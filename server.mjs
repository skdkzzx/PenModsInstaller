#!/usr/bin/env node
/**
 * PenMods Installer — 生产环境服务器
 *
 * 同时提供:
 *   1. 静态文件服务 (dist/)
 *   2. WebSocket SSH 代理 (与 Vite 开发插件相同的能力)
 *
 * 用法:
 *   node server.mjs [端口] [SSH密码]
 *   默认端口: 8022
 *   默认密码: CherryYoudao
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2]) || 8022;
const DEFAULT_SSH_PASS = process.env.DEFAULT_SSH_PASS || process.argv[3] || 'CherryYoudao';

const DIST_DIR = path.join(__dirname, 'dist');

// ── MIME 类型 ──
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ── HTTP 服务：静态文件 ──
const httpServer = http.createServer((req, res) => {
  // 只处理 GET 请求
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end();
  }

  let urlPath = req.url?.split('?')[0] || '/';
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.join(DIST_DIR, urlPath);

  // 安全检查：防止路径遍历
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA 回退：未找到文件时返回 index.html
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, fallback) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; font-src 'self' data:;",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
    res.end(data);
  });
});

// ── WebSocket SSH 代理 ──
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, sock, head) => {
  if (!req.url?.startsWith('/ws/ssh')) {
    sock.destroy();
    return;
  }

  const u = new URL(req.url, `http://${req.headers.host}`);
  const target = u.searchParams.get('target') || '';
  const parts = target.split(':');
  const targetHost = parts[0] || '127.0.0.1';
  const targetPort = parseInt(parts[1]) || 22;
  const sshUser = u.searchParams.get('user') || 'root';
  const sshPass = u.searchParams.get('password') || DEFAULT_SSH_PASS;

  wss.handleUpgrade(req, sock, head, (ws) => {
    let sshClient = new Client();
    let sftpSession = null;
    let shellStream = null;

    const send = (data) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data)); };
    const sendData = (type, payload) => send({ type, ...payload });

    // ── 打开交互式 shell ──
    function openShell(cb) {
      sshClient.shell({ term: 'xterm', cols: 90, rows: 30 }, (err, stream) => {
        if (err) return cb(err);
        shellStream = stream;
        stream.on('data', (d) => sendData('shell_data', { data: d.toString('utf-8') }));
        stream.stderr?.on('data', (d) => sendData('shell_data', { data: d.toString('utf-8') }));
        stream.on('close', () => { shellStream = null; sendData('shell_close', {}); });
        cb();
      });
    }

    // ── SSH 连接 ──
    sshClient.on('ready', () => {
      sendData('connect_result', { ok: true });
      openShell((err) => {
        if (err) sendData('shell_data', { data: `\r\n[shell 启动失败: ${err.message}]\r\n` });
      });
    });
    sshClient.on('error', (err) => sendData('connect_result', { ok: false, msg: err.message }));
    sshClient.on('close', () => { sftpSession = null; shellStream = null; });

    sshClient.connect({
      host: targetHost,
      port: targetPort,
      username: sshUser,
      password: sshPass,
      readyTimeout: 15000,
    });

    // ── 消息处理 ──
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {
        // 交互式 shell 输入
        case 'shell_input':
          if (shellStream) shellStream.write(msg.data);
          break;

        // 调整终端尺寸
        case 'shell_resize':
          if (shellStream) shellStream.setWindow(msg.rows || 30, msg.cols || 90);
          break;

        // 单条命令执行
        case 'exec':
          sshClient.exec(msg.cmd, (err, stream) => {
            if (err) return sendData('error', { id: msg.id, msg: err.message });
            let output = '';
            stream.on('data', (d) => { output += d.toString(); });
            stream.stderr.on('data', (d) => { output += d.toString(); });
            stream.on('close', (code) => sendData('output', { id: msg.id, data: output.trim(), code }));
          });
          break;

        // 在交互式 shell 里跑脚本（流式回传）
        case 'shell_exec': {
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
            const onChunk = (d) => {
              buf += d.toString('utf-8');
              let nl;
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
          const sftpOp = (err, sftp) => {
            if (err) return sendData('error', { id: msg.id, msg: err.message });
            sftpOpMap[msg.type](sftp, msg, (err2, result) => {
              if (err2) return sendData('error', { id: msg.id, msg: err2.message });
              sendData('sftp_result', { id: msg.id, ...result });
            });
          };
          if (sftpSession) return sftpOp(null, sftpSession);
          sshClient.sftp((err, sftp) => {
            if (err) return sendData('error', { id: msg.id, msg: err.message });
            sftpSession = sftp;
            sftpOp(null, sftp);
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      sshClient.end();
      sftpSession = null;
      shellStream = null;
    });
  });
});

// ── 启动 ──
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('============================================');
  console.log('  PenMods Installer — 生产服务器');
  console.log('============================================');
  console.log(`  地址: http://0.0.0.0:${PORT}`);
  console.log(`  默认 SSH 密码: ${DEFAULT_SSH_PASS}`);
  console.log(`  静态文件: ${DIST_DIR}`);
  console.log('============================================');
  console.log('  浏览器访问后，SSH 代理 WebSocket 自动就绪');
  console.log('============================================');
});

// ── SFTP 操作映射 ──
const sftpOpMap = {
  sftp_readdir(sftp, msg, cb) {
    sftp.readdir(msg.path, (err, list) => {
      if (err) return cb(err);
      cb(null, { files: list.map(e => ({
        name: e.filename, isDir: e.attrs.isDirectory(), isSymlink: e.attrs.isSymbolicLink(),
        sizeBytes: Number(e.attrs.size), mtime: Math.floor(Number(e.attrs.mtime)),
      })) });
    });
  },
  sftp_read(sftp, msg, cb) {
    sftp.readFile(msg.path, (err, data) => {
      if (err) return cb(err);
      cb(null, { data: data.toString('base64'), isBase64: true });
    });
  },
  sftp_write(sftp, msg, cb) {
    sftp.writeFile(msg.path, Buffer.from(msg.data, 'base64'), (err) => cb(err, { ok: !err }));
  },
  sftp_delete(sftp, msg, cb) {
    sftp.unlink(msg.path, (err) => cb(err, { ok: !err }));
  },
  sftp_rename(sftp, msg, cb) {
    sftp.rename(msg.oldPath, msg.newPath, (err) => cb(err, { ok: !err }));
  },
  sftp_mkdir(sftp, msg, cb) {
    sftp.mkdir(msg.path, (err) => cb(err, { ok: !err }));
  },
  sftp_rmdir(sftp, msg, cb) {
    sftp.rmdir(msg.path, (err) => cb(err, { ok: !err }));
  },
};