import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') || '' : '');

  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token: authToken },
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  } else if (authToken) {
    socket.auth = { token: authToken };
  }
  return socket;
}
