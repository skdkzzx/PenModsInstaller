import React from 'react';

interface PathBarProps {
  segments: { label: string; path: string }[];
  onNavigate: (p: string) => void;
  editingPath: boolean;
  setEditingPath: (v: boolean) => void;
  pathInput: string;
  setPathInput: (v: string) => void;
  onPathSubmit: (p: string) => void;
  entryCount: number;
}

export const PathBar = React.memo(function PathBar({
  segments, onNavigate, editingPath, setEditingPath, pathInput, setPathInput, onPathSubmit, entryCount,
}: PathBarProps) {
  return (
    <div
      className="text-xs bg-white border border-[#e2e8f0] rounded-xl px-4 py-2 font-mono flex items-center gap-0.5 cursor-text overflow-x-auto"
      onClick={() => { setPathInput(segments.map(s => s.label === '/' ? '' : s.label).join('/') || '/'); setEditingPath(true); }}
    >
      <svg className="w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0 mr-1" viewBox="0 0 24 24" fill="#94a3b8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      {editingPath ? (
        <input value={pathInput} onChange={e => setPathInput(e.target.value)}
          autoFocus className="flex-1 bg-[#f1f5f9] border border-[#2563eb] rounded px-2 py-0.5 text-sm outline-none min-w-0"
          onKeyDown={e => { if (e.key === 'Enter') onPathSubmit(pathInput); if (e.key === 'Escape') setEditingPath(false); }}
          onBlur={() => setEditingPath(false)} onClick={e => e.stopPropagation()} />
      ) : (
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
          {segments.map((seg, i) => (
            <span key={seg.path} className="flex items-center gap-0.5 whitespace-nowrap">
              {i > 0 && <span className="text-[#94a3b8] mx-0.5">/</span>}
              {i === segments.length - 1 ? (
                <span className="text-[#0f172a] font-medium">{seg.label}</span>
              ) : (
                <span className="text-[#2563eb] hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); onNavigate(seg.path); }}>
                  {seg.label}
                </span>
              )}
            </span>
          ))}
          <span className="text-[#94a3b8] ml-2 whitespace-nowrap">({entryCount} 项)</span>
        </div>
      )}
    </div>
  );
});
