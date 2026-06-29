import {
  Adb,
  AdbDaemonTransport,
  type AdbCredentialStore,
  LinuxFileType,
} from '@yume-chan/adb';
import { ConcatStringStream, TextDecoderStream } from '@yume-chan/stream-extra';
import { AdbDaemonWebUsbDevice } from '@yume-chan/adb-daemon-webusb';
import { BrowserCredentialStore } from './credential-store';
import type { DeviceConnection } from './device';

export type DeviceStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface AdbProgressEvent {
  type: 'log' | 'progress' | 'error' | 'status' | 'connected';
  message: string;
  progress?: number;
}

/** 远程文件条目（来自 sync readdir 协议，比 shell 方式快 N 倍） */
export interface RemoteFileEntry {
  name: string;
  isDir: boolean;
  isSymlink: boolean;
  sizeBytes: number;
  mtime: number;   // Unix 时间戳（秒）
  mode: number;
  permission: number;
  ino?: number;
}

export type ProgressCallback = (event: AdbProgressEvent) => void;

/** 转义字符串使其可安全放入 shell 双引号中 */
function shellEscapeDq(s: string): string {
  return s.replace(/(["$`\\])/g, '\\$1');
}

/**
 * 解析 BusyBox `ls` 在 PTY 下对含非打印字节的文件名所用的 shell 引用，还原原始字节。
 * 形如 `''$'\360''-'$'\242\277''+-+'$'\246''+'$'\360'`：
 *   - `'...'`   普通单引号段，内容为字面字节
 *   - `$'...'`  ANSI-C 段，处理 \nnn(八进制) \xHH(十六进制) \n \t \\ 等转义
 * 还原出字节后即可用 TextDecoder 解出与列表显示完全一致的名字，从而匹配乱码文件。
 */
function unquoteBusyboxLsName(s: string): Uint8Array {
  const bytes: number[] = [];
  const ctrl: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '\\': 92, "'": 39, '"': 34 };
  let i = 0;
  while (i < s.length) {
    if (s[i] === '$' && s[i + 1] === "'") {
      i += 2;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\') {
          i++;
          const e = s[i];
          if (e >= '0' && e <= '7') {
            let oct = '';
            while (oct.length < 3 && s[i] >= '0' && s[i] <= '7') { oct += s[i]; i++; }
            bytes.push(parseInt(oct, 8) & 0xff);
          } else if (e === 'x') {
            i++;
            let hex = '';
            while (hex.length < 2 && /[0-9a-fA-F]/.test(s[i] || '')) { hex += s[i]; i++; }
            bytes.push(parseInt(hex || '0', 16) & 0xff);
          } else {
            bytes.push(e in ctrl ? ctrl[e] : (e || '').charCodeAt(0));
            i++;
          }
        } else {
          bytes.push(s.charCodeAt(i) & 0xff); i++;
        }
      }
      i++; // 跳过结束的 '
    } else if (s[i] === "'") {
      i++;
      while (i < s.length && s[i] !== "'") { bytes.push(s.charCodeAt(i) & 0xff); i++; }
      i++;
    } else {
      bytes.push(s.charCodeAt(i) & 0xff); i++;
    }
  }
  return new Uint8Array(bytes);
}

export class AdbManager implements DeviceConnection {
  private adb: Adb | null = null;
  private transport: AdbDaemonTransport | null = null;
  private credentialStore: AdbCredentialStore = new BrowserCredentialStore();
  private onProgress: ProgressCallback;
  private _passwordAuthed = false;

  static get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  static get supportStatus(): { ok: boolean; reason?: string } {
    if (typeof navigator === 'undefined') {
      return { ok: false, reason: '不在浏览器环境中' };
    }
    if (!('usb' in navigator)) {
      const ua = ((navigator as any).userAgent || '').toLowerCase();
      const isChromium = ua.includes('chrome') || ua.includes('edge') || ua.includes('opera');
      if (isChromium) {
        return { ok: false, reason: '检测到Chromium内核但WebUSB不可用。请检查: ①页面通过 HTTPS 或 localhost 访问 ②不在无痕/隐私模式 ③浏览器未禁用 WebUSB' };
      }
      return { ok: false, reason: '非 Chromium 内核浏览器，请使用 Chrome 或 Edge' };
    }
    return { ok: true };
  }

  get isConnected() { return this.adb !== null; }
  get isPasswordAuthed() { return this._passwordAuthed; }
  get serial() { return this.transport?.serial ?? null; }
  get adbInstance() { return this.adb; }

  constructor(onProgress: ProgressCallback) { this.onProgress = onProgress; }
  private emit(event: AdbProgressEvent) { this.onProgress(event); }

  private findAdbInterface(device: USBDevice): {
    configuration: USBConfiguration;
    interface_: USBInterface;
    alternate: USBAlternateInterface;
  } | undefined {
    const filters = [
      { classCode: 0xff, subclassCode: 0x42, protocolCode: 1 },
      { classCode: 0xff, subclassCode: 0x42, protocolCode: 0 },
      { classCode: 0xff, subclassCode: 0x00, protocolCode: 0 },
    ];
    for (const config of device.configurations) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          for (const f of filters) {
            if (alt.interfaceClass === f.classCode &&
                alt.interfaceSubclass === f.subclassCode &&
                alt.interfaceProtocol === f.protocolCode) {
              return { configuration: config, interface_: iface, alternate: alt };
            }
          }
        }
      }
    }
    // 兜底：使用第一个 0xFF 接口
    for (const config of device.configurations) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          if (alt.interfaceClass === 0xff) {
            return { configuration: config, interface_: iface, alternate: alt };
          }
        }
      }
    }
    return undefined;
  }

  async requestDevice(): Promise<void> {
    if (!AdbManager.isSupported) {
      const _status = AdbManager.supportStatus;
      throw new Error('当前浏览器不支持 WebUSB: ' + (_status.reason || '未知原因'));
    }

    const usb = navigator.usb;
    let rawDevice: USBDevice | null = null;

    const existing = await usb.getDevices();
    for (const d of existing) {
      if (this.findAdbInterface(d)) {
        rawDevice = d;
        this.emit({ type: 'log', message: `找到已授权的设备: ${d.productName || 'dictpen'}` });
        break;
      }
    }

    if (!rawDevice) {
      this.emit({ type: 'status', message: '请在弹出窗口中选择您的词典笔…' });
      try {
        rawDevice = await usb.requestDevice({ filters: [{ classCode: 0xff }] });
        this.emit({ type: 'log', message: `已选择设备: ${rawDevice.productName || 'dictpen'}` });
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'NotFoundError') {
          throw new Error('未选择设备');
        }
        throw e;
      }
    }

    if (!rawDevice) throw new Error('未选择设备');

    const adbIface = this.findAdbInterface(rawDevice);
    if (!adbIface) {
      this.emit({ type: 'log', message: `设备: ${rawDevice.manufacturerName || ''} ${rawDevice.productName || ''}` });
      throw new Error('未找到 ADB 接口，请确认设备已开启 ADB');
    }

    this.emit({ type: 'status', message: '正在打开 USB 连接…' });
    this.emit({ type: 'log', message: '[4/5] 打开 USB 设备并声明接口…' });
    const adbDevice = new AdbDaemonWebUsbDevice(rawDevice, adbIface, usb);

    let connection;
    try {
      connection = await adbDevice.connect();
      this.emit({ type: 'log', message: 'USB 接口已成功声明' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : 'UnknownError';
      this.emit({ type: 'log', message: 'USB 接口声明失败: [' + name + '] ' + msg });
      if (name === 'NetworkError' || e instanceof AdbDaemonWebUsbDevice.DeviceBusyError) {
        throw new Error('USB 连接失败: ADB 服务占用了设备。请先在终端执行 adb kill-server 再点击重试。 (' + msg + ')');
      }
      throw new Error('USB 连接失败: ' + msg);
    }

    this.emit({ type: 'status', message: '正在进行 ADB 协议握手…' });
    this.emit({ type: 'log', message: '[5/5] ADB 认证 (RSA 密钥交换)…' });
    try {
      // 先尝试最小特性集（兼容老设备）
      this.emit({ type: 'log', message: '尝试使用最小兼容模式连接…' });
      this.transport = await AdbDaemonTransport.authenticate({
        serial: adbDevice.serial,
        connection,
        credentialStore: this.credentialStore,
        features: [],
      });
      this.emit({ type: 'log', message: 'ADB 认证成功, 序列号: ' + this.transport.serial });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : 'UnknownError';
      this.emit({ type: 'log', message: '最小模式失败: [' + name + '] ' + msg });
      this.emit({ type: 'log', message: '尝试默认特性集…' });
      try {
        this.transport = await AdbDaemonTransport.authenticate({
          serial: adbDevice.serial,
          connection,
          credentialStore: this.credentialStore,
        });
        this.emit({ type: 'log', message: 'ADB 认证成功, 序列号: ' + this.transport.serial });
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        const name2 = e2 instanceof Error ? e2.name : 'UnknownError';
        this.emit({ type: 'log', message: '默认模式也失败: [' + name2 + '] ' + msg2 });
        throw new Error('ADB 握手失败，设备可能不支持标准 ADB 协议。');
      }
    }

    this.adb = new Adb(this.transport);
    this.emit({ type: 'connected', message: '设备已连接' });
  }

    async authPassword(password: string = "CherryYoudao"): Promise<void> {
    if (!this.adb) throw new Error("设备未连接");
    this.emit({ type: "status", message: "正在执行密码认证…" });
    this.emit({ type: "log", message: "运行 auth (PTY 模式)…" });

    try {
      const pty = await this.adb.subprocess.noneProtocol.pty(["auth"]);
      const writer = pty.input.getWriter();
      await new Promise(r => setTimeout(r, 500));
      await writer.write(new TextEncoder().encode(password + String.fromCharCode(10)) as any);
      writer.releaseLock();

      const output = await pty.output
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new ConcatStringStream());
      await pty.exited;

      this.emit({ type: "log", message: "auth 输出: " + (output.trim() || "(空)") });
      if (output.includes("success")) {
        this._passwordAuthed = true;
        this.emit({ type: "log", message: "密码认证成功" });
      }
    } catch (e) {
      this.emit({ type: "log", message: "auth 异常: " + (e instanceof Error ? e.message : String(e)) });
    }
  }

async shellCommand(command: string): Promise<string> {
    if (!this.adb) throw new Error('设备未连接');
    this.emit({ type: 'log', message: '$ ' + command });
    const socket = await this.adb.createSocket('shell:exec ' + command);
    const readResult = await socket.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new ConcatStringStream());
    const trimmed = readResult.trim();
    if (trimmed) this.emit({ type: 'log', message: trimmed });
    return trimmed;
  }

  /**
   * 执行多语句 shell 脚本。使用 `shell:` 服务（不加 `exec ` 前缀），
   * 设备端以 `sh -c "<脚本>"` 运行，因此 `;`、`for`、`&&` 等组合语句都能正常工作。
   * （`shellCommand` 用的 `shell:exec ` 会把命令包成 `exec <cmd>`，组合语句会被截断。）
   */
  async shellScript(script: string): Promise<string> {
    if (!this.adb) throw new Error('设备未连接');
    this.emit({ type: 'log', message: '$ ' + script.replace(/\s+/g, ' ').slice(0, 200) });
    const socket = await this.adb.createSocket('shell:' + script);
    const readResult = await socket.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new ConcatStringStream());
    const trimmed = readResult.trim();
    if (trimmed) this.emit({ type: 'log', message: trimmed });
    return trimmed;
  }

  /**
   * 统一的脚本执行接口（DeviceConnection.runScript）。USB 走 shell: 服务一次性返回，
   * 无流式，输出在完成后整体回传给 onData。退出码无法从 shell: 取得，固定 0。
   */
  async runScript(script: string, onData?: (chunk: string) => void): Promise<{ output: string; code: number }> {
    const output = await this.shellScript(script);
    if (output && onData) onData(output);
    return { output, code: 0 };
  }

  /**
   * 按 inode 在设备端定位并操作文件，绕开 BusyBox `find`（不支持 -inum）。
   * 遍历目录用 `ls -di "$f"` 取每项 inode；命中后对原生字节名 `$f` 直接操作，
   * 全程不把(可能乱码的)文件名经 JS 往返，对非 UTF-8 文件名安全。
   * 只把干净的 inode 整数与目标目录发往设备。
   */
  private inodeLoop(dir: string, inode: number, action: string): string {
    return (
      'cd "' + shellEscapeDq(dir) + '" || exit 1; ' +
      'for f in * .[!.]* ..?*; do ' +
      '[ -e "$f" ] || [ -L "$f" ] || continue; ' +
      'set -- $(ls -di "$f" 2>/dev/null); ' +
      '[ "$1" = "' + inode + '" ] && { ' + action + '; echo __DONE__; break; }; ' +
      'done'
    );
  }

  async removeByInode(dir: string, inode: number): Promise<boolean> {
    const out = await this.shellScript(this.inodeLoop(dir, inode, 'rm -rf "$f"'));
    return out.includes('__DONE__');
  }

  async renameByInode(dir: string, inode: number, newName: string): Promise<boolean> {
    const action = 'mv "$f" "' + shellEscapeDq(newName) + '"';
    const out = await this.shellScript(this.inodeLoop(dir, inode, action));
    return out.includes('__DONE__');
  }

  /**
   * 通过 PTY (交互式 Shell) 执行命令，支持 cd、管道等 shell 特性
   */
  async shellPtyCommand(command: string, waitMs = 1500): Promise<string> {
    if (!this.adb) throw new Error('设备未连接');
    this.emit({ type: 'log', message: '$ ' + command });
    try {
      const pty = await this.adb.subprocess.noneProtocol.pty(['']);
      const writer = pty.input.getWriter();
      await writer.write(new TextEncoder().encode(command + '\n') as any);
      writer.releaseLock();
      await new Promise(r => setTimeout(r, waitMs));

      // 读取 PTY 输出（过滤掉 echo 回显）
      const reader = pty.output.getReader();
      let output = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += new TextDecoder().decode(value);
      }
      reader.releaseLock();
      await pty.exited.catch(() => {});

      // 去掉命令回显行和 shell prompt
      const lines = output.split('\n').filter(l => !l.includes(command.trim()) && !l.match(/^\s*[$#]\s*$/) && l.trim());
      const trimmed = lines.join('\n').trim();
      if (trimmed) this.emit({ type: 'log', message: trimmed });
      return trimmed;
    } catch (e) {
      this.emit({ type: 'log', message: 'PTY 命令失败，回退到 shell:exec' });
      return this.shellCommand(command);
    }
  }

  async getProp(key: string): Promise<string> {
    if (!this.adb) throw new Error('设备未连接');
    try {
      const result = await this.shellCommand('getprop ' + key);
      // 如果返回错误信息（非 Android 系统），返回空字符串
      if (result.includes('not found') || result.includes('Usage')) return '';
      return result;
    } catch {
      return '';
    }
  }

  async pushFile(data: Uint8Array, remotePath: string, onProgress?: (pct: number) => void): Promise<void> {
    if (!this.adb) throw new Error('设备未连接');
    this.emit({ type: 'log', message: '推送: ' + remotePath });
    const sync = await this.adb.sync();
    const totalSize = data.length;
    let sentSize = 0;
    const CHUNK = 65536; // 64KB 每块
    const stream = new ReadableStream({
      pull(controller) {
        if (sentSize >= totalSize) { controller.close(); return Promise.resolve(); }
        const end = Math.min(sentSize + CHUNK, totalSize);
        controller.enqueue(data.subarray(sentSize, end));
        sentSize = end;
        onProgress?.(Math.round((sentSize / totalSize) * 100));
        return Promise.resolve();
      },
    });
    await (sync.write)({ filename: remotePath, file: stream as any, permission: 0o755 });
    await sync.dispose();
  }

  /**
   * 通过 ADB sync 协议快速读取远程文件（比 shell base64 快 10 倍以上）
   */
  async readFile(remotePath: string): Promise<Uint8Array> {
    if (!this.adb) throw new Error('设备未连接');
    const sync = await this.adb.sync();
    try {
      const stream = sync.read(remotePath);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } finally {
      await sync.dispose();
    }
  }

  /**
   * 通过 ADB sync 协议快速读取目录列表（单次调用，无需逐文件 wc）
   * 大幅优于之前的 ls + find + 逐文件 wc 方案
   */
  async readDir(dir: string): Promise<RemoteFileEntry[]> {
    if (!this.adb) throw new Error('设备未连接');
    // 方法 1: 尝试 ADB sync 协议（最快）
    try {
      const sync = await this.adb.sync();
      try {
        const entries = await sync.readdir(dir);
        const filtered = entries.filter(e => e.name !== '.' && e.name !== '..');
        if (filtered.length > 0) {
          return filtered.map(e => ({
            name: e.name,
            isDir: e.type === LinuxFileType.Directory,
            isSymlink: e.type === LinuxFileType.Link,
            sizeBytes: Number(e.size),
            mtime: Number(e.mtime),
            mode: e.mode,
            permission: e.permission,
          }));
        }
        // sync 返回 0 条，可能不支持，回退到 shell
      } finally {
        await sync.dispose();
      }
    } catch (e) {
      this.emit({ type: 'log', message: `sync readdir 失败: ${e}，尝试 shell 方式` });
    }

    // 方法 2: 用 ls -la 单次 shell 命令解析
    try {
      return await this.readDirShell(dir);
    } catch (e) {
      this.emit({ type: 'log', message: `shell readdir 也失败: ${e}` });
    }

    // 方法 3: 原始的多步方案（兜底）
    const entries = await this.readDirOriginal(dir);
    return entries;
  }

  /** 用 ls -la 解析目录（sync readdir 的 fallback） */
  private async readDirShell(dir: string): Promise<RemoteFileEntry[]> {
    const output = await this.shellCommand(`ls -la "${dir}" 2>/dev/null`);
    const entries: RemoteFileEntry[] = [];
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('total ')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 8) continue;
      const perm = parts[0];
      const typeChar = perm[0];
      if (typeChar === 'c' || typeChar === 'b') continue; // 跳过设备文件
      const size = parseInt(parts[4], 10);
      const name = parts.slice(8).join(' ');
      const cleanName = name.includes(' -> ') ? name.split(' -> ')[0] : name;
      if (cleanName === '.' || cleanName === '..') continue;
      entries.push({
        name: cleanName,
        isDir: typeChar === 'd',
        isSymlink: typeChar === 'l',
        sizeBytes: isNaN(size) ? 0 : size,
        mtime: 0,
        mode: 0,
        permission: 0,
      });
    }
    return entries;
  }

  /**
   * 查找 inode：列出目录的「inode + 名字」对，用与显示完全相同的有损 UTF-8
   * 解码来匹配名字。
   *
   * 为什么不用 `stat "<路径>"` 按名字回查：
   * 显示出来的名字若包含非 UTF-8 字节（例如 toybox unzip 解出的 GBK 名），
   * 经解码已变成 U+FFFD 替换符且不可逆。把这个有损名字再发回设备时，UTF-8
   * 编码出的字节与文件系统里的真实字节对不上，stat 必然失败 → 删除/重命名报
   * 「未找到文件」。而 `ls -1i` 的输出经过同一条 UTF-8 解码链，乱码↔乱码可
   * 精确匹配；同时这条路径不依赖 `stat -c` 是否被设备的 toybox 支持。
   */
  async findInode(dir: string, name: string): Promise<number | null> {
    // 把名字里所有「非 ASCII 段」归一化成单个标记，用于吸收两条解码链可能
    // 存在的替换粒度差异（display 来自 @yume-chan TextDecoder，ls 来自
    // TextDecoderStream）。正常中文名也适用：CJK 段同样被归一。
    const skeleton = (s: string) => s.replace(/[^\x20-\x7e]+/g, '□');

    // 解析 `ls -1i` 每行为 { ino, raw }；raw 是 ls 输出的(可能被 shell 引用的)名字。
    // display = 把 raw 反引用还原成字节后再 TextDecoder，应与列表里的显示名一致。
    const decoder = new TextDecoder();
    const parseLs = (out: string): Array<{ ino: number; raw: string; display: string }> => {
      const rows: Array<{ ino: number; raw: string; display: string }> = [];
      for (const line0 of out.split('\n')) {
        const line = line0.replace(/\r$/, '');
        const m = line.match(/^\s*(\d+)[ \t]+(.*)$/);
        if (!m) continue;
        const ino = parseInt(m[1], 10);
        const raw = m[2];
        if (!raw || raw === '.' || raw === '..') continue;
        if (isNaN(ino) || ino <= 0) continue;
        let display = raw;
        try { display = decoder.decode(unquoteBusyboxLsName(raw)); } catch { /* 用 raw */ }
        rows.push({ ino, raw, display });
      }
      return rows;
    };

    const variants = [
      'ls -1iA "' + dir + '" 2>/dev/null',
      'ls -1ia "' + dir + '" 2>/dev/null',
    ];

    let lastOut = '';
    try {
      for (const cmd of variants) {
        const out = await this.shellCommand(cmd);
        lastOut = out;
        const rows = parseLs(out);
        if (rows.length === 0) continue;

        // 1) 直接匹配 ls 原始名（正常 ASCII 名）
        const exact = rows.find(r => r.raw === name);
        if (exact) return exact.ino;

        // 2) 反引用+解码后匹配（覆盖 BusyBox 对乱码/含空格名字的 shell 引用）
        const decoded = rows.find(r => r.display === name);
        if (decoded) {
          this.emit({ type: 'log', message: `findInode 反引用匹配「${name}」→ inode ${decoded.ino}` });
          return decoded.ino;
        }

        // 3) 骨架匹配（吸收解码粒度差异；唯一命中才采用，避免歧义误删）
        const target = skeleton(name);
        const skelHits = rows.filter(r => skeleton(r.display) === target);
        if (skelHits.length === 1) {
          this.emit({ type: 'log', message: `findInode 骨架匹配命中「${name}」→ inode ${skelHits[0].ino}` });
          return skelHits[0].ino;
        }
        if (skelHits.length > 1) {
          this.emit({ type: 'log', message: `findInode 骨架匹配到 ${skelHits.length} 个同形项，放弃以防误删` });
        }
      }

      // 4) 兜底：stat 按名字查（正常 ASCII 名有效）
      const fullPath = dir === '/' ? '/' + name : dir + '/' + name;
      const inodeStr = await this.shellCommand('stat -c %i "' + fullPath + '" 2>/dev/null');
      const inode = parseInt(inodeStr.trim(), 10);
      if (!isNaN(inode) && inode > 0) return inode;

      // 全部失败：打印诊断信息（设备真实 ls 输出 + 目标名 code points）
      const codePoints = Array.from(name).map(c => c.codePointAt(0)!.toString(16)).join(' ');
      this.emit({ type: 'log', message: `findInode 失败「${name}」[U+${codePoints}]` });
      this.emit({ type: 'log', message: `ls 原始输出(前400字符): ${JSON.stringify(lastOut.slice(0, 400))}` });
    } catch (e) {
      this.emit({ type: 'log', message: 'findInode 异常: ' + (e instanceof Error ? e.message : String(e)) });
    }
    return null;
  }

  /**
   * 安全删除：先用 findInode 取 inode，再用设备端 inode 循环删除（绕开 find -inum）。
   */
  async safeRm(dir: string, name: string): Promise<boolean> {
    try {
      const inode = await this.findInode(dir, name);
      if (inode) return await this.removeByInode(dir, inode);
      // fallback: 直接 rm（仅对正常名字有效）
      const fullPath = dir === '/' ? '/' + name : dir + '/' + name;
      await this.shellPtyCommand('rm -rf "' + fullPath + '"', 2000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清理乱码文件：遍历 ls -1i 找出名字含非 ASCII 字符的项，按 inode 删除
   * 完全避免在 shell 命令中传递乱码字节
   */
  async cleanGarbled(dir: string): Promise<string[]> {
    const deleted: string[] = [];
    try {
      const lsOut = await this.shellCommand('ls -1i "' + dir + '" 2>/dev/null');
      for (const line of lsOut.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const inode = parts[0];
        const name = parts.slice(1).join(' ');
        if (!inode || !name || name === '.' || name === '..') continue;
        if (/[^\x20-\x7e]/.test(name)) {
          await this.shellCommand('find "' + dir + '" -maxdepth 1 -inum ' + inode + ' -exec rm -rf {} \\\\; 2>/dev/null');
          deleted.push(name);
        }
      }
    } catch { /* ignore */ }
    return deleted;
  }

  /** 原始的多步方案（最终 fallback）：ls -1a + find + wc */
  private async readDirOriginal(dir: string): Promise<RemoteFileEntry[]> {
    const raw = await this.shellCommand(`ls -1a "${dir}" 2>/dev/null`);
    const allNames = raw.split('\n').map(s => s.trim()).filter(Boolean);
    const names = allNames.filter(n => n !== '.' && n !== '..');

    if (names.length === 0) return [];

    const dirsRaw = await this.shellCommand(`find "${dir}" -maxdepth 1 -type d ! -name "." ! -name ".." 2>/dev/null`);
    const dirPaths = dirsRaw.split('\n').filter(Boolean);
    const dirNames = new Set(dirPaths.map((p: string) => p.replace(/.*\//, '').trim()).filter(Boolean));

    const sizeMap: Record<string, number> = {};
    for (const name of names) {
      if (dirNames.has(name)) continue;
      try {
        const sizeStr = await this.shellCommand(`wc -c < "${dir}/${name}" 2>/dev/null`);
        const s = parseInt(sizeStr.trim());
        if (!isNaN(s)) sizeMap[name] = s;
      } catch { /* ignore */ }
    }

    return names.map(name => ({
      name,
      isDir: dirNames.has(name),
      isSymlink: false,
      sizeBytes: sizeMap[name] || 0,
      mtime: 0,
      mode: 0,
      permission: 0,
    }));
  }

  async fetchFile(url: string): Promise<Uint8Array> {
    this.emit({ type: 'log', message: `下载: ${url.split('/').pop()}` });
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`下载失败: ${resp.status}`);
    return new Uint8Array(await resp.arrayBuffer());
  }

  /**
   * 递归统计目录真实占用（字节）。用 `du -sk`（KB），按需调用，不在列表里批量算。
   * 返回 null 表示失败（如目录名乱码、du 不可用）。
   */
  async dirSize(path: string): Promise<number | null> {
    try {
      const out = await this.shellCommand('du -sk "' + path + '" 2>/dev/null');
      const m = out.trim().match(/^(\d+)/);
      if (m) return parseInt(m[1], 10) * 1024;
    } catch { /* ignore */ }
    return null;
  }

  async mkdir(path: string) { await this.shellCommand(`mkdir -p "${path}"`); }
  async chmod(path: string, mode: string) { await this.shellCommand(`chmod ${mode} "${path}"`); }
  async unzip(zipPath: string, dir?: string) {
    await this.shellCommand(dir ? `unzip -oq "${zipPath}" -d "${dir}"` : `unzip -oq "${zipPath}"`);
  }
  async reboot() {
    this.emit({ type: 'status', message: '正在重启…' });
    await this.shellCommand('reboot');
  }

  async disconnect(): Promise<void> {
    try { await this.adb?.close(); } catch { /* ignore */ }
    this.adb = null;
    this.transport = null;
    this._passwordAuthed = false;
    this.emit({ type: 'status', message: '已断开连接' });
  }
}

