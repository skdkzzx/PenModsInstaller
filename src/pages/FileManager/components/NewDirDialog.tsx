import React from 'react';

export const NewDirDialog = React.memo(function NewDirDialog({ value, onChange, onSubmit, onCancel }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-[#e2e8f0] rounded-xl p-3">
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder="输入目录名称" autoFocus
        className="flex-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb]"
        onKeyDown={e => e.key === 'Enter' && onSubmit()} />
      <button onClick={onSubmit} className="px-4 py-1.5 text-xs bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">确定</button>
      <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg">取消</button>
    </div>
  );
});
