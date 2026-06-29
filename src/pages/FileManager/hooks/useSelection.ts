import { useCallback } from 'react';
import type { FileEntry } from '../types';
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
  goBack: () => void;
}

export function useSelection({
  dispatch, displayEntries, selectedNames, lastClicked, activeIndex, viewMode,
  enterDir, downloadFile, renameFile, batchDelete,
  copyFile, cutFile, pasteFile, clipboard,
  editingPath, showNewDir, ctxMenu, goBack,
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
        goBack();
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
      toggleSelect, selectAll, enterDir, downloadFile, renameFile, batchDelete, copyFile, cutFile, pasteFile, goBack, dispatch]);

  return { toggleSelect, selectAll, clearSelection, handleKeyDown };
}
