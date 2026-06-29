import { useCallback } from 'react';
import { sftpReaddir, sftpReadFile, sftpDelete, sftpRename, sftpMkdir, sftpRmdir, execCommand } from '../../../lib/ssh';
import { joinPath } from '../utils';
import { showToast } from '../components/Toast';
import type { FileManagerAction } from '../state';

/**
 * SFTP 版文件操作 hook — 接口与 useFileOperations 一致
 * 当连接类型为 SSH 时由 FileManager 使用
 */
/** 通过 SFTP 递归删除目录或文件（不依赖 shell） */
async function rmRecursiveSFTP(path: string): Promise<void> {
  const clean = path.replace(/\/+$/, '');
  let entries;
  try {
    entries = await sftpReaddir(clean);
  } catch {
    try { await sftpDelete(clean); } catch { /* 已不存在 */ }
    return;
  }
  for (const e of entries) {
    const child = clean + '/' + e.name;
    if (e.isDir && !e.isSymlink) await rmRecursiveSFTP(child);
    else { try { await sftpDelete(child); } catch { /* 忽略 */ } }
  }
  try { await sftpRmdir(clean); } catch { /* 忽略 */ }
}

export function useFileOperationsSFTP(
  dispatch: React.Dispatch<FileManagerAction>,
  onLog: (msg: string) => void,
  loadDir: (dir: string) => void,
) {
  const rename = useCallback(async (currentPath: string, name: string) => {
    const newName = prompt('重命名：' + name, name);
    if (!newName || newName === name || !newName.trim()) return;
    onLog(`重命名 ${name} → ${newName.trim()}`);
    try {
      await sftpRename(joinPath(currentPath, name), joinPath(currentPath, newName.trim()));
      onLog('✓ 完成');
      loadDir(currentPath);
    } catch (e) {
      const msg = '✗ 失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg); showToast(msg, 'error');
    }
  }, [onLog, loadDir]);

  const del = useCallback(async (currentPath: string, name: string) => {
    if (!confirm(`删除「${name}」？`)) return;
    onLog(`删除 ${name}`);
    try {
      await sftpDelete(joinPath(currentPath, name));
      onLog('✓ 已删除');
      loadDir(currentPath);
    } catch {
      // 可能是目录，先试 rmdir，非空则递归删除
      const fullPath = joinPath(currentPath, name);
      try { await sftpRmdir(fullPath); onLog('✓ 已删除'); loadDir(currentPath); }
      catch {
        try { await rmRecursiveSFTP(fullPath); onLog('✓ 已删除'); loadDir(currentPath); }
        catch (e) {
          const msg = '✗ 删除失败: ' + (e instanceof Error ? e.message : String(e));
          onLog(msg); showToast(msg, 'error');
        }
      }
    }
  }, [onLog, loadDir]);

  const batchDelete = useCallback(async (currentPath: string, names: string[]) => {
    if (!confirm(`删除选中的 ${names.length} 项？`)) return;
    onLog(`批量删除 ${names.length} 项`);
    let ok = 0;
    for (const name of names) {
      try { await sftpDelete(joinPath(currentPath, name)); ok++; }
      catch { try { await sftpRmdir(joinPath(currentPath, name)); ok++; } catch {} }
    }
    onLog(`✓ 成功删除 ${ok}/${names.length} 项`);
    loadDir(currentPath);
  }, [onLog, loadDir]);

  const copy = useCallback((name: string, currentPath: string) => {
    dispatch({ type: 'SET_CLIPBOARD', clipboard: { action: 'copy', name, sourcePath: joinPath(currentPath, name) } });
    onLog('已复制: ' + name);
  }, [dispatch, onLog]);

  const cut = useCallback((name: string, currentPath: string) => {
    dispatch({ type: 'SET_CLIPBOARD', clipboard: { action: 'cut', name, sourcePath: joinPath(currentPath, name) } });
    onLog('已剪切: ' + name);
  }, [dispatch, onLog]);

  const paste = useCallback(async (currentPath: string, clipboard: { action: 'copy' | 'cut'; name: string; sourcePath: string }) => {
    const dest = joinPath(currentPath, clipboard.name);
    onLog(`${clipboard.action === 'copy' ? '复制' : '移动'} ${clipboard.name} → ${currentPath}`);
    try {
      if (clipboard.action === 'copy') {
        await execCommand(`cp -r "${clipboard.sourcePath}" "${dest}"`);
      } else {
        await execCommand(`mv "${clipboard.sourcePath}" "${dest}"`);
      }
      onLog('✓ 完成');
      dispatch({ type: 'CLEAR_CLIPBOARD' });
      loadDir(currentPath);
    } catch (e) {
      const msg = '✗ 失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg); showToast(msg, 'error');
    }
  }, [dispatch, onLog, loadDir]);

  const compress = useCallback(async (currentPath: string, name: string) => {
    const zipName = name + '.zip';
    dispatch({ type: 'SET_PROCESSING', message: `压缩 ${name}...` });
    onLog(`压缩 ${name} → ${zipName}`);
    try {
      await execCommand(`cd "${currentPath}" && zip -r "${zipName}" "${name}"`);
      onLog('✓ 压缩完成');
      loadDir(currentPath);
    } catch (e) {
      onLog('✗ 压缩失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      dispatch({ type: 'SET_PROCESSING', message: null });
    }
  }, [dispatch, onLog, loadDir]);

  const extract = useCallback(async (currentPath: string, name: string) => {
    const dir = joinPath(currentPath, name.replace(/\.zip$/i, '') || '_extracted');
    dispatch({ type: 'SET_PROCESSING', message: '解压 ' + name + '...' });
    onLog(`解压 ${name}`);
    try {
      await execCommand(`mkdir -p "${dir}" && unzip -o "${joinPath(currentPath, name)}" -d "${dir}"`);
      onLog(`✓ 已解压到 ${dir.split('/').pop()}/`);
      loadDir(currentPath);
    } catch (e) {
      onLog('✗ 解压失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      dispatch({ type: 'SET_PROCESSING', message: null });
    }
  }, [dispatch, onLog, loadDir]);

  const mkdir = useCallback(async (currentPath: string, dirName: string) => {
    if (!dirName.trim()) return;
    onLog(`新建目录 ${joinPath(currentPath, dirName.trim())}`);
    try {
      await sftpMkdir(joinPath(currentPath, dirName.trim()));
      onLog('✓ 完成');
      dispatch({ type: 'SET_SHOW_NEW_DIR', show: false });
      loadDir(currentPath);
    } catch (e) {
      onLog('✗ 失败: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [dispatch, onLog, loadDir]);

  const downloadFile = useCallback(async (currentPath: string, name: string) => {
    onLog('下载 ' + name);
    try {
      const data = await sftpReadFile(joinPath(currentPath, name));
      const blob = new Blob([data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onLog('✓ 下载完成');
    } catch (e) {
      onLog('✗ 下载失败: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [onLog]);

  return { rename, del, batchDelete, copy, cut, paste, compress, extract, mkdir, downloadFile };
}
