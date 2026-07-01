import { Component, useState, useCallback, useRef, useEffect } from 'react';
import { AdbManager, type AdbProgressEvent, type DeviceStatus as DeviceStatusType } from './lib/adb';
import { Installer } from './lib/installer';
import { createSSHConnection } from './lib/device';
import { FileManager } from './pages/FileManager';
import { PluginInstall } from './pages/PluginInstall';
import { Shell } from './pages/Shell';
import { EnableSSH } from './pages/EnableSSH';
import { AppStore } from './pages/AppStore';
import { connectSSHProxy, disconnectSSH, setOnDisconnect } from './lib/ssh';
import { getInstallFiles, getInstallFilesFromZip, type InstallFile } from './lib/files';
import { IconPackage, IconUsb, IconZap, IconCheck,
  IconRefresh, IconUpload, IconTerminal, IconX
} from './components/icons';
import { DisclaimerModal } from './components/DisclaimerModal';

/** 错误边界 - 防止文件管理器崩溃导致整个页面白屏 */
class FileManagerErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 text-center">
          <svg className="w-12 h-12 text-[#dc2626] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm font-medium text-[#dc2626] mb-2">文件管理器加载异常</p>
          <p className="text-xs text-[#64748b] mb-4">{this.state.error?.message || '未知错误'}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs px-4 py-1.5 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** 安装步骤 */
type Step = 'idle' | 'installing' | 'done' | 'error';

/** 工具标签 */
type ToolTab = 'penmods' | 'files' | 'plugins' | 'ssh' | 'enable-ssh' | 'apps';

// 主导航（常用）
const MAIN_TABS: { id: ToolTab; label: string }[] = [
  { id: 'penmods', label: 'PenMods 安装' },
  { id: 'plugins', label: '插件安装' },
  { id: 'ssh', label: '终端' },
  { id: 'files', label: '文件管理' },
];
// 「更多 ⋯」二级菜单（工具/设置类）
const MORE_TABS: { id: ToolTab; label: string }[] = [
  { id: 'enable-ssh', label: '开启 SSH' },
  { id: 'apps', label: '安装包' },
];

function App() {
  const [activeTab, setActiveTab] = useState<ToolTab>('penmods');
  // 状态
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusType>('idle');
  const [deviceInfo, setDeviceInfo] = useState<{ model: string; serial: string } | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [selectedCert, setSelectedCert] = useState(true);
  const [zipInfo, setZipInfo] = useState<string | null>(null);
  const [zipWarnList, setZipWarnList] = useState<string[]>([]);
  const [zipFiles, setZipFiles] = useState<InstallFile[] | null>(null);
  const [updateSo, setUpdateSo] = useState<Uint8Array | null>(null);
  const [updateSoName, setUpdateSoName] = useState<string>('');
  const [logCollapsed, setLogCollapsed] = useState(true);

  const adbRef = useRef<AdbManager | null>(null);
  const installerRef = useRef<Installer | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // 连接模式: USB(ADB) 或 SSH（状态持久化到 localStorage）
  const [connMode, setConnMode] = useState<'usb' | 'ssh'>(() => {
    const saved = localStorage.getItem('connMode');
    return saved === 'ssh' ? 'ssh' : 'usb';
  });
  const [sshHost, setSshHost] = useState(() => localStorage.getItem('sshHost') || '');
  const [sshPort, setSshPort] = useState(() => localStorage.getItem('sshPort') || '22');
  const [sshPassword, setSshPassword] = useState(() => localStorage.getItem('sshPassword') || '');
  const [showSshPanel, setShowSshPanel] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // 持久化 SSH 配置
  useEffect(() => { localStorage.setItem('connMode', connMode); }, [connMode]);
  useEffect(() => { localStorage.setItem('sshHost', sshHost); }, [sshHost]);
  useEffect(() => { localStorage.setItem('sshPort', sshPort); }, [sshPort]);
  useEffect(() => { localStorage.setItem('sshPassword', sshPassword); }, [sshPassword]);

  // 自动滚动日志
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  /** 统一的「连接意外丢失」处理（USB 拔线/设备重启、SSH 掉线/代理崩溃都走这里） */
  const handleConnectionLost = useCallback(() => {
    adbRef.current = null;
    setDeviceStatus('idle');
    setDeviceInfo(null);
    setLog(prev =>
      prev[prev.length - 1]?.includes('连接已断开')
        ? prev
        : [...prev, '[warn] 设备连接已断开，请重新连接']
    );
  }, []);

  // SSH 意外掉线 → 刷新状态（主动断开不会触发）
  useEffect(() => {
    setOnDisconnect(handleConnectionLost);
    return () => setOnDisconnect(null);
  }, [handleConnectionLost]);

  // USB 物理拔线兜底（ADB 传输层的 disconnected 在 handleConnect 里另行监听）
  useEffect(() => {
    const handler = () => { if (adbRef.current) handleConnectionLost(); };
    navigator.usb?.addEventListener('disconnect', handler);
    return () => navigator.usb?.removeEventListener('disconnect', handler);
  }, [handleConnectionLost]);

  const onProgress = useCallback((event: AdbProgressEvent) => {
    if (event.type === 'connected') setDeviceStatus('connected');
    else if (event.type === 'error') setError(event.message);
    if (event.type === 'log' || event.type === 'status') {
      setLog(prev => [...prev, `[${event.type}] ${event.message}`]);
    }
  }, []);

  /** 连接设备 */
  const handleConnect = async () => {
    setError(null);
    setLog(prev => [...prev, '[info] 正在连接设备…']);
    setShowSshPanel(false);

    if (!AdbManager.isSupported) {
      const s = AdbManager.supportStatus;
      setError('浏览器不支持 WebUSB: ' + (s.reason || ''));
      setLog(prev => [...prev, '[error] 浏览器不支持 WebUSB']);
      return;
    }

    const adb = new AdbManager(onProgress);
    adbRef.current = adb;

    try {
      setDeviceStatus('connecting');
      await adb.requestDevice();
      setDeviceStatus('connected');

      const model = await adb.getProp('ro.product.model');
      setDeviceInfo({ model: model || '未知型号', serial: adb.serial || '' });

      // 监听 ADB 传输层断开（设备重启/USB 异常/拔线），仅对当前实例生效
      adb.adbInstance?.disconnected.then(() => {
        if (adbRef.current === adb) handleConnectionLost();
      }).catch(() => {});

      // 自动认证
      setLog(prev => [...prev, '[info] 正在密码认证…']);
      await adb.authPassword();
      setLog(prev => [...prev, '[success] 密码认证完成']);

    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : String(e);
      let msg = rawMsg;
      if (rawMsg.includes('busy') || rawMsg.includes('occupied') || rawMsg.includes('claimed') || rawMsg.includes('Interface')) {
        msg = 'USB 接口被占用 — 拔线重插，或执行: adb kill-server';
      } else if (rawMsg.includes('not found') || rawMsg.includes('No device')) {
        msg = '未检测到设备 — 确认 OTG 线已连接，ADB 已开启';
      }
      setDeviceStatus('error');
      setError(msg);
      setLog(prev => [...prev, `[error] ${msg}`]);
    }
  };

  /** 断开连接 */
  const handleDisconnect = async () => {
    if (connMode === 'usb') {
      // 先摘掉 ref，避免 disconnected promise 把主动断开误判为意外掉线
      const adb = adbRef.current;
      adbRef.current = null;
      await adb?.disconnect();
    } else {
      disconnectSSH();
    }
    deviceStatus !== 'idle' && setDeviceStatus('idle');
    setDeviceInfo(null);
  };

  /** SSH 连接（override 可显式指定主机/端口/密码，用于自动连接） */
  const handleSshConnect = async (
    override?: { host?: string; port?: string; password?: string }
  ): Promise<boolean> => {
    const host = override?.host ?? sshHost;
    const port = override?.port ?? sshPort;
    const password = override?.password ?? sshPassword;
    if (!host) return false;
    setShowSshPanel(false);
    setDeviceStatus('connecting');
    setError(null);
    setLog(prev => [...prev, `[info] 连接 SSH ${host}:${port}…`]);
    try {
      const pw = password ? `&password=${encodeURIComponent(password)}` : '';
      const proxyUrl = `ws://${window.location.host}/ws/ssh?target=${host}:${port}${pw}`;
      setLog(prev => [...prev, `[info] 代理地址: ws://${window.location.host}/ws/ssh?target=${host}:${port}&password=***`]);
      await connectSSHProxy(proxyUrl);
      setDeviceStatus('connected');
      setDeviceInfo({ model: 'SSH', serial: `${host}:${port}` });
      setLog(prev => [...prev, `[success] SSH 已连接 ${host}`]);
      return true;
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : String(e);
      let msg = rawMsg;
      if (rawMsg.includes('WebSocket') || rawMsg.includes('connect') || rawMsg.includes('refused')) {
        msg = `SSH 连接失败 — 确认:\n1.词典笔 SSH 已开启\n2.IP 地址正确\n(${rawMsg})`;
      }
      setDeviceStatus('error');
      setError(msg);
      setLog(prev => [...prev, `[error] SSH 连接失败: ${msg}`]);
      return false;
    }
  };

  /** 从「开启 SSH」页一键连接：填入设备 IP/密码 → 连接 → 成功后切到 SSH 模式并断开 USB */
  const autoConnectSSH = async (host: string, password: string) => {
    setSshHost(host);
    setSshPort('22');
    setSshPassword(password);
    const ok = await handleSshConnect({ host, port: '22', password });
    if (ok) {
      setConnMode('ssh');
      // 已不需要 USB；先摘 ref 再断开，避免 disconnected 回调误判为意外掉线
      if (adbRef.current) {
        const a = adbRef.current;
        adbRef.current = null;
        await a.disconnect().catch(() => {});
      }
      setActiveTab('files');
    }
  };

  /** 快速更新：选择 .so 文件后自动推送 */
  const handleSoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const data = new Uint8Array(reader.result as ArrayBuffer);
      setUpdateSo(data);
      setUpdateSoName(file.name);
      const logMsg = `[info] 已加载: ${file.name} (${(data.length / 1024).toFixed(0)}KB)`;
      setLog(prev => [...prev, logMsg]);

      // 设备已连接时自动推送（PenMods 安装仅支持 USB）
      if (adbRef.current && deviceStatus === 'connected' && connMode === 'usb') {
        setLog(prev => [...prev, '[info] 正在推送…']);
        try {
          await adbRef.current.pushFile(data, '/userdata/PenMods/libPenMods.so');
          setLog(prev => [...prev, '[success] 推送完成，重启词典笔即可生效']);
        } catch (e) {
          setLog(prev => [...prev, `[error] 推送失败: ${e instanceof Error ? e.message : String(e)}`]);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /** 上传 ZIP */
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLog(prev => [...prev, `[info] 正在解析 ${file.name} (${(file.size / 1024).toFixed(0)}KB)…`]);
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);

      const result = await getInstallFilesFromZip(zip);
      setZipFiles(result.files);
      setZipWarnList(result.warnings);

      setZipInfo(`已加载 ${result.fileCount} 个文件${result.warnings.length > 0 ? `，${result.warnings.length} 个警告` : ''}`);
      setLog(prev => [...prev, `[info] ZIP 解析完成，${result.fileCount} 个文件`]);
      for (const w of result.warnings) {
        setLog(prev => [...prev, `[warn] ${w}`]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setZipInfo(null);
      setZipWarnList([]);
      setZipFiles(null);
      setLog(prev => [...prev, `[error] ZIP 解析失败: ${msg}`]);
    }
  };

  /** 开始安装 */
  const handleInstall = async () => {
    setError(null);
    setStep('installing');
    setLog([]);
    setProgress(0);

    // PenMods 安装仅支持 USB
    const adb = adbRef.current;
    if (connMode === 'ssh' || !adb) {
      setError('PenMods 安装仅支持 USB 模式，请切换到 USB 并连接设备');
      setStep('error');
      return;
    }

    // 合并 ZIP 文件与默认文件：ZIP 中有则用 ZIP 的，没有则用内置的
    const defaultFiles = getInstallFiles();
    let mergedFiles = zipFiles
      ? defaultFiles.map(df => {
          const zf = zipFiles.find(f => f.name === df.name || f.remotePath === df.remotePath);
          return zf || df;
        })
      : [...defaultFiles];
    // 如果有单独上传的 SO，替换 libPenMods.so
    if (updateSo) {
      const soIdx = mergedFiles.findIndex(f => f.name === 'libPenMods.so');
      if (soIdx >= 0) {
        mergedFiles[soIdx] = { ...mergedFiles[soIdx], data: updateSo };
      }
      setLog(prev => [...prev, `[info] 使用自定义 libPenMods.so (${(updateSo.length / 1024).toFixed(0)}KB)`]);
    }
    setLog(prev => [...prev, `[info] 准备安装，共 ${mergedFiles.length} 个文件${zipFiles ? ' (已合并自定义包)' : ''}${updateSo ? ' + 自定义 SO' : ''}`]);

    const onState = (state: { progress: number; log: string[] }) => {
      setProgress(state.progress);
      setLog(state.log);
    };

    try {
      const installer = new Installer(adb, onState);
      installerRef.current = installer;
      await installer.install({ base: true, certs: selectedCert, rime: false }, mergedFiles);
      setStep('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStep('error');
    }
  };

  /** 卸载 PenMods（只移除 Mod，不清除用户数据） */
  const handleUninstall = async () => {
    if (!confirm('确定要卸载 PenMods 吗？\n\n将恢复原版应用并删除 Mod 文件，不会清除词典笔的个人数据。')) return;
    setLog([]);
    setLog(prev => [...prev, '[info] 开始卸载 PenMods…']);

    // PenMods 卸载仅支持 USB
    const adb = adbRef.current;
    if (connMode === 'ssh' || !adb) { setError('PenMods 卸载仅支持 USB 模式'); return; }

    try {
      setLog(prev => [...prev, '[info] 挂载可写…']);
      await adb.shellCommand('mount -o remount,rw /');

      setLog(prev => [...prev, '[info] 恢复原版应用…']);
      const bakResult = await adb.shellCommand('mv /oem/YoudaoDictPen/output/YoudaoDictPen.original_bak /oem/YoudaoDictPen/output/YoudaoDictPen 2>&1');
      setLog(prev => [...prev, '[info] ' + (bakResult || 'ok')]);

      setLog(prev => [...prev, '[info] 删除 Mod 文件…']);
      await adb.shellCommand('rm -rf /userdata/PenMods');
      await adb.shellCommand('rm -f /usr/bin/patchelf');
      setLog(prev => [...prev, '[success] PenMods 已移除']);

      setLog(prev => [...prev, '[info] 重启设备…']);
      await adb.reboot();
      setLog(prev => [...prev, '[success] 卸载完成，设备正在重启']);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLog(prev => [...prev, '[error] 卸载失败: ' + msg]);
    }
  };

  const moreActive = MORE_TABS.some(t => t.id === activeTab);

  /** 重置 */
  const handleReset = () => {
    setStep('idle');
    setError(null);
    setLog([]);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* 顶栏 */}
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 48 48" className="w-8 h-8">
                <defs>
                  <linearGradient id="hdr" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#2563eb"/>
                    <stop offset="100%" stop-color="#7c3aed"/>
                  </linearGradient>
                </defs>
                <rect width="48" height="48" rx="11" fill="url(#hdr)"/>
                <path d="M24 11c-1.3 0-2.5.9-3 2.2L15 30c-.4 1.1 0 2.4 1 3.1l8 5.5 8-5.5c1-.7 1.4-2 1-3.1L27 13.2c-.5-1.3-1.7-2.2-3-2.2Z" fill="#fff" opacity="0.95"/>
                <path d="M20.5 28.5c-.3 0-.5-.4-.3-.7l3.8-11c0-.1.2-.2.5-.2s.4.1.5.2l3.8 11c.2.3 0 .7-.3.7h-8Z" fill="#6366f1" opacity="0.8"/>
                <line x1="24" y1="25" x2="24" y2="37" stroke="#fff" stroke-width="1.5" opacity="0.4"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#0f172a]">PenMods Installer</h1>
              <p className="text-[10px] text-[#94a3b8] -mt-0.5">有道词典笔增强工具</p>
            </div>
          </div>
          {step !== 'idle' && (
            <button onClick={handleReset}
              className="text-xs text-[#64748b] hover:text-[#0f172a] flex items-center gap-1">
              <IconRefresh className="w-3.5 h-3.5" /> 重置
            </button>
          )}
        </div>
      </header>

      {/* 工具导航栏 + 全局连接状态 */}
      <div className="border-b border-[#e2e8f0] bg-white">
        <div className="max-w-3xl mx-auto px-6 flex items-center">
          {/* 主标签：仅这里可横向滚动 */}
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MAIN_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#0f172a] text-[#0f172a]'
                    : 'border-transparent text-[#94a3b8] hover:text-[#64748b]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* 更多 ⋯（放在滚动容器外，下拉不会被 overflow 裁剪，也不会被挤压） */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowMore(p => !p)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${
                moreActive ? 'border-[#0f172a] text-[#0f172a]' : 'border-transparent text-[#94a3b8] hover:text-[#64748b]'
              }`}>
              {moreActive ? MORE_TABS.find(t => t.id === activeTab)?.label : '更多'}
              <svg className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showMore && <div className="fixed inset-0 z-10" onClick={() => setShowMore(false)} />}
            {showMore && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#e2e8f0] rounded-lg shadow-lg py-1 min-w-[140px]">
                {MORE_TABS.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMore(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      activeTab === tab.id ? 'text-[#0f172a] bg-[#f8fafc] font-medium' : 'text-[#64748b] hover:bg-[#f8fafc]'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* 连接控件：独立一行，永不与标签互相挤压 */}
        <div className="max-w-3xl mx-auto px-6 pb-2 flex justify-end">
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 连接模式切换 — 始终显示 */}
            <div className="flex bg-[#f1f5f9] rounded-lg p-0.5 mr-2">
              <button onClick={() => {
                if (connMode !== 'usb' && deviceStatus === 'connected') handleDisconnect();
                setConnMode('usb');
              }}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${connMode === 'usb' ? 'bg-white shadow-sm text-[#0f172a]' : 'text-[#64748b]'}`}>
                <svg className="w-3.5 h-3.5 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="14"/><path d="M16 14H8a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/><circle cx="12" cy="20" r="1"/></svg>
                USB
              </button>
              <button onClick={() => {
                if (connMode !== 'ssh' && deviceStatus === 'connected') handleDisconnect();
                setConnMode('ssh');
              }}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${connMode === 'ssh' ? 'bg-white shadow-sm text-[#0f172a]' : 'text-[#64748b]'}`}>
                <svg className="w-3.5 h-3.5 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                SSH
              </button>
            </div>

            {deviceStatus === 'connected' ? (
              <>
                <span className={`status-dot online`} />
                <span className="text-xs text-[#64748b]">
                  {connMode === 'ssh' ? `SSH ${sshHost}` : (deviceInfo?.serial || '已连接')}
                </span>
                <button onClick={handleDisconnect}
                  className="text-xs px-2.5 py-1 border border-[#e2e8f0] rounded-md text-[#64748b] hover:bg-[#f8fafc]">断开</button>
              </>
            ) : connMode === 'ssh' ? (
              <div className="relative">
                <button onClick={() => setShowSshPanel(p => !p)}
                  className="text-xs px-3 py-1.5 bg-[#0f172a] text-white rounded-md hover:bg-[#1e293b] flex items-center gap-1.5 whitespace-nowrap">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  SSH 连接
                  <svg className={`w-3 h-3 transition-transform ${showSshPanel ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {showSshPanel && (
                  <div className="fixed inset-0 z-10" onClick={() => setShowSshPanel(false)} />
                )}
                {showSshPanel && (
                  <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-4 w-72">
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-[#94a3b8] block mb-1">主机名 (IP)</label>
                        <input value={sshHost} onChange={e => setSshHost(e.target.value)}
                          placeholder="192.168.x.x" autoFocus
                          className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-[#94a3b8] block mb-1">端口</label>
                          <input value={sshPort} onChange={e => setSshPort(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#94a3b8] block mb-1">密码</label>
                          <div className="relative">
                            <input value={sshPassword} onChange={e => setSshPassword(e.target.value)}
                              type={showPassword ? 'text' : 'password'}
                              placeholder="CherryYoudao"
                              className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] font-mono pr-8" />
                            <button type="button" onClick={() => setShowPassword(v => !v)}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-0.5">
                              {showPassword ? (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              ) : (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#94a3b8]">
                        默认用户名 <code className="bg-[#f1f5f9] px-1 rounded">root</code>
                        <br />需先开启 SSH 运行 + 开机自启
                      </p>
                      {deviceStatus === 'error' && (
                        <p className="text-[10px] text-[#dc2626] bg-[#fef2f2] px-2 py-1 rounded">{error}</p>
                      )}
                      {deviceStatus === 'connecting' ? (
                        <div className="w-full py-2 text-xs bg-[#e2e8f0] text-[#64748b] rounded-lg text-center flex items-center justify-center gap-2">
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                          连接中…
                        </div>
                      ) : (
                        <button onClick={() => handleSshConnect()} disabled={!sshHost}
                          className="w-full py-2 text-xs bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] disabled:opacity-40">
                          连接 SSH
                        </button>
                      )}
                      <p className="text-[10px] text-[#94a3b8] text-center">
                        Vite 已内置 SSH 代理，无需额外启动
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleConnect} disabled={deviceStatus === 'connecting'}
                className="text-xs px-2.5 py-1 bg-[#2563eb] text-white rounded-md hover:bg-[#1d4ed8] disabled:opacity-50">
                {deviceStatus === 'connecting' ? '连接中…' : 'USB 连接'}
              </button>
            )}
          </div>
        </div>
        {/* 连接错误提示 — 独立一行，不挤压标签 */}
        {error && deviceStatus === 'error' && (
          <div className="max-w-3xl mx-auto px-6 pb-2">
            <div className="flex items-center gap-2 text-[10px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-1.5">
              <span>⚠</span>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-[#94a3b8] hover:text-[#64748b] flex-shrink-0">✕</button>
            </div>
          </div>
        )}
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {activeTab === 'penmods' && (
        <>
        {/* PenMods 安装仅支持 USB */}
        {connMode === 'ssh' && (
          <div className="flex items-center gap-2 text-xs text-[#d97706] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-4 py-3">
            <span>⚠</span>
            <span className="flex-1">PenMods 安装/卸载/快速更新仅支持 <b>USB</b> 模式。请切换顶部连接为 USB。</span>
            <button onClick={() => setConnMode('usb')}
              className="px-2.5 py-1 bg-[#0f172a] text-white rounded-md hover:bg-[#1e293b] flex-shrink-0">切到 USB</button>
          </div>
        )}
        {/* ===== 步骤指示器 ===== */}
        <div className="flex items-center gap-0">
          {[
            { id: 'package', label: '安装包', icon: IconPackage },
            { id: 'device', label: '连接设备', icon: IconUsb },
            { id: 'install', label: '执行安装', icon: IconZap },
          ].map((s, i) => {
            const isActive =
              (s.id === 'package' && step === 'idle') ||
              (s.id === 'device' && (deviceStatus === 'connected' || deviceStatus === 'connecting')) ||
              (s.id === 'install' && (step === 'installing' || step === 'done' || step === 'error'));
            const isDone =
              (s.id === 'package' && deviceInfo) ||
              (s.id === 'device' && step !== 'idle') ||
              (s.id === 'install' && (step === 'done' || step === 'error'));
            return (
              <div key={s.id} className="flex items-center gap-0 flex-1">
                <div className={`flex items-center gap-2 ${isDone ? 'text-[#059669]' : isActive ? 'text-[#2563eb]' : 'text-[#94a3b8]'}`}>
                  <div className={`step-dot ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                    {isDone ? <IconCheck className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-[#e2e8f0] mx-3 mt-0.5" />}
              </div>
            );
          })}
        </div>

        {/* ===== ADB 开启指南 ===== */}
        {step === 'idle' && (
          <details className="card !p-3 group">
            <summary className="text-xs font-medium text-[#64748b] cursor-pointer select-none flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#94a3b8] group-open:rotate-90 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              如何开启词典笔 ADB 调试？
            </summary>
            <div className="mt-3 space-y-3 pl-5">
              {[
                ['打开「设置」', '在词典笔主屏幕找到并点击"设置"图标'],
                ['进入「关于」', '在设置列表中向下滑动，找到并点击"关于"'],
                ['点击「法律监管」10 次', '快速连续点击"法律监管"或"法律信息"10 次，直到屏幕提示"ADB 已开启"'],
                ['确认开启', '看到"ADB 已开启"提示即表示操作成功'],
              ].map(([title, desc], i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#2563eb] text-white rounded-full flex items-center justify-center text-[11px] font-bold">{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium text-[#0f172a]">{title}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ===== 1. 安装包 ===== */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <IconPackage className="w-4 h-4 text-[#64748b]" />
            <h2 className="text-sm font-semibold text-[#0f172a]">安装包</h2>
            {zipInfo && <span className="text-xs text-[#059669] ml-auto">{zipInfo}</span>}
          </div>

          <div
            className={`dropzone ${zipInfo ? 'has-file' : ''}`}
            onClick={() => document.getElementById('zip-input')?.click()}
          >
            <input id="zip-input" type="file" accept=".zip" className="hidden"
              onChange={handleZipUpload} />
            {zipInfo ? (
              <div className="text-sm">
                <IconCheck className="w-8 h-8 text-[#059669] mx-auto mb-2" />
                <p className="text-[#059669] font-medium">自定义安装包已加载</p>
                <p className="text-xs text-[#64748b] mt-1">点击重新选择</p>
                {zipWarnList.length > 0 && (
                  <div className="mt-3 text-xs text-[#d97706] bg-[#fffbeb] border border-[#fde68a] rounded-lg p-3 text-left">
                    <p className="font-medium mb-1">以下文件未找到：</p>
                    {zipWarnList.map((w, i) => <p key={i}>· {w}</p>)}
                    <p className="mt-1 text-[#92400e]">安装时缺少的文件将使用内置版本</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm">
                <IconUpload className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
                <p className="text-[#64748b] font-medium">上传 PenMods.zip</p>
                <p className="text-xs text-[#94a3b8] mt-1">留空将使用内置版本</p>
              </div>
            )}
          </div>
          {/* 快速更新 libPenMods.so */}
          <div className="mt-3 pt-3 border-t border-[#e2e8f0]">
            <div className="flex items-center gap-2 mb-2">
              <IconUpload className="w-3.5 h-3.5 text-[#64748b]" />
              <span className="text-xs font-medium text-[#64748b]">快速更新</span>
              <span className="text-[10px] text-[#94a3b8]">仅推送 libPenMods.so，不需完整安装</span>
            </div>
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 border border-dashed border-[#e2e8f0] rounded-lg text-sm text-[#64748b] ${connMode === 'ssh' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-[#2563eb]'}`}>
                <input type="file" accept=".so" className="hidden" onChange={handleSoUpload} disabled={connMode === 'ssh'} />
                {updateSo ? <span className="text-[#059669]">{updateSoName}</span> : <span>选择 libPenModsd.so</span>}
              </label>
              {updateSo && (
                <button onClick={() => { setUpdateSo(null); setUpdateSoName(''); }}
                  className="px-3 py-2.5 text-xs text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc]">清除</button>
              )}
            </div>
            <p className="text-xs text-[#64748b] mt-1.5">选择文件后自动推送，无需其他操作</p>
          </div>
        </section>

        {/* ===== 3. 安装 ===== */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <IconZap className="w-4 h-4 text-[#64748b]" />
            <h2 className="text-sm font-semibold text-[#0f172a]">安装</h2>
          </div>

          {/* 安装选项 */}
          <div className="space-y-2 mb-5">
            <label className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg cursor-pointer">
              <input type="checkbox" checked disabled className="accent-[#2563eb]" />
              <div>
                <span className="text-sm font-medium text-[#0f172a]">PenMods 核心</span>
                <span className="text-xs text-[#94a3b8] ml-2">必选</span>
                <p className="text-xs text-[#64748b]">Mod 运行时、文件管理器、AI 助手等全部功能</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg cursor-pointer"
              onClick={() => setSelectedCert(!selectedCert)}>
              <input type="checkbox" checked={selectedCert} readOnly className="accent-[#2563eb]" />
              <div>
                <span className="text-sm font-medium text-[#0f172a]">SSL 证书</span>
                <p className="text-xs text-[#64748b]">用于 AI 助手等联网功能</p>
              </div>
            </label>
          </div>

          {/* 安装按钮 */}
          {step === 'idle' && (
            <div className="flex gap-3">
              <button onClick={handleInstall} disabled={deviceStatus !== 'connected' || connMode === 'ssh'}
                className="flex-1 py-2.5 bg-[#0f172a] text-white rounded-lg text-sm font-medium
                  hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors flex items-center justify-center gap-2">
                <IconZap className="w-4 h-4" />
                开始安装
              </button>
              <button onClick={handleUninstall} disabled={deviceStatus !== 'connected' || connMode === 'ssh'}
                className="px-4 py-2.5 border border-[#dc2626] text-[#dc2626] rounded-lg text-sm font-medium
                  hover:bg-[#fef2f2] disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors flex items-center justify-center gap-2">
                <IconX className="w-4 h-4" />
                卸载
              </button>
            </div>
          )}
        </section>

        {/* ===== 进度/日志 ===== */}
        {(step === 'installing' || step === 'done' || step === 'error') && (
          <section className="card !p-0 overflow-hidden">
            {/* 进度条 */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
                <span>
                  {step === 'installing' && (progress < 50 ? '推送文件中…' : progress < 90 ? '执行安装脚本…' : '即将重启…')}
                  {step === 'done' && '安装完成'}
                  {step === 'error' && '安装失败'}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div className={`progress-bar ${step === 'done' ? 'success' : step === 'error' ? 'error' : ''}`}
                  style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* 终端日志 */}
            <div className="border-t border-[#e2e8f0]">
              <div className="flex items-center gap-1.5 px-5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <IconTerminal className="w-3.5 h-3.5 text-[#94a3b8]" />
                <span className="text-xs text-[#94a3b8]">输出日志</span>
              </div>
              <div ref={logRef} className="terminal max-h-[300px]" style={{ maxHeight: '300px' }}>
                <div className="text-[#64748b] text-[10px] mb-2">PenMods Installer v2.0 — {new Date().toLocaleString()}</div>
                {log.map((line, i) => {
                  let style = 'info';
                  if (line.includes('[success]') || line.includes('✓')) style = 'success';
                  else if (line.includes('[error]') || line.includes('✗')) style = 'error';
                  else if (line.includes('$ ')) style = 'prompt';
                  return (
                    <div key={i} className={`whitespace-pre-wrap break-all ${style}`}>
                      <span className="text-[#475569] mr-2">{'>'}</span>
                      {line.replace(/^\[\w+\]\s*/, '')}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 完成状态 */}
            {step === 'done' && (
              <div className="px-5 py-4 bg-[#ecfdf5] border-t border-[#a7f3d0]">
                <p className="text-sm font-medium text-[#059669]">安装完成</p>
                <p className="text-xs text-[#047857] mt-1">设备正在重启。如果屏幕不可用，长按电源键关机重启即可。</p>
                <button onClick={handleReset}
                  className="mt-3 text-xs px-4 py-1.5 bg-[#059669] text-white rounded-lg hover:bg-[#047857]">
                  返回首页
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="px-5 py-4 bg-[#fef2f2] border-t border-[#fecaca]">
                <p className="text-sm font-medium text-[#dc2626]">安装失败</p>
                <p className="text-xs text-[#b91c1c] mt-1">{error}</p>
                <button onClick={handleReset}
                  className="mt-3 text-xs px-4 py-1.5 bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c]">
                  返回重试
                </button>
              </div>
            )}
          </section>
        )}

        </>)}
        {activeTab === 'plugins' && (
          <PluginInstall
            adb={adbRef.current}
            connected={deviceStatus === 'connected'}
            connectionType={connMode}
            onLog={(msg) => setLog(prev => [...prev, msg])}
          />
        )}
        {activeTab === 'ssh' && (
          <Shell
            adb={adbRef.current}
            connected={deviceStatus === 'connected'}
            connectionType={connMode}
            onLog={(msg) => setLog(prev => [...prev, msg])}
          />
        )}
        {activeTab === 'enable-ssh' && (
          <EnableSSH
            adb={adbRef.current}
            connected={deviceStatus === 'connected'}
            connectionType={connMode}
            onLog={(msg) => setLog(prev => [...prev, msg])}
            onConnectSSH={autoConnectSSH}
          />
        )}
        {activeTab === 'apps' && (
          <AppStore
            conn={connMode === 'ssh' ? createSSHConnection() : adbRef.current}
            connected={deviceStatus === 'connected'}
            onLog={(msg) => setLog(prev => [...prev, msg])}
          />
        )}
        {/* youdaoEXT 暂时隐藏
        {activeTab === 'youdaoxt' && (
          <YoudaoExt
            adb={adbRef.current}
            connected={deviceStatus === 'connected'}
            onLog={(msg) => setLog(prev => [...prev, msg])}
          />
        )}
        */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <FileManagerErrorBoundary>
              <FileManager
                adb={adbRef.current}
                onLog={(msg) => setLog(prev => [...prev, msg])}
                connected={deviceStatus === 'connected'}
                connectionType={connMode}
              />
            </FileManagerErrorBoundary>
            {/* 日志 */}
            {log.length > 0 && (
              <div className="card !p-0 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] cursor-pointer select-none" onClick={() => setLogCollapsed(!logCollapsed)}>
                  <svg className={`w-3 h-3 text-[#94a3b8] transition-transform ${logCollapsed ? '' : 'rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  <span className="text-xs text-[#94a3b8]">操作日志</span>
                  <span className="text-[10px] text-[#cbd5e1] ml-1">({log.length} 条)</span>
                  <button onClick={e => { e.stopPropagation(); setLog([]); }} className="ml-auto text-xs text-[#94a3b8] hover:text-[#64748b]">清空</button>
                </div>
                {!logCollapsed && (
                  <div className="terminal max-h-[160px]" ref={logRef}>
                    <div className="text-[#64748b] text-[10px] mb-1">File Manager</div>
                    {log.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap break-all text-[#38bdf8]">
                        <span className="text-[#475569] mr-2">{'>'}</span>
                        {line.replace(/^\[\w+\]\s*/, '')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {showDisclaimer && (
        <DisclaimerModal
          onAccept={() => setShowDisclaimer(false)}
        />
      )}

      <footer className="text-center py-6 px-6 text-xs text-[#94a3b8]">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a href="https://github.com/skdkzzx/PenModsInstaller" target="_blank" rel="noopener"
            className="hover:text-[#64748b] transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            skdkzzx/PenModsInstaller
          </a>
          <span className="text-[#cbd5e1]">·</span>
          <a href="https://github.com/PenUniverse/PenMods" target="_blank" rel="noopener"
            className="hover:text-[#64748b] transition-colors flex items-center gap-1">
            原项目 PenUniverse/PenMods
          </a>
          <span className="text-[#cbd5e1]">·</span>
          <a href="https://ifdian.net/order/create?user_id=c2e3740cb7a811ef93d85254001e7c00&remark=&affiliate_code=&fr=afcom"
            target="_blank" rel="noopener"
            className="hover:text-[#ea580c] transition-colors flex items-center gap-1 text-[#f97316]">
            <span>❤️</span> 赞助
          </a>
          <span className="text-[#cbd5e1]">·</span>
          <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener" className="hover:text-[#64748b] transition-colors">GPL-3.0</a>
          <span className="text-[#cbd5e1]">·</span>
          <span>©2026 skdkzzx</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
