import { useState, useCallback, useRef, useEffect } from 'react';
import type { DeviceConnection } from '../../lib/device';
import {
  installApp,
  parseCustomPackage, buildCustomAppPackage,
  type CustomPackageInfo,
} from '../../lib/app-store';
import { IconUpload, IconTerminal } from '../../components/icons';

export interface AppStoreProps {
  conn: DeviceConnection | null;
  connected: boolean;
  onLog: (msg: string) => void;
}

export function AppStore({ conn, connected, onLog }: AppStoreProps) {
  const [installing, setInstalling] = useState(false);
  const [outputLog, setOutputLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [outputLog]);

  const [customPkg, setCustomPkg] = useState<CustomPackageInfo | null>(null);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const pkgRef = useRef<HTMLInputElement>(null);
  const scriptRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((msg: string) => {
    setOutputLog(prev => [...prev, msg]);
    onLog(msg);
  }, [onLog]);

  // ── 安装 ──
  const handleInstall = useCallback(async () => {
    if (!conn || !connected || !customPkg) return;
    const app = buildCustomAppPackage(customPkg);
    setInstalling(true);
    setOutputLog([]);
    addLog(`--- 安装: ${customPkg.fileName} ---`);
    try {
      await installApp(conn, app, (msg) => addLog(msg));
      addLog(`✓ 安装完成`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`✗ 安装失败: ${msg}`);
    } finally {
      setInstalling(false);
    }
  }, [conn, connected, customPkg, addLog]);

  const handlePkgSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const info = await parseCustomPackage(file, scriptFile);
      setCustomPkg(info);
      addLog(`已选择: ${info.fileName} (${info.sizeMB.toFixed(1)}MB)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`✗ ${msg}`);
    }
    e.target.value = '';
  }, [scriptFile, addLog]);

  const handleScriptSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScriptFile(file);
    addLog(`已选择安装脚本: ${file.name}`);
    e.target.value = '';
  }, [addLog]);

  if (!connected || !conn) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl py-16 text-center">
        <svg className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
        <p className="text-sm text-[#94a3b8]">请先连接设备（USB 或 SSH）</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 上传 ===== */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <IconUpload className="w-4 h-4 text-[#64748b]" />
          <h2 className="text-sm font-semibold text-[#0f172a]">安装包上传</h2>
        </div>
        <p className="text-xs text-[#64748b] mb-4 leading-relaxed">
          上传 <code className="bg-[#f1f5f9] px-1 rounded">.tar.gz</code> 或 <code className="bg-[#f1f5f9] px-1 rounded">.zip</code>
          到设备自动解压，可选配 <code className="bg-[#f1f5f9] px-1 rounded">install.sh</code> 作为安装脚本。
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="dropzone cursor-pointer" onClick={() => pkgRef.current?.click()}
            style={customPkg ? { borderColor: '#059669', backgroundColor: '#f0fdf4' } : {}}>
            <input ref={pkgRef} type="file" accept=".tar.gz,.tgz,.zip" className="hidden" onChange={handlePkgSelect} />
            <IconUpload className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
            <p className="text-sm text-[#64748b] font-medium">压缩包</p>
            <p className="text-xs text-[#94a3b8] mt-1">{customPkg ? customPkg.fileName : '.tar.gz / .zip'}</p>
          </div>
          <div className={`dropzone cursor-pointer ${scriptFile ? 'has-file' : ''}`} onClick={() => scriptRef.current?.click()}>
            <input ref={scriptRef} type="file" accept=".sh" className="hidden" onChange={handleScriptSelect} />
            <svg className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <p className="text-sm text-[#64748b] font-medium">install.sh</p>
            <p className="text-xs text-[#94a3b8] mt-1">{scriptFile ? scriptFile.name : '可选'}</p>
          </div>
        </div>
        {customPkg && (
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-[#059669]">✓ {customPkg.fileName} ({customPkg.sizeMB.toFixed(1)}MB)</span>
            <button onClick={() => { setCustomPkg(null); setScriptFile(null); }} className="text-[#dc2626] hover:underline">清除</button>
          </div>
        )}
        {customPkg && (
          <button onClick={handleInstall} disabled={!connected || installing}
            className="mt-3 w-full py-2.5 bg-[#2563eb] text-white rounded-lg text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            <IconUpload className="w-4 h-4" />
            {installing ? '安装中…' : '安装到设备'}
          </button>
        )}
      </section>

      {/* ===== 终端输出 ===== */}
      {(installing || outputLog.length > 0) && (
        <section className="card !p-0 overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <IconTerminal className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span className="text-xs text-[#94a3b8]">安装输出</span>
            {installing && (
              <div className="flex items-center gap-1.5 ml-2">
                <svg className="w-3 h-3 animate-spin text-[#2563eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                <span className="text-[10px] text-[#2563eb]">运行中…</span>
              </div>
            )}
            <button onClick={() => setOutputLog([])} className="ml-auto text-xs text-[#94a3b8] hover:text-[#64748b]">清空</button>
          </div>
          <div ref={logRef} className="terminal max-h-[300px]">
            <div className="text-[#64748b] text-[10px] mb-2">Package Installer — {new Date().toLocaleString()}</div>
            {outputLog.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                <span className="text-[#475569] mr-2">{'>'}</span>
                {line.replace(/^\[\w+\]\s*/, '')}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
