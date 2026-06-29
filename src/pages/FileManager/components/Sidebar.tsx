import React, { useState, useEffect, useCallback } from 'react';
import { AdbManager } from '../../../lib/adb';
import { joinPath, loadBookmarks, saveBookmarks, loadRecentDirs, saveRecentDirs } from '../utils';

interface SidebarProps {
  adb: AdbManager | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLog: (msg: string) => void;
  sidebarOpen: boolean;
  onToggle: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  expanded: boolean;
  loading: boolean;
  children: TreeNode[];
}

/** 内置默认收藏 */
const DEFAULT_BOOKMARKS = ['/', '/userdisk', '/userdata', '/oem', '/system', '/mnt'];

export function Sidebar({ adb, currentPath, onNavigate, sidebarOpen, onToggle }: SidebarProps) {
  const [tree, setTree] = useState<TreeNode[]>([{ name: '/', path: '/', expanded: true, loading: false, children: [] }]);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    const saved = loadBookmarks();
    return saved.length > 0 ? saved : DEFAULT_BOOKMARKS;
  });
  const [recentDirs, setRecentDirs] = useState<string[]>(loadRecentDirs);
  const [tab, setTab] = useState<'tree' | 'fav' | 'recent'>('fav');

  // 加载目录树子节点
  const loadTreeChildren = useCallback(async (parentPath: string) => {
    if (!adb) return;
    try {
      const entries = await adb.readDir(parentPath);
      return entries
        .filter(e => e.isDir)
        .map(e => ({
          name: e.name,
          path: joinPath(parentPath, e.name),
          expanded: false,
          loading: false,
          children: [],
        }));
    } catch {
      return [];
    }
  }, [adb]);

  // 展开/折叠树节点
  const toggleNode = async (path: string) => {
    const updateNode = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        if (node.path === path) {
          if (node.expanded) {
            result.push({ ...node, expanded: false });
          } else {
            // 加载子节点
            const childDirs = await loadTreeChildren(path);
            result.push({ ...node, expanded: true, loading: false, children: childDirs || [] });
          }
        } else {
          result.push({ ...node, children: node.children.length > 0 ? await updateNode(node.children) : node.children });
        }
      }
      return result;
    };
    setTree(prev => {
      updateNode(prev).then(setTree);
      return prev; // 立即返回旧值，异步更新
    });
  };

  // 初始展开根目录
  useEffect(() => {
    if (adb && tree[0] && !tree[0].loading && tree[0].expanded && tree[0].children.length === 0) {
      loadTreeChildren('/').then(children => {
        setTree(prev => [{ ...prev[0], children: children || [] }]);
      });
    }
  }, [adb]);

  // 添加/移除收藏
  const toggleBookmark = (path: string) => {
    const next = bookmarks.includes(path)
      ? bookmarks.filter(b => b !== path)
      : [...bookmarks, path];
    setBookmarks(next);
    saveBookmarks(next);
  };

  // 导航并记录最近
  const navigate = (path: string) => {
    onNavigate(path);
    const next = [path, ...recentDirs.filter(d => d !== path)];
    setRecentDirs(next.slice(0, 15));
    saveRecentDirs(next.slice(0, 15));
  };

  // 树节点渲染
  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isActive = currentPath === node.path;
    return (
      <div key={node.path}>
        <div
          className={`sidebar-node ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => navigate(node.path)}
        >
          {/* 展开箭头 */}
          <span
            className="sidebar-arrow"
            onClick={e => { e.stopPropagation(); toggleNode(node.path); }}
          >
            {node.loading ? (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
            ) : (
              <svg className={`w-3 h-3 transition-transform ${node.expanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </span>
          {/* 文件夹图标 */}
          <svg className="w-4 h-4 flex-shrink-0 text-[#eab308]" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="1">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="truncate text-xs">{node.name === '/' ? '根目录 /' : node.name}</span>
        </div>
        {node.expanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (!sidebarOpen) return null;

  return (
    <div className="sidebar">
      {/* 侧栏头部 */}
      <div className="sidebar-header">
        <span className="text-xs font-semibold text-[#0f172a]">浏览</span>
        <button onClick={onToggle} className="sidebar-close-btn" title="关闭侧栏">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="sidebar-tabs">
        <button className={`sidebar-tab ${tab === 'fav' ? 'active' : ''}`} onClick={() => setTab('fav')}>收藏夹</button>
        <button className={`sidebar-tab ${tab === 'tree' ? 'active' : ''}`} onClick={() => setTab('tree')}>目录树</button>
        <button className={`sidebar-tab ${tab === 'recent' ? 'active' : ''}`} onClick={() => setTab('recent')}>最近</button>
      </div>

      <div className="sidebar-content">
        {/* 收藏夹 */}
        {tab === 'fav' && (
          <div>
            {bookmarks.map(path => {
              const name = path === '/' ? '根目录' : path.split('/').pop() || path;
              const isActive = currentPath === path;
              return (
                <div key={path} className={`sidebar-node ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(path)}>
                  <svg className="w-4 h-4 flex-shrink-0 text-[#eab308]" viewBox="0 0 24 24" fill={isActive ? '#eab308' : 'none'} stroke="#eab308" strokeWidth="1.5">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span className="truncate text-xs">{name}</span>
                  <span className="text-[10px] text-[#94a3b8] ml-auto mr-1 truncate hidden group-hover:block">{path}</span>
                  <button
                    onClick={e => { e.stopPropagation(); toggleBookmark(path); }}
                    className="sidebar-star" title="移除收藏"
                  >
                    <svg className="w-3 h-3 text-[#f59e0b]" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                </div>
              );
            })}
            {/* 添加当前路径到收藏夹 */}
            {currentPath !== '/' && !bookmarks.includes(currentPath) && (
              <div className="px-3 py-2">
                <button onClick={() => toggleBookmark(currentPath)}
                  className="text-xs text-[#2563eb] hover:underline flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  收藏当前目录
                </button>
              </div>
            )}
          </div>
        )}

        {/* 目录树 */}
        {tab === 'tree' && (
          <div>
            {tree.map(node => renderNode(node, 0))}
          </div>
        )}

        {/* 最近访问 */}
        {tab === 'recent' && (
          <div>
            {recentDirs.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#94a3b8]">暂无最近访问记录</div>
            ) : (
              recentDirs.map(path => {
                const name = path === '/' ? '根目录' : path.split('/').pop() || path;
                const isActive = currentPath === path;
                return (
                  <div key={path} className={`sidebar-node ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(path)}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span className="truncate text-xs">{name}</span>
                    <span className="text-[10px] text-[#94a3b8] ml-auto truncate max-w-[80px]">{path}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
