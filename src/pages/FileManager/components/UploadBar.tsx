import React from 'react';

export const UploadBar = React.memo(function UploadBar({ name, size, onCancel, onConfirm, progress }: {
  name: string; size: number; onCancel: () => void; onConfirm: () => Promise<void>; progress?: number | null;
}) {
  const isUploading = progress !== undefined && progress !== null;
  return (
    <div className={`px-4 py-3 border rounded-xl text-sm ${isUploading ? 'bg-[#eff6ff] border-[#bfdbfe]' : 'bg-[#fffbeb] border-[#fde68a]'}`}>
      <div className="flex items-center gap-3">
        <span className="text-[#92400e] truncate flex-1">
          {isUploading ? '⏳ 上传中: ' : '上传: '}<strong>{name}</strong> ({(size / 1024).toFixed(0)}KB)
        </span>
        {isUploading ? (
          <span className="text-xs text-[#2563eb] font-mono">{progress}%</span>
        ) : (
          <>
            <button onClick={onCancel} className="text-[#64748b] hover:text-[#dc2626]">✕</button>
            <button onClick={onConfirm} className="px-4 py-1 text-xs bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">确认上传</button>
          </>
        )}
      </div>
      {isUploading && (
        <div className="mt-2 progress-track">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
});
