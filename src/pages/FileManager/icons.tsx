import { getFileType } from './utils';

// ===================================================================
// 文件图标组件
// ===================================================================

export function FileIcon({ name, isDir, size = 'md' }: { name: string; isDir: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const type = getFileType(name, isDir);
  const cls = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const dflt = { fill: 'none', strokeWidth: 1.5 };

  switch (type) {
    case 'folder':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case 'binary':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#6366f1"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="15" y2="6"/></svg>;
    case 'script':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#10b981"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
    case 'archive':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#f59e0b"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>;
    case 'text':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#94a3b8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>;
    case 'code':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#8b5cf6"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/></svg>;
    case 'image':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#ec4899"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
    case 'audio':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#14b8a6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    case 'video':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#f43f5e"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
    case 'pdf':
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#ef4444"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M12 12v6"/></svg>;
    default:
      return <svg className={`${cls} flex-shrink-0`} viewBox="0 0 24 24" {...dflt} stroke="#64748b"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>;
  }
}

// ===================================================================
// 右键菜单 SVG 图标
// ===================================================================

export function MenuIcon({ type, className }: { type: string; className?: string }) {
  const cls = className || 'w-3.5 h-3.5';
  switch (type) {
    case 'open':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case 'preview':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'download':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
    case 'copy':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
    case 'cut':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;
    case 'rename':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case 'compress':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>;
    case 'extract':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><polyline points="7 14 12 19 17 14"/><line x1="12" y1="19" x2="12" y2="8"/></svg>;
    case 'delete':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
    case 'fav':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
    default:
      return null;
  }
}
