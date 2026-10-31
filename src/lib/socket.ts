import { io, Socket } from 'socket.io-client';
import { safeFetchJson } from './utils';

let socket: Socket | null = null;
let currentSocketToken: string | null = null;
let isRefreshingToken = false;

/**
 * Request a short-lived (10-minute) Socket.IO authentication token from the backend.
 * Uses the browser's HTTP-only session cookie automatically via the Vercel-to-Render proxy.
 */
export async function fetchSocketToken(): Promise<string | null> {
  try {
    const res = await safeFetchJson<{ socketToken: string; expiresIn: number }>('/api/auth/socket-token', {
      method: 'POST',
    });

    if (res.ok && res.data?.socketToken) {
      currentSocketToken = res.data.socketToken;
      return res.data.socketToken;
    }

    if (res.status === 401) {
      console.warn('[Socket Auth] User session missing or unauthenticated. Cannot obtain socket token.');
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Socket Auth] Error fetching short-lived socket token:', err);
    }
  }
  return null;
}

/**
 * Sets or updates the socket authentication token in memory.
 */
export function setSocketAuthToken(token: string): void {
  currentSocketToken = token;
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }
}

/**
 * Returns the singleton Socket.IO client instance configured for the Render backend.
 * Does NOT depend on localStorage for authentication tokens.
 */
export function getSocket(explicitToken?: string): Socket {
  if (explicitToken) {
    currentSocketToken = explicitToken;
  }

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';

  if (!socket) {
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: false, // Explicit connection once token is available
      withCredentials: true,
      auth: (cb) => {
        // Socket.IO dynamic auth callback: provides the latest token on every connection/reconnection
        if (currentSocketToken) {
          cb({ token: currentSocketToken });
        } else {
          // If no token is cached in memory, fetch one dynamically
          fetchSocketToken()
            .then((newToken) => {
              if (newToken) {
                cb({ token: newToken });
              } else {
                cb({ token: '' });
              }
            })
            .catch(() => cb({ token: '' }));
        }
      },
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket.IO connected] Successfully authenticated. Socket ID: ${socket?.id}`);
      }
    });

    socket.on('connect_error', async (err: Error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Socket.IO connect_error] ${err.message}`);
      }

      // Handle token expiration or auth rejection: fetch fresh token and reconnect safely
      const isAuthError =
        err.message.includes('Authentication Error') ||
        err.message.includes('Missing Token') ||
        err.message.includes('Invalid Token') ||
        err.message.includes('jwt');

      if (isAuthError && !isRefreshingToken) {
        isRefreshingToken = true;
        try {
          console.info('[Socket.IO] Authentication token expired or invalid. Requesting fresh token...');
          const freshToken = await fetchSocketToken();
          if (freshToken && socket) {
            currentSocketToken = freshToken;
            socket.auth = { token: freshToken };
            socket.connect();
          }
        } finally {
          isRefreshingToken = false;
        }
      }
    });

    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket.IO disconnected] Reason: ${reason}`);
      }
    });

    // If an explicit token was already available, start connecting
    if (currentSocketToken) {
      socket.connect();
    }
  } else if (explicitToken) {
    socket.auth = { token: explicitToken };
    if (!socket.connected) {
      socket.connect();
    }
  }

  return socket;
}

/**
 * Disconnects and cleans up the active socket connection.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentSocketToken = null;
  }
}
