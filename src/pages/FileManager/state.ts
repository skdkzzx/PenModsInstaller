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
