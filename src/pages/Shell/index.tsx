import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { setShellCallbacks, shellWrite } from '../../lib/ssh';
import { AdbManager } from '../../lib/adb';

export interface ShellProps {
  adb: AdbManager | null;
  connected: boolean;
  connectionType: 'usb' | 'ssh';
  onLog: (msg: string) => void;
}

export function Shell({ adb, connected, connectionType }: ShellProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!connected || !termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      theme: { background: '#0f172a', foreground: '#e2e8f0', cursor: '#38bdf8' },
      allowTransparency: false,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termRef.current);
    setTimeout(() => fit.fit(), 50);
    term.write(' ');
    term.focus();
    // 等 shell 输出到达后自动覆盖占位

    terminalRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);

    // 点击触发手机键盘
    const container = termRef.current;
    const focusTerm = () => {
      const ta = term.textarea;
      if (ta) { ta.focus(); ta.click(); }
    };
    container.addEventListener('click', focusTerm);

    let cleanup = () => {
      window.removeEventListener('resize', onResize);
      container.removeEventListener('click', focusTerm);
    };

    if (connectionType === 'ssh') {
      // ── SSH 模式 ──
      setShellCallbacks(
        (data: string) => term.write(data),
        () => {
          term.write('\r\n\x1b[31m[连接已关闭]\x1b[0m\r\n');
        },
      );
      term.onData((data) => shellWrite(data));
    } else if (connectionType === 'usb' && adb) {
      // ── USB/ADB 模式 ──
      const startADBShell = async () => {
        try {
          const pty = await adb.adbInstance!.subprocess.noneProtocol.pty(['']);
          const writer = pty.input.getWriter();

          // PTY 输出 → xterm
          const reader = pty.output.getReader();
          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) term.write(value);
            }
          };
          pump();

          // xterm 输入 → PTY
          const dispose = term.onData((data) => {
            writer.write(new TextEncoder().encode(data) as any).catch(() => {});
          });

          pty.exited.then(() => {
            term.write('\r\n\x1b[31m[ADB Shell 已关闭]\x1b[0m\r\n');
          }).catch(() => {});

          cleanup = () => {
            window.removeEventListener('resize', onResize);
            container.removeEventListener('click', focusTerm);
            writer.close().catch(() => {});
            dispose.dispose();
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          term.write(`\r\n\x1b[31mADB Shell 启动失败: ${msg}\x1b[0m\r\n`);
        }
      };
      startADBShell();
    }

    cleanupRef.current = cleanup;

    return () => {
      cleanup();
      terminalRef.current = null;
      fitRef.current = null;
      term.dispose();
    };
  }, [connected, connectionType, adb]);

  if (!connected) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl py-12 text-center">
        <p className="text-sm text-[#94a3b8]">请先连接设备</p>
        <p className="text-xs text-[#cbd5e1] mt-1">顶部连接栏 → USB 或 SSH</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#e2e8f0] rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
      <div ref={termRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
