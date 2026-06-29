import { AdbManager } from '../../lib/adb';

export interface FileManagerProps {
  adb: AdbManager | null;
  onLog: (msg: string) => void;
  connected: boolean;
  connectionType?: 'usb' | 'ssh';
}

export type ViewMode = 'list' | 'grid';
export type SortField = 'name' | 'size' | 'type' | 'date';

export interface FileEntry {
  name: string;
  isDir: boolean;
  isSymlink: boolean;
  sizeBytes: number;
  mtime: number;
  mode?: number;
}

/** 收藏夹条目 */
export interface Bookmark {
  path: string;
  label: string;
}

/** 文件操作类型 */
export type FileOpType = 'upload' | 'download' | 'copy' | 'move' | 'delete';

/** 文件操作队列项 */
export interface FileOperation {
  id: string;
  type: FileOpType;
  source?: string;
  target: string;
  progress: number;
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  error?: string;
}

/** 最近的目录 */
export interface RecentDir {
  path: string;
  lastVisit: number;
}

export type CtxMenuTarget = {
  x: number;
  y: number;
  name: string;
  isDir: boolean;
} | null;

export type PreviewData = {
  name: string;
  dataUrl: string;
  type: 'image' | 'text' | 'other';
} | null;
