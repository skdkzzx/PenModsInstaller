import { useCallback } from 'react';
import { sftpReaddir } from '../../../lib/ssh';
import { joinPath, parentPath } from '../utils';
import type { FileEntry } from '../types';
import type { FileManagerAction } from '../state';

export function useNavigationSFTP(
  dispatch: React.Dispatch<FileManagerAction>,
) {
  const loadDir = useCallback(async (dir: string) => {
    dispatch({ type: 'NAVIGATE_START', path: dir });
    try {
      const raw = await sftpReaddir(dir);
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
  }, [dispatch]);

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
