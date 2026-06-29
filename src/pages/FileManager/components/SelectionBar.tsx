import React from 'react';

export const SelectionBar = React.memo(function SelectionBar({ count, onCopy, onDelete, onClear }: {
  count: number; onCopy: () => void; onDelete: () => void; onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-sm">
      <span className="text-[#1e40af] font-medium">已选 {count} 项</span>
      <button onClick={onCopy} className="ml-2 px-3 py-1 text-xs bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">复制</button>
      <button onClick={onDelete} className="px-3 py-1 text-xs bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c]">删除</button>
      <button onClick={onClear} className="text-xs text-[#64748b] hover:text-[#dc2626]">取消</button>
    </div>
  );
});
