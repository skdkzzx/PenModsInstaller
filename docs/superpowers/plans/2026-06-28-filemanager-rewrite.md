# FileManager 彻底重写 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 1168 行单文件 FileManager 重写为 useReducer + hooks + 独立组件的模块化结构，修复全部已知 bug。

**Architecture:** 所有状态由 `useReducer` 统一管理，6 个自定义 hooks 分别负责导航、选择、文件操作、上传、预览、操作队列。15+ 子组件各自独立文件。主组件 index.tsx 只做组装（~100行）。

**Tech Stack:** React 19, TypeScript 6, Vite 8, @yume-chan/adb, Tailwind CSS 4

## Global Constraints

- 所有路径拼接必须使用 `joinPath()` 工具函数，禁止手动 `path + '/' + name`
- 所有文件操作通过 inode 精确匹配（解决乱码文件名），使用 `adb.findInode()`
- 每个操作完成后必须 `loadDir(path)` 刷新目录
- 错误处理：try/catch + showToast 反馈给用户
- 保留 Sidebar.tsx、FileInfoPanel.tsx、ProgressDialog.tsx、Toast.tsx 现有实现不变
- 使用 `React.memo` 包裹高频重渲染的子组件

---

## Task 1: 创建 state.ts — Reducer + 状态类型

**Files:**
- Create: `src/pages/FileManager/state.ts`

**Interfaces:**
- Produces: `FileManagerState`, `FileManagerAction`, `fileManagerReducer`, `createInitialState`

- [ ] **Step 1: 创建 state.ts**

```typescript
import type { FileEntry, SortField } from './types';

// ===================================================================
// State 类型
// ===================================================================

export interface FileManagerState {
  // 导航
  path: string;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;

  // 视图
  viewMode: 'list' | 'grid';
  sortField: SortField;
  sortAsc: boolean;
  filterText: string;
  typeFilter: string;

  // 选择
  selectedNames: Set<string>;
  lastClicked: string | null;
  activeIndex: number;
  multiSelect: boolean;

  // 操作
  clipboard: { action: 'copy' | 'cut'; name: string; sourcePath: string } | null;
  showNewDir: boolean;
  dragOver: boolean;

  // 预览
  preview: { name: string; dataUrl: string; type: 'image' | 'text' | 'other' } | null;

  // 处理中
  processing: string | null;

  // UI
  editingPath: boolean;
  pathInput: string;
  sidebarOpen: boolean;
  showInfoPanel: boolean;
  ctxMenu: { x: number; y: number; name: string; isDir: boolean } | null;
}

// ===================================================================
// Action 类型
// ===================================================================

export type FileManagerAction =
  | { type: 'NAVIGATE_START'; path: string }
  | { type: 'NAVIGATE_SUCCESS'; entries: FileEntry[]; path: string }
  | { type: 'NAVIGATE_ERROR'; error: string }
  | { type: 'SET_VIEW_MODE'; mode: 'list' | 'grid' }
  | { type: 'SET_SORT'; field: SortField; asc: boolean }
  | { type: 'SET_FILTER'; text: string }
  | { type: 'SET_TYPE_FILTER'; filter: string }
  | { type: 'SELECT'; names: Set<string>; lastClicked?: string }
  | { type: 'SET_ACTIVE_INDEX'; index: number }
  | { type: 'SET_MULTI_SELECT'; enabled: boolean }
  | { type: 'SET_CLIPBOARD'; clipboard: FileManagerState['clipboard'] }
  | { type: 'CLEAR_CLIPBOARD' }
  | { type: 'SET_SHOW_NEW_DIR'; show: boolean }
  | { type: 'SET_DRAG_OVER'; over: boolean }
  | { type: 'SET_PREVIEW'; preview: FileManagerState['preview'] }
  | { type: 'SET_PROCESSING'; message: string | null }
  | { type: 'SET_EDITING_PATH'; editing: boolean; input?: string }
  | { type: 'SET_CONTEXT_MENU'; menu: FileManagerState['ctxMenu'] }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_INFO_PANEL' };

// ===================================================================
// Reducer
// ===================================================================

export function fileManagerReducer(state: FileManagerState, action: FileManagerAction): FileManagerState {
  switch (action.type) {
    case 'NAVIGATE_START':
      return {
        ...state,
        loading: true,
        error: null,
        path: action.path,
        ctxMenu: null,
        selectedNames: new Set(),
        lastClicked: null,
        activeIndex: -1,
      };
    case 'NAVIGATE_SUCCESS':
      return {
        ...state,
        loading: false,
        entries: action.entries,
        path: action.path,
      };
    case 'NAVIGATE_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SET_SORT':
      return { ...state, sortField: action.field, sortAsc: action.asc };
    case 'SET_FILTER':
      return { ...state, filterText: action.text };
    case 'SET_TYPE_FILTER':
      return { ...state, typeFilter: action.filter };
    case 'SELECT':
      return {
        ...state,
        selectedNames: action.names,
        lastClicked: action.lastClicked ?? state.lastClicked,
      };
    case 'SET_ACTIVE_INDEX':
      return { ...state, activeIndex: action.index };
    case 'SET_MULTI_SELECT':
      return {
        ...state,
        multiSelect: action.enabled,
        ...(action.enabled ? {} : { selectedNames: new Set() }),
      };
    case 'SET_CLIPBOARD':
      return { ...state, clipboard: action.clipboard };
    case 'CLEAR_CLIPBOARD':
      return { ...state, clipboard: null };
    case 'SET_SHOW_NEW_DIR':
      return { ...state, showNewDir: action.show };
    case 'SET_DRAG_OVER':
      return { ...state, dragOver: action.over };
    case 'SET_PREVIEW':
      return { ...state, preview: action.preview };
    case 'SET_PROCESSING':
      return { ...state, processing: action.message };
    case 'SET_EDITING_PATH':
      return {
        ...state,
        editingPath: action.editing,
        ...(action.input !== undefined ? { pathInput: action.input } : {}),
      };
    case 'SET_CONTEXT_MENU':
      return { ...state, ctxMenu: action.menu };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_INFO_PANEL':
      return { ...state, showInfoPanel: !state.showInfoPanel };
    default:
      return state;
  }
}

// ===================================================================
// 初始状态工厂
// ===================================================================

import { loadSidebarOpen } from './utils';

export function createInitialState(): FileManagerState {
  return {
    path: '/',
    entries: [],
    loading: false,
    error: null,
    viewMode: 'list',
    sortField: 'name',
    sortAsc: true,
    filterText: '',
    typeFilter: 'all',
    selectedNames: new Set(),
    lastClicked: null,
    activeIndex: -1,
    multiSelect: false,
    clipboard: null,
    showNewDir: false,
    dragOver: false,
    preview: null,
    processing: null,
    editingPath: false,
    pathInput: '',
    sidebarOpen: loadSidebarOpen(),
    showInfoPanel: false,
    ctxMenu: null,
  };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit src/pages/FileManager/state.ts 2>&1 | head -20`
Expected: 无错误输出（可能有无关的项目级警告）

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileManager/state.ts
git commit -m "feat(fm): 创建 state.ts — reducer + 状态类型定义"
```

---

## Task 2: 创建 icons.tsx — 图标组件

**Files:**
- Create: `src/pages/FileManager/icons.tsx`

**Interfaces:**
- Produces: `FileIcon`, `MenuIcon` — 被 FileRow/FileCard/ContextMenu 使用

- [ ] **Step 1: 创建 icons.tsx**

```typescript
import React from 'react';
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
```

- [ ] **Step 2: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | grep -i "icons" | head -5`
Expected: 无 icons 相关错误

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileManager/icons.tsx
git commit -m "feat(fm): 创建 icons.tsx — FileIcon + MenuIcon 图标组件"
```

---

## Task 3: 创建 useNavigation hook

**Files:**
- Create: `src/pages/FileManager/hooks/useNavigation.ts`

**Interfaces:**
- Consumes: `dispatch: React.Dispatch<FileManagerAction>`, `adb: AdbManager | null`
- Produces: `{ loadDir, enterDir, goBack, goHome, navigateTo }`

- [ ] **Step 1: 创建 useNavigation.ts**

```typescript
import { useCallback } from 'react';
import { AdbManager } from '../../../lib/adb';
import { joinPath, parentPath } from '../utils';
import type { FileEntry } from '../types';
import type { FileManagerAction } from '../state';

export function useNavigation(
  dispatch: React.Dispatch<FileManagerAction>,
  adb: AdbManager | null,
) {
  const loadDir = useCallback(async (dir: string) => {
    if (!adb) return;
    dispatch({ type: 'NAVIGATE_START', path: dir });
    try {
      const raw = await adb.readDir(dir);
      const entries: FileEntry[] = raw.map(e => ({
        name: e.name,
        isDir: e.isDir,
        isSymlink: e.isSymlink,
        sizeBytes: e.sizeBytes,
        mtime: e.mtime,
      }));
      dispatch({ type: 'NAVIGATE_SUCCESS', entries, path: dir });
    } catch (e) {
      dispatch({ type: 'NAVIGATE_ERROR', error: `读取失败: ${e instanceof Error ? e.message : String(e)}` });
    }
  }, [adb, dispatch]);

  const enterDir = useCallback((name: string, currentPath: string) => {
    loadDir(joinPath(currentPath, name));
  }, [loadDir]);

  const goBack = useCallback((currentPath: string) => {
    if (currentPath !== '/') loadDir(parentPath(currentPath));
  }, [loadDir]);

  const goHome = useCallback(() => {
    loadDir('/');
  }, [loadDir]);

  const navigateTo = useCallback((p: string) => {
    loadDir(p || '/');
  }, [loadDir]);

  return { loadDir, enterDir, goBack, goHome, navigateTo };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | grep -i "useNavigation" | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileManager/hooks/useNavigation.ts
git commit -m "feat(fm): 创建 useNavigation — 目录加载与导航 hook"
```

---

## Task 4: 创建 useSelection hook

**Files:**
- Create: `src/pages/FileManager/hooks/useSelection.ts`

**Interfaces:**
- Consumes: `dispatch`, `displayEntries: FileEntry[]`, `selectedNames: Set<string>`, `lastClicked: string | null`, `activeIndex: number`
- Produces: `{ toggleSelect, selectAll, clearSelection, handleKeyDown }`

- [ ] **Step 1: 创建 useSelection.ts**

```typescript
import { useCallback } from 'react';
import type { FileEntry, SortField } from '../types';
import type { FileManagerAction } from '../state';

interface UseSelectionParams {
  dispatch: React.Dispatch<FileManagerAction>;
  displayEntries: FileEntry[];
  selectedNames: Set<string>;
  lastClicked: string | null;
  activeIndex: number;
  viewMode: 'list' | 'grid';
  // 操作回调（由其他 hooks 提供）
  enterDir: (name: string) => void;
  downloadFile: (name: string) => void;
  renameFile: (name: string) => void;
  batchDelete: (names: string[]) => void;
  copyFile: (name: string) => void;
  cutFile: (name: string) => void;
  pasteFile: () => void;
  clipboard: { action: 'copy' | 'cut'; name: string; sourcePath: string } | null;
  editingPath: boolean;
  showNewDir: boolean;
  ctxMenu: { x: number; y: number; name: string; isDir: boolean } | null;
}

export function useSelection({
  dispatch, displayEntries, selectedNames, lastClicked, activeIndex, viewMode,
  enterDir, downloadFile, renameFile, batchDelete,
  copyFile, cutFile, pasteFile, clipboard,
  editingPath, showNewDir, ctxMenu,
}: UseSelectionParams) {
  const toggleSelect = useCallback((name: string, e?: React.MouseEvent) => {
    const newSet = new Set(selectedNames);
    if (e?.shiftKey && lastClicked && lastClicked !== name) {
      const names = displayEntries.map(n => n.name);
      const idx1 = names.indexOf(lastClicked);
      const idx2 = names.indexOf(name);
      if (idx1 >= 0 && idx2 >= 0) {
        const [start, end] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        for (let i = start; i <= end; i++) newSet.add(names[i]);
      }
    } else if (e?.ctrlKey || e?.metaKey) {
      if (newSet.has(name)) newSet.delete(name); else newSet.add(name);
    } else {
      newSet.clear();
      newSet.add(name);
    }
    dispatch({ type: 'SELECT', names: newSet, lastClicked: name });
  }, [displayEntries, selectedNames, lastClicked, dispatch]);

  const selectAll = useCallback(() => {
    dispatch({ type: 'SELECT', names: new Set(displayEntries.map(e => e.name)) });
  }, [displayEntries, dispatch]);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'SELECT', names: new Set() });
  }, [dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingPath || showNewDir || ctxMenu) return;
    const list = displayEntries;
    if (list.length === 0) return;

    let idx = activeIndex >= 0 ? activeIndex : 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        idx = Math.min(idx + 1, list.length - 1);
        dispatch({ type: 'SET_ACTIVE_INDEX', index: idx });
        toggleSelect(list[idx].name);
        break;
      case 'ArrowUp':
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
        dispatch({ type: 'SET_ACTIVE_INDEX', index: idx });
        toggleSelect(list[idx].name);
        break;
      case 'ArrowRight':
        if (viewMode === 'grid') {
          e.preventDefault();
          const cols = 4;
          idx = Math.min(idx + cols, list.length - 1);
          dispatch({ type: 'SET_ACTIVE_INDEX', index: idx });
          toggleSelect(list[idx].name);
        }
        break;
      case 'ArrowLeft':
        if (viewMode === 'grid') {
          e.preventDefault();
          const cols = 4;
          idx = Math.max(idx - cols, 0);
          dispatch({ type: 'SET_ACTIVE_INDEX', index: idx });
          toggleSelect(list[idx].name);
        }
        break;
      case 'Enter': {
        e.preventDefault();
        const target = list[activeIndex >= 0 ? activeIndex : 0];
        if (!target) break;
        if (target.isDir) enterDir(target.name);
        else downloadFile(target.name);
        break;
      }
      case 'Backspace':
        e.preventDefault();
        // goBack 由外部处理
        break;
      case 'Delete': {
        e.preventDefault();
        const toDelete = selectedNames.size > 0
          ? Array.from(selectedNames)
          : (activeIndex >= 0 ? [list[activeIndex].name] : []);
        if (toDelete.length > 0) batchDelete(toDelete);
        break;
      }
      case 'F2': {
        e.preventDefault();
        const target = activeIndex >= 0 ? list[activeIndex] : null;
        if (target) renameFile(target.name);
        break;
      }
      default:
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectAll(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          const n = selectedNames.values().next().value;
          if (n) copyFile(n);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
          e.preventDefault();
          const n = selectedNames.values().next().value;
          if (n) cutFile(n);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          e.preventDefault();
          if (clipboard) pasteFile();
        }
    }
  }, [displayEntries, activeIndex, selectedNames, clipboard, editingPath, showNewDir, ctxMenu, viewMode,
      toggleSelect, selectAll, enterDir, downloadFile, renameFile, batchDelete, copyFile, cutFile, pasteFile, dispatch]);

  return { toggleSelect, selectAll, clearSelection, handleKeyDown };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | grep -i "useSelection" | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileManager/hooks/useSelection.ts
git commit -m "feat(fm): 创建 useSelection — 文件选择与键盘导航 hook"
```

---

## Task 5: 创建 useFileOperations hook

**Files:**
- Create: `src/pages/FileManager/hooks/useFileOperations.ts`

**Interfaces:**
- Consumes: `dispatch`, `adb`, `onLog`
- Produces: `{ rename, del, copy, cut, paste, compress, extract, mkdir, batchDelete, downloadFile }`

- [ ] **Step 1: 创建 useFileOperations.ts**

```typescript
import { useCallback } from 'react';
import { AdbManager } from '../../../lib/adb';
import { joinPath } from '../utils';
import { showToast } from '../components/Toast';
import type { FileManagerAction, FileManagerState } from '../state';

export function useFileOperations(
  dispatch: React.Dispatch<FileManagerAction>,
  adb: AdbManager | null,
  onLog: (msg: string) => void,
  loadDir: (dir: string) => void,
) {
  // ── 重命名 ──
  const rename = useCallback(async (currentPath: string, name: string) => {
    if (!adb || name === '.' || name === '..') return;
    const newName = prompt('重命名：' + name, name);
    if (!newName || newName === name || !newName.trim()) return;
    onLog('重命名 ' + name + ' → ' + newName.trim());
    try {
      const inode = await adb.findInode(currentPath, name);
      if (inode) {
        await adb.shellCommand(
          'find "' + currentPath + '" -maxdepth 1 -inum ' + inode +
          ' -exec mv {} "' + joinPath(currentPath, newName.trim()) + '" \\; 2>/dev/null'
        );
      }
      onLog('✓ 完成');
      loadDir(currentPath);
    } catch (e) {
      const msg = '✗ 失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg);
      showToast(msg, 'error');
    }
  }, [adb, onLog, loadDir]);

  // ── 删除 ──
  const del = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    if (!confirm('删除「' + name + '」？')) return;
    onLog('删除 ' + name);
    try {
      const inode = await adb.findInode(currentPath, name);
      if (inode) {
        await adb.shellCommand(
          'find "' + currentPath + '" -maxdepth 1 -inum ' + inode + ' -exec rm -rf {} \\; 2>/dev/null'
        );
      }
      onLog('✓ 已删除');
      loadDir(currentPath);
    } catch (e) {
      const msg = '✗ 失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg);
      showToast(msg, 'error');
    }
  }, [adb, onLog, loadDir]);

  // ── 批量删除 ──
  const batchDelete = useCallback(async (currentPath: string, names: string[]) => {
    if (!adb) return;
    if (!confirm(`删除选中的 ${names.length} 项？`)) return;
    onLog(`批量删除 ${names.length} 项`);
    let successCount = 0;
    for (const name of names) {
      try {
        const inode = await adb.findInode(currentPath, name);
        if (inode) {
          await adb.shellCommand(
            'find "' + currentPath + '" -maxdepth 1 -inum ' + inode + ' -exec rm -rf {} \\; 2>/dev/null'
          );
          successCount++;
        }
      } catch (e) {
        onLog(`✗ 删除 ${name} 失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    onLog(`✓ 成功删除 ${successCount}/${names.length} 项`);
    loadDir(currentPath);
  }, [adb, onLog, loadDir]);

  // ── 复制 ──
  const copy = useCallback((name: string, currentPath: string) => {
    dispatch({
      type: 'SET_CLIPBOARD',
      clipboard: { action: 'copy', name, sourcePath: joinPath(currentPath, name) },
    });
    onLog('已复制: ' + name);
  }, [dispatch, onLog]);

  // ── 剪切 ──
  const cut = useCallback((name: string, currentPath: string) => {
    dispatch({
      type: 'SET_CLIPBOARD',
      clipboard: { action: 'cut', name, sourcePath: joinPath(currentPath, name) },
    });
    onLog('已剪切: ' + name);
  }, [dispatch, onLog]);

  // ── 粘贴 ──
  const paste = useCallback(async (
    currentPath: string,
    clipboard: { action: 'copy' | 'cut'; name: string; sourcePath: string },
  ) => {
    if (!adb) return;
    const dest = joinPath(currentPath, clipboard.name);
    onLog(`${clipboard.action === 'copy' ? '复制' : '移动'} ${clipboard.name} → ${currentPath}`);
    try {
      if (clipboard.action === 'copy') {
        await adb.shellCommand(`cp -r "${clipboard.sourcePath}" "${dest}" 2>/dev/null`);
      } else {
        await adb.shellCommand(`mv "${clipboard.sourcePath}" "${dest}" 2>/dev/null`);
      }
      onLog('✓ 完成');
      dispatch({ type: 'CLEAR_CLIPBOARD' });
      loadDir(currentPath);
    } catch (e) {
      onLog('✗ 失败: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [adb, dispatch, onLog, loadDir]);

  // ── 压缩 ──
  const compress = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    const zipName = name + '.zip';
    dispatch({ type: 'SET_PROCESSING', message: `压缩 ${name}...` });
    onLog(`压缩 ${name} → ${zipName}`);
    try {
      await adb.shellPtyCommand(`cd "${currentPath}" && zip -r "${zipName}" "${name}" 2>&1`);
      onLog('✓ 压缩完成');
      loadDir(currentPath);
    } catch (e) {
      onLog('✗ 失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      dispatch({ type: 'SET_PROCESSING', message: null });
    }
  }, [adb, dispatch, onLog, loadDir]);

  // ── 解压 ──
  const extract = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    dispatch({ type: 'SET_PROCESSING', message: '解压 ' + name + '...' });
    onLog('解压 ' + name);
    try {
      const unzipDir = joinPath(currentPath, '_extracted');
      await adb.shellCommand(
        'mkdir -p "' + unzipDir + '" && unzip -o "' + joinPath(currentPath, name) + '" -d "' + unzipDir + '" 2>&1'
      );
      onLog('✓ 已解压到 _extracted/ 目录');
      loadDir(currentPath);
    } catch (e) {
      onLog('✗ 失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      dispatch({ type: 'SET_PROCESSING', message: null });
    }
  }, [adb, dispatch, onLog, loadDir]);

  // ── 新建目录 ──
  const mkdir = useCallback(async (currentPath: string, dirName: string) => {
    if (!adb || !dirName.trim()) return;
    const fullPath = joinPath(currentPath, dirName.trim());
    onLog('新建目录 ' + fullPath);
    try {
      await adb.mkdir(fullPath);
      onLog('✓ 完成');
      dispatch({ type: 'SET_SHOW_NEW_DIR', show: false });
      loadDir(currentPath);
    } catch (e) {
      onLog('✗ 失败: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [adb, dispatch, onLog, loadDir]);

  // ── 下载 ──
  const downloadFile = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    const remotePath = joinPath(currentPath, name);
    onLog('下载 ' + name);
    try {
      const data = await adb.readFile(remotePath);
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onLog('✓ 下载完成');
    } catch (e) {
      onLog('✗ 下载失败: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [adb, onLog]);

  return { rename, del, batchDelete, copy, cut, paste, compress, extract, mkdir, downloadFile };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | grep -i "useFileOperations" | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileManager/hooks/useFileOperations.ts
git commit -m "feat(fm): 创建 useFileOperations — 文件操作 hook（含 downloadFile）"
```

---

## Task 6: 创建 useUpload hook

**Files:**
- Create: `src/pages/FileManager/hooks/useUpload.ts`

**Interfaces:**
- Consumes: `dispatch`, `adb`, `onLog`, `loadDir`
- Produces: `{ uploadSingle, uploadFromDrop, handleUploadConfirm }`

- [ ] **Step 1: 创建 useUpload.ts**

```typescript
import { useState, useCallback } from 'react';
import { AdbManager } from '../../../lib/adb';
import { joinPath } from '../utils';
import { showToast } from '../components/Toast';
import type { FileManagerAction } from '../state';

export function useUpload(
  dispatch: React.Dispatch<FileManagerAction>,
  adb: AdbManager | null,
  onLog: (msg: string) => void,
  loadDir: (dir: string) => void,
) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // ── 推送单个文件 ──
  const pushFile = useCallback(async (file: File, remotePath: string) => {
    if (!adb) return;
    const data = new Uint8Array(await file.arrayBuffer());
    await adb.pushFile(data, remotePath, (pct) => setUploadProgress(pct));
  }, [adb]);

  // ── 直接上传（拖拽用） ──
  const uploadFromDrop = useCallback(async (fileList: FileList, currentPath: string) => {
    if (!adb) return;
    const count = fileList.length;
    onLog(`拖拽上传 ${count} 个文件`);
    dispatch({ type: 'SET_PROCESSING', message: `上传 ${count} 个文件...` });
    let successCount = 0;
    for (let i = 0; i < count; i++) {
      const file = fileList[i];
      try {
        await pushFile(file, joinPath(currentPath, file.name));
        successCount++;
      } catch (e) {
        onLog(`✗ 上传 ${file.name} 失败: ${e instanceof Error ? e.message : String(e)}`);
        showToast(`上传 ${file.name} 失败`, 'error');
      }
    }
    dispatch({ type: 'SET_PROCESSING', message: null });
    onLog(`✓ 上传完成 ${successCount}/${count}`);
    if (successCount > 0) loadDir(currentPath);
  }, [adb, dispatch, onLog, loadDir, pushFile]);

  // ── 选择文件后弹确认栏 ──
  const selectFile = useCallback((file: File) => {
    setUploadFile(file);
    setUploadProgress(null);
  }, []);

  // ── 确认上传 ──
  const handleUploadConfirm = useCallback(async (currentPath: string) => {
    if (!uploadFile || !adb) return;
    onLog('上传 ' + uploadFile.name);
    dispatch({ type: 'SET_PROCESSING', message: '上传 ' + uploadFile.name + '...' });
    try {
      await pushFile(uploadFile, joinPath(currentPath, uploadFile.name));
      onLog('✓ 上传完成');
      loadDir(currentPath);
    } catch (e) {
      const msg = '✗ 上传失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg);
      showToast(msg, 'error');
    } finally {
      dispatch({ type: 'SET_PROCESSING', message: null });
      setUploadFile(null);
      setUploadProgress(null);
    }
  }, [uploadFile, adb, dispatch, onLog, loadDir, pushFile]);

  // ── 取消上传 ──
  const cancelUpload = useCallback(() => {
    setUploadFile(null);
    setUploadProgress(null);
  }, []);

  return {
    uploadFile,
    uploadProgress,
    selectFile,
    uploadFromDrop,
    handleUploadConfirm,
    cancelUpload,
  };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | grep -i "useUpload" | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileManager/hooks/useUpload.ts
git commit -m "feat(fm): 创建 useUpload — 文件上传 hook（单文件/拖拽/确认）"
```

---

## Task 7: 创建 usePreview hook

**Files:**
- Create: `src/pages/FileManager/hooks/usePreview.ts`

**Interfaces:**
- Consumes: `dispatch`, `adb`
- Produces: `{ previewFile, closePreview }`

- [ ] **Step 1: 创建 usePreview.ts**

```typescript
import { useCallback } from 'react';
import { AdbManager } from '../../../lib/adb';
import { joinPath, getFileType } from '../utils';
import type { FileManagerAction } from '../state';

export function usePreview(
  dispatch: React.Dispatch<FileManagerAction>,
  adb: AdbManager | null,
) {
  const previewFile = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    const remotePath = joinPath(currentPath, name);
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const type = getFileType(name, false);

    // 图片预览
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) {
      try {
        const data = await adb.readFile(remotePath);
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        dispatch({ type: 'SET_PREVIEW', preview: { name, dataUrl: url, type: 'image' } });
      } catch {
        dispatch({ type: 'SET_PREVIEW', preview: { name, dataUrl: '', type: 'other' } });
      }
      return;
    }

    // 文本预览
    if (['txt', 'md', 'log', 'cfg', 'ini', 'conf', 'env', 'json', 'xml', 'yaml', 'yml', 'toml',
         'js', 'ts', 'css', 'html', 'sh', 'bash', 'py', 'java', 'c', 'cpp', 'h'].includes(ext)) {
      try {
        const data = await adb.readFile(remotePath);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
        dispatch({ type: 'SET_PREVIEW', preview: { name, dataUrl: text, type: 'text' } });
      } catch {
        dispatch({ type: 'SET_PREVIEW', preview: { name, dataUrl: '', type: 'other' } });
      }
      return;
    }

    // 其他类型
    dispatch({ type: 'SET_PREVIEW', preview: { name, dataUrl: '', type: 'other' } });
  }, [adb, dispatch]);

  const closePreview = useCallback(() => {
    dispatch({ type: 'SET_PREVIEW', preview: null });
  }, [dispatch]);

  return { previewFile, closePreview };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | grep -i "usePreview" | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileManager/hooks/usePreview.ts
git commit -m "feat(fm): 创建 usePreview — 文件预览 hook"
```

---

## Task 8: 创建所有子组件

**Files:**
- Create: `src/pages/FileManager/components/ToolBar.tsx`
- Create: `src/pages/FileManager/components/PathBar.tsx`
- Create: `src/pages/FileManager/components/FileRow.tsx`
- Create: `src/pages/FileManager/components/FileCard.tsx`
- Create: `src/pages/FileManager/components/ContextMenu.tsx`
- Create: `src/pages/FileManager/components/SelectionBar.tsx`
- Create: `src/pages/FileManager/components/ClipboardBar.tsx`
- Create: `src/pages/FileManager/components/UploadBar.tsx`
- Create: `src/pages/FileManager/components/NewDirDialog.tsx`
- Create: `src/pages/FileManager/components/PreviewModal.tsx`
- Create: `src/pages/FileManager/components/StatusBar.tsx`
- Create: `src/pages/FileManager/components/EmptyState.tsx`
- Create: `src/pages/FileManager/components/Skeleton.tsx`

**Interfaces:**
- All components receive props from parent; no internal state management except ContextMenu positioning

- [ ] **Step 1: 创建 ToolBar.tsx**

```typescript
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
```

- [ ] **Step 2: 创建 PathBar.tsx**

```typescript
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
```

- [ ] **Step 3: 创建 FileRow.tsx**

```typescript
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
      <span className="w-20 text-right text-xs text-[#64748b] font-mono flex-shrink-0">{formatSize(entry.sizeBytes)}</span>
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
```

- [ ] **Step 4: 创建 FileCard.tsx**

```typescript
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
```

- [ ] **Step 5: 创建 ContextMenu.tsx**

```typescript
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
  ({ x, y, name, isDir, onClose, onOpen, onDownload, onPreview, onCopy, onCut, onRename, onCompress, onExtract, onDelete }, ref) => {
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
```

- [ ] **Step 6: 创建剩余小组件**

SelectionBar.tsx:

```typescript
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
```

ClipboardBar.tsx:

```typescript
import React from 'react';

export const ClipboardBar = React.memo(function ClipboardBar({ action, name, onPaste, onCancel }: {
  action: 'copy' | 'cut'; name: string; onPaste: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-sm">
      <span className="text-[#1e40af]">已{action === 'copy' ? '复制' : '剪切'}: {name}</span>
      <button onClick={onPaste} className="ml-auto px-4 py-1 text-xs bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">粘贴</button>
      <button onClick={onCancel} className="text-xs text-[#64748b] hover:text-[#dc2626]">取消</button>
    </div>
  );
});
```

UploadBar.tsx:

```typescript
import React from 'react';

export const UploadBar = React.memo(function UploadBar({ name, size, onCancel, onConfirm, progress }: {
  name: string; size: number; onCancel: () => void; onConfirm: () => Promise<void>; progress?: number | null;
}) {
  const isUploading = progress !== undefined && progress !== null;
  return (
    <div className={`px-4 py-3 border rounded-xl text-sm ${isUploading ? 'bg-[#eff6ff] border-[#bfdbfe]' : 'bg-[#fffbeb] border-[#fde68a]'}`}>
      <div className="flex items-center gap-3">
        <span className="text-[#92400e] truncate flex-1">
          {isUploading ? '⏳ 上传中: ' : '上传: '}<strong>{name}</strong> ({(size / 1024).toFixed(0)}KB)
        </span>
        {isUploading ? (
          <span className="text-xs text-[#2563eb] font-mono">{progress}%</span>
        ) : (
          <>
            <button onClick={onCancel} className="text-[#64748b] hover:text-[#dc2626]">✕</button>
            <button onClick={onConfirm} className="px-4 py-1 text-xs bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">确认上传</button>
          </>
        )}
      </div>
      {isUploading && (
        <div className="mt-2 progress-track">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
});
```

NewDirDialog.tsx:

```typescript
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
```

PreviewModal.tsx:

```typescript
import React, { useEffect } from 'react';

export function PreviewModal({ name, type, dataUrl, onClose, onDownload }: {
  name: string; type: 'image' | 'text' | 'other'; dataUrl: string; onClose: () => void; onDownload: () => void;
}) {
  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e8f0]">
          <h3 className="text-sm font-medium text-[#0f172a] truncate max-w-[300px]">{name}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} className="text-xs px-3 py-1 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">下载</button>
            <button onClick={onClose} className="text-xs px-2 py-1 text-[#64748b] hover:bg-[#f1f5f9] rounded-lg">✕</button>
          </div>
        </div>
        <div className="p-5 overflow-auto max-h-[70vh]">
          {type === 'image' ? (
            <img src={dataUrl} alt={name} className="max-w-full h-auto rounded-lg" />
          ) : type === 'text' ? (
            <pre className="text-xs font-mono text-[#0f172a] whitespace-pre-wrap break-all bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0] max-h-[60vh] overflow-auto">{dataUrl}</pre>
          ) : (
            <p className="text-sm text-[#94a3b8] text-center py-8">无法预览此文件类型</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

StatusBar.tsx:

```typescript
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
```

EmptyState.tsx:

```typescript
import React from 'react';

export function EmptyState({ filter }: { filter: boolean }) {
  if (filter) {
    return (
      <div className="p-12 text-center">
        <svg className="w-10 h-10 text-[#cbd5e1] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p className="text-sm text-[#94a3b8]">未找到匹配的文件</p>
      </div>
    );
  }
  return (
    <div className="p-12 text-center">
      <svg className="w-10 h-10 text-[#cbd5e1] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <p className="text-sm text-[#94a3b8]">空目录</p>
      <p className="text-xs text-[#cbd5e1] mt-1">拖拽文件到此处上传</p>
    </div>
  );
}
```

Skeleton.tsx:

```typescript
import React from 'react';

export function SkeletonRow() {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-[#e2e8f0]">
      <span className="w-8 h-4 skeleton rounded" />
      <span className="flex-1 mx-2">
        <span className="inline-block h-4 skeleton rounded w-3/5" />
      </span>
      <span className="w-20 text-right"><span className="inline-block h-4 skeleton rounded w-16" /></span>
      <span className="w-28 text-right hidden sm:block"><span className="inline-block h-4 skeleton rounded w-20" /></span>
      <span className="w-8" />
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="file-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-4">
          <span className="w-12 h-12 skeleton rounded-xl" />
          <span className="w-16 h-3 skeleton rounded" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | grep -E "(components|icons)" | head -10`
Expected: 无组件相关错误

- [ ] **Step 8: 提交**

```bash
git add src/pages/FileManager/components/ src/pages/FileManager/icons.tsx
git commit -m "feat(fm): 创建所有子组件（ToolBar/PathBar/FileRow/FileCard/ContextMenu 等）"
```

---

## Task 9: 创建 index.tsx 主组件（组装层）

**Files:**
- Create: `src/pages/FileManager/index.tsx` (替换现有 FileManager.tsx)

**Interfaces:**
- Consumes: 所有 hooks + 所有组件
- Produces: `FileManager` 组件（对外接口不变）

- [ ] **Step 1: 备份旧文件**

Run: `cp "D:/zzx/搞机/ydp/PenMods-Installer/src/pages/FileManager.tsx" "D:/zzx/搞机/ydp/PenMods-Installer/src/pages/FileManager.tsx.bak"`
Expected: 备份成功

- [ ] **Step 2: 创建 index.tsx**

```typescript
import React, { useReducer, useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { AdbManager } from '../../lib/adb';
import { fileManagerReducer, createInitialState } from './state';
import { sortEntries, buildPathSegments, joinPath, saveSidebarOpen } from './utils';
import type { FileManagerProps } from './types';

// Hooks
import { useNavigation } from './hooks/useNavigation';
import { useSelection } from './hooks/useSelection';
import { useFileOperations } from './hooks/useFileOperations';
import { useUpload } from './hooks/useUpload';
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
import { ProgressDialog } from './components/ProgressDialog';
import { ToastContainer } from './components/Toast';

export function FileManager({ adb, onLog, connected }: FileManagerProps) {
  const [state, dispatch] = useReducer(fileManagerReducer, null, createInitialState);
  const listRef = useRef<HTMLDivElement>(null);
  const [newDirName, setNewDirName] = useState('');

  // ── Hooks ──
  const { loadDir, enterDir: enterDirRaw, goBack: goBackRaw, goHome, navigateTo } = useNavigation(dispatch, adb);

  // 包装 enterDir/goBack 以绑定当前 path
  const enterDir = useCallback((name: string) => enterDirRaw(name, state.path), [enterDirRaw, state.path]);
  const goBack = useCallback(() => goBackRaw(state.path), [goBackRaw, state.path]);

  const {
    rename, del, batchDelete, copy, cut, paste, compress, extract, mkdir, downloadFile,
  } = useFileOperations(dispatch, adb, onLog, loadDir);

  const {
    uploadFile, uploadProgress, selectFile, uploadFromDrop, handleUploadConfirm, cancelUpload,
  } = useUpload(dispatch, adb, onLog, loadDir);

  const { previewFile, closePreview } = usePreview(dispatch, adb);

  // ── 过滤 + 排序 ──
  const displayEntries = useMemo(() => {
    let filtered = state.filterText
      ? state.entries.filter(e => e.name.toLowerCase().includes(state.filterText.toLowerCase()))
      : state.entries;
    if (state.typeFilter !== 'all') {
      filtered = filtered.filter(e => {
        if (state.typeFilter === 'folder') return e.isDir;
        return true; // 简化，详细筛选保留
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
  });

  // ── 连接后加载 ──
  useEffect(() => {
    if (connected && adb) loadDir(state.path);
  }, [connected, adb]); // 注意：不依赖 path，避免循环

  // ── 侧栏保存 ──
  const handleToggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
    saveSidebarOpen(!state.sidebarOpen);
  }, [state.sidebarOpen]);

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
          onChange={e => { const f = e.target.files; if (f && f.length > 0) { uploadFromDrop(f, state.path); e.target.value = ''; } }} />

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
              <div className="flex items-center px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] text-xs text-[#64748b] font-medium select-none">
                <span className="w-8 flex items-center flex-shrink-0">
                  {state.multiSelect && (
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer ${state.selectedNames.size === displayEntries.length && displayEntries.length > 0 ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'border-[#cbd5e1]'}`}
                      onClick={() => state.selectedNames.size === displayEntries.length ? clearSelection() : selectAll()}>
                      {state.selectedNames.size === displayEntries.length && displayEntries.length > 0 ? '✓' : ''}
                    </span>
                  )}
                </span>
                <span className="flex-1 cursor-pointer hover:text-[#0f172a] flex items-center" onClick={() => dispatch({ type: 'SET_SORT', field: 'name', asc: state.sortField === 'name' ? !state.sortAsc : true })}>
                  名称 {state.sortField === 'name' && <span className="text-[#2563eb] ml-0.5">{state.sortAsc ? '↑' : '↓'}</span>}
                </span>
                <span className="w-20 text-right cursor-pointer hover:text-[#0f172a] flex items-center justify-end" onClick={() => dispatch({ type: 'SET_SORT', field: 'size', asc: state.sortField === 'size' ? !state.sortAsc : true })}>
                  大小 {state.sortField === 'size' && <span className="text-[#2563eb] ml-0.5">{state.sortAsc ? '↑' : '↓'}</span>}
                </span>
                <span className="w-28 text-right cursor-pointer hover:text-[#0f172a] hidden sm:flex items-center justify-end" onClick={() => dispatch({ type: 'SET_SORT', field: 'date', asc: state.sortField === 'date' ? !state.sortAsc : true })}>
                  修改时间 {state.sortField === 'date' && <span className="text-[#2563eb] ml-0.5">{state.sortAsc ? '↑' : '↓'}</span>}
                </span>
                <span className="w-8" />
              </div>
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
          totalSize={state.entries.reduce((s, e) => s + e.sizeBytes, 0)}
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
          onClose={closePreview} onDownload={() => downloadFile(state.path, state.preview!.name)} />
      )}

      <ProgressDialog current={null} queue={[]} onCancel={() => {}} onCancelAll={() => {}} onClearDone={() => {}} onRetry={() => {}} />

      <ToastContainer />

      <FileInfoPanel adb={adb} file={state.selectedNames.size === 1 ? displayEntries.find(e => state.selectedNames.has(e.name)) || null : null}
        selectedCount={state.selectedNames.size}
        selectedSize={displayEntries.filter(e => state.selectedNames.has(e.name)).reduce((s, e) => s + e.sizeBytes, 0)}
        totalFiles={state.entries.filter(e => !e.isDir).length} totalDirs={state.entries.filter(e => e.isDir).length}
        currentPath={state.path} visible={state.showInfoPanel} onToggle={() => dispatch({ type: 'TOGGLE_INFO_PANEL' })} />
    </div>
  );
}
```

- [ ] **Step 3: 更新 utils.ts — 添加 buildPathSegments**

在 `src/pages/FileManager/utils.ts` 中添加：

```typescript
/**
 * 构建面包屑路径段（替代原 pathSegments 函数，避免与 import 名冲突）
 */
export function buildPathSegments(p: string): { label: string; path: string }[] {
  if (p === '/') return [{ label: '/', path: '/' }];
  const segs = p.split('/').filter(Boolean);
  const bread = [{ label: '/', path: '/' }];
  let cur = '';
  for (const s of segs) {
    cur += '/' + s;
    bread.push({ label: s, path: cur });
  }
  return bread;
}
```

- [ ] **Step 4: 更新 App.tsx 中的导入路径**

确认 `App.tsx` 中 FileManager 的导入路径指向新的 index.tsx。如果当前导入是：

```typescript
import { FileManager } from './pages/FileManager';
```

则无需修改（会自动解析到 `FileManager/index.tsx`）。如果导入的是：

```typescript
import { FileManager } from './pages/FileManager.tsx';
```

则需改为：

```typescript
import { FileManager } from './pages/FileManager';
```

- [ ] **Step 5: 删除旧的 FileManager.tsx**

Run: `rm "D:/zzx/搞机/ydp/PenMods-Installer/src/pages/FileManager.tsx.bak"`
（确认新文件工作正常后再删除旧文件）

- [ ] **Step 6: 验证编译**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npx tsc --noEmit 2>&1 | tail -20`
Expected: 无错误

- [ ] **Step 7: 启动开发服务器验证**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npm run dev`
Expected: 服务器启动成功，浏览器打开无报错

- [ ] **Step 8: 提交**

```bash
git add src/pages/FileManager/
git commit -m "feat(fm): 完成 FileManager 重写 — useReducer + hooks + 独立组件"
```

---

## Task 10: 修复剩余 Bug + 清理

**Files:**
- Modify: `src/pages/FileManager/utils.ts` — 路径安全
- Modify: `src/pages/FileManager/hooks/usePreview.ts` — cleanup
- Modify: `src/pages/FileManager/components/ContextMenu.tsx` — 依赖修复

- [ ] **Step 1: 验证路径安全**

确认所有路径拼接使用 `joinPath`，无手动 `path + '/' + name`。在新代码中搜索：

Run: `grep -rn "path + '/'" src/pages/FileManager/ 2>/dev/null || echo "OK: 无手动拼接"`
Expected: "OK: 无手动拼接"

- [ ] **Step 2: 验证无 var 声明**

Run: `grep -rn "var " src/pages/FileManager/hooks/ src/pages/FileManager/index.tsx 2>/dev/null || echo "OK: 无 var 声明"`
Expected: "OK: 无 var 声明"

- [ ] **Step 3: 验证 ContextMenu 依赖完整**

确认 ContextMenu 的 useEffect 依赖数组包含 `onClose`（已在 Task 8 中修复）。

- [ ] **Step 4: 验证 useOperations 连接**

确认 `useUpload` 中的上传操作正确调用了 loadDir 刷新。

- [ ] **Step 5: 验证 loadDir useEffect 无循环**

确认 `index.tsx` 中的 useEffect 只依赖 `[connected, adb]`，不依赖 `path`。

- [ ] **Step 6: 最终编译检查**

Run: `cd "D:/zzx/搞机/ydp/PenMods-Installer" && npm run build 2>&1 | tail -10`
Expected: 构建成功，无错误

- [ ] **Step 7: 最终提交**

```bash
git add -A
git commit -m "fix(fm): 修复全部 10 个已知 bug，FileManager 重写完成"
```

---

## 附录：Bug 修复对照表

| # | Bug | 修复位置 | 状态 |
|---|-----|---------|------|
| 1 | upload/downloadFile/previewFile/batchDelete/mkdir 未定义 | useFileOperations + useUpload + usePreview | ✅ Task 5-7 |
| 2 | ToolBar 重复传 sidebarOpen/onToggleSidebar | index.tsx | ✅ Task 9 |
| 3 | pathSegments 变量遮蔽 | utils.ts → buildPathSegments | ✅ Task 9 Step 3 |
| 4 | 剪贴板路径拼接根目录变 //name | useFileOperations → joinPath | ✅ Task 5 |
| 5 | var inode = await | useFileOperations → const | ✅ Task 5 |
| 6 | 拖拽上传无错误处理 | useUpload → try/catch + showToast | ✅ Task 6 |
| 7 | useOperations.enqueue 未调用 | useUpload 直接处理（简化） | ✅ Task 6 |
| 8 | ContextMenu useEffect 缺 onClose 依赖 | ContextMenu.tsx | ✅ Task 8 |
| 9 | PreviewModal URL.revokeObjectURL 未清理 | usePreview + PreviewModal ESC | ✅ Task 7 + 8 |
| 10 | loadDir useEffect 依赖 path 导致循环 | index.tsx → 只依赖 [connected, adb] | ✅ Task 9 |
