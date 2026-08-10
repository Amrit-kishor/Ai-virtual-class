// src/lib/videoBackgroundProcessor.ts
// Production-grade client-side real-time video background processor for WebRTC:
// Supports 'original', 'blur', 'remove' (Show Only Me), and 'virtual' modes using MediaPipe SelfieSegmentation & Canvas 2D compositing.

export type BackgroundMode = 'original' | 'blur' | 'remove' | 'virtual';

export interface BackgroundProcessorState {
  mode: BackgroundMode;
  virtualImageSrc: string | null;
  isProcessing: boolean;
  error: string | null;
}

export const PRESET_VIRTUAL_BACKGROUNDS = [
  {
    id: 'modern_office',
    name: 'Modern Office',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80',
    full: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1280&q=85',
  },
  {
    id: 'cozy_library',
    name: 'Academic Library',
    thumbnail: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=400&q=80',
    full: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1280&q=85',
  },
  {
    id: 'minimal_loft',
    name: 'Minimalist Studio',
    thumbnail: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
    full: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1280&q=85',
  },
  {
    id: 'cyber_classroom',
    name: 'Cyber Classroom',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
    full: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=85',
  },
];

export class VideoBackgroundProcessor {
  private mode: BackgroundMode = 'original';
  private virtualImage: HTMLImageElement | null = null;
  private virtualImageSrc: string | null = null;

  // Processing DOM Nodes (Offscreen)
  private inputVideo: HTMLVideoElement | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputCtx: CanvasRenderingContext2D | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;

  private inputStream: MediaStream | null = null;
  private outputStream: MediaStream | null = null;
  private selfieSegmentation: any = null;
  private animationFrameId: number | null = null;
  private isModelReady = false;
  private isProcessingFrame = false;
  private isDestroyed = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initOffscreenNodes();
    }
  }

  private initOffscreenNodes() {
    if (this.outputCanvas || typeof document === 'undefined') return;

    // 1. Offscreen Input Video element
    this.inputVideo = document.createElement('video');
    this.inputVideo.autoplay = true;
    this.inputVideo.playsInline = true;
    this.inputVideo.muted = true;
    this.inputVideo.style.position = 'fixed';
    this.inputVideo.style.top = '-9999px';
    this.inputVideo.style.left = '-9999px';
    this.inputVideo.style.opacity = '0';
    this.inputVideo.style.pointerEvents = 'none';
    this.inputVideo.width = 640;
    this.inputVideo.height = 360;
    document.body.appendChild(this.inputVideo);

    // 2. Offscreen Output Canvas (640x360 for high 30 FPS throughput)
    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = 640;
    this.outputCanvas.height = 360;
    this.outputCtx = this.outputCanvas.getContext('2d', { willReadFrequently: false, alpha: false });

    // 3. Mask Compositing Canvas
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = 640;
    this.maskCanvas.height = 360;
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: false });
  }

  private async loadScript(src: string): Promise<void> {
    if (typeof document === 'undefined') return;
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  public async initModel(): Promise<void> {
    if (this.selfieSegmentation || typeof window === 'undefined') return;

    try {
      let SelfieSegmentationConstructor: any = null;

      // 1. Try ESM / CJS module import
      try {
        const mpModule: any = await import('@mediapipe/selfie_segmentation');
        SelfieSegmentationConstructor =
          mpModule.SelfieSegmentation ||
          mpModule.default?.SelfieSegmentation ||
          (window as any).SelfieSegmentation;
      } catch (importErr) {
        console.warn('[VideoBackgroundProcessor] Module import failed, trying CDN script fallback:', importErr);
      }

      // 2. Try global window from CDN script if module import didn't expose constructor
      if (!SelfieSegmentationConstructor) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
        SelfieSegmentationConstructor = (window as any).SelfieSegmentation;
      }

      if (!SelfieSegmentationConstructor) {
        throw new Error('SelfieSegmentation constructor could not be resolved from package or CDN.');
      }

      this.selfieSegmentation = new SelfieSegmentationConstructor({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      this.selfieSegmentation.setOptions({
        modelSelection: 1, // 1 = Landscape mode (desktop webcam)
        selfieMode: false,
      });

      this.selfieSegmentation.onResults(this.handleSegmentationResults.bind(this));
      await this.selfieSegmentation.initialize();
      this.isModelReady = true;
      console.log('[VideoBackgroundProcessor] MediaPipe SelfieSegmentation initialized successfully');
    } catch (err) {
      console.warn('[VideoBackgroundProcessor] Model initialization error:', err);
      this.isModelReady = false;
    }
  }

  public setMode(mode: BackgroundMode, virtualImageSrc?: string | null): void {
    this.mode = mode;
    if (virtualImageSrc) {
      this.setVirtualImage(virtualImageSrc);
    }
    console.log(`[VideoBackgroundProcessor] Mode updated to: "${mode}"`);
  }

  public setVirtualImage(src: string): void {
    this.virtualImageSrc = src;
    if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.virtualImage = img;
        console.log('[VideoBackgroundProcessor] Virtual background image loaded');
      };
      img.onerror = (e) => {
        console.warn('[VideoBackgroundProcessor] Virtual image failed to load:', e);
      };
      img.src = src;
    }
  }

  public getMode(): BackgroundMode {
    return this.mode;
  }

  public async start(cameraStream: MediaStream): Promise<MediaStream> {
    this.inputStream = cameraStream;
    this.isDestroyed = false;

    if (!this.inputVideo || !this.outputCanvas) {
      this.initOffscreenNodes();
    }

    if (this.inputVideo) {
      this.inputVideo.srcObject = cameraStream;
      await this.inputVideo.play().catch(console.warn);
    }

    // Lazy load model if not yet initialized
    if (!this.isModelReady) {
      await this.initModel().catch(console.warn);
    }

    // Capture processed video stream from offscreen canvas at 30 FPS
    if (this.outputCanvas) {
      if ('captureStream' in this.outputCanvas) {
        this.outputStream = this.outputCanvas.captureStream(30);
      } else if ('mozCaptureStream' in this.outputCanvas) {
        this.outputStream = (this.outputCanvas as any).mozCaptureStream(30);
      }
    }

    // Start frame processing loop
    this.startProcessingLoop();

    return this.outputStream || cameraStream;
  }

  private startProcessingLoop() {
    if (this.isDestroyed) return;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const processFrame = async () => {
      if (this.isDestroyed) return;

      if (this.inputVideo && this.inputVideo.readyState >= 2 && !this.inputVideo.paused) {
        if (this.selfieSegmentation && this.isModelReady && this.mode !== 'original') {
          if (!this.isProcessingFrame) {
            this.isProcessingFrame = true;
            try {
              await this.selfieSegmentation.send({ image: this.inputVideo });
            } catch (e) {
              // On frame error, render raw frame to prevent black video
              this.drawDirectFrame();
            } finally {
              this.isProcessingFrame = false;
            }
          }
        } else {
          this.drawDirectFrame();
        }
      }

      this.animationFrameId = requestAnimationFrame(processFrame);
    };

    this.animationFrameId = requestAnimationFrame(processFrame);
  }

  private drawDirectFrame() {
    if (!this.outputCtx || !this.outputCanvas || !this.inputVideo) return;
    const { width, height } = this.outputCanvas;

    this.outputCtx.save();
    this.outputCtx.filter = 'none';
    this.outputCtx.globalCompositeOperation = 'source-over';
    this.outputCtx.drawImage(this.inputVideo, 0, 0, width, height);
    this.outputCtx.restore();
  }

  private handleSegmentationResults(results: any) {
    if (!this.outputCtx || !this.outputCanvas || !this.maskCtx || !this.maskCanvas || !results.image) {
      return;
    }

    const { width, height } = this.outputCanvas;

    // Synchronize mask canvas size
    if (this.maskCanvas.width !== width || this.maskCanvas.height !== height) {
      this.maskCanvas.width = width;
      this.maskCanvas.height = height;
    }

    // 1. ORIGINAL MODE: Draw camera directly
    if (this.mode === 'original') {
      this.outputCtx.save();
      this.outputCtx.filter = 'none';
      this.outputCtx.globalCompositeOperation = 'source-over';
      this.outputCtx.drawImage(results.image, 0, 0, width, height);
      this.outputCtx.restore();
      return;
    }

    // 2. Extract Person Foreground onto Mask Canvas
    this.maskCtx.save();
    this.maskCtx.clearRect(0, 0, width, height);
    // Draw segmentation mask (white person, black background)
    this.maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
    // Clip with input camera image so mask canvas has ONLY the sharp person
    this.maskCtx.globalCompositeOperation = 'source-in';
    this.maskCtx.drawImage(results.image, 0, 0, width, height);
    this.maskCtx.restore();

    // 3. Render Desired Background Mode onto Main Canvas
    this.outputCtx.save();

    if (this.mode === 'blur') {
      // Background Layer: Blurred camera frame
      this.outputCtx.filter = 'blur(14px)';
      this.outputCtx.drawImage(results.image, 0, 0, width, height);
      this.outputCtx.filter = 'none';
    } else if (this.mode === 'remove') {
      // Background Layer: Studio neutral dark gradient (Show Only Me)
      const grad = this.outputCtx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#090d16');
      this.outputCtx.fillStyle = grad;
      this.outputCtx.fillRect(0, 0, width, height);

      // Subtle ambient studio backlight
      const radial = this.outputCtx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width / 1.5);
      radial.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
      radial.addColorStop(1, 'rgba(9, 13, 22, 0)');
      this.outputCtx.fillStyle = radial;
      this.outputCtx.fillRect(0, 0, width, height);
    } else if (this.mode === 'virtual') {
      if (this.virtualImage && this.virtualImage.complete) {
        // Draw virtual image with cover aspect ratio
        this.drawImageCover(this.outputCtx, this.virtualImage, 0, 0, width, height);
      } else {
        // Fallback stylish dark slate background while image loads
        this.outputCtx.fillStyle = '#1e293b';
        this.outputCtx.fillRect(0, 0, width, height);
      }
    }

    // 4. Foreground Layer: Draw sharp extracted person on top
    this.outputCtx.globalCompositeOperation = 'source-over';
    this.outputCtx.drawImage(this.maskCanvas, 0, 0, width, height);

    this.outputCtx.restore();
  }

  private drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;
    let sWidth = img.width;
    let sHeight = img.height;
    let sx = 0;
    let sy = 0;

    if (imgRatio > canvasRatio) {
      sWidth = img.height * canvasRatio;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width / canvasRatio;
      sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
  }

  public getProcessedTrack(): MediaStreamTrack | null {
    if (this.mode === 'original' && this.inputStream) {
      return this.inputStream.getVideoTracks()[0] || null;
    }
    return this.outputStream?.getVideoTracks()[0] || this.inputStream?.getVideoTracks()[0] || null;
  }

  public getProcessedStream(): MediaStream | null {
    if (this.mode === 'original' && this.inputStream) {
      return this.inputStream;
    }
    return this.outputStream || this.inputStream;
  }

  public stop(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.outputStream) {
      this.outputStream.getTracks().forEach((t) => t.stop());
      this.outputStream = null;
    }

    if (this.inputVideo) {
      this.inputVideo.srcObject = null;
      this.inputVideo.remove();
      this.inputVideo = null;
    }

    this.outputCanvas = null;
    this.outputCtx = null;
    this.maskCanvas = null;
    this.maskCtx = null;
  }
}
