import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { WebSocketServer } from 'ws'
import { Client } from 'ssh2'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'ssh-proxy',
      configureServer(server) {
        const wss = new WebSocketServer({ noServer: true });

        server.httpServer?.on('upgrade', (req, sock, head) => {
          if (!req.url?.startsWith('/ws/ssh')) return;
          const u = new URL(req.url, `http://${req.headers.host}`);
          const target = u.searchParams.get('target') || '';
          const parts = target.split(':');
          const targetHost = parts[0] || '127.0.0.1';
          const targetPort = parseInt(parts[1]) || 22;
          const sshUser = u.searchParams.get('user') || 'root';
          const sshPass = u.searchParams.get('password') || 'CherryYoudao';

          wss.handleUpgrade(req, sock as any, head, (ws) => {
            let sshClient: Client | null = null;
            let sftpSession: any = null;
            let shellStream: any = null;

            const send = (data: any) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data)); };
            const sendData = (type: string, payload: any) => send({ type, ...payload });

            function openShell(cb: (err?: Error) => void) {
              if (!sshClient) return cb(new Error('SSH 未连接'));
              sshClient.shell({ term: 'xterm', cols: 90, rows: 30 }, (err, stream) => {
                if (err) return cb(err);
                shellStream = stream;
                stream.on('data', (d: Buffer) => sendData('shell_data', { data: d.toString('utf-8') }));
                stream.stderr?.on('data', (d: Buffer) => sendData('shell_data', { data: d.toString('utf-8') }));
                stream.on('close', () => { shellStream = null; sendData('shell_close', {}); });
                cb();
              });
            }

            // ── 连接 ──
            sshClient = new Client();
            sshClient.on('ready', () => {
              sendData('connect_result', { ok: true });
              // 自动打开交互式 shell
              openShell((err) => {
                if (err) sendData('shell_data', { data: `\r\n[shell 启动失败: ${err.message}]\r\n` });
              });
            });
            sshClient.on('error', (err) => sendData('connect_result', { ok: false, msg: err.message }));
            sshClient.on('close', () => { sftpSession = null; shellStream = null; });
            sshClient.connect({ host: targetHost, port: targetPort, username: sshUser, password: sshPass, readyTimeout: 15000 });

            // ── 消息处理 ──
            ws.on('message', (raw: Buffer) => {
              let msg: any;
              try { msg = JSON.parse(raw.toString()); } catch { return; }

              switch (msg.type) {
                // 交互式 shell 输入（直接写入 PTY）
                case 'shell_input':
                  if (shellStream) shellStream.write(msg.data);
                  break;

                // 调整终端尺寸
                case 'shell_resize':
                  if (shellStream) shellStream.setWindow(msg.rows || 30, msg.cols || 90);
                  break;

                // 单条命令执行（用于脚本/自动化）
                case 'exec':
                  if (!sshClient) return sendData('error', { id: msg.id, msg: 'SSH 未连接' });
                  sshClient.exec(msg.cmd, (err, stream) => {
                    if (err) return sendData('error', { id: msg.id, msg: err.message });
                    let output = '';
                    stream.on('data', (d: Buffer) => { output += d.toString(); });
                    stream.stderr.on('data', (d: Buffer) => { output += d.toString(); });
                    stream.on('close', (code: number | null) => sendData('output', { id: msg.id, data: output.trim(), code }));
                  });
                  break;

                // 在独立交互式 shell 里跑脚本，按行流式回传输出。
                // 设备 SSH 的 exec 通道不走 shell（&&/cd/unzip 失效），但交互式
                // shell 正常 —— PenMods 安装这类需要真实 shell 的脚本走这里。
                case 'shell_exec': {
                  if (!sshClient) return sendData('error', { id: msg.id, msg: 'SSH 未连接' });
                  const marker = '__PM_DONE_' + msg.id + '__';
                  sshClient.shell({ term: 'dumb', cols: 200, rows: 50 }, (err, stream) => {
                    if (err) return sendData('error', { id: msg.id, msg: err.message });
                    let buf = '';
                    let exitCode = 0;
                    let finished = false;
                    const finish = () => {
                      if (finished) return;
                      finished = true;
                      sendData('shell_exec_result', { id: msg.id, code: exitCode });
                      try { stream.end(); } catch { /* 已关闭 */ }
                    };
                    const onChunk = (d: Buffer) => {
                      buf += d.toString('utf-8');
                      let nl: number;
                      while ((nl = buf.indexOf('\n')) >= 0) {
                        const line = buf.slice(0, nl);
                        buf = buf.slice(nl + 1);
                        const mi = line.indexOf(marker);
                        if (mi >= 0) {
                          const m = line.slice(mi + marker.length).match(/:(\d+)/);
                          if (m) exitCode = parseInt(m[1]);
                          return finish();
                        }
                        sendData('shell_exec_data', { id: msg.id, data: line + '\n' });
                      }
                    };
                    stream.on('data', onChunk);
                    stream.stderr?.on('data', onChunk);
                    stream.on('close', () => finish());
                    // 写入脚本，最后打印「标记:退出码」作为结束哨兵
                    stream.write(msg.script + '\n');
                    stream.write('echo ' + marker + ':$?\n');
                    stream.write('exit\n');
                  });
                  break;
                }

                // SFTP 操作
                case 'sftp_readdir':
                case 'sftp_read':
                case 'sftp_write':
                case 'sftp_delete':
                case 'sftp_rename':
                case 'sftp_mkdir':
                case 'sftp_rmdir': {
                  const sftpOp = (err: any, sftp: any) => {
                    if (err) return sendData('error', { id: msg.id, msg: err.message });
                    sftpOpMap[msg.type](sftp, msg, (err2: any, result?: any) => {
                      if (err2) return sendData('error', { id: msg.id, msg: err2.message });
                      sendData('sftp_result', { id: msg.id, ...result });
                    });
                  };
                  if (sftpSession) return sftpOp(null, sftpSession);
                  if (!sshClient) return sendData('error', { id: msg.id, msg: 'SSH 未连接' });
                  sshClient.sftp((err, sftp) => {
                    if (err) return sendData('error', { id: msg.id, msg: err.message });
                    sftpSession = sftp;
                    sftpOp(null, sftp);
                  });
                  break;
                }
              }
            });

            ws.on('close', () => { sshClient?.end(); sftpSession = null; shellStream = null; });
          });
        });

        console.log('[ssh-proxy] ✅ 内置 SSH 代理就绪');
      },
    },
  ],
  base: './',
  server: {
    host: '0.0.0.0', port: 5173, open: false,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; font-src 'self' data:;",
    },
  },
});

// ── SFTP 操作映射 ──
const sftpOpMap: Record<string, (sftp: any, msg: any, cb: Function) => void> = {
  sftp_readdir(sftp, msg, cb) {
    sftp.readdir(msg.path, (err: any, list: any[]) => {
      if (err) return cb(err);
      cb(null, { files: list.map((e: any) => ({
        name: e.filename, isDir: e.attrs.isDirectory(), isSymlink: e.attrs.isSymbolicLink(),
        sizeBytes: Number(e.attrs.size), mtime: Math.floor(Number(e.attrs.mtime)),
      })) });
    });
  },
  sftp_read(sftp, msg, cb) {
    sftp.readFile(msg.path, (err: any, data: Buffer) => {
      if (err) return cb(err);
      cb(null, { data: data.toString('base64'), isBase64: true });
    });
  },
  sftp_write(sftp, msg, cb) {
    sftp.writeFile(msg.path, Buffer.from(msg.data, 'base64'), (err: any) => cb(err, { ok: !err }));
  },
  sftp_delete(sftp, msg, cb) {
    sftp.unlink(msg.path, (err: any) => cb(err, { ok: !err }));
  },
  sftp_rename(sftp, msg, cb) {
    sftp.rename(msg.oldPath, msg.newPath, (err: any) => cb(err, { ok: !err }));
  },
  sftp_mkdir(sftp, msg, cb) {
    sftp.mkdir(msg.path, (err: any) => cb(err, { ok: !err }));
  },
  sftp_rmdir(sftp, msg, cb) {
    sftp.rmdir(msg.path, (err: any) => cb(err, { ok: !err }));
  },
};
