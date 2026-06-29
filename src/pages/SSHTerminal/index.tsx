import { useState, useCallback, useRef, useEffect } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { AdbManager } from '../../lib/adb';

export interface SSHTerminalProps {
  adb: AdbManager | null;
  connected: boolean;
}

export function SSHTerminal({ adb, connected }: SSHTerminalProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [password, setPassword] = useState('CherryYoudao');
  const [sessionActive, setSessionActive] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [tab, setTab] = useState<'ssh' | 'shell'>('shell');

  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const ptyRef = useRef<any>(null);
  const writerRef = useRef<any>(null);

  // ── 自动检测设备 IP ──
  const detectIP = useCallback(async () => {
    if (!adb) return;
    try {
      // 尝试多种方式获取 IP
      const methods = [
        `ip addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1`,
        `ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}'`,
        `getprop dhcp.wlan0.ipaddress 2>/dev/null`,
      ];
      for (const cmd of methods) {
        const out = await adb.shellCommand(cmd);
        if (out && /^\d+\.\d+\.\d+\.\d+$/.test(out.trim())) {
          setHost(out.trim());
          return;
        }
      }
    } catch { /* ignore */ }
  }, [adb]);

  useEffect(() => {
    if (connected && adb) detectIP();
  }, [connected, adb, detectIP]);

  // ── 启动终端 ──
  const startTerminal = useCallback(async (useADB: boolean) => {
    if (!adb) return;
    setSessionActive(true);
    setStatusText('正在启动终端…');

    // 初始化 xterm
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      theme: { background: '#0f172a', foreground: '#e2e8f0', cursor: '#38bdf8' },
      allowTransparency: false,
    });
    terminalRef.current = term;

    if (termRef.current) {
      term.open(termRef.current);
    }

    // 通过 ADB PTY 创建交互式 shell
    try {
      const pty = await adb.adbInstance!.subprocess.noneProtocol.pty(['']);
      ptyRef.current = pty;
      const writer = pty.input.getWriter();
      writerRef.current = writer;

      setStatusText(useADB ? 'Shell 已连接' : `SSH ${host}:${port} 已连接`);

      // 如果是 SSH 模式，先发送 ssh 命令
      if (!useADB) {
        await writer.write(new TextEncoder().encode(`ssh root@${host} -p ${port}\n`) as any);
      }

      // 读取 PTY 输出 → xterm
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
      term.onData((data) => {
        writer.write(new TextEncoder().encode(data) as any).catch(() => {});
      });

      // 等待 PTY 退出
      pty.exited.then(() => {
        setSessionActive(false);
        setStatusText('连接已关闭');
        term.write('\r\n\x1b[31m[连接已关闭]\x1b[0m\r\n');
      }).catch(() => {});

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatusText('连接失败: ' + msg);
      term.write('\r\n\x1b[31m连接失败: ' + msg + '\x1b[0m\r\n');
    }
  }, [adb, host, port]);

  // ── 关闭终端 ──
  const closeTerminal = useCallback(async () => {
    try { writerRef.current?.close(); } catch {}
    try { ptyRef.current?.exited.catch(() => {}); } catch {}
    try { terminalRef.current?.dispose(); } catch {}
    terminalRef.current = null;
    ptyRef.current = null;
    writerRef.current = null;
    setSessionActive(false);
    setStatusText('');
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => { closeTerminal(); };
  }, [closeTerminal]);

  // ── 未连接 ──
  if (!connected) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl py-16 text-center">
        <svg className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <p className="text-sm text-[#94a3b8]">请先在顶部连接设备</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== 标签切换 ===== */}
      <div className="flex gap-0 border-b border-[#e2e8f0]">
        <button onClick={() => setTab('shell')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'shell' ? 'border-[#0f172a] text-[#0f172a]' : 'border-transparent text-[#94a3b8] hover:text-[#64748b]'}`}>
          本地 Shell
        </button>
        <button onClick={() => setTab('ssh')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'ssh' ? 'border-[#0f172a] text-[#0f172a]' : 'border-transparent text-[#94a3b8] hover:text-[#64748b]'}`}>
          SSH 连接
        </button>
      </div>

      {/* ===== SSH 连接表单 ===== */}
      {tab === 'ssh' && !sessionActive && (
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <h2 className="text-sm font-semibold text-[#0f172a]">SSH 连接</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#64748b] mb-1 block">主机名 (IP)</label>
              <div className="flex gap-2">
                <input value={host} onChange={e => setHost(e.target.value)}
                  placeholder="192.168.x.x"
                  className="flex-1 px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] font-mono" />
                <button onClick={detectIP}
                  className="px-3 py-2 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-[#f8fafc] whitespace-nowrap">
                  自动检测
                </button>
              </div>
              <p className="text-[10px] text-[#94a3b8] mt-1">设置 → 网络 → 更多 查看设备 IP</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">端口</label>
                <input value={port} onChange={e => setPort(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] font-mono" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#64748b] mb-1 block">密码</label>
                <input value={password} onChange={e => setPassword(e.target.value)}
                  type="password"
                  className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] font-mono" />
              </div>
            </div>

            <p className="text-xs text-[#94a3b8]">
              默认用户名 <code className="bg-[#f1f5f9] px-1 rounded">root</code>，密码 <code className="bg-[#f1f5f9] px-1 rounded">CherryYoudao</code>
              <br />需先在开发者设置开启 SSH 运行状态 + 开机自启
            </p>

            <button onClick={() => startTerminal(false)}
              disabled={!host}
              className="w-full py-2.5 bg-[#0f172a] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              连接 SSH
            </button>
          </div>
        </section>
      )}

      {/* ===== Shell 模式（一键启动） ===== */}
      {tab === 'shell' && !sessionActive && (
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            <h2 className="text-sm font-semibold text-[#0f172a]">本地 Shell</h2>
          </div>
          <p className="text-xs text-[#64748b] mb-4">
            通过 ADB 连接到词典笔的交互式 Shell。可执行任意命令、运行脚本、调试。
          </p>
          <button onClick={() => startTerminal(true)}
            className="w-full py-2.5 bg-[#0f172a] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            启动 Shell
          </button>
        </section>
      )}

      {/* ===== 终端 ===== */}
      {sessionActive && (
        <section className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[#0f172a] border-b border-[#1e293b]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
              <span className="text-xs text-[#94a3b8]">{statusText}</span>
            </div>
            <button onClick={closeTerminal}
              className="text-xs px-2 py-1 text-[#64748b] hover:text-[#f87171] rounded transition-colors">
              关闭
            </button>
          </div>
          <div ref={termRef} className="p-0" style={{ background: '#0f172a' }} />
        </section>
      )}
    </div>
  );
}
