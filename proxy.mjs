#!/usr/bin/env node
/**
 * WebSocket ⇄ SSH 代理服务器
 * 浏览器无法直连 SSH，通过此代理桥接 WebSocket ↔ SSH(SFTP)
 *
 * 用法: node proxy.mjs <设备IP> [端口] [SSH端口]
 * 默认: node proxy.mjs 192.168.x.x 8022 22
 *
 * 协议: JSON 消息 over WebSocket
 *   → {"type":"exec","id":"1","cmd":"ls"}
 *   ← {"type":"output","id":"1","data":"..."}
 *   ← {"type":"exit","id":"1","code":0}
 *
 *   → {"type":"sftp_readdir","id":"2","path":"/"}
 *   ← {"type":"sftp_result","id":"2","files":[...]}
 */

import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';
import { readFileSync, existsSync } from 'fs';

const targetHost = process.argv[2];
if (!targetHost) {
  console.log('用法: node proxy.mjs <设备IP> [WebSocket端口] [SSH端口]');
  console.log('示例: node proxy.mjs 192.168.2.100');
  process.exit(1);
}
const wsPort = parseInt(process.argv[3]) || 8022;
const sshPort = parseInt(process.argv[4]) || 22;

// 从 env 或命令行参数读取 SSH 凭据
const SSH_USER = process.env.SSH_USER || 'root';
const SSH_PASS = process.env.SSH_PASS || 'CherryYoudao';

const wss = new WebSocketServer({ port: wsPort });
console.log(`[proxy] WebSocket 代理已启动: ws://0.0.0.0:${wsPort}`);
console.log(`[proxy] 目标 SSH: ${targetHost}:${sshPort}`);
console.log(`[proxy] 用户名: ${SSH_USER}`);
console.log('');

let sshClient = new Client();
let sshReady = false;

function connectSSH(cb) {
  if (sshReady) return cb(null);

  sshClient = new Client();
  sshClient.on('ready', () => {
    sshReady = true;
    console.log('[proxy] SSH 已连接');
    cb(null);
  });
  sshClient.on('error', (err) => {
    sshReady = false;
    console.error('[proxy] SSH 错误:', err.message);
    cb(err);
  });
  sshClient.on('close', () => {
    sshReady = false;
    console.log('[proxy] SSH 连接已关闭');
  });

  sshClient.connect({
    host: targetHost,
    port: sshPort,
    username: SSH_USER,
    password: SSH_PASS,
    readyTimeout: 10000,
  });
}

/** 执行单条命令 */
function execCmd(cmd, cb) {
  sshClient.exec(cmd, (err, stream) => {
    if (err) return cb(err);
    let output = '';
    stream.on('data', (d) => { output += d.toString(); });
    stream.stderr.on('data', (d) => { output += d.toString(); });
    stream.on('close', (code) => {
      cb(null, output.trim(), code);
    });
  });
}

/** SFTP 操作 */
let sftpSession = null;
function getSFTP(cb) {
  if (sftpSession) return cb(null, sftpSession);
  sshClient.sftp((err, sftp) => {
    if (err) return cb(err);
    sftpSession = sftp;
    cb(null, sftp);
  });
}

/** 读目录 */
function sftpReaddir(path, cb) {
  getSFTP((err, sftp) => {
    if (err) return cb(err);
    sftp.readdir(path, (err, list) => {
      if (err) return cb(err);
      const files = list.map(e => ({
        name: e.filename,
        isDir: e.attrs.isDirectory(),
        isSymlink: e.attrs.isSymbolicLink(),
        sizeBytes: e.attrs.size,
        mtime: Math.floor(e.attrs.mtime),
      }));
      cb(null, files);
    });
  });
}

/** 读文件（返回 base64） */
function sftpReadFile(path, cb) {
  getSFTP((err, sftp) => {
    if (err) return cb(err);
    sftp.readFile(path, (err, data) => {
      if (err) return cb(err);
      cb(null, data.toString('base64'));
    });
  });
}

/** 写文件 */
function sftpWriteFile(path, dataBase64, cb) {
  getSFTP((err, sftp) => {
    if (err) return cb(err);
    sftp.writeFile(path, Buffer.from(dataBase64, 'base64'), cb);
  });
}

/** 删除 */
function sftpDelete(path, cb) {
  getSFTP((err, sftp) => {
    if (err) return cb(err);
    sftp.unlink(path, cb);
  });
}

/** 重命名 */
function sftpRename(oldPath, newPath, cb) {
  getSFTP((err, sftp) => {
    if (err) return cb(err);
    sftp.rename(oldPath, newPath, cb);
  });
}

/** 创建目录 */
function sftpMkdir(path, cb) {
  getSFTP((err, sftp) => {
    if (err) return cb(err);
    sftp.mkdir(path, cb);
  });
}

/** 删除目录 */
function sftpRmdir(path, cb) {
  getSFTP((err, sftp) => {
    if (err) return cb(err);
    sftp.rmdir(path, cb);
  });
}

// ── WebSocket 连接处理 ──

wss.on('connection', (ws) => {
  console.log('[proxy] 浏览器已连接');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return ws.send(JSON.stringify({ type: 'error', id: '', msg: '无效的 JSON' }));
    }

    const send = (data) => ws.send(JSON.stringify(data));

    switch (msg.type) {
      // ── SSH 连接 ──
      case 'connect': {
        connectSSH((err) => {
          if (err) return send({ type: 'connect_result', id: msg.id, ok: false, msg: err.message });
          send({ type: 'connect_result', id: msg.id, ok: true });
        });
        break;
      }

      // ── 执行命令 ──
      case 'exec': {
        if (!sshReady) return send({ type: 'error', id: msg.id, msg: 'SSH 未连接' });
        execCmd(msg.cmd, (err, output, code) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'output', id: msg.id, data: output, code });
        });
        break;
      }

      // ── SFTP ──
      case 'sftp_readdir': {
        sftpReaddir(msg.path, (err, files) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'sftp_result', id: msg.id, files });
        });
        break;
      }

      case 'sftp_read': {
        sftpReadFile(msg.path, (err, data) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'sftp_result', id: msg.id, data, isBase64: true });
        });
        break;
      }

      case 'sftp_write': {
        sftpWriteFile(msg.path, msg.data, (err) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'sftp_result', id: msg.id, ok: true });
        });
        break;
      }

      case 'sftp_delete': {
        sftpDelete(msg.path, (err) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'sftp_result', id: msg.id, ok: true });
        });
        break;
      }

      case 'sftp_rename': {
        sftpRename(msg.oldPath, msg.newPath, (err) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'sftp_result', id: msg.id, ok: true });
        });
        break;
      }

      case 'sftp_mkdir': {
        sftpMkdir(msg.path, (err) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'sftp_result', id: msg.id, ok: true });
        });
        break;
      }

      case 'sftp_rmdir': {
        sftpRmdir(msg.path, (err) => {
          if (err) return send({ type: 'error', id: msg.id, msg: err.message });
          send({ type: 'sftp_result', id: msg.id, ok: true });
        });
        break;
      }

      default:
        send({ type: 'error', id: msg.id, msg: '未知命令: ' + msg.type });
    }
  });

  ws.on('close', () => {
    console.log('[proxy] 浏览器已断开');
    // 不关闭 SSH，允许重连
  });
});
