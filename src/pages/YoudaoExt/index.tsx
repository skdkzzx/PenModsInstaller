import { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { AdbManager } from '../../lib/adb';
import {
  getYoudaoExtFiles, getBuiltinYoudaoExtFiles,
  installYoudaoExt, uninstallYoudaoExt, isYoudaoExtInstalled,
  configureYoudaoExtEndpoint,
  type YoudaoExtFile, type InstallProgress,
} from '../../lib/youdaoxt';
import { IconPackage, IconUpload, IconCheck, IconX, IconRefresh, IconTerminal } from '../../components/icons';

export interface YoudaoExtProps {
  adb: AdbManager | null;
  connected: boolean;
  onLog: (msg: string) => void;
}

export function YoudaoExt({ adb, connected, onLog }: YoudaoExtProps) {
  const [parsedFiles, setParsedFiles] = useState<YoudaoExtFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installDone, setInstallDone] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [localLog, setLocalLog] = useState<string[]>([]);
  const [logCollapsed, setLogCollapsed] = useState(true);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [localLog]);

  const addLog = useCallback((msg: string) => {
    setLocalLog(prev => [...prev, msg]);
    onLog(msg);
  }, [onLog]);

  // ── 加载内置安装包 ──
  const handleBuiltin = useCallback(async () => {
    setLoading(true); setError(null); setParsedFiles(null); setInstallDone(false);
    setLocalLog([]);
    try {
      addLog('[info] 正在加载内置安装包…');
      const { files, skipped, totalSize } = await getBuiltinYoudaoExtFiles();
      setParsedFiles(files);
      setSourceLabel(`内置安装包 (${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
      addLog(`[success] 加载完成: ${files.length} 个文件，${(totalSize / 1024 / 1024).toFixed(1)}MB` +
        (skipped.length ? `，跳过 ${skipped.length} 个辅助文件` : ''));
      setLogCollapsed(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); addLog(`[error] ${msg}`);
    } finally { setLoading(false); }
  }, [addLog]);

  // ── 上传 ZIP ──
  const handleZip = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setParsedFiles(null); setInstallDone(false);
    setLocalLog([]);
    try {
      addLog(`[info] 解析 ZIP: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(f => !f.dir).map(f => ({
        path: f.name,
        getData: () => f.async('uint8array'),
      }));
      const result = await getYoudaoExtFiles(entries);
      setParsedFiles(result.files);
      setSourceLabel(file.name);
      const totalSize = result.files.reduce((s, f) => s + f.data.length, 0);
      addLog(`[success] 识别 ${result.files.length} 个文件，共 ${(totalSize / 1024 / 1024).toFixed(1)}MB` +
        (result.skipped.length ? `，跳过 ${result.skipped.length} 个辅助脚本` : ''));
      setLogCollapsed(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); addLog(`[error] ${msg}`);
    } finally { setLoading(false); }
    e.target.value = '';
  }, [addLog]);

  // ── 安装 ──
  const handleInstall = useCallback(async () => {
    if (!adb || !parsedFiles) return;
    setInstalling(true); setInstallDone(false); setError(null);
    addLog('[info] 开始安装 youdaoEXT…');
    addLog(`[info] 推送 ${parsedFiles.length} 个文件…`);
    try {
      await installYoudaoExt(adb, parsedFiles, (p) => {
        setInstallProgress(p);
        if (p.done % 5 === 0 || p.done === p.total) addLog(`  [${p.done}/${p.total}] ${p.file}`);
      });
      addLog('[success] youdaoEXT 安装完成');
      addLog('[info] 开机自启和 AI 端点已自动配置');
      setInstallDone(true);
      setInstalled(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); addLog(`[error] ✗ 安装失败: ${msg}`);
    } finally {
      setInstalling(false);
      setInstallProgress(null);
    }
  }, [adb, parsedFiles, addLog]);

  // ── 配置端点 ──
  const handleConfigureEndpoint = useCallback(async () => {
    if (!adb) return;
    setConfigMsg(null);
    addLog('[info] 配置 AI 端点…');
    try {
      await configureYoudaoExtEndpoint(adb);
      setConfigMsg('✓ AI 端点已配置: http://127.0.0.2:9987/');
      addLog('[success] AI 端点已配置');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConfigMsg('✗ 配置失败: ' + msg);
      addLog(`[error] ${msg}`);
    }
  }, [adb, addLog]);

  // ── 卸载 ──
  const handleUninstall = useCallback(async () => {
    if (!adb) return;
    if (!confirm('确定卸载 youdaoEXT 吗？\n将移除 youdaoExt 引擎、Node.js 运行时、扩展及数据目录。')) return;
    setInstalling(true); setError(null); setLocalLog([]);
    addLog('[info] 卸载 youdaoEXT…');
    try {
      await uninstallYoudaoExt(adb, (p) => {
        setInstallProgress(p);
        if (p.done === p.total) addLog('  ✓ ' + p.file);
      });
      addLog('[success] youdaoEXT 已卸载');
      setInstalled(false);
      setParsedFiles(null);
      setInstallDone(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`[error] ✗ 卸载失败: ${msg}`);
    } finally {
      setInstalling(false);
      setInstallProgress(null);
    }
  }, [adb, addLog]);

  // ── 检测 ──
  const checkInstalled = useCallback(async () => {
    if (!adb) return;
    setChecking(true);
    const ok = await isYoudaoExtInstalled(adb);
    setInstalled(ok);
    setChecking(false);
  }, [adb]);

  useEffect(() => {
    if (connected && adb) { checkInstalled(); setLocalLog([]); setConfigMsg(null); }
    if (!connected) { setInstalled(null); setParsedFiles(null); }
  }, [connected, adb, checkInstalled]);

  const clearState = useCallback(() => {
    setParsedFiles(null); setError(null); setInstallDone(false); setLocalLog([]); setSourceLabel(''); setConfigMsg(null);
  }, []);

  // ── 未连接 ──
  if (!connected) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl py-16 text-center">
        <svg className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <p className="text-sm text-[#94a3b8]">请先在顶部连接设备</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 状态 + 卸载 ===== */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <h2 className="text-sm font-semibold text-[#0f172a]">安装状态</h2>
          <button onClick={checkInstalled} className="ml-auto text-xs text-[#94a3b8] hover:text-[#64748b] flex items-center gap-1">
            <IconRefresh className="w-3 h-3" /> 检测
          </button>
        </div>
        {checking ? (
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            检测中…
          </div>
        ) : installed === true ? (
          <div className="px-4 py-3 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl flex items-center gap-3">
            <IconCheck className="w-5 h-5 text-[#059669]" />
            <div>
              <p className="text-sm font-medium text-[#059669]">youdaoEXT 已安装</p>
              <p className="text-xs text-[#047857] mt-0.5">
                /usr/bin/youdaoExt ✓&emsp;开机自启 ✓
              </p>
            </div>
            <button onClick={handleUninstall} disabled={installing}
              className="ml-auto px-3 py-1.5 text-xs bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
              <IconX className="w-3 h-3" /> 卸载
            </button>
          </div>
        ) : installed === false ? (
          <div className="px-4 py-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl">
            <p className="text-sm font-medium text-[#92400e]">尚未安装</p>
            <p className="text-xs text-[#92400e] mt-0.5">使用内置包或上传 ZIP 后安装</p>
          </div>
        ) : (
          <div className="text-xs text-[#94a3b8]">正在检测设备信息…</div>
        )}
      </section>

      {/* ===== 安装包来源 ===== */}
      {!installDone && (
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <IconPackage className="w-4 h-4 text-[#64748b]" />
          <h2 className="text-sm font-semibold text-[#0f172a]">安装包</h2>
          {sourceLabel && <span className="text-xs text-[#059669] ml-auto">{sourceLabel}</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleBuiltin} disabled={loading || installing}
            className="dropzone cursor-pointer border-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <p className="text-sm text-[#64748b] font-medium">内置安装包</p>
            <p className="text-xs text-[#94a3b8] mt-1">一键安装，无需下载</p>
          </button>
          <div className="dropzone cursor-pointer" onClick={() => zipRef.current?.click()}>
            <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={handleZip} />
            <IconUpload className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
            <p className="text-sm text-[#64748b] font-medium">上传 ZIP</p>
            <p className="text-xs text-[#94a3b8] mt-1">发布页下载的安装包</p>
          </div>
        </div>
        {loading && (
          <div className="flex items-center gap-2 mt-4 text-xs text-[#2563eb]">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            正在解析安装包…
          </div>
        )}
        {error && (
          <div className="mt-4 px-4 py-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#dc2626] flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}
      </section>
      )}

      {/* ===== 文件清单 + 安装 ===== */}
      {parsedFiles && !installDone && (
        <section className="card">
          <div className="flex items-center gap-2 mb-3">
            <IconCheck className="w-4 h-4 text-[#059669]" />
            <h2 className="text-sm font-semibold text-[#0f172a]">待安装</h2>
            <button onClick={clearState} className="ml-auto text-xs text-[#94a3b8] hover:text-[#64748b]">清除</button>
          </div>

          {installProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
                <span>{installProgress.file}</span>
                <span>{installProgress.total > 0 ? Math.round((installProgress.done / installProgress.total) * 100) : 0}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${installProgress.total > 0 ? (installProgress.done / installProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          <div className="border border-[#e2e8f0] rounded-xl overflow-hidden mb-4">
            <div className="flex items-center gap-1.5 px-4 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] cursor-pointer select-none"
              onClick={() => setLogCollapsed(!logCollapsed)}>
              <svg className={`w-3 h-3 text-[#94a3b8] transition-transform ${logCollapsed ? '' : 'rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              <IconTerminal className="w-3.5 h-3.5 text-[#94a3b8]" />
              <span className="text-xs text-[#94a3b8]">输出日志</span>
              <span className="text-[10px] text-[#cbd5e1] ml-1">({localLog.length} 条)</span>
            </div>
            {!logCollapsed && (
              <div ref={logRef} className="terminal max-h-[240px]" style={{ maxHeight: '240px' }}>
                <div className="text-[#64748b] text-[10px] mb-2">youdaoEXT Installer — {new Date().toLocaleString()}</div>
                {localLog.map((line, i) => {
                  let style = 'info';
                  if (line.includes('[success]')) style = 'success';
                  else if (line.includes('[error]')) style = 'error';
                  return (
                    <div key={i} className={`whitespace-pre-wrap break-all ${style}`}>
                      <span className="text-[#475569] mr-2">{'>'}</span>
                      {line.replace(/^\[\w+\]\s*/, '')}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!installing && (
            <button onClick={handleInstall}
              className="w-full py-2.5 bg-[#0f172a] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] transition-colors flex items-center justify-center gap-2">
              <IconPackage className="w-4 h-4" />
              安装 youdaoEXT
            </button>
          )}
          {installing && (
            <div className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-sm text-[#1e40af]">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
              安装中… {installProgress ? `(${installProgress.done}/${installProgress.total})` : ''}
            </div>
          )}
        </section>
      )}

      {/* ===== 安装完成 + 使用说明 ===== */}
      {installDone && (
        <section className="card !border-[#a7f3d0] !bg-[#ecfdf5]">
          <div className="flex items-center gap-2 mb-4">
            <IconCheck className="w-5 h-5 text-[#059669]" />
            <h2 className="text-base font-semibold text-[#059669]">安装完成</h2>
          </div>

          <div className="space-y-3 text-sm text-[#065f46]">
            <div className="bg-white/70 rounded-xl p-4 space-y-2">
              <p className="font-medium">📋 使用说明</p>
              <ol className="list-decimal list-inside space-y-1.5 text-xs">
                <li><strong>重启词典笔</strong>（或等 20 秒自动启动）</li>
                <li>打开 PenMods <strong>AI 助手</strong>界面</li>
                <li>进入<strong>设置</strong>，确认 API 地址为：<code className="bg-white px-1.5 py-0.5 rounded font-mono text-[#059669]">http://127.0.0.2:9987/</code></li>
                <li>输入内容即可使用 AI + 扩展功能</li>
                <li>扩展命令：<code className="bg-white px-1.5 py-0.5 rounded font-mono">gpt</code>、<code className="bg-white px-1.5 py-0.5 rounded font-mono">2048</code>、<code className="bg-white px-1.5 py-0.5 rounded font-mono">#exit</code> 退出</li>
              </ol>
            </div>

            <div className="bg-white/70 rounded-xl p-4 space-y-2">
              <p className="font-medium">⚙️ 端点配置</p>
              <p className="text-xs">AI 端点已自动写入配置文件。若手动设置无效，点此重新配置：</p>
              <button onClick={handleConfigureEndpoint}
                className="mt-1 px-3 py-1.5 text-xs bg-[#059669] text-white rounded-lg hover:bg-[#047857]">
                配置 AI 端点
              </button>
              {configMsg && (
                <p className={`text-xs mt-1 ${configMsg.startsWith('✓') ? 'text-[#059669]' : 'text-[#dc2626]'}`}>{configMsg}</p>
              )}
            </div>

            <div className="bg-white/70 rounded-xl p-4 space-y-2">
              <p className="font-medium">🔄 重启服务</p>
              <p className="text-xs">如果 youdaoEXT 未启动，手动执行：</p>
              <code className="block bg-white px-2 py-1 rounded font-mono text-xs mt-1">youdaoExt</code>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handleUninstall} disabled={installing}
              className="px-4 py-2 text-xs border border-[#dc2626] text-[#dc2626] rounded-lg hover:bg-[#fef2f2] disabled:opacity-50">
              卸载 youdaoEXT
            </button>
            <button onClick={clearState}
              className="px-4 py-2 text-xs text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-white">
              返回
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
