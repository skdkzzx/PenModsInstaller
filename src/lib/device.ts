/**
 * 设备连接抽象接口
 * ADB（WebUSB）和 SSH 两种连接方式统一实现此接口，
 * 上层（插件安装等）不关心底层协议。
 */

export interface RemoteFileEntry {
  name: string;
  isDir: boolean;
  isSymlink: boolean;
  sizeBytes: number;
  mtime: number;
  mode: number;
  permission: number;
}

export interface DeviceConnection {
  shellCommand(cmd: string): Promise<string>;
  shellScript(script: string): Promise<string>;
  pushFile(data: Uint8Array, remotePath: string): Promise<void>;
  readDir(path: string): Promise<RemoteFileEntry[]>;
  readFile?(path: string): Promise<Uint8Array>;
  /**
   * 标记此连接的 device-side shell（exec 通道）不可靠 —— SSH 模式即如此：
   * 设备 SSH server 的 exec 不走 shell（&&、cd、unzip、重定向均失效），
   * 上层应改用纯 SFTP 路径（mkdirp/pushFile/removeDir）完成操作。
   */
  noShell?: boolean;
  /** 递归创建目录（SFTP，不依赖 shell）。noShell 连接必须提供。 */
  mkdirp?(path: string): Promise<void>;
  /** 递归删除目录（SFTP，不依赖 shell）。noShell 连接必须提供。 */
  removeDir?(path: string): Promise<void>;
  /**
   * 在设备的真实 shell 里跑一段脚本，流式回传输出，返回完整输出与退出码。
   * SSH 走交互式 shell 通道（exec 通道不可靠）；ADB 无需此方法（用 PTY）。
   */
  runScript?(script: string, onData?: (chunk: string) => void): Promise<{ output: string; code: number }>;
}

// ── SSH 适配 ──

import {
  execCommand,
  sftpWriteFile,
  sftpReaddir,
  sftpReadFile,
  sftpMkdir,
  sftpDelete,
  sftpRmdir,
  shellExec,
} from './ssh';

/** 通过 SFTP 递归创建目录（等价 mkdir -p） */
async function mkdirRecursive(path: string): Promise<void> {
  const parts = path.replace(/\/+/g, '/').replace(/\/$/, '').split('/').filter(Boolean);
  let current = '';
  for (const p of parts) {
    current += '/' + p;
    try { await sftpMkdir(current); } catch { /* 已存在，忽略 */ }
  }
}

/** 通过 SFTP 递归删除目录或文件（等价 rm -rf，不依赖 shell） */
async function rmRecursive(path: string): Promise<void> {
  const clean = path.replace(/\/+$/, '');
  let entries;
  try {
    entries = await sftpReaddir(clean);
  } catch {
    // 不是目录（或读取失败），按文件删除
    try { await sftpDelete(clean); } catch { /* 已不存在 */ }
    return;
  }
  for (const e of entries) {
    const child = clean + '/' + e.name;
    if (e.isDir && !e.isSymlink) await rmRecursive(child);
    else { try { await sftpDelete(child); } catch { /* 忽略 */ } }
  }
  try { await sftpRmdir(clean); } catch { /* 忽略 */ }
}

/** 转义单引号并包装到 sh -c '...' 中 */
function shWrap(cmd: string): string {
  const esc = cmd.replace(/'/g, "'\\''");
  return `sh -c '${esc}'`;
}

export function createSSHConnection(): DeviceConnection {
  return {
    // 某些设备的 SSH server 不自动走 shell，显式 sh -c 保证 &&、cd、重定向生效
    shellCommand: (cmd: string) => execCommand(shWrap(cmd)),
    shellScript: async (script: string) => {
      // mkdir -p 改走 SFTP（不依赖 shell）
      const m = script.match(/^mkdir -p\s+"([^"]+)"/);
      if (m) {
        await mkdirRecursive(m[1]);
        return '';
      }
      return execCommand(shWrap(script));
    },
    pushFile: (data: Uint8Array, remotePath: string) =>
      sftpWriteFile(remotePath, data),
    readDir: async (path: string) => {
      try {
        const entries = await sftpReaddir(path);
        return entries.map(e => ({
          name: e.name,
          isDir: e.isDir,
          isSymlink: e.isSymlink,
          sizeBytes: e.sizeBytes,
          mtime: e.mtime,
          mode: 0,
          permission: 0,
        }));
      } catch {
        return [];
      }
    },
    readFile: sftpReadFile,
    noShell: true,
    mkdirp: mkdirRecursive,
    removeDir: rmRecursive,
    runScript: shellExec,
  };
}
