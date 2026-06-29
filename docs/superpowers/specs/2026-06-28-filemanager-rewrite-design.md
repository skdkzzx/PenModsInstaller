# FileManager 彻底重写设计文档

> 日期: 2026-06-28
> 状态: 已确认
> 范围: `src/pages/FileManager/` 整个模块

---

## 1. 背景与问题

当前 FileManager 是一个 1168 行的单文件 (`FileManager.tsx`)，存在以下核心问题：

- **15+ 子组件内联** — ToolBar、PathBar、ListHeader、ContextMenu、PreviewModal 等全部写在一个文件中
- **25+ 个 useState** — 主组件状态爆炸，没有分层
- **函数引用缺失** — `upload`、`downloadFile`、`previewFile`、`batchDelete`、`mkdir` 在 JSX 中被引用但未定义
- **重复 props** — ToolBar 的 `sidebarOpen` 和 `onToggleSidebar` 各传了两次
- **变量遮蔽** — `import { pathSegments }` 和 `const pathSegments = useMemo(...)` 同时存在
- **路径拼接不安全** — `path + '/' + name` 在根目录产生 `//name`
- **操作队列未使用** — `useOperations` 的 `enqueue` 从未被调用
- **var 声明隐患** — `var inode = await ...` 在 async 函数中
- **拖拽上传无错误处理** — onDrop 内联逻辑出错无反馈

## 2. 目标

将 FileManager 重写为 **清晰分层、职责单一、可独立测试** 的模块化结构。

### 核心原则

1. **一个文件一个职责** — 每个子组件独立文件，每个 hook 管一类状态
2. **状态上收、UI 下沉** — 所有状态由 `useReducer` 统一管理，组件只负责渲染
3. **操作与展示分离** — 文件操作封装在 hooks 中，组件通过 dispatch 触发
4. **路径安全** — 所有路径拼接使用 `joinPath` 工具函数

## 3. 文件结构

```
src/pages/FileManager/
├── index.tsx                    # 主组件（组装层，~100行）
├── state.ts                     # reducer + state 类型定义
├── types.ts                     # 公共类型（保留现有）
├── utils.ts                     # 工具函数（保留+增强路径安全）
│
├── hooks/
│   ├── useFileManager.ts        # 核心 hook：创建 reducer + dispatch
│   ├── useNavigation.ts         # 导航逻辑：loadDir, enterDir, goBack, navigateTo
│   ├── useSelection.ts          # 选择逻辑：toggleSelect, selectAll, keyboard nav
│   ├── useFileOperations.ts     # 文件操作：rename, delete, copy, cut, paste, compress, extract
│   ├── useUpload.ts             # 上传逻辑：单文件/多文件/拖拽
│   ├── usePreview.ts            # 预览逻辑：图片/文本/其他
│   └── useOperations.ts         # 操作队列（保留，与实际操作连接）
│
├── components/
│   ├── ToolBar.tsx              # 工具栏
│   ├── PathBar.tsx              # 面包屑路径
│   ├── FileList.tsx             # 列表视图（表头+行）
│   ├── FileGrid.tsx             # 网格视图
│   ├── FileRow.tsx              # 单个文件行（列表模式）
│   ├── FileCard.tsx             # 单个文件卡片（网格模式）
│   ├── ContextMenu.tsx          # 右键菜单
│   ├── SelectionBar.tsx         # 多选操作栏
│   ├── ClipboardBar.tsx         # 剪贴板提示
│   ├── UploadDialog.tsx         # 上传对话框
│   ├── NewDirDialog.tsx         # 新建目录
│   ├── PreviewModal.tsx         # 文件预览
│   ├── StatusBar.tsx            # 底部状态栏
│   ├── Sidebar.tsx              # 侧栏（保留现有）
│   ├── FileInfoPanel.tsx        # 信息面板（保留现有）
│   ├── ProgressDialog.tsx       # 操作进度（保留现有）
│   ├── Toast.tsx                # 通知（保留现有）
│   ├── EmptyState.tsx           # 空状态
│   └── Skeleton.tsx             # 骨架屏
│
└── icons.tsx                    # 图标组件
```

## 4. 状态管理（Reducer）

### 4.1 State 类型

```typescript
interface FileManagerState {
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
```

### 4.2 Action 类型

```typescript
type FileManagerAction =
  // 导航
  | { type: 'NAVIGATE_START'; path: string }
  | { type: 'NAVIGATE_SUCCESS'; entries: FileEntry[]; path: string }
  | { type: 'NAVIGATE_ERROR'; error: string }

  // 视图
  | { type: 'SET_VIEW_MODE'; mode: 'list' | 'grid' }
  | { type: 'SET_SORT'; field: SortField; asc: boolean }
  | { type: 'SET_FILTER'; text: string }
  | { type: 'SET_TYPE_FILTER'; filter: string }

  // 选择
  | { type: 'SELECT'; names: Set<string>; lastClicked?: string }
  | { type: 'SET_ACTIVE_INDEX'; index: number }
  | { type: 'SET_MULTI_SELECT'; enabled: boolean }

  // 操作
  | { type: 'SET_CLIPBOARD'; clipboard: FileManagerState['clipboard'] }
  | { type: 'CLEAR_CLIPBOARD' }
  | { type: 'SET_SHOW_NEW_DIR'; show: boolean }
  | { type: 'SET_DRAG_OVER'; over: boolean }

  // 预览
  | { type: 'SET_PREVIEW'; preview: FileManagerState['preview'] }

  // 处理中
  | { type: 'SET_PROCESSING'; message: string | null }

  // UI
  | { type: 'SET_EDITING_PATH'; editing: boolean; input?: string }
  | { type: 'SET_CONTEXT_MENU'; menu: FileManagerState['ctxMenu'] }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_INFO_PANEL' };
```

### 4.3 设计要点

- 所有状态变更走 dispatch，组件不直接 setState
- `selectedNames` 用 `Set<string>` — O(1) 查找
- 路径拼接统一走 `joinPath` — 根目录不会产生 `//`

## 5. Hooks 设计

### 5.1 `useNavigation(dispatch, adb)`

职责：目录加载、路径导航。

```
返回：{ loadDir, enterDir, goBack, goHome, navigateTo }
```

- `loadDir(dir)` — dispatch NAVIGATE_START → adb.readDir → dispatch NAVIGATE_SUCCESS/ERROR
- `enterDir(name)` — loadDir(joinPath(path, name))
- `goBack()` — loadDir(parentPath(path))
- `navigateTo(p)` — loadDir(p || '/')

### 5.2 `useSelection(dispatch, displayEntries)`

职责：文件选择、键盘导航。

```
返回：{ toggleSelect, selectAll, clearSelection, handleKeyDown }
```

- `toggleSelect(name, event?)` — Shift 范围选、Ctrl 切换、普通单选
- `handleKeyDown` — 方向键、Enter、Delete、F2、Ctrl+A/C/X/V

### 5.3 `useFileOperations(dispatch, adb, path, selectedNames, clipboard)`

职责：所有文件操作。

```
返回：{ rename, del, copy, cut, paste, compress, extract, mkdir, batchDelete }
```

- 接收当前 path/selectedNames/clipboard 作为参数（从 state 中读取传入）
- 路径安全：所有路径拼接用 `joinPath`
- inode 操作：保留 inode 精确匹配方案（解决乱码文件名）
- 错误处理：try/catch + showToast

### 5.4 `useUpload(dispatch, adb, path)`

职责：文件上传。

```
返回：{ uploadFile, uploadFromDrop, uploadMultiple }
```

- `uploadFile(file)` — 推送单个文件，有进度回调
- `uploadFromDrop(fileList)` — 拖拽上传，逐个推送
- `uploadMultiple(fileList)` — 批量上传

### 5.5 `usePreview(dispatch, adb, path)`

职责：文件预览。

```
返回：{ previewFile }
```

- 图片 → readFile → Blob → ObjectURL
- 文本 → readFile → TextDecoder → 字符串
- 其他 → 显示"无法预览"

### 5.6 `useOperations()` (保留现有，改进)

职责：操作队列管理。

改进：与 useUpload/useFileOperations 连接，enqueue 真正被调用。

## 6. Bug 修复清单

| # | Bug | 修复方案 |
|---|-----|---------|
| 1 | `upload`/`downloadFile`/`previewFile`/`batchDelete`/`mkdir` 未定义 | 在对应 hooks 中正确定义 |
| 2 | ToolBar 重复传 `sidebarOpen`/`onToggleSidebar` prop | 只传一次 |
| 3 | `pathSegments` 变量遮蔽 | utils 中函数改名为 `buildPathSegments` |
| 4 | 剪贴板路径拼接根目录变 `//name` | 统一用 `joinPath(path, name)` |
| 5 | 重命名/删除中 `var inode = await` | 改为 `const inode = await` |
| 6 | 拖拽上传无错误处理 | try/catch + showToast |
| 7 | useOperations.enqueue 从未调用 | 上传操作通过 enqueue 进队列 |
| 8 | ContextMenu useEffect 缺少 `onClose` 依赖 | 补全依赖数组 |
| 9 | PreviewModal URL.revokeObjectURL 未清理 | useEffect cleanup |
| 10 | loadDir useEffect 依赖 `path` 导致重复加载 | 移除 path 依赖 |

## 7. 组件设计要点

- **index.tsx** — 约 100 行，只做组装：创建 hooks → 传 props → 渲染子组件
- **FileList.tsx** — ListHeader + 文件行列表
- **FileRow.tsx** — 单行组件，React.memo 包裹
- **FileGrid.tsx** — 网格视图容器
- **FileCard.tsx** — 单个网格卡片，React.memo 包裹
- **ContextMenu.tsx** — 独立文件，forwardRef
- 所有子组件用 React.memo 减少重渲染

## 8. 实施顺序

1. 创建 `state.ts` — reducer + state/action 类型
2. 创建 `hooks/` — 所有 hooks
3. 创建 `icons.tsx` — 图标组件
4. 创建 `components/` — 所有子组件
5. 创建 `index.tsx` — 主组件组装
6. 修复 `utils.ts` — 路径安全 + 重命名 `buildPathSegments`
7. 更新 `types.ts` — 如有需要
8. 测试所有功能

## 9. 不变的部分

- `Sidebar.tsx` — 保持现有实现
- `FileInfoPanel.tsx` — 保持现有实现
- `ProgressDialog.tsx` — 保持现有实现
- `Toast.tsx` — 保持现有实现
- `types.ts` — 保持现有类型，按需扩展
- `useOperations.ts` — 保持现有逻辑，连接到实际操作
