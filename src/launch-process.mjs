import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

export function launchArguments(port) {
  return [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'];
}

export async function allocatePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

export function startApp(executable, port) {
  const child = spawn(executable, launchArguments(port), { stdio: 'ignore' });
  const exited = new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', () => reject(new Error('Antigravity 无法启动，请核对应用路径。')));
  });
  child.unref();
  return { child, exited };
}
