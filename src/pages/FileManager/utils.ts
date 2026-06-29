import type { FileEntry, SortField } from './types';

// ===================================================================
// 文件类型检测
// ===================================================================

export function getFileType(name: string, isDir: boolean): string {
  if (isDir) return 'folder';
  if (!name.includes('.')) return 'binary';
  const ext = name.split('.').pop()!.toLowerCase();
  if (['so', 'dll', 'dylib'].includes(ext)) return 'binary';
  if (['sh', 'bash', 'zsh'].includes(ext)) return 'script';
  if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz'].includes(ext)) return 'archive';
  if (['txt', 'md', 'log', 'cfg', 'ini', 'conf', 'env'].includes(ext)) return 'text';
  if (['json', 'xml', 'yaml', 'yml', 'toml', 'js', 'ts', 'css', 'html'].includes(ext)) return 'code';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'wma'].includes(ext)) return 'audio';
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(ext)) return 'video';
  if (['pdf'].includes(ext)) return 'pdf';
  return 'file';
}

export function getFileTypeLabel(name: string, isDir: boolean): string {
  if (isDir) return '文件夹';
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const map: Record<string, string> = {
    so: '动态库', dll: '动态库', dylib: '动态库',
    sh: 'Shell 脚本', bash: 'Shell 脚本', zsh: 'Shell 脚本',
    zip: '压缩包', tar: '压缩包', gz: '压缩包', bz2: '压缩包', '7z': '压缩包', rar: '压缩包', xz: '压缩包',
    txt: '文本文档', md: 'Markdown', log: '日志文件',
    cfg: '配置文件', ini: '配置文件', conf: '配置文件', env: '环境变量',
    json: 'JSON', xml: 'XML', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
    js: 'JavaScript', ts: 'TypeScript', css: '样式表', html: 'HTML',
    png: 'PNG 图片', jpg: 'JPEG 图片', jpeg: 'JPEG 图片', gif: 'GIF 图片', bmp: 'BMP 图片', svg: 'SVG 图片', webp: 'WebP 图片',
    mp3: 'MP3 音频', wav: 'WAV 音频', aac: 'AAC 音频', flac: 'FLAC 音频', ogg: 'OGG 音频',
    mp4: 'MP4 视频', avi: 'AVI 视频', mkv: 'MKV 视频', mov: 'MOV 视频',
    pdf: 'PDF 文档',
  };
  return map[ext] || '未知文件';
}

// ===================================================================
// 格式化
// ===================================================================

export function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let s = bytes;
  while (s >= 1024 && i < units.length - 1) { s /= 1024; i++; }
  return s.toFixed(i === 0 ? 0 : i >= 2 ? 2 : 1) + ' ' + units[i];
}

export function formatDate(mtime: number): string {
  if (!mtime) return '-';
  const d = new Date(mtime * 1000);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export function formatPermissions(mode: number): string {
  if (!mode) return '';
  const perm = mode & 0o777;
  const rwx = (n: number) =>
    (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
  return rwx((perm >> 6) & 7) + rwx((perm >> 3) & 7) + rwx(perm & 7);
}

// ===================================================================
// 排序
// ===================================================================

export function sortEntries(entries: FileEntry[], field: SortField, asc: boolean): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    switch (field) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'size': cmp = a.sizeBytes - b.sizeBytes; break;
      case 'type': cmp = getFileTypeLabel(a.name, false).localeCompare(getFileTypeLabel(b.name, false)) || a.name.localeCompare(b.name); break;
      case 'date': cmp = a.mtime - b.mtime; break;
    }
    return asc ? cmp : -cmp;
  });
}

// ===================================================================
// 路径工具
// ===================================================================

export function joinPath(parent: string, child: string): string {
  if (parent === '/' || parent === '') return '/' + child;
  return parent + '/' + child;
}

export function parentPath(p: string): string {
  if (p === '/' || !p.includes('/')) return '/';
  const parent = p.substring(0, p.lastIndexOf('/'));
  return parent || '/';
}

/**
 * 构建面包屑路径段
 */
export function buildPathSegments(p: string): { label: string; path: string }[] {
  if (p === '/') return [{ label: '/', path: '/' }];
  const segs = p.split('/').filter(Boolean);
  const bread = [{ label: '/', path: '/' }];
  let cur = '';
  for (const s of segs) {
    cur += '/' + s;
    bread.push({ label: s, path: cur });
  }
  return bread;
}

/** @deprecated Use buildPathSegments instead */
export const pathSegments = buildPathSegments;

// ===================================================================
// localStorage 工具
// ===================================================================

const STORAGE_KEYS = {
  BOOKMARKS: 'fm_bookmarks',
  RECENT_DIRS: 'fm_recent_dirs',
  SIDEBAR_OPEN: 'fm_sidebar_open',
  VIEW_MODE: 'fm_view_mode',
};

export function loadBookmarks(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '[]');
  } catch { return []; }
}

export function saveBookmarks(bookmarks: string[]) {
  localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
}

export function loadRecentDirs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_DIRS) || '[]');
  } catch { return []; }
}

export function saveRecentDirs(dirs: string[]) {
  localStorage.setItem(STORAGE_KEYS.RECENT_DIRS, JSON.stringify(dirs.slice(0, 15)));
}

export function loadSidebarOpen(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.SIDEBAR_OPEN);
    return v !== null ? JSON.parse(v) : true;
  } catch { return true; }
}

export function saveSidebarOpen(open: boolean) {
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_OPEN, JSON.stringify(open));
}
