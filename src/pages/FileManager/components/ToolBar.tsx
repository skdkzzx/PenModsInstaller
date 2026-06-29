import React from 'react';
import type { ViewMode } from '../types';

interface ToolBarProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  onRefresh: () => void;
  loading: boolean;
  multiSelect: boolean;
  setMultiSelect: (v: boolean) => void;
  onNewDir: () => void;
  onUploadClick: () => void;
  filterText: string;
  onFilterChange: (v: string) => void;
  typeFilter: string;
  onTypeFilter: (v: string) => void;
  onGoBack: () => void;
  onGoHome: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleInfo: () => void;
}

export const ToolBar = React.memo(function ToolBar({
  viewMode, setViewMode, onRefresh, loading, multiSelect, setMultiSelect,
  onNewDir, onUploadClick, filterText, onFilterChange,
  onGoBack, onGoHome, sidebarOpen, onToggleSidebar, onToggleInfo, typeFilter, onTypeFilter,
}: ToolBarProps) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-2 flex items-center gap-1.5 flex-wrap">
      <button onClick={onGoHome} className="px-2 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg font-mono font-bold" title="根目录">/</button>
      <button onClick={onGoBack} className="px-2 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg" title="返回上级">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button onClick={onToggleSidebar} className="px-2 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg" title={sidebarOpen ? '收起侧栏' : '展开侧栏'}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
      </button>
      <div className="w-px h-5 bg-[#e2e8f0] mx-1" />
      <div className="flex items-center bg-[#f1f5f9] rounded-lg p-0.5">
        <button onClick={() => setViewMode('list')}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[#0f172a]' : 'text-[#64748b] hover:text-[#0f172a]'}`}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
        <button onClick={() => setViewMode('grid')}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#0f172a]' : 'text-[#64748b] hover:text-[#0f172a]'}`}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </button>
      </div>
      <div className="w-px h-5 bg-[#e2e8f0] mx-0.5" />
      <button onClick={onRefresh} disabled={loading}
        className="px-2.5 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg flex items-center gap-1 disabled:opacity-40">
        <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      </button>
      <button onClick={() => setMultiSelect(!multiSelect)}
        className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${multiSelect ? 'bg-[#2563eb] text-white' : 'text-[#64748b] hover:bg-[#f1f5f9]'}`}>
        多选
      </button>
      <div className="flex-1 min-w-[120px] max-w-[200px] relative">
        <svg className="w-3 h-3 text-[#94a3b8] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={filterText} onChange={e => onFilterChange(e.target.value)}
          placeholder="搜索…" className="w-full pl-7 pr-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] bg-transparent"
          onKeyDown={e => e.stopPropagation()} />
        {filterText && (
          <button onClick={() => onFilterChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] text-xs">✕</button>
        )}
      </div>
      <select value={typeFilter} onChange={e => onTypeFilter(e.target.value)}
        className="text-xs border border-[#e2e8f0] rounded-lg px-2 py-1.5 outline-none focus:border-[#2563eb] bg-white text-[#64748b]"
        onKeyDown={e => e.stopPropagation()}>
        <option value="all">全部</option>
        <option value="folder">文件夹</option>
        <option value="archive">压缩包</option>
        <option value="image">图片</option>
        <option value="text">文档</option>
        <option value="audio">音频</option>
        <option value="video">视频</option>
        <option value="binary">二进制</option>
      </select>
      <div className="flex items-center gap-1.5">
        <button onClick={onToggleInfo}
          className="px-2.5 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg flex items-center gap-1" title="详细信息">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </button>
        <button onClick={onNewDir}
          className="px-3 py-1.5 text-xs bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] transition-colors whitespace-nowrap">+ 新建目录</button>
        <button onClick={onUploadClick}
          className="px-3 py-1.5 text-xs bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] transition-colors whitespace-nowrap flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          上传
        </button>
      </div>
    </div>
  );
});
