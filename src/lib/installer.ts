import { AdbManager } from './adb';
import { getInstallFiles, type InstallFile } from './files';

export type InstallPhase =
  | 'pushing-files'
  | 'installing'
  | 'rebooting'
  | 'done'
  | 'error';

export interface InstallState {
  phase: InstallPhase;
  progress: number;
  currentFile: string;
  log: string[];
}

export type InstallCallback = (state: InstallState) => void;

export class Installer {
  private adb: AdbManager;
  private onUpdate: InstallCallback;
  private log: string[] = [];

  constructor(adb: AdbManager, onUpdate: InstallCallback) {
    this.adb = adb;
    this.onUpdate = onUpdate;
  }

  private emit(phase: InstallPhase, progress: number, currentFile: string, message: string) {
    this.log.push(message);
    this.onUpdate({ phase, progress, currentFile, log: this.log });
  }

  /** 发送命令到 PTY 并等待输出 */
  private async ptySend(
    pty: any,
    cmd: string,
    waitMs = 1000
  ): Promise<string> {
    const writer = pty.input.getWriter();
    await writer.write(new TextEncoder().encode(cmd + '\n') as any);
    writer.releaseLock();
    await new Promise(r => setTimeout(r, waitMs));
    // PTY 输出流不会自动 close（交互式 session），每次只读可用的 chunk
    const reader = pty.output.getReader();
    let output = '';
    for (let i = 0; i < 5; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) output += new TextDecoder().decode(value);
      // 小 chunk 意味着没有更多积压数据了
      if (!value || value.length < 512) break;
    }
    reader.releaseLock();
    return output;
  }

  async install(
    _components: { base: boolean; certs: boolean; rime: boolean },
    customFiles?: InstallFile[]
  ) {
    this.log = [];

    try {
      // ====== 1. 推送所有文件（sync 协议不需要 auth）======
      this.emit('pushing-files', 0, '', '开始推送文件…');
      const files = customFiles || getInstallFiles();
      const totalFiles = files.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const pct = Math.round((i / totalFiles) * 50);

        this.emit('pushing-files', pct, file.name, `[${i+1}/${totalFiles}] ${file.name}`);

        try {
          const dir = file.remotePath.substring(0, file.remotePath.lastIndexOf('/'));
          await this.adb.mkdir(dir);

          let data: Uint8Array;
          if (file.data) {
            data = file.data;
            this.emit('pushing-files', pct, file.name, `  来自 ZIP: ${(data.length / 1024).toFixed(0)}KB`);
          } else if (file.localPath) {
            const resp = await fetch(file.localPath);
            if (!resp.ok) {
              this.emit('pushing-files', pct, file.name, `  文件不存在，跳过`);
              continue;
            }
            data = new Uint8Array(await resp.arrayBuffer());
            this.emit('pushing-files', pct, file.name, `  ${(data.length / 1024).toFixed(0)}KB`);
          } else { continue; }

          await this.adb.pushFile(data, file.remotePath);
          this.emit('pushing-files', pct, file.name, `  ✓`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.emit('pushing-files', pct, file.name, `  ✗ ${msg}`);
        }
      }

      // ====== 2. 用一个 PTY 会话执行所有命令（仅需一次 auth）======
      this.emit('installing', 55, '', '正在执行安装脚本…（约1分钟）');

      // 构建安装命令链：先 auth，然后一气呵成
      const cmds = [
        "echo 'CherryYoudao' | auth",
        "mount -o remount,rw /",
        "cd /userdisk && unzip -oq CA.zip && mv CA/* /etc/ssl/certs/ 2>/dev/null; echo 'certs done'",
        "cd /userdata/PenMods && chmod +x patch.sh misc/init.sh misc/patchelf",
        "cd /userdata/PenMods/misc && ./init.sh; echo 'init done'",
        "cd /userdata/PenMods && ./patch.sh; echo 'patch done'",
      ];

      this.emit('installing', 60, '', '打开交互式 Shell 会话…');
      const pty = await this.adb.adbInstance!.subprocess.noneProtocol.pty(['']);

      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        const pct = 60 + Math.round((i / cmds.length) * 35);
        this.emit('installing', pct, '', `执行: ${cmd.substring(0, 50)}…`);
        const output = await this.ptySend(pty, cmd, 1500);
        if (output.trim()) {
          const lines = output.trim().split('\n').filter(l => l.trim());
          for (const line of lines) {
            this.emit('installing', pct, '', '  ' + line);
          }
        }
      }

      // ====== 3. 重启 ======
      this.emit('rebooting', 96, '', '安装完成！正在重启…');
      await this.ptySend(pty, 'reboot', 500);
      await pty.exited.catch(() => {});

      this.emit('done', 100, '', '安装完成！设备正在重启。如果屏幕不可用，长按电源键关机重启即可。');

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit('error', 90, '', '❌ 安装失败: ' + message);
    }
  }
}
