import type JSZip from 'jszip';
import type { DeviceConnection } from './device';

// ===================================================================
// PenMods 插件（应用）安装
//
// 插件 = 一个含 metadata.json 的文件夹，安装即把该文件夹推送到
// /userdisk/PenMods/plugins/<插件名>/。支持两种来源：
//   - ZIP 包（群文件常见形态）
//   - 本地文件夹（webkitdirectory 选择）
// 两者统一解析为 PluginPackage 后走同一条推送流程。
// ===================================================================

export const PLUGINS_DIR = '/userdisk/PenMods/plugins';

export interface PluginMeta {
  id?: string;
  name?: string;
  version?: string;
  author?: string;
  description?: string;
  icon?: string;
  main_qml?: string;
  main_so?: string;
  [k: string]: unknown;
}

/** 插件根目录下的一个文件，path 相对插件根（如 "metadata.json"、"qml/main.qml"） */
export interface PluginEntry {
  path: string;
  getData: () => Promise<Uint8Array>;
}

export interface PluginPackage {
  /** 安装目标文件夹名（plugins/<name>/） */
  name: string;
  meta: PluginMeta;
  files: PluginEntry[];
  /** icon.png 数据，用于预览（可选） */
  iconData?: Uint8Array;
}

// ── 内部工具 ──

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : '';
}

function basename(p: string): string {
  return p.split('/').filter(Boolean).pop() || '';
}

/** UTF-8 严格失败则按 GBK 解码（兼容 Windows 中文压缩包条目名） */
function decodeZipName(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try { return new TextDecoder('gbk').decode(bytes); }
    catch { return new TextDecoder('utf-8').decode(bytes); }
  }
}

/**
 * 从一组路径里挑出代表插件的 metadata.json：
 * 排除「源码 / source / src」目录，再取层级最浅的一个。
 */
function pickMetadata(paths: string[]): string | null {
  const cands = paths.filter(p => {
    const lp = p.toLowerCase();
    return lp.endsWith('/metadata.json') || lp === 'metadata.json';
  });
  if (cands.length === 0) return null;
  const score = (p: string) => (/(源码|source|\/src\/|\bsrc\/)/i.test(p) ? 1000 : 0) + p.split('/').length;
  cands.sort((a, b) => score(a) - score(b));
  return cands[0];
}

/**
 * 解析安装文件夹名，优先级：
 * 1. metadata.icon 里的 plugins/<NAME>/ —— 插件自身代码引用的名字，最权威
 * 2. metadata.json 所在目录的 basename —— 分发者意图
 * 3. metadata.id / name 兜底
 */
function resolveName(meta: PluginMeta, rootDir: string): string {
  const iconMatch = String(meta.icon || '').match(/plugins\/([^/]+)\//);
  if (iconMatch) return iconMatch[1];
  const base = basename(rootDir);
  if (base) return base;
  return String(meta.id || meta.name || 'plugin').replace(/[^\w.\-]+/g, '_');
}

function findIcon(files: PluginEntry[], meta: PluginMeta): PluginEntry | undefined {
  const iconRel = basename(String(meta.icon || '')).toLowerCase();
  return (
    files.find(f => basename(f.path).toLowerCase() === iconRel && iconRel) ||
    files.find(f => /^icon\.(png|jpg|jpeg|webp|gif)$/i.test(basename(f.path)))
  );
}

async function buildPackage(
  metaPath: string,
  allPaths: string[],
  readText: (path: string) => Promise<string>,
  makeEntry: (path: string, rel: string) => PluginEntry,
): Promise<PluginPackage> {
  const root = dirname(metaPath);
  const prefix = root ? root + '/' : '';
  let meta: PluginMeta;
  try {
    meta = JSON.parse(await readText(metaPath));
  } catch (e) {
    throw new Error('metadata.json 解析失败：' + (e instanceof Error ? e.message : String(e)));
  }
  const name = resolveName(meta, root);

  const files: PluginEntry[] = [];
  for (const p of allPaths) {
    if (prefix && !p.startsWith(prefix)) continue;
    const rel = prefix ? p.slice(prefix.length) : p;
    if (!rel) continue;
    files.push(makeEntry(p, rel));
  }

  const iconEntry = findIcon(files, meta);
  let iconData: Uint8Array | undefined;
  if (iconEntry) {
    try { iconData = await iconEntry.getData(); } catch { /* 预览可选 */ }
  }

  return { name, meta, files, iconData };
}

// ── 来源 1：ZIP ──

export async function parsePluginFromZip(zip: JSZip): Promise<PluginPackage> {
  const fileEntries = Object.values(zip.files).filter(f => !f.dir);
  const paths = fileEntries.map(f => f.name);
  const metaPath = pickMetadata(paths);
  if (!metaPath) throw new Error('压缩包内未找到 metadata.json，这可能不是有效的 PenMods 插件包');

  const byName = new Map(fileEntries.map(f => [f.name, f]));
  return buildPackage(
    metaPath,
    paths,
    (p) => byName.get(p)!.async('string'),
    (p, rel) => ({ path: rel, getData: () => byName.get(p)!.async('uint8array') }),
  );
}

/** 读取 zip File，自动按 UTF-8/GBK 处理条目名 */
export async function loadZipForPlugin(file: File): Promise<JSZip> {
  const JSZipMod = (await import('jszip')).default;
  return JSZipMod.loadAsync(file, { decodeFileName: (b) => decodeZipName(b as Uint8Array) });
}

// ── 来源 2：本地文件夹（<input webkitdirectory>） ──

export async function parsePluginFromFiles(fileList: File[]): Promise<PluginPackage> {
  const paths = fileList.map(f => f.webkitRelativePath || f.name);
  const metaPath = pickMetadata(paths);
  if (!metaPath) throw new Error('所选文件夹内未找到 metadata.json，请选择插件文件夹');

  const byPath = new Map(fileList.map((f, i) => [paths[i], f]));
  return buildPackage(
    metaPath,
    paths,
    async (p) => byPath.get(p)!.text(),
    (p, rel) => ({ path: rel, getData: async () => new Uint8Array(await byPath.get(p)!.arrayBuffer()) }),
  );
}

// ── 查询设备上已安装版本 ──

export async function getInstalledPlugin(conn: DeviceConnection, name: string): Promise<PluginMeta | null> {
  const metaPath = PLUGINS_DIR + '/' + name + '/metadata.json';
  try {
    let text: string;
    // noShell 连接（SSH）的 exec 通道不可靠，cat 读不到内容 —— 改走 SFTP readFile
    if (conn.noShell && conn.readFile) {
      text = new TextDecoder('utf-8').decode(await conn.readFile(metaPath));
    } else {
      text = await conn.shellCommand('cat "' + metaPath + '" 2>/dev/null');
    }
    const t = text.trim();
    if (!t || t[0] !== '{') return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// ── 安装（推送到设备） ──

export interface InstallProgress {
  done: number;
  total: number;
  file: string;
}

export async function installPlugin(
  conn: DeviceConnection,
  pkg: PluginPackage,
  onProgress: (p: InstallProgress) => void,
): Promise<string> {
  const targetDir = PLUGINS_DIR + '/' + pkg.name;

  // noShell 连接（SSH）：device-side shell 不可靠，unzip 静默失败。
  // 改为完全走 SFTP —— 逐文件推送，目录用 SFTP mkdir 预建，不触碰 shell。
  if (conn.noShell && conn.mkdirp) {
    return installViaSftp(conn, pkg, onProgress);
  }

  const zipPath = targetDir + '/__install.zip';

  onProgress({ done: 0, total: pkg.files.length, file: '打包中…' });

  // 浏览器端打包成单一 ZIP，只需一次 ADB 推送，设备端解压，比逐个推送快 N 倍
  const JSZipMod = (await import('jszip')).default;
  const zip = new JSZipMod();
  for (const f of pkg.files) {
    const data = await f.getData();
    zip.file(f.path, data);
  }
  const zipData = await zip.generateAsync({ type: 'uint8array' });
  onProgress({ done: 0, total: 1, file: '推送中 (' + (zipData.length / 1024).toFixed(0) + 'KB)…' });

  // shell:exec 不支持 && 链，用 shellScript（sh -c）执行多语句脚本
  // 先建目录 → 推 ZIP → 解压 → 设权限 → 删 ZIP
  await conn.shellScript('mkdir -p "' + targetDir + '"');
  await conn.pushFile(zipData, zipPath);
  onProgress({ done: 0, total: 1, file: '解压中…' });
  const out = await conn.shellScript(
    'cd "' + targetDir + '" && unzip -o "' + zipPath + '" && chmod -R 755 . && rm -f "' + zipPath + '"'
  );
  if (/error|cannot|No such/i.test(out) && !/inflating|extracting/i.test(out)) {
    throw new Error('解压失败: ' + (out.split('\n')[0] || '未知错误'));
  }

  onProgress({ done: pkg.files.length, total: pkg.files.length, file: '完成' });
  return targetDir;
}

/**
 * SFTP-only 安装（SSH 模式）：不依赖任何 device-side shell 命令。
 * 先用 SFTP 递归建好所有子目录，再逐个 SFTP 写入文件。
 * 任一写入失败都会抛出真实错误，不会再出现「报成功但没装」。
 */
async function installViaSftp(
  conn: DeviceConnection,
  pkg: PluginPackage,
  onProgress: (p: InstallProgress) => void,
): Promise<string> {
  const targetDir = PLUGINS_DIR + '/' + pkg.name;
  const total = pkg.files.length;

  // 收集所有需要的目录（含根），去重后逐个 mkdir（递归，幂等）
  onProgress({ done: 0, total, file: '创建目录…' });
  const dirs = new Set<string>([targetDir]);
  for (const f of pkg.files) {
    const d = dirname(f.path);
    if (d) dirs.add(targetDir + '/' + d);
  }
  // 排序保证父目录先于子目录（父路径是子路径前缀，字典序在前）
  for (const d of [...dirs].sort()) {
    await conn.mkdirp!(d);
  }

  let done = 0;
  for (const f of pkg.files) {
    onProgress({ done, total, file: f.path });
    const data = await f.getData();
    await conn.pushFile(data, targetDir + '/' + f.path);
    done++;
  }

  onProgress({ done: total, total, file: '完成' });
  return targetDir;
}
