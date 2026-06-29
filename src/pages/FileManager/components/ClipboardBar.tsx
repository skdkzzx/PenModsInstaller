import React from 'react';

export const ClipboardBar = React.memo(function ClipboardBar({ action, name, onPaste, onCancel }: {
  action: 'copy' | 'cut'; name: string; onPaste: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-sm">
      <span className="text-[#1e40af]">已{action === 'copy' ? '复制' : '剪切'}: {name}</span>
      <button onClick={onPaste} className="ml-auto px-4 py-1 text-xs bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">粘贴</button>
      <button onClick={onCancel} className="text-xs text-[#64748b] hover:text-[#dc2626]">取消</button>
    </div>
  );
});
