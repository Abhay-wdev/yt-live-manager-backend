import { Server } from 'socket.io';

class SocketService {
  private io: Server | null = null;

  public init(io: Server) {
    this.io = io;
  }

  public getIO() {
    if (!this.io) {
      throw new Error('Socket.io is not initialized');
    }
    return this.io;
  }
}

export default new SocketService();
