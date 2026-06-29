import { useCallback } from 'react';
import { AdbManager } from '../../../lib/adb';
import { joinPath } from '../utils';
import type { FileManagerAction } from '../state';

export function usePreview(
  dispatch: React.Dispatch<FileManagerAction>,
  adb: AdbManager | null,
) {
  const previewFile = useCallback(async (currentPath: string, name: string) => {
    if (!adb) return;
    const remotePath = joinPath(currentPath, name);
    const ext = name.split('.').pop()?.toLowerCase() || '';

    // 图片预览
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) {
      try {
        const data = await adb.readFile(remotePath);
        const blob = new Blob([data as BlobPart]);
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

  const closePreview = useCallback((currentPreview?: { dataUrl: string; type: string } | null) => {
    if (currentPreview?.type === 'image' && currentPreview.dataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentPreview.dataUrl);
    }
    dispatch({ type: 'SET_PREVIEW', preview: null });
  }, [dispatch]);

  return { previewFile, closePreview };
}
