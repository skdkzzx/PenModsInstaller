import React from 'react';
import { formatSize } from '../utils';

export const StatusBar = React.memo(function StatusBar({ path, totalItems, totalSize, selectedCount, filterActive, filteredCount }: {
  path: string; totalItems: number; totalSize: number; selectedCount: number; filterActive: boolean; filteredCount: number;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-white border border-[#e2e8f0] rounded-xl text-[10px] text-[#94a3b8]">
      <div className="flex items-center gap-3">
        <span>共 {totalItems} 项</span>
        <span>合计 {formatSize(totalSize)}</span>
        {filterActive && <span>筛选结果 {filteredCount} 项</span>}
      </div>
      <div className="flex items-center gap-2">
        {selectedCount > 0 && <span className="text-[#2563eb] font-medium">已选 {selectedCount} 项</span>}
        <span className="font-mono truncate max-w-[200px]" title={path}>{path}</span>
      </div>
    </div>
  );
});
