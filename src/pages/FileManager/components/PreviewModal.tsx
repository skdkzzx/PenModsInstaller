import { useEffect } from 'react';

export function PreviewModal({ name, type, dataUrl, onClose, onDownload }: {
  name: string; type: 'image' | 'text' | 'other'; dataUrl: string; onClose: () => void; onDownload: () => void;
}) {
  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Cleanup: revoke blob URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (type === 'image' && dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(dataUrl);
      }
    };
  }, [dataUrl, type]);

  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e8f0]">
          <h3 className="text-sm font-medium text-[#0f172a] truncate max-w-[300px]">{name}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} className="text-xs px-3 py-1 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">下载</button>
            <button onClick={onClose} className="text-xs px-2 py-1 text-[#64748b] hover:bg-[#f1f5f9] rounded-lg">✕</button>
          </div>
        </div>
        <div className="p-5 overflow-auto max-h-[70vh]">
          {type === 'image' ? (
            <img src={dataUrl} alt={name} className="max-w-full h-auto rounded-lg" />
          ) : type === 'text' ? (
            <pre className="text-xs font-mono text-[#0f172a] whitespace-pre-wrap break-all bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0] max-h-[60vh] overflow-auto">{dataUrl}</pre>
          ) : (
            <p className="text-sm text-[#94a3b8] text-center py-8">无法预览此文件类型</p>
          )}
        </div>
      </div>
    </div>
  );
}
