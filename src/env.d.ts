declare module 'ws' {
  import { Server } from 'http';
  import { EventEmitter } from 'events';

  class WebSocket extends EventEmitter {
    static Server: typeof WebSocketServer;
    readyState: number;
    readonly OPEN: 1;
    send(data: any): void;
    close(): void;
    on(event: string, listener: (...args: any[]) => void): this;
    terminate(): void;
  }

  class WebSocketServer {
    constructor(opts?: { noServer?: boolean; port?: number });
    on(event: 'connection', listener: (ws: WebSocket) => void): this;
    handleUpgrade(
      req: any,
      sock: any,
      head: any,
      cb: (ws: WebSocket) => void,
    ): void;
  }

  export { WebSocketServer };
  export default WebSocket;
}
