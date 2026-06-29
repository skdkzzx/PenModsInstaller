import { useState, useCallback } from 'react';
import { AdbManager } from '../../lib/adb';

// ===================================================================
// 通过 USB(ADB) 在未装 PenMods 的设备上探测并强制开启 SSH 服务
//
// 设备 adbd shell 本身是 root，可直接改系统。流程：
//   1. 探测（只读）：发现 SSH 服务器二进制、主机密钥、22 端口、密码工具
//   2. 开启（最佳努力）：生成主机密钥 → 设 root 密码为 CherryYoudao →
//      启动 dropbear → 验证 22 端口
// 全程输出原始结果，便于排查设备差异。
// ===================================================================

export interface EnableSSHProps {
  adb: AdbManager | null;
  connected: boolean;
  connectionType: 'usb' | 'ssh';
  onLog: (msg: string) => void;
  /** 读取设备 IP 后一键连接 SSH（由 App 切换到 SSH 模式并连接） */
  onConnectSSH?: (host: string, password: string) => Promise<void> | void;
}

const DEFAULT_PASSWORD = 'CherryYoudao';

/** 读取设备网络 IP（global 作用域的 IPv4，排除回环） */
const IP_SCRIPT = `
{ ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1; ifconfig 2>/dev/null | sed -n 's/.*inet \\(addr:\\)\\?\\([0-9.]*\\).*/\\2/p'; } 2>/dev/null
`.trim();

/** 探测脚本（只读，不改设备） */
const PROBE_SCRIPT = `
echo "### ARCH"
uname -a
echo "libc:"; ls -l /lib/ld-* /lib/libc.so* 2>/dev/null
echo "### BINARIES_IN_PATH"
for b in dropbear dropbearmulti dropbearkey sshd ssh-keygen sftp-server telnetd; do p=$(command -v $b 2>/dev/null); echo "$b: \${p:-(none)}"; done
echo "### FIND_SSH (全盘搜索, 可能较慢)"
find /usr /bin /sbin /lib /oem /system /vendor /opt /data /userdata /userdisk -type f 2>/dev/null | grep -iE "dropbear|sshd|sftp-server|/openssh|/ssh$" | head -40 || echo "(未找到)"
echo "### BUSYBOX_APPLETS"
busybox 2>&1 | tr ', ' '\\n' | grep -iE "^(dropbear|dropbearkey|telnetd|nc|passwd|chpasswd)$" | sort -u
echo "### PORT22"
(netstat -lnt 2>/dev/null || ss -lnt 2>/dev/null) | grep -E "[:.]22[^0-9]" || echo "(22 未监听)"
echo "### HOSTKEYS"
ls -l /etc/dropbear/ /etc/ssh/ 2>/dev/null || echo "(无 host key 目录)"
echo "### ROOT_SHADOW"
grep "^root:" /etc/shadow 2>/dev/null | sed "s/:[^:]*:/: <hash 已隐藏>:/" || echo "(无 shadow)"
echo "### PWTOOLS"
for t in passwd chpasswd openssl mkpasswd; do command -v $t >/dev/null 2>&1 && echo "$t: yes" || echo "$t: no"; done
echo "### OS"
(cat /etc/os-release 2>/dev/null | head -2)
echo "### END"
`.trim();

/** 开启脚本（OpenSSH sshd，会改设备） */
function enableScript(password: string): string {
  return `
PW='${password.replace(/'/g, "'\\''")}'
echo "### REMOUNT"
mount -o remount,rw / 2>&1; echo "remount done"
echo "### PASSWD"
printf "%s\\n%s\\n" "$PW" "$PW" | passwd root >/dev/null 2>&1 && echo "root 密码已设为默认值" || echo "密码设置失败"
echo "### HOSTKEYS"
if [ -f /etc/ssh/ssh_host_rsa_key ]; then echo "(host key 已存在)"; else ssh-keygen -A 2>&1 && echo "host key 已生成"; fi
echo "### PRIVSEP"
mkdir -p /var/empty /run/sshd /var/run/sshd 2>/dev/null; echo "特权分离目录就绪"
echo "### START"
if pidof sshd >/dev/null 2>&1; then
  echo "(sshd 已在运行)"
else
  /usr/sbin/sshd -o PermitRootLogin=yes -o PasswordAuthentication=yes 2>&1 && echo "sshd 已启动"
fi
sleep 1
echo "### VERIFY"
(netstat -lnt 2>/dev/null || ss -lnt 2>/dev/null) | grep -E "[:.]22[^0-9]" && echo "✓ 22 端口监听中" || echo "✗ 22 端口未监听"
pidof sshd >/dev/null 2>&1 && echo "sshd 进程: $(pidof sshd)" || true
echo "### END"
`.trim();
}

/** 开机自启：写入 Buildroot 标准 init 脚本 /etc/init.d/S50sshd（rcS 会自动以 start 调用 S??*） */
const AUTOSTART_SCRIPT = `
mount -o remount,rw / 2>&1; echo "remount done"
cat > /etc/init.d/S50sshd <<'PMEOF'
#!/bin/sh
# 由 PenMods Installer 写入：开机自动启动 OpenSSH sshd
case "$1" in
  start|"")
    mkdir -p /var/empty /run/sshd /var/run/sshd
    [ -f /etc/ssh/ssh_host_rsa_key ] || /usr/bin/ssh-keygen -A
    /usr/sbin/sshd -o PermitRootLogin=yes -o PasswordAuthentication=yes
    ;;
  stop) kill $(pidof sshd) 2>/dev/null ;;
  restart) "$0" stop; sleep 1; "$0" start ;;
esac
PMEOF
chmod +x /etc/init.d/S50sshd
echo "### WROTE"
ls -l /etc/init.d/S50sshd
echo "### RCS_CHECK (确认开机会跑 init.d/S*)"
grep -nE "init.d|S\\?\\?|for .* in" /etc/init.d/rcS 2>/dev/null | head -10 || echo "(未找到 /etc/init.d/rcS — 机制可能不同)"
echo "### INITTAB"
grep -nE "rcS|sysinit|init.d" /etc/inittab 2>/dev/null || echo "(无 inittab 匹配)"
echo "### SSHD_SEVICE (固件自带脚本内容, 供参考)"
cat /usr/bin/sshd_sevice 2>/dev/null | head -40 || echo "(无)"
echo "### END"
`.trim();

/** 取消开机自启 */
const REMOVE_AUTOSTART_SCRIPT = `
mount -o remount,rw / 2>&1; echo "remount done"
rm -f /etc/init.d/S50sshd && echo "已删除 /etc/init.d/S50sshd" || echo "删除失败或本就不存在"
ls -l /etc/init.d/S50sshd 2>/dev/null || echo "(确认已移除)"
echo "### END"
`.trim();

type RunState = 'idle' | 'probing' | 'enabling' | 'autostart' | 'removing';

export function EnableSSH({ adb, connected, connectionType, onLog, onConnectSSH }: EnableSSHProps) {
  const [output, setOutput] = useState('');
  const [state, setState] = useState<RunState>('idle');
  const [port22, setPort22] = useState<boolean | null>(null);
  const [hasSshd, setHasSshd] = useState<boolean | null>(null);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPw, setShowPw] = useState(false);
  const [deviceIp, setDeviceIp] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const usbReady = !!adb && connected && connectionType === 'usb';

  /** 读取设备 IP → 用当前密码一键连接 SSH */
  const handleConnectSSH = useCallback(async () => {
    if (!adb || !onConnectSSH) return;
    setConnecting(true);
    onLog('读取设备网络 IP…');
    try {
      const out = await adb.shellScript(IP_SCRIPT);
      const ip = (out.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).find(x => !x.startsWith('127.'));
      if (!ip) {
        setOutput('未读取到设备网络 IP（设备需联网且有可达 IP）\n\n原始输出:\n' + out);
        onLog('✗ 未读取到设备网络 IP');
        return;
      }
      setDeviceIp(ip);
      onLog(`设备 IP: ${ip}，正在连接 SSH…`);
      await onConnectSSH(ip, password || DEFAULT_PASSWORD);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(prev => prev + `\n[读取 IP/连接失败] ${msg}`);
      onLog(`✗ ${msg}`);
    } finally {
      setConnecting(false);
    }
  }, [adb, onConnectSSH, onLog, password]);

  const run = useCallback(async (script: string, label: Exclude<RunState, 'idle'>, logMsg: string) => {
    if (!adb) return;
    setState(label);
    setOutput('');
    onLog(logMsg);
    try {
      const out = await adb.shellScript(script);
      setOutput(out);
      // 轻量解析状态
      const listening = /22 端口监听中/.test(out) || (/[:.]22\b/.test(out) && /LISTEN/i.test(out));
      const notListening = /22[^\n]*未监听/.test(out);
      if (label === 'enabling' || label === 'probing') {
        setPort22(listening ? true : notListening ? false : null);
      }
      if (label === 'probing') {
        setHasSshd(/sshd:\s*\/|\/usr\/sbin\/sshd/.test(out));
      }
      onLog('✓ 完成');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(prev => prev + `\n[执行失败] ${msg}`);
      onLog(`✗ ${msg}`);
    } finally {
      setState('idle');
    }
  }, [adb, onLog]);

  if (!usbReady) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl py-16 text-center">
        <svg className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="7" y="2" width="10" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="14"/><path d="M16 14H8a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/></svg>
        <p className="text-sm text-[#94a3b8]">请先用 <span className="font-medium text-[#64748b]">USB</span> 连接设备</p>
        <p className="text-xs text-[#cbd5e1] mt-1">本功能通过 USB(ADB) 引导开启设备的 SSH 服务，开启后即可切换到 SSH 模式</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <h2 className="text-sm font-semibold text-[#0f172a]">通过 USB 开启 SSH 服务</h2>
        </div>
        <p className="text-xs text-[#64748b] mb-4 leading-relaxed">
          适用于<span className="font-medium">未安装 PenMods</span> 的设备：用 USB 连接后，先「探测」看设备 SSH 环境，
          再「一键开启」启动服务并设置 root 密码。开启后切换顶部到 SSH 模式即可使用全部功能。
        </p>

        {/* root 密码（可自定义） */}
        <div className="mb-4">
          <label className="text-[10px] text-[#94a3b8] block mb-1">root 登录密码（开启时写入设备）</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input value={password} onChange={e => setPassword(e.target.value)}
                type={showPw ? 'text' : 'password'} placeholder={DEFAULT_PASSWORD}
                className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] font-mono pr-9" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a]">
                {showPw ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <button type="button" onClick={() => setPassword(DEFAULT_PASSWORD)}
              className="px-3 text-xs text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] whitespace-nowrap">默认</button>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => run(PROBE_SCRIPT, 'probing', '探测 SSH 环境…')} disabled={state !== 'idle'}
            className="flex-1 py-2.5 border border-[#e2e8f0] text-[#0f172a] rounded-lg text-sm font-medium hover:bg-[#f8fafc] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            {state === 'probing' ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            )}
            探测环境（只读）
          </button>
          <button onClick={() => run(enableScript(password || DEFAULT_PASSWORD), 'enabling', '开启 SSH 并设置密码…')} disabled={state !== 'idle'}
            className="flex-1 py-2.5 bg-[#0f172a] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            {state === 'enabling' ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            )}
            一键开启 SSH
          </button>
        </div>

        {/* 开机自启 */}
        <div className="flex gap-3 mt-3">
          <button onClick={() => run(AUTOSTART_SCRIPT, 'autostart', '设置开机自启…')} disabled={state !== 'idle'}
            className="flex-1 py-2 border border-[#2563eb] text-[#2563eb] rounded-lg text-xs font-medium hover:bg-[#eff6ff] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            {state === 'autostart' ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/></svg>
            )}
            设置开机自启
          </button>
          <button onClick={() => run(REMOVE_AUTOSTART_SCRIPT, 'removing', '取消开机自启…')} disabled={state !== 'idle'}
            className="px-4 py-2 border border-[#e2e8f0] text-[#64748b] rounded-lg text-xs font-medium hover:bg-[#f8fafc] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            {state === 'removing' ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
            ) : null}
            取消自启
          </button>
        </div>

        {/* 一键连接：自动读设备 IP + 当前密码，直接连 SSH，无需手动配置 */}
        {onConnectSSH && (
          <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
            <button onClick={handleConnectSSH} disabled={state !== 'idle' || connecting}
              className="w-full py-2.5 bg-[#2563eb] text-white rounded-lg text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {connecting ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              )}
              {connecting ? '连接中…' : '读取设备 IP 并一键连接 SSH'}
            </button>
            <p className="text-[10px] text-[#94a3b8] mt-1.5 text-center">
              自动获取设备网络 IP，用上方密码连接，连上后断开 USB 并跳到文件管理
              {deviceIp && <span className="text-[#64748b]"> · 上次 IP: <span className="font-mono">{deviceIp}</span></span>}
            </p>
          </div>
        )}

        {/* 状态徽标 */}
        {(port22 !== null || hasSshd !== null) && (
          <div className="flex gap-2 mt-4">
            {hasSshd !== null && (
              <span className={`text-xs px-2.5 py-1 rounded-full ${hasSshd ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                {hasSshd ? '✓ 检测到 sshd (OpenSSH)' : '✗ 未发现 sshd'}
              </span>
            )}
            {port22 !== null && (
              <span className={`text-xs px-2.5 py-1 rounded-full ${port22 ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fffbeb] text-[#d97706]'}`}>
                {port22 ? '✓ 22 端口监听中' : '22 端口未监听'}
              </span>
            )}
          </div>
        )}

        {/* 原始输出 */}
        {output && (
          <div className="mt-4">
            <div className="text-[10px] text-[#94a3b8] mb-1">设备输出</div>
            <pre className="terminal max-h-[360px] overflow-auto text-[11px] whitespace-pre-wrap break-all">{output}</pre>
          </div>
        )}
      </section>

      <div className="text-xs text-[#94a3b8] leading-relaxed px-1">
        <p className="font-medium text-[#64748b] mb-1">说明</p>
        <p>· 设备自带 OpenSSH（sshd + sftp-server + host key 齐全），无需推送二进制。</p>
        <p>· 「一键开启」会重挂载根分区、把 root 密码设为上方输入值、启动 sshd（强制允许 root + 密码登录）。</p>
        <p>· 密码写入 <code className="bg-[#f1f5f9] px-0.5 rounded">/etc/shadow</code> 持久保存，改密码后重新点「一键开启」即可生效。</p>
        <p>· 「设置开机自启」写入 <code className="bg-[#f1f5f9] px-0.5 rounded">/etc/init.d/S50sshd</code>，重启后自动拉起 sshd（沿用已设密码）。</p>
        <p>· 开启后用 SSH 模式连接，主机填设备 IP、端口 22、密码填你设置的值。</p>
      </div>
    </div>
  );
}
