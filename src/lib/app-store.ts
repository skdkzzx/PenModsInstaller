import type { DeviceConnection } from './device';

// ===================================================================
// 安装包上传安装
//
// 上传 .tar.gz 或 .zip 到 /userdisk，在设备端解压 + 跑 install.sh。
// 适用于 mpv 视频播放器、opkg 包管理器等需要推送压缩包再配置的软件。
// USB 和 SSH 都支持（走 DeviceConnection.runScript）。
// ===================================================================

export interface AppFile {
  /** 内置文件 URL（相对站点根） */
  url?: string;
  /** 设备上的目标路径 */
  remotePath: string;
  /** 自定义上传的文件数据 */
  data?: Uint8Array;
}

export interface AppPackage {
  id: string;
  name: string;
  description: string;
  sizeMB: number;
  files: AppFile[];
  /** 安装脚本（设备端 sh 执行，root） */
  script: string;
  /** 卸载脚本（可选） */
  uninstallScript?: string;
  isCustom?: boolean;
}

const MARKER = '__INSTALL_DONE__';

// ── 自定义包解析 ──

export interface CustomPackageInfo {
  fileName: string;
  data: Uint8Array;
  isTarGz: boolean;
  installScript?: string;
  installScriptName?: string;
  sizeMB: number;
}

export async function parseCustomPackage(
  pkgFile: File,
  scriptFile?: File | null,
): Promise<CustomPackageInfo> {
  const isZip = pkgFile.name.toLowerCase().endsWith('.zip');
  const isTarGz = pkgFile.name.toLowerCase().endsWith('.tar.gz') || pkgFile.name.toLowerCase().endsWith('.tgz');
  if (!isZip && !isTarGz) throw new Error('仅支持 .tar.gz / .tgz / .zip 格式的安装包');
  const data = new Uint8Array(await pkgFile.arrayBuffer());
  let installScript: string | undefined;
  let installScriptName: string | undefined;
  if (scriptFile) {
    installScript = await scriptFile.text();
    installScriptName = scriptFile.name;
  }
  return { fileName: pkgFile.name, data, isTarGz, installScript, installScriptName, sizeMB: data.byteLength / 1048576 };
}

export function buildCustomAppPackage(info: CustomPackageInfo): AppPackage {
  const ext = info.isTarGz ? '.tar.gz' : '.zip';
  const pkgName = info.fileName.replace(/\.(tar\.gz|tgz|zip)$/i, '');
  const files: AppFile[] = [{ data: info.data, remotePath: `/userdisk/__custom${ext}` }];
  if (info.installScript) {
    files.push({ data: new TextEncoder().encode(info.installScript), remotePath: '/userdisk/__custom_install.sh' });
  }
  const script = info.isTarGz
    ? `echo "解压 ${info.fileName}…"
cd /userdisk
tar -xzf __custom.tar.gz
if [ -f __custom_install.sh ]; then
  chmod +x __custom_install.sh
  echo "执行安装脚本…"
  ./__custom_install.sh
fi
rm -f /userdisk/__custom.tar.gz /userdisk/__custom_install.sh 2>/dev/null || true
echo "安装完成"`
    : `echo "解压 ${info.fileName}…"
cd /userdisk
unzip -o __custom.zip 2>&1
if [ -f __custom_install.sh ]; then
  chmod +x __custom_install.sh
  echo "执行安装脚本…"
  ./__custom_install.sh
fi
rm -f /userdisk/__custom.zip /userdisk/__custom_install.sh 2>/dev/null || true
echo "安装完成"`;
  return {
    id: 'custom_' + pkgName, name: pkgName,
    description: `自定义安装包${info.installScript ? ' + install.sh' : ''}`,
    sizeMB: info.sizeMB, isCustom: true, files, script,
    uninstallScript: `mount -o remount,rw / 2>/dev/null
echo "清理临时文件…"
rm -f /userdisk/__custom.tar.gz /userdisk/__custom.zip /userdisk/__custom_install.sh 2>/dev/null || true
echo "移除应用目录（/userdisk/${pkgName}）…"
rm -rf "/userdisk/${pkgName}" 2>/dev/null || echo "（目录不存在，跳过）"
sync
echo "${pkgName} 已卸载"`,
  };
}

// ── 安装 ──

export async function installApp(
  conn: DeviceConnection,
  app: AppPackage,
  onLog: (msg: string) => void,
): Promise<void> {
  if (!conn.runScript) throw new Error('当前连接不支持执行脚本');
  for (const f of app.files) {
    const fname = f.remotePath.split('/').pop();
    let data: Uint8Array;
    if (f.data) data = f.data;
    else if (f.url) {
      const resp = await fetch(f.url);
      if (!resp.ok) throw new Error(`内置文件缺失: ${f.url} (HTTP ${resp.status})`);
      data = new Uint8Array(await resp.arrayBuffer());
    } else continue;
    await conn.pushFile(data, f.remotePath);
    onLog(`✓ 已推送 ${fname} (${(data.length / 1048576).toFixed(1)}MB)`);
  }
  onLog('执行安装脚本…');
  const { output } = await conn.runScript(app.script + `\necho ${MARKER}`, (chunk) => {
    for (const line of chunk.split('\n')) {
      const t = line.trimEnd();
      if (t.trim() && !t.includes(MARKER)) onLog('  ' + t);
    }
  });
  if (!output.includes(MARKER)) throw new Error('安装脚本未正常结束（见上方输出）');
  onLog('✓ 安装完成');
}

// ── 卸载（保留供内部/未来使用） ──

export async function uninstallApp(
  conn: DeviceConnection,
  app: AppPackage,
  onLog: (msg: string) => void,
): Promise<void> {
  if (!app.uninstallScript) throw new Error('该包不支持自动卸载');
  if (!conn.runScript) throw new Error('当前连接不支持执行脚本');
  onLog(`卸载 ${app.name}…`);
  const { output } = await conn.runScript(app.uninstallScript + `\necho ${MARKER}`, (chunk) => {
    for (const line of chunk.split('\n')) {
      const t = line.trimEnd();
      if (t.trim() && !t.includes(MARKER)) onLog('  ' + t);
    }
  });
  if (!output.includes(MARKER)) throw new Error('卸载脚本未正常结束');
  onLog('✓ 已卸载');
}
