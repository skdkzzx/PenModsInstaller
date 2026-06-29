import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AdbManager } from '../../lib/adb';
import type { DeviceConnection } from '../../lib/device';
import { createSSHConnection } from '../../lib/device';
import {
  parsePluginFromZip, parsePluginFromFiles, installPlugin,
  getInstalledPlugin, loadZipForPlugin, PLUGINS_DIR,
  type PluginPackage, type PluginMeta,
} from '../../lib/plugin-install';
import { IconPackage, IconUpload, IconCheck, IconRefresh } from '../../components/icons';

export interface PluginInstallProps {
  adb: AdbManager | null;
  connected: boolean;
  connectionType: 'usb' | 'ssh';
  onLog: (msg: string) => void;
}

interface InstalledPlugin {
  name: string;
  meta: PluginMeta;
}

export function PluginInstall({ adb, connected, connectionType, onLog }: PluginInstallProps) {
  const [loadedPlugin, setLoadedPlugin] = useState<PluginPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installDone, setInstallDone] = useState(false);
  const [installProgress, setInstallProgress] = useState<{ done: number; total: number; file: string } | null>(null);
  const [installedList, setInstalledList] = useState<InstalledPlugin[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  const zipRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const installedLoadedRef = useRef(false);

  // 根据连接模式选择后端
  const deviceConn = useMemo<DeviceConnection | null>(() => {
    if (!connected) return null;
    return connectionType === 'ssh' ? createSSHConnection() : adb;
  }, [connected, connectionType, adb]);

  // ── 从 ZIP 加载 ──
  const handleZip = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setLoadedPlugin(null); setInstallDone(false);
    try {
      onLog(`解析 ZIP: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);
      const zip = await loadZipForPlugin(file);
      const pkg = await parsePluginFromZip(zip);
      setLoadedPlugin(pkg);
      onLog(`✓ 识别为插件: ${pkg.name} v${pkg.meta.version || '?'}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); onLog(`✗ ${msg}`);
    } finally { setLoading(false); }
    // 清空 input 以便重新选同一个文件
    e.target.value = '';
  }, [onLog]);

  // ── 从文件夹加载 ──
  const handleFolder = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true); setError(null); setLoadedPlugin(null); setInstallDone(false);
    try {
      onLog(`解析文件夹 (${files.length} 个文件)`);
      const pkg = await parsePluginFromFiles(Array.from(files));
      setLoadedPlugin(pkg);
      onLog(`✓ 识别为插件: ${pkg.name} v${pkg.meta.version || '?'}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); onLog(`✗ ${msg}`);
    } finally { setLoading(false); }
    e.target.value = '';
  }, [onLog]);

  // ── 安装 ──
  const handleInstall = useCallback(async () => {
    if (!deviceConn || !loadedPlugin) return;
    setInstalling(true); setInstallDone(false); setError(null);
    onLog(`安装插件: ${loadedPlugin.name} (${loadedPlugin.files.length} 个文件)`);
    try {
      await installPlugin(deviceConn, loadedPlugin, (p) => {
        setInstallProgress(p);
        if (p.done % 5 === 0 || p.done === p.total) {
          onLog(`  [${p.done}/${p.total}] ${p.file}`);
        }
      });
      onLog(`✓ ${loadedPlugin.name} 安装完成，路径: ${PLUGINS_DIR}/${loadedPlugin.name}/`);
      setInstallDone(true);
      // 刷新已安装列表
      loadInstalled();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg); onLog(`✗ 安装失败: ${msg}`);
    } finally {
      setInstalling(false);
      setInstallProgress(null);
    }
  }, [deviceConn, loadedPlugin, onLog]);

  // ── 加载已安装列表 ──
  const loadInstalled = useCallback(async () => {
    if (!deviceConn) return;
    setInstalledLoading(true);
    const list: InstalledPlugin[] = [];
    try {
      const entries = await deviceConn.readDir(PLUGINS_DIR);
      const dirs = entries.filter(e => e.isDir);
      for (const dir of dirs) {
        try {
          const meta = await getInstalledPlugin(deviceConn, dir.name);
          if (meta) list.push({ name: dir.name, meta });
        } catch { /* 跳过无法读取的目录 */ }
      }
      setInstalledList(list);
    } catch (e) {
      // plugins 目录可能还不存在（首次使用）
      setInstalledList([]);
    }
    setInstalledLoading(false);
  }, [deviceConn]);

  // 连接后自动加载已安装列表
  useEffect(() => {
    if (connected && deviceConn && !installedLoadedRef.current) {
      installedLoadedRef.current = true;
      loadInstalled();
    }
    if (!connected) installedLoadedRef.current = false;
  }, [connected, deviceConn, loadInstalled]);

  // ── 卸载 ──
  const handleUninstall = useCallback(async (name: string) => {
    if (!deviceConn) return;
    if (!confirm(`确定卸载插件「${name}」吗？\n将删除 ${PLUGINS_DIR}/${name}/`)) return;
    onLog(`卸载插件: ${name}`);
    try {
      // noShell 连接（SSH）的 rm -rf 走 exec 不可靠，优先用 SFTP 递归删除
      if (deviceConn.removeDir) {
        await deviceConn.removeDir(`${PLUGINS_DIR}/${name}`);
      } else {
        await deviceConn.shellCommand(`rm -rf "${PLUGINS_DIR}/${name}"`);
      }
      onLog(`✓ ${name} 已卸载`);
      loadInstalled();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onLog(`✗ 卸载失败: ${msg}`);
    }
  }, [deviceConn, onLog, loadInstalled]);

  // ── 清除已加载插件 ──
  const clearLoaded = useCallback(() => {
    setLoadedPlugin(null); setError(null); setInstallDone(false);
  }, []);

  // ── 未连接 ──
  if (!connected) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl py-16 text-center">
        <svg className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        <p className="text-sm text-[#94a3b8]">请先在顶部连接设备</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 来源选择 ===== */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <IconPackage className="w-4 h-4 text-[#64748b]" />
          <h2 className="text-sm font-semibold text-[#0f172a]">选择插件来源</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* ZIP 上传 */}
          <div className="dropzone cursor-pointer" onClick={() => zipRef.current?.click()}>
            <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={handleZip} />
            <IconUpload className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
            <p className="text-sm text-[#64748b] font-medium">上传 ZIP</p>
            <p className="text-xs text-[#94a3b8] mt-1">压缩插件包</p>
          </div>

          {/* 文件夹选择 */}
          <div className="dropzone cursor-pointer" onClick={() => folderRef.current?.click()}>
            <input ref={folderRef} type="file" className="hidden" {...({webkitdirectory: ''} as any)} onChange={handleFolder} />
            <svg className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <p className="text-sm text-[#64748b] font-medium">选择文件夹</p>
            <p className="text-xs text-[#94a3b8] mt-1">已解压的插件目录</p>
          </div>
        </div>

        {/* 加载中 */}
        {loading && (
          <div className="flex items-center gap-2 mt-4 text-xs text-[#2563eb]">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            正在解析插件…
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div className="mt-4 px-4 py-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#dc2626] flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}
      </section>

      {/* ===== 已解析的插件信息 ===== */}
      {loadedPlugin && (
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <IconCheck className="w-4 h-4 text-[#059669]" />
            <h2 className="text-sm font-semibold text-[#0f172a]">待安装插件</h2>
            <button onClick={clearLoaded} className="ml-auto text-xs text-[#94a3b8] hover:text-[#64748b]">清除</button>
          </div>

          <div className="flex gap-4 p-4 bg-[#f8fafc] rounded-xl">
            {/* 图标 */}
            <div className="w-16 h-16 bg-white rounded-xl border border-[#e2e8f0] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {loadedPlugin.iconData ? (
                <img src={URL.createObjectURL(new Blob([loadedPlugin.iconData as BlobPart]))} alt={loadedPlugin.name}
                  className="w-full h-full object-contain" onLoad={e => URL.revokeObjectURL((e.target as HTMLImageElement).src)} />
              ) : (
                <svg className="w-8 h-8 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              )}
            </div>

            {/* 元信息 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-[#0f172a]">{loadedPlugin.meta.name || loadedPlugin.name}
                <span className="text-xs font-normal text-[#64748b] ml-2">v{loadedPlugin.meta.version || '?'}</span>
              </h3>
              {loadedPlugin.meta.author && (
                <p className="text-xs text-[#64748b] mt-0.5">作者: {loadedPlugin.meta.author}</p>
              )}
              {loadedPlugin.meta.description && (
                <p className="text-xs text-[#94a3b8] mt-1 line-clamp-2">{loadedPlugin.meta.description}</p>
              )}
              <p className="text-xs text-[#94a3b8] mt-1">{loadedPlugin.files.length} 个文件</p>
            </div>
          </div>

          {/* 安装进度 */}
          {installProgress && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
                <span>安装中… [{installProgress.done}/{installProgress.total}]</span>
                <span>{Math.round((installProgress.done / installProgress.total) * 100)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${(installProgress.done / installProgress.total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* 安装按钮 */}
          {!installing && !installDone && (
            <button onClick={handleInstall}
              className="mt-4 w-full py-2.5 bg-[#0f172a] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] transition-colors flex items-center justify-center gap-2">
              <IconPackage className="w-4 h-4" />
              安装到设备
            </button>
          )}

          {installing && (
            <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-sm text-[#1e40af]">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
              安装中… {installProgress ? `(${installProgress.done}/${installProgress.total})` : ''}
            </div>
          )}

          {installDone && (
            <div className="mt-4 px-4 py-2.5 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl text-sm text-[#059669] flex items-center gap-2">
              <IconCheck className="w-4 h-4" />
              安装完成！打开词典笔的「插件管理」即可看到。
            </div>
          )}
        </section>
      )}

      {/* ===== 已安装的插件 ===== */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
          <h2 className="text-sm font-semibold text-[#0f172a]">已安装</h2>
          <button onClick={loadInstalled} className="ml-auto text-xs text-[#94a3b8] hover:text-[#64748b] flex items-center gap-1">
            <IconRefresh className="w-3 h-3" /> 刷新
          </button>
        </div>

        {installedLoading ? (
          <div className="flex items-center gap-2 py-4 text-xs text-[#64748b]">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            加载已安装列表…
          </div>
        ) : installedList.length === 0 ? (
          <div className="py-8 text-center">
            <svg className="w-8 h-8 text-[#cbd5e1] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
            <p className="text-sm text-[#94a3b8]">暂无已安装的插件</p>
            <p className="text-xs text-[#cbd5e1] mt-1">选择上方 ZIP 或文件夹进行安装</p>
          </div>
        ) : (
          <div className="space-y-1">
            {installedList.map(p => (
              <div key={p.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f8fafc] transition-colors">
                <div className="w-8 h-8 bg-[#f1f5f9] rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#0f172a]">{p.meta.name || p.name}</span>
                  <span className="text-xs text-[#64748b] ml-2">v{p.meta.version || '?'}</span>
                  {p.meta.author && <span className="text-xs text-[#94a3b8] ml-2">· {p.meta.author}</span>}
                </div>
                <button onClick={() => handleUninstall(p.name)}
                  className="px-2.5 py-1 text-xs border border-[#e2e8f0] text-[#dc2626] rounded-lg hover:bg-[#fef2f2] transition-colors flex-shrink-0">
                  卸载
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
