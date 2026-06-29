import React from 'react';
import { FileIcon } from '../icons';
import { formatSize, formatDate } from '../utils';
import type { FileEntry } from '../types';

interface FileRowProps {
  entry: FileEntry;
  index: number;
  isSelected: boolean;
  isActive: boolean;
  multiSelect: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
}

export const FileRow = React.memo(function FileRow({
  entry, isSelected, isActive, multiSelect, onClick, onDoubleClick, onContextMenu, onRename, onMenu,
}: FileRowProps) {
  return (
    <div
      className={`list-row group ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <span className="w-8 flex items-center flex-shrink-0">
        {multiSelect ? (
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${isSelected ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'border-[#cbd5e1]'}`}>
            {isSelected ? '✓' : ''}
          </span>
        ) : (
          <FileIcon name={entry.name} isDir={entry.isDir} size="sm" />
        )}
      </span>
      <span className={`flex-1 min-w-0 truncate ${entry.isDir ? 'text-[#2563eb] font-medium' : 'text-[#0f172a]'} cursor-default`}
        title={`${entry.name}${entry.isSymlink ? ' (符号链接)' : ''}`}>
        {entry.name}
      </span>
      <span className="w-20 text-right text-xs text-[#64748b] font-mono flex-shrink-0">{entry.isDir ? '-' : formatSize(entry.sizeBytes)}</span>
      <span className="w-28 text-right text-xs text-[#94a3b8] hidden sm:block flex-shrink-0">{formatDate(entry.mtime)}</span>
      <span className="w-14 text-right relative flex-shrink-0 flex items-center justify-end gap-0.5">
        {!multiSelect && (
          <>
            <button onClick={onRename}
              className="px-0.5 text-sm text-[#94a3b8] hover:text-[#2563eb] leading-none transition-colors opacity-60 hover:opacity-100" title="重命名">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onClick={onMenu}
              className="px-0.5 text-sm text-[#94a3b8] hover:text-[#0f172a] font-mono leading-none transition-colors"
            >⋯</button>
          </>
        )}
      </span>
    </div>
  );
});
