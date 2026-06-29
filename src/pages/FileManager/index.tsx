import React, { useReducer, useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { fileManagerReducer, createInitialState } from './state';
import { sortEntries, buildPathSegments, saveSidebarOpen, getFileType } from './utils';
import type { FileManagerProps } from './types';
import type { SortField } from './types';

// Hooks
import { useNavigation } from './hooks/useNavigation';
import { useNavigationSFTP } from './hooks/useNavigationSFTP';
import { useSelection } from './hooks/useSelection';
import { useFileOperations } from './hooks/useFileOperations';
import { useFileOperationsSFTP } from './hooks/useFileOperationsSFTP';
import { useUpload } from './hooks/useUpload';
import { useUploadSFTP } from './hooks/useUploadSFTP';
import { usePreview } from './hooks/usePreview';

// Components
import { ToolBar } from './components/ToolBar';
import { PathBar } from './components/PathBar';
import { FileRow } from './components/FileRow';
import { FileCard } from './components/FileCard';
import { ContextMenu } from './components/ContextMenu';
import { SelectionBar } from './components/SelectionBar';
import { ClipboardBar } from './components/ClipboardBar';
import { UploadBar } from './components/UploadBar';
import { NewDirDialog } from './components/NewDirDialog';
import { PreviewModal } from './components/PreviewModal';
import { StatusBar } from './components/StatusBar';
import { EmptyState } from './components/EmptyState';
import { SkeletonRow, SkeletonGrid } from './components/Skeleton';
import { Sidebar } from './components/Sidebar';
import { FileInfoPanel } from './components/FileInfoPanel';
import { ToastContainer } from './components/Toast';

// ── ListHeader (memoized) ──
interface ListHeaderProps {
  multiSelect: boolean;
  selectedNames: Set<string>;
  sortField: SortField;
  sortAsc: boolean;
  entryCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSort: (field: SortField) => void;
}

const ListHeader = React.memo(function ListHeader({
  multiSelect, selectedNames, sortField, sortAsc, entryCount, onSelectAll, onClearSelection, onSort,
}: ListHeaderProps) {
  const allSelected = selectedNames.size === entryCount && entryCount > 0;
  return (
    <div className="flex items-center px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] text-xs text-[#64748b] font-medium select-none">
      <span className="w-8 flex items-center flex-shrink-0">
        {multiSelect && (
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer ${allSelected ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'border-[#cbd5e1]'}`}
            onClick={allSelected ? onClearSelection : onSelectAll}>
            {allSelected ? '✓' : ''}
          </span>
        )}
      </span>
      <span className="flex-1 cursor-pointer hover:text-[#0f172a] flex items-center" onClick={() => onSort('name')}>
        名称 {sortField === 'name' && <span className="text-[#2563eb] ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
      </span>
      <span className="w-20 text-right cursor-pointer hover:text-[#0f172a] flex items-center justify-end" onClick={() => onSort('size')}>
        大小 {sortField === 'size' && <span className="text-[#2563eb] ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
      </span>
      <span className="w-28 text-right cursor-pointer hover:text-[#0f172a] hidden sm:flex items-center justify-end" onClick={() => onSort('date')}>
        修改时间 {sortField === 'date' && <span className="text-[#2563eb] ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
      </span>
      <span className="w-8" />
    </div>
  );
});

export function FileManager({ adb, onLog, connected, connectionType = 'usb' }: FileManagerProps) {
  const [state, dispatch] = useReducer(fileManagerReducer, null, createInitialState);
  const listRef = useRef<HTMLDivElement>(null);
  const [newDirName, setNewDirName] = useState('');

  // ── Hooks（根据连接类型选后端）──
  const isSSH = connectionType === 'ssh';
  const adbNav = useNavigation(dispatch, isSSH ? null : adb);
  const sftpNav = useNavigationSFTP(dispatch);
  const { loadDir, enterDir: enterDirRaw, goBack: goBackRaw, goHome, navigateTo } = isSSH ? sftpNav : adbNav;

  const enterDir = useCallback((name: string) => enterDirRaw(name, state.path), [enterDirRaw, state.path]);
  const goBack = useCallback(() => goBackRaw(state.path), [goBackRaw, state.path]);

  const usbOps = useFileOperations(dispatch, adb, onLog, loadDir);
  const sftpOps = useFileOperationsSFTP(dispatch, onLog, loadDir);
  const fileOps = isSSH ? sftpOps : usbOps;
  const { rename, del, batchDelete, copy, cut, paste, compress, extract, mkdir, downloadFile } = fileOps;

  const usbUpload = useUpload(dispatch, adb, onLog, loadDir);
  const sftpUpload = useUploadSFTP(dispatch, onLog, loadDir);
  const upload = isSSH ? sftpUpload : usbUpload;
  const { uploadFile, uploadProgress, selectFile, uploadFromDrop, handleUploadConfirm, cancelUpload } = upload;

  const { previewFile, closePreview } = usePreview(dispatch, adb);

  // ── 过滤 + 排序 ──
  const displayEntries = useMemo(() => {
    let filtered = state.filterText
      ? state.entries.filter(e => e.name.toLowerCase().includes(state.filterText.toLowerCase()))
      : state.entries;
    if (state.typeFilter !== 'all') {
      filtered = filtered.filter(e => {
        if (state.typeFilter === 'folder') return e.isDir;
        const t = getFileType(e.name, false);
        if (state.typeFilter === 'archive') return t === 'archive';
        if (state.typeFilter === 'image') return t === 'image';
        if (state.typeFilter === 'text') return t === 'text' || t === 'code';
        if (state.typeFilter === 'audio') return t === 'audio';
        if (state.typeFilter === 'video') return t === 'video';
        if (state.typeFilter === 'binary') return t === 'binary' || t === 'script';
        return true;
      });
    }
    return sortEntries(filtered, state.sortField, state.sortAsc);
  }, [state.entries, state.filterText, state.typeFilter, state.sortField, state.sortAsc]);

  // ── 面包屑 ──
  const segments = useMemo(() => buildPathSegments(state.path), [state.path]);

  // ── 选择 ──
  const { toggleSelect, selectAll, clearSelection, handleKeyDown } = useSelection({
    dispatch,
    displayEntries,
    selectedNames: state.selectedNames,
    lastClicked: state.lastClicked,
    activeIndex: state.activeIndex,
    viewMode: state.viewMode,
    enterDir,
    downloadFile: (name: string) => downloadFile(state.path, name),
    renameFile: (name: string) => rename(state.path, name),
    batchDelete: (names: string[]) => batchDelete(state.path, names),
    copyFile: (name: string) => copy(name, state.path),
    cutFile: (name: string) => cut(name, state.path),
    pasteFile: () => { if (state.clipboard) paste(state.path, state.clipboard); },
    clipboard: state.clipboard,
    editingPath: state.editingPath,
    showNewDir: state.showNewDir,
    ctxMenu: state.ctxMenu,
    goBack,
  });

  // ── 连接后加载 ──
  useEffect(() => {
    if (connected && (adb || isSSH)) loadDir(state.path);
  }, [connected, adb, isSSH]);

  // ── 侧栏保存 ──
  const handleToggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
    saveSidebarOpen(!state.sidebarOpen);
  }, [state.sidebarOpen]);

  // ── 排序 ──
  const handleSort = useCallback((field: SortField) => {
    dispatch({ type: 'SET_SORT', field, asc: state.sortField === field ? !state.sortAsc : true });
  }, [state.sortField, state.sortAsc]);

  // ── 未连接 ──
  if (!connected) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl py-16 text-center">
        <svg className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <p className="text-sm text-[#94a3b8]">请先在顶部连接设备</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3" onKeyDown={handleKeyDown} tabIndex={-1}>
      <Sidebar adb={adb} currentPath={state.path} onNavigate={navigateTo} onLog={onLog}
        sidebarOpen={state.sidebarOpen} onToggle={handleToggleSidebar} />

      <div className="flex-1 min-w-0 space-y-3">
        <ToolBar
          viewMode={state.viewMode} setViewMode={v => dispatch({ type: 'SET_VIEW_MODE', mode: v })}
          onRefresh={() => loadDir(state.path)} loading={state.loading}
          multiSelect={state.multiSelect} setMultiSelect={v => dispatch({ type: 'SET_MULTI_SELECT', enabled: v })}
          onNewDir={() => dispatch({ type: 'SET_SHOW_NEW_DIR', show: !state.showNewDir })}
          onUploadClick={() => document.getElementById('fm-file-input')?.click()}
          filterText={state.filterText} onFilterChange={v => dispatch({ type: 'SET_FILTER', text: v })}
          typeFilter={state.typeFilter} onTypeFilter={v => dispatch({ type: 'SET_TYPE_FILTER', filter: v })}
          onGoBack={goBack} onGoHome={goHome}
          sidebarOpen={state.sidebarOpen} onToggleSidebar={handleToggleSidebar}
          onToggleInfo={() => dispatch({ type: 'TOGGLE_INFO_PANEL' })}
        />

        <input id="fm-file-input" type="file" multiple className="hidden"
          onChange={e => { const f = e.target.files; if (f && f.length > 0) { if (f.length === 1) { selectFile(f[0]); } else { uploadFromDrop(f, state.path); } e.target.value = ''; } }} />

        <PathBar segments={segments} onNavigate={navigateTo}
          editingPath={state.editingPath} setEditingPath={v => dispatch({ type: 'SET_EDITING_PATH', editing: v })}
          pathInput={state.pathInput} setPathInput={v => dispatch({ type: 'SET_EDITING_PATH', editing: true, input: v })}
          onPathSubmit={p => { dispatch({ type: 'SET_EDITING_PATH', editing: false }); navigateTo(p || '/'); }}
          entryCount={state.entries.length} />

        {state.multiSelect && state.selectedNames.size > 0 && (
          <SelectionBar count={state.selectedNames.size}
            onCopy={() => {
              const names = Array.from(state.selectedNames);
              if (names.length === 1) { copy(names[0], state.path); dispatch({ type: 'SET_MULTI_SELECT', enabled: false }); }
            }}
            onDelete={() => batchDelete(state.path, Array.from(state.selectedNames))}
            onClear={clearSelection} />
        )}

        {state.clipboard && (
          <ClipboardBar action={state.clipboard.action} name={state.clipboard.name}
            onPaste={() => paste(state.path, state.clipboard!)}
            onCancel={() => dispatch({ type: 'CLEAR_CLIPBOARD' })} />
        )}

        {state.error && (
          <div className="px-4 py-2 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#dc2626] flex items-center gap-2">
            <span>⚠</span> {state.error}
            <button onClick={() => loadDir(state.path)} className="ml-auto text-[#2563eb] hover:underline">重试</button>
          </div>
        )}

        {uploadFile && (
          <UploadBar name={uploadFile.name} size={uploadFile.size} progress={uploadProgress}
            onCancel={cancelUpload} onConfirm={() => handleUploadConfirm(state.path)} />
        )}

        {state.processing && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-sm">
            <svg className="w-4 h-4 text-[#2563eb] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            <span className="text-[#1e40af]">{state.processing}</span>
          </div>
        )}

        {state.showNewDir && (
          <NewDirDialog value={newDirName} onChange={setNewDirName}
            onSubmit={() => { mkdir(state.path, newDirName); setNewDirName(''); }}
            onCancel={() => { dispatch({ type: 'SET_SHOW_NEW_DIR', show: false }); setNewDirName(''); }} />
        )}

        <div ref={listRef} className="relative bg-white border border-[#e2e8f0] rounded-xl overflow-hidden"
          onContextMenu={e => e.preventDefault()}
          onDragOver={e => { e.preventDefault(); dispatch({ type: 'SET_DRAG_OVER', over: true }); }}
          onDragLeave={e => { if (!listRef.current?.contains(e.relatedTarget as Node)) dispatch({ type: 'SET_DRAG_OVER', over: false }); }}
          onDrop={async e => { e.preventDefault(); dispatch({ type: 'SET_DRAG_OVER', over: false }); const f = e.dataTransfer.files; if (f && f.length > 0) uploadFromDrop(f, state.path); }}>
          {state.dragOver && (
            <div className="drag-overlay">
              <div className="text-center pointer-events-none">
                <svg className="w-10 h-10 text-[#2563eb] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p className="text-sm font-medium text-[#2563eb]">松开以上传文件</p>
              </div>
            </div>
          )}

          {state.viewMode === 'list' ? (
            <>
              <ListHeader
                multiSelect={state.multiSelect}
                selectedNames={state.selectedNames}
                sortField={state.sortField}
                sortAsc={state.sortAsc}
                entryCount={displayEntries.length}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                onSort={handleSort}
              />
              {state.loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : displayEntries.length === 0 ? (
                <EmptyState filter={!!state.filterText} />
              ) : (
                <div>
                  {displayEntries.map((entry, i) => (
                    <FileRow key={entry.name} entry={entry} index={i}
                      isSelected={state.selectedNames.has(entry.name)} isActive={i === state.activeIndex}
                      multiSelect={state.multiSelect}
                      onClick={e => { toggleSelect(entry.name, e); dispatch({ type: 'SET_ACTIVE_INDEX', index: i }); }}
                      onDoubleClick={() => { if (entry.isDir) enterDir(entry.name); else previewFile(state.path, entry.name); }}
                      onContextMenu={e => { e.preventDefault(); if (!state.selectedNames.has(entry.name)) toggleSelect(entry.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: { x: e.clientX, y: e.clientY, name: entry.name, isDir: entry.isDir } }); }}
                      onRename={e => { e.stopPropagation(); rename(state.path, entry.name); }}
                      onMenu={e => { e.stopPropagation(); dispatch({ type: 'SET_CONTEXT_MENU', menu: state.ctxMenu?.name === entry.name ? null : { x: e.clientX - 80, y: e.clientY + 5, name: entry.name, isDir: entry.isDir } }); }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            state.loading ? <SkeletonGrid /> : displayEntries.length === 0 ? <EmptyState filter={!!state.filterText} /> : (
              <div className="file-grid">
                {displayEntries.map((entry, i) => (
                  <FileCard key={entry.name} entry={entry}
                    isSelected={state.selectedNames.has(entry.name)} isActive={i === state.activeIndex}
                    onClick={e => { toggleSelect(entry.name, e); dispatch({ type: 'SET_ACTIVE_INDEX', index: i }); }}
                    onDoubleClick={() => { if (entry.isDir) enterDir(entry.name); else previewFile(state.path, entry.name); }}
                    onContextMenu={e => { e.preventDefault(); if (!state.selectedNames.has(entry.name)) toggleSelect(entry.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: { x: e.clientX, y: e.clientY, name: entry.name, isDir: entry.isDir } }); }}
                    onMenu={e => { e.stopPropagation(); dispatch({ type: 'SET_CONTEXT_MENU', menu: state.ctxMenu?.name === entry.name ? null : { x: e.clientX - 40, y: e.clientY + 5, name: entry.name, isDir: entry.isDir } }); }}
                  />
                ))}
              </div>
            )
          )}
        </div>

        <StatusBar path={state.path} totalItems={state.entries.length}
          totalSize={state.entries.reduce((s, e) => s + (e.isDir ? 0 : e.sizeBytes), 0)}
          selectedCount={state.selectedNames.size} filterActive={!!state.filterText}
          filteredCount={displayEntries.length} />
      </div>

      {state.ctxMenu && (
        <ContextMenu x={state.ctxMenu.x} y={state.ctxMenu.y} name={state.ctxMenu.name} isDir={state.ctxMenu.isDir}
          onClose={() => dispatch({ type: 'SET_CONTEXT_MENU', menu: null })}
          onOpen={() => { enterDir(state.ctxMenu!.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); }}
          onDownload={() => { downloadFile(state.path, state.ctxMenu!.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); }}
          onPreview={() => { previewFile(state.path, state.ctxMenu!.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); }}
          onCopy={() => { copy(state.ctxMenu!.name, state.path); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); }}
          onCut={() => { cut(state.ctxMenu!.name, state.path); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); }}
          onRename={() => { rename(state.path, state.ctxMenu!.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); }}
          onCompress={state.ctxMenu.isDir ? () => { compress(state.path, state.ctxMenu!.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); } : undefined}
          onExtract={state.ctxMenu.name.toLowerCase().endsWith('.zip') ? () => { extract(state.path, state.ctxMenu!.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); } : undefined}
          onDelete={() => { del(state.path, state.ctxMenu!.name); dispatch({ type: 'SET_CONTEXT_MENU', menu: null }); }}
        />
      )}

      {state.preview && (
        <PreviewModal name={state.preview.name} type={state.preview.type} dataUrl={state.preview.dataUrl}
          onClose={() => closePreview(state.preview)} onDownload={() => downloadFile(state.path, state.preview!.name)} />
      )}

      <ToastContainer />

      <FileInfoPanel adb={adb} file={state.selectedNames.size === 1 ? displayEntries.find(e => state.selectedNames.has(e.name)) || null : null}
        selectedCount={state.selectedNames.size}
        selectedSize={displayEntries.filter(e => state.selectedNames.has(e.name)).reduce((s, e) => s + (e.isDir ? 0 : e.sizeBytes), 0)}
        totalFiles={state.entries.filter(e => !e.isDir).length} totalDirs={state.entries.filter(e => e.isDir).length}
        currentPath={state.path} visible={state.showInfoPanel} onToggle={() => dispatch({ type: 'TOGGLE_INFO_PANEL' })} />
    </div>
  );
}
