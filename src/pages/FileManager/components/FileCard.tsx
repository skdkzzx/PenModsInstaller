import React from 'react';
import { FileIcon } from '../icons';
import { formatSize } from '../utils';
import type { FileEntry } from '../types';

interface FileCardProps {
  entry: FileEntry;
  isSelected: boolean;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
}

export const FileCard = React.memo(function FileCard({
  entry, isSelected, isActive, onClick, onDoubleClick, onContextMenu, onMenu,
}: FileCardProps) {
  return (
    <div
      className={`grid-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className="relative w-full flex flex-col items-center">
        <button onClick={onMenu}
          className="absolute -top-1 right-0 px-1 text-xs text-[#94a3b8] hover:text-[#0f172a] leading-none transition-colors"
        >⋯</button>
        <FileIcon name={entry.name} isDir={entry.isDir} size="lg" />
      </div>
      <span className="text-[11px] text-center leading-tight truncate w-full px-1">{entry.name}</span>
      <span className="text-[10px] text-[#94a3b8]">{entry.isDir ? '' : formatSize(entry.sizeBytes)}</span>
    </div>
  );
});
