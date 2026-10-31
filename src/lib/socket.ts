import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') || '' : '');
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';

  if (!socket) {
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
      auth: { token: authToken },
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  } else if (authToken) {
    socket.auth = { token: authToken };
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
}
