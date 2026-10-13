export class CdpClient {
  #socket;
  #pending = new Map();
  #sequence = 0;

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', event => this.#receive(event));
    socket.addEventListener('close', () => this.#rejectPending());
    socket.addEventListener('error', () => this.#rejectPending());
  }

  static async connect(url, timeout = 5000) {
    const socket = new WebSocket(url);
    const client = new CdpClient(socket);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('汉化连接超时。'));
      }, timeout);
      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('无法连接应用汉化通道。'));
      }, { once: true });
    });
    return client;
  }

  call(method, params = {}, timeout = 5000) {
    if (this.#socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('应用汉化连接已关闭。'));
    }
    const id = ++this.#sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error('应用未及时回应汉化请求。'));
      }, timeout);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  get isOpen() { return this.#socket.readyState === WebSocket.OPEN; }

  close() {
    this.#rejectPending();
    this.#socket.close();
  }

  #receive(event) {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(message.id);
    if (message.error) pending.reject(new Error('应用拒绝了汉化请求。'));
    else pending.resolve(message.result ?? {});
  }

  #rejectPending() {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('应用汉化连接已关闭。'));
    }
    this.#pending.clear();
  }
}
