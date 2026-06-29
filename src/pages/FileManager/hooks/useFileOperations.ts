import { useCallback } from 'react';
import JSZip from 'jszip';
import { AdbManager } from '../../../lib/adb';
import { joinPath } from '../utils';
import { showToast } from '../components/Toast';
import type { FileManagerAction } from '../state';

/**
 * 解码 ZIP 内部文件名：先按严格 UTF-8 尝试，失败则按 GBK（兼容 Windows 中文
 * 压缩包）。避免设备端 toybox unzip 把 GBK 名直接写成乱码字节。
 */
function decodeZipName(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('gbk').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}

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
      if (!inode) {
        const msg = '✗ 重命名失败: 未找到文件「' + name + '」';
        onLog(msg);
        showToast(msg, 'error');
        return;
      }
      const ok = await adb.renameByInode(currentPath, inode, newName.trim());
      if (ok) {
        onLog('✓ 完成');
      } else {
        const msg = '✗ 重命名未生效（mv 失败，见上方日志）';
        onLog(msg);
        showToast(msg, 'error');
      }
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
      if (!inode) {
        const msg = '✗ 删除失败: 未找到文件「' + name + '」';
        onLog(msg);
        showToast(msg, 'error');
        return;
      }
      const ok = await adb.removeByInode(currentPath, inode);
      if (ok) {
        onLog('✓ 已删除');
      } else {
        const msg = '✗ 删除未生效（inode ' + inode + ' 仍存在，见上方日志）';
        onLog(msg);
        showToast(msg, 'error');
      }
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
        if (!inode) {
          onLog(`⚠ 跳过 ${name}: 未找到文件`);
          continue;
        }
        const ok = await adb.removeByInode(currentPath, inode);
        if (ok) successCount++;
        else onLog(`⚠ ${name} 删除未生效`);
      } catch (e) {
        const msg = `✗ 删除 ${name} 失败: ${e instanceof Error ? e.message : String(e)}`;
        onLog(msg);
        showToast(msg, 'error');
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
      const msg = '✗ 失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg);
      showToast(msg, 'error');
    }
  }, [adb, dispatch, onLog, loadDir]);

  // ── 压缩 ──
  const compress = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    const zipName = name + '.zip';
    dispatch({ type: 'SET_PROCESSING', message: `压缩 ${name}...` });
    onLog(`压缩 ${name} → ${zipName}`);
    try {
      const out = await adb.shellPtyCommand(`cd "${currentPath}" && zip -r "${zipName}" "${name}" 2>&1`);
      if (/not found|No such|cannot|inaccessible/i.test(out) && !/adding:|updating:/i.test(out)) {
        throw new Error(out.split('\n').find(Boolean) || '设备可能未安装 zip');
      }
      onLog('✓ 压缩完成');
      loadDir(currentPath);
    } catch (e) {
      const msg = '✗ 压缩失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg);
      showToast(msg, 'error');
    } finally {
      dispatch({ type: 'SET_PROCESSING', message: null });
    }
  }, [adb, dispatch, onLog, loadDir]);

  // ── 解压 ──
  // 优先在浏览器端用 JSZip 解压（可正确处理 GBK 文件名），逐个推送到设备，
  // 彻底避免设备端 unzip 产生乱码目录。失败时回退到设备端 unzip。
  const extract = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    const srcPath = joinPath(currentPath, name);
    const unzipDir = joinPath(currentPath, name.replace(/\.zip$/i, '') || '_extracted');
    const dirLabel = unzipDir.split('/').pop() || '_extracted';
    dispatch({ type: 'SET_PROCESSING', message: '解压 ' + name + '...' });
    onLog('解压 ' + name + ' → ' + dirLabel + '/');
    try {
      const zipData = await adb.readFile(srcPath);
      const zip = await JSZip.loadAsync(zipData, {
        decodeFileName: (bytes) => decodeZipName(bytes as Uint8Array),
      });
      const entries = Object.values(zip.files);
      const files = entries.filter(e => !e.dir);

      // 先创建所有需要的目录（含文件的父目录）
      const dirs = new Set<string>();
      for (const e of entries) {
        const rel = e.name.replace(/\/+$/, '');
        if (!rel) continue;
        const parent = e.dir ? rel : (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
        if (parent) dirs.add(joinPath(unzipDir, parent));
      }
      await adb.mkdir(unzipDir);
      for (const d of dirs) await adb.mkdir(d);

      // 逐个推送文件
      let count = 0;
      for (const e of files) {
        const data = await e.async('uint8array');
        await adb.pushFile(data, joinPath(unzipDir, e.name));
        count++;
        dispatch({ type: 'SET_PROCESSING', message: `解压 ${name}... (${count}/${files.length})` });
      }
      onLog(`✓ 已解压 ${count} 个文件到 ${dirLabel}/`);
      loadDir(currentPath);
    } catch (e) {
      // 回退：设备端 unzip（速度更快，但中文名可能乱码）
      onLog('客户端解压失败，回退设备端 unzip: ' + (e instanceof Error ? e.message : String(e)));
      try {
        const out = await adb.shellCommand(
          'mkdir -p "' + unzipDir + '" && unzip -o "' + srcPath + '" -d "' + unzipDir + '" 2>&1'
        );
        if (/error|cannot|No such|not found|inflating.*: *$/i.test(out) && !/inflating|extracting/i.test(out)) {
          throw new Error(out.split('\n').find(Boolean) || '解压失败');
        }
        onLog('✓ 已解压到 ' + dirLabel + '/');
        loadDir(currentPath);
      } catch (e2) {
        const msg = '✗ 解压失败: ' + (e2 instanceof Error ? e2.message : String(e2));
        onLog(msg);
        showToast(msg, 'error');
      }
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
      const msg = '✗ 新建目录失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg);
      showToast(msg, 'error');
    }
  }, [adb, dispatch, onLog, loadDir]);

  // ── 下载 ──
  const downloadFile = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    const remotePath = joinPath(currentPath, name);
    onLog('下载 ' + name);
    try {
      const data = await adb.readFile(remotePath);
      const blob = new Blob([data as BlobPart]);
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
      const msg = '✗ 下载失败: ' + (e instanceof Error ? e.message : String(e));
      onLog(msg);
      showToast(msg, 'error');
    }
  }, [adb, onLog]);

  return { rename, del, batchDelete, copy, cut, paste, compress, extract, mkdir, downloadFile };
}
