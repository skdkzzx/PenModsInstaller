import React, { useState, useEffect, useRef } from 'react';
import { MenuIcon } from '../icons';

interface ContextMenuProps {
  x: number; y: number; name: string; isDir: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onDownload: () => void;
  onPreview: () => void;
  onCopy: () => void; onCut: () => void;
  onRename: () => void;
  onCompress?: () => void; onExtract?: () => void;
  onDelete: () => void;
}

export const ContextMenu = React.forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ x, y, isDir, onClose, onOpen, onDownload, onPreview, onCopy, onCut, onRename, onCompress, onExtract, onDelete }, ref) => {
    const [pos, setPos] = useState({ x, y });
    const internalRef = useRef<HTMLDivElement>(null);
    const resolvedRef = (ref || internalRef) as React.RefObject<HTMLDivElement | null>;

    useEffect(() => {
      if (!resolvedRef.current) return;
      const rect = resolvedRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 8;
      const maxY = window.innerHeight - rect.height - 8;
      setPos({ x: Math.min(x, maxX), y: Math.min(y, maxY) });
    }, [x, y]);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (resolvedRef.current && !resolvedRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const item = (iconType: string, label: string, onClick: () => void, color?: string) => (
      <button onClick={onClick} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] flex items-center gap-2.5 ${color || 'text-[#0f172a]'}`}>
        <MenuIcon type={iconType} className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{label}</span>
      </button>
    );

    return (
      <div ref={resolvedRef} className="context-menu" style={{ left: pos.x, top: pos.y }} onClick={e => e.stopPropagation()}>
        {isDir ? item('open', '打开', onOpen!) : item('preview', '预览', onPreview)}
        {!isDir && item('download', '下载', onDownload)}
        <div className="h-px bg-[#e2e8f0] my-1" />
        {item('copy', '复制', onCopy)}
        {item('cut', '剪切', onCut)}
        {item('rename', '重命名', onRename)}
        {onCompress && item('compress', '压缩', onCompress)}
        {onExtract && item('extract', '解压', onExtract)}
        <div className="h-px bg-[#e2e8f0] my-1" />
        {item('delete', '删除', onDelete, 'text-[#dc2626]')}
      </div>
    );
  }
);
