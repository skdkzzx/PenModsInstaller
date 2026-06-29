import { AdbManager } from './adb';

// ===================================================================
// youdaoEXT 安装/卸载/检测
//
// 用户上传 youdaoExt ZIP → 解析文件 → 推送 → shell 命令安装
// 安装逻辑对应 install.native.sh，卸载对应 uninstall.native.sh
// ===================================================================

export interface YoudaoExtFile {
  name: string;
  remotePath: string;
  data: Uint8Array;
}

export interface InstallProgress {
  done: number;
  total: number;
  file: string;
}

/** ZIP 中需要排除不推送的辅助脚本（安装/卸载/chroot 相关） */
const SKIP_FILES = new Set([
  'install.native.sh', 'install.chroot.sh',
  'uninstall.native.sh', 'uninstall.chroot.sh',
  'youdaoExt.sh.chroot', 'youdaoExt.sh.inchroot',
  'node.chroot',
]);

/**
 * 解析 ZIP 条目，映射远程路径，排除辅助脚本。
 * entries 由调用方提供（来自 ZIP 或文件夹），与插件安装的 parsePluginFromZip 类似。
 */
export async function getYoudaoExtFiles(
  entries: { path: string; getData: () => Promise<Uint8Array> }[],
): Promise<{ files: YoudaoExtFile[]; skipped: string[] }> {
  const allPaths = entries.map(e => e.path);
  const prefix = detectCommonPrefix(allPaths);
  const files: YoudaoExtFile[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const rel = prefix ? (entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : entry.path) : entry.path;
    const name = rel.split('/').filter(Boolean).pop() || rel;

    // 跳过安装/卸载脚本
    if (SKIP_FILES.has(name) || SKIP_FILES.has(rel)) {
      skipped.push(rel);
      continue;
    }

    const remotePath = mapRemotePath(rel, name);
    if (!remotePath) {
      skipped.push(rel);
      continue;
    }

    files.push({ name, remotePath, data: await entry.getData() });
  }

  return { files, skipped };
}

/** 检测 ZIP 内所有路径的公共前缀（如 "ydpExt/"） */
function detectCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const parts = paths.map(p => p.split('/').filter(Boolean));
  if (parts.length === 0) return '';
  const first = parts[0];
  if (first.length <= 1) return ''; // 根层文件，无公共前缀
  for (let i = 0; i < first.length - 1; i++) {
    const seg = first[i];
    if (parts.every(p => p[i] === seg)) continue;
    return parts[0].slice(0, i).join('/') + '/';
  }
  // 所有路径都在同一层目录下
  return first.slice(0, -1).join('/') + '/';
}

/** 将相对路径映射到设备上的绝对路径 */
function mapRemotePath(rel: string, _name: string): string | null {
  if (rel === 'youdaoExt.sh.native') return '/userdisk/youdaoExt.sh';
  if (rel === 'node.native') return '/userdisk/node';
  if (rel.startsWith('youdaoExt/') || rel === 'youdaoExt') {
    // youdaoExt 目录下的文件 → /userdisk/youdaoExt/...
    // 如果 rel 就是 youdaoExt 目录本身（dir），跳过
    if (rel === 'youdaoExt' || rel === 'youdaoExt/') return null;
    return '/userdisk/' + rel;
  }
  // 其他顶层文件 → /userdisk/
  if (!rel.includes('/')) return '/userdisk/' + rel;
  return '/userdisk/' + rel;
}

// ── 内置文件 ──

/**
 * 从服务器内置的 youdaoExt.zip 中获取安装文件。
 * 与用户上传 ZIP 走同样的解析路径。
 */
export async function getBuiltinYoudaoExtFiles(): Promise<{
  files: YoudaoExtFile[];
  skipped: string[];
  totalSize: number;
}> {
  const resp = await fetch('./files/youdaoExt.zip');
  if (!resp.ok) throw new Error('加载内置安装包失败: ' + resp.status);

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await resp.arrayBuffer());
  const entries = Object.values(zip.files).filter(f => !f.dir).map(f => ({
    path: f.name,
    getData: () => f.async('uint8array'),
  }));
  const { files, skipped } = await getYoudaoExtFiles(entries);
  const totalSize = files.reduce((s, f) => s + f.data.length, 0);
  return { files, skipped, totalSize };
}

// ── 安装 ──

/**
 * 执行 youdaoEXT 安装。
 * 流程匹配 install.native.sh：推文件 → 设权限 → 建软链 → 建目录 → 修改 runDictPen
 */
export async function installYoudaoExt(
  adb: AdbManager,
  files: YoudaoExtFile[],
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  const tmpZip = '/tmp/ydext_install_' + Date.now() + '.zip';

  // ── 1. 浏览器端打包成单一 ZIP，一次推送设备端解压 ──
  onProgress({ done: 0, total: files.length, file: '打包中…' });
  const JSZipMod = (await import('jszip')).default;
  const zip = new JSZipMod();
  for (const f of files) {
    const p = f.remotePath.startsWith('/') ? f.remotePath.slice(1) : f.remotePath;
    zip.file(p, f.data);
  }
  const zipData = await zip.generateAsync({ type: 'uint8array' });
  onProgress({ done: Math.round(files.length * 0.1), total: files.length, file: '推送中 (' + (zipData.length / 1024 / 1024).toFixed(1) + 'MB)…' });
  await adb.pushFile(zipData, tmpZip);
  onProgress({ done: Math.round(files.length * 0.3), total: files.length, file: '解压中…' });

  const out = await adb.shellScript(
    'cd / && unzip -o "' + tmpZip + '" 2>/dev/null && rm -f "' + tmpZip + '"'
  );
  if (/error|cannot|No such/i.test(out) && !/inflating|extracting/i.test(out)) {
    throw new Error('解压失败: ' + (out.split('\n')[0] || '未知错误'));
  }
  onProgress({ done: Math.round(files.length * 0.6), total: files.length, file: '解压完成，配置中…' });

  // ── 2. 设权限 + 建软链 + 建目录 + 修改 runDictPen ──
  const cmds = [
    'chmod +x /userdisk/youdaoExt.sh /userdisk/node 2>/dev/null',
    'ln -sf /userdisk/youdaoExt.sh /usr/bin/youdaoExt',
    'chmod +x /usr/bin/youdaoExt',
    'ln -sf /userdisk/node /usr/bin/node',
    'chmod +x /usr/bin/node',
    'mkdir -p /userdisk/Music/gpt /userdisk/Music/textweb/offline /userdisk/Music/textweb/cookie',
    'grep -q "youdaoExt" /usr/bin/runDictPen 2>/dev/null || { '
      + 'sed -i "1i sleep 5" /usr/bin/runDictPen 2>/dev/null; '
      + 'sed -i "1i youdaoExt &" /usr/bin/runDictPen 2>/dev/null; '
      + 'sed -i "1i #!/bin/sh" /usr/bin/runDictPen 2>/dev/null; '
      + 'chmod +x /usr/bin/runDictPen 2>/dev/null; }',
  ];

  for (const cmd of cmds) {
    await adb.shellScript(cmd);
  }
  onProgress({ done: Math.round(files.length * 0.8), total: files.length, file: '配置端点…' });
  await configureYoudaoExtEndpoint(adb);

  // ── 3. 验证 ──
  onProgress({ done: Math.round(files.length * 0.9), total: files.length, file: '验证安装…' });
  const errors = await verifyInstall(adb);
  if (errors.length > 0) {
    throw new Error('安装验证失败:\n' + errors.join('\n'));
  }

  onProgress({ done: files.length, total: files.length, file: '完成' });
}

// ── 验证 ──

async function verifyInstall(adb: AdbManager): Promise<string[]> {
  const errs: string[] = [];
  const checks = [
    { path: '/userdisk/youdaoExt.sh', label: '启动脚本' },
    { path: '/userdisk/node', label: 'Node 运行时' },
    { path: '/usr/bin/youdaoExt', label: 'youdaoExt 软链' },
    { path: '/usr/bin/node', label: 'node 软链' },
    { path: '/userdisk/youdaoExt/main.js', label: '引擎主程序' },
  ];
  for (const c of checks) {
    const out = await adb.shellCommand('ls -l "' + c.path + '" 2>/dev/null');
    if (!out || out.includes('No such') || out.includes('not found')) {
      errs.push(c.label + ' (' + c.path + ') 未找到');
    }
  }
  return errs;
}

// ── 端点配置 ──

const AI_ENDPOINT = 'http://127.0.0.2:9987/';
const ENDPOINT_CONFIG_PATHS = [
  '/userdata/PenMods/config.json',
  '/userdata/PenMods/settings.json',
  '/userdata/PenMods/ai_config.json',
  '/userdata/PenMods/endpoint.json',
  '/oem/YoudaoDictPen/output/config.json',
];

/**
 * 自动配置 PenMods AI 端点为 youdaoEXT 的地址。
 * 搜索已知的配置位置，找到后写入；找不到则创建默认位置。
 */
export async function configureYoudaoExtEndpoint(adb: AdbManager): Promise<boolean> {
  let foundPath = '';
  for (const p of ENDPOINT_CONFIG_PATHS) {
    const out = await adb.shellCommand('cat "' + p + '" 2>/dev/null');
    if (out && out.trim().startsWith('{')) {
      foundPath = p;
      break;
    }
  }

  if (!foundPath) {
    const search = await adb.shellScript(
      'find /userdata/PenMods /oem/YoudaoDictPen -name "*.json" 2>/dev/null | head -10'
    );
    const candidates = search.split('\n').filter(Boolean);
    for (const p of candidates) {
      const out = await adb.shellCommand('cat "' + p + '" 2>/dev/null');
      if (out && out.trim().startsWith('{') && (out.includes('api') || out.includes('endpoint') || out.includes('url'))) {
        foundPath = p;
        break;
      }
    }
  }

  const configBytes = new TextEncoder().encode(JSON.stringify({
    api_endpoint: AI_ENDPOINT, endpoint: AI_ENDPOINT,
    url: AI_ENDPOINT, server_addr: '127.0.0.2', api_port: 9987,
  }, null, 2));

  if (foundPath) {
    await adb.pushFile(configBytes, foundPath);
  } else {
    await adb.mkdir('/userdata/PenMods');
    await adb.pushFile(configBytes, '/userdata/PenMods/config.json');
  }
  return true;
}

// ── 卸载 ──

/**
 * 卸载 youdaoEXT，匹配 uninstall.native.sh
 */
export async function uninstallYoudaoExt(adb: AdbManager, onProgress: (p: InstallProgress) => void): Promise<void> {
  onProgress({ done: 0, total: 4, file: '移除软链…' });

  const cmds = [
    // 移除软链和文件
    'rm -f /usr/bin/youdaoExt /userdisk/youdaoExt.sh',
    'rm -f /usr/bin/node /userdisk/node',
    // 删除引擎 + 数据目录
    'rm -rf /userdisk/youdaoExt /userdisk/Music/textweb /userdisk/Music/gpt',
  ];

  for (let i = 0; i < cmds.length; i++) {
    await adb.shellScript(cmds[i]);
    onProgress({ done: i + 1, total: 4, file: i < 2 ? '移除软链…' : '删除目录…' });
  }

  onProgress({ done: 4, total: 4, file: '已卸载' });
}

// ── 检测 ──

/**
 * 检测设备上是否已安装 youdaoEXT（通过检查 /usr/bin/youdaoExt 是否存在）
 */
export async function isYoudaoExtInstalled(adb: AdbManager): Promise<boolean> {
  try {
    const out = await adb.shellCommand('ls -l /usr/bin/youdaoExt 2>/dev/null');
    return out.length > 0 && !out.includes('No such') && !out.includes('not found');
  } catch {
    return false;
  }
}
