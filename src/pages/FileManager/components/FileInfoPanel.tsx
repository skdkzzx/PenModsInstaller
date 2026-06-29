import { useEffect, useState } from 'react';
import { AdbManager } from '../../../lib/adb';
import type { FileEntry } from '../types';
import { formatSize, formatDate, formatPermissions, getFileTypeLabel } from '../utils';

interface FileInfoPanelProps {
  adb: AdbManager | null;
  file: FileEntry | null;
  selectedCount: number;
  selectedSize: number;
  totalFiles: number;
  totalDirs: number;
  currentPath: string;
  visible: boolean;
  onToggle: () => void;
}

export function FileInfoPanel({
  adb, file, selectedCount, selectedSize,
  totalFiles, totalDirs, currentPath, visible, onToggle,
}: FileInfoPanelProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(false);
  const [dirSize, setDirSize] = useState<number | null>(null);
  const [computingSize, setComputingSize] = useState(false);

  // 选中单个文件夹时，按需用 du 计算真实占用
  useEffect(() => {
    setDirSize(null);
    if (!file || !adb || !file.isDir) return;
    let cancelled = false;
    setComputingSize(true);
    const path = (currentPath === '/' ? '' : currentPath) + '/' + file.name;
    adb.dirSize(path)
      .then(sz => { if (!cancelled) setDirSize(sz); })
      .finally(() => { if (!cancelled) setComputingSize(false); });
    return () => { cancelled = true; };
  }, [file?.name, file?.isDir, currentPath]);

  // Load thumbnail for image files
  useEffect(() => {
    if (!file || !adb || file.isDir) {
      setThumbnailUrl(null);
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
      setThumbnailUrl(null);
      return;
    }
    if (file.sizeBytes > 1024 * 1024) { // >1MB skip thumbnail
      setThumbnailUrl(null);
      return;
    }
    setLoadingThumb(true);
    const path = currentPath + '/' + file.name;
    adb.readFile(path).then(data => {
      const blob = new Blob([data as BlobPart]);
      const url = URL.createObjectURL(blob);
      setThumbnailUrl(url);
    }).catch(() => {
      setThumbnailUrl(null);
    }).finally(() => {
      setLoadingThumb(false);
    });

    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [file?.name, file?.sizeBytes]);

  if (!visible) return null;

  return (
    <div className="info-panel">
      {/* Header */}
      <div className="info-panel-header">
        <span className="text-xs font-semibold text-[#0f172a]">详细信息</span>
        <button onClick={onToggle} className="text-[#94a3b8] hover:text-[#0f172a]" title="关闭">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="info-panel-content">
        {/* Multiple selection */}
        {selectedCount > 1 ? (
          <div className="px-4 py-6 text-center">
            <svg className="w-10 h-10 text-[#94a3b8] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
            </svg>
            <p className="text-sm font-medium text-[#0f172a]">已选 {selectedCount} 项</p>
            <p className="text-xs text-[#64748b] mt-1">合计 {formatSize(selectedSize)}</p>
          </div>
        ) : file ? (
          /* Single file info */
          <div>
            {/* Thumbnail / Icon area */}
            <div className="flex justify-center py-6 bg-[#f8fafc] mx-4 rounded-lg mb-4">
              {loadingThumb ? (
                <div className="w-20 h-20 skeleton rounded-lg" />
              ) : thumbnailUrl ? (
                <img src={thumbnailUrl} alt={file.name} className="max-w-[80px] max-h-[80px] rounded-lg object-contain" />
              ) : (
                <svg className="w-16 h-16 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke={file.isDir ? '#eab308' : '#64748b'} strokeWidth="1">
                  {file.isDir ? (
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  ) : (
                    <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></>
                  )}
                </svg>
              )}
            </div>

            {/* File details */}
            <div className="px-4 space-y-2.5">
              <InfoRow label="名称" value={file.name} />
              <InfoRow label="类型" value={file.isDir ? '文件夹' : getFileTypeLabel(file.name, false)} />
              <InfoRow label="大小" value={file.isDir ? (computingSize ? '计算中…' : dirSize !== null ? formatSize(dirSize) : '-') : formatSize(file.sizeBytes)} />
              <InfoRow label="修改时间" value={formatDate(file.mtime)} />
              {!!file.mode && <InfoRow label="权限" value={file.mode ? formatPermissions(file.mode) : '-'} />}
            </div>
          </div>
        ) : (
          /* Directory statistics */
          <div className="px-4 py-5 space-y-3">
            <div className="flex items-center gap-3 px-3 py-2 bg-[#f8fafc] rounded-lg">
              <svg className="w-5 h-5 text-[#eab308]" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <div>
                <p className="text-xs text-[#0f172a]">{totalDirs} 个文件夹</p>
                <p className="text-xs text-[#64748b]">{totalFiles} 个文件</p>
              </div>
            </div>
            <InfoRow label="路径" value={currentPath === '/' ? '/' : currentPath} />
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-[#94a3b8] uppercase">{label}</span>
      <span className="text-xs text-[#0f172a] break-all" style={{ wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
