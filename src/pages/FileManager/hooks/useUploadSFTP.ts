import { useState, useCallback } from 'react';
import { sftpWriteFile } from '../../../lib/ssh';
import { joinPath } from '../utils';
import { showToast } from '../components/Toast';
import type { FileManagerAction } from '../state';

export function useUploadSFTP(
  dispatch: React.Dispatch<FileManagerAction>,
  onLog: (msg: string) => void,
  loadDir: (dir: string) => void,
) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const pushFile = useCallback(async (file: File, remotePath: string) => {
    const data = new Uint8Array(await file.arrayBuffer());
    await sftpWriteFile(remotePath, data);
    setUploadProgress(100);
  }, []);

  const uploadFromDrop = useCallback(async (fileList: FileList, currentPath: string) => {
    const count = fileList.length;
    onLog(`拖拽上传 ${count} 个文件`);
    dispatch({ type: 'SET_PROCESSING', message: `上传 ${count} 个文件...` });
    let success = 0;
    for (let i = 0; i < count; i++) {
      try {
        await pushFile(fileList[i], joinPath(currentPath, fileList[i].name));
        success++;
      } catch (e) {
        onLog(`✗ 上传 ${fileList[i].name} 失败: ${e instanceof Error ? e.message : String(e)}`);
        showToast(`上传 ${fileList[i].name} 失败`, 'error');
      }
    }
    dispatch({ type: 'SET_PROCESSING', message: null });
    onLog(`✓ 上传完成 ${success}/${count}`);
    if (success > 0) loadDir(currentPath);
  }, [dispatch, onLog, loadDir, pushFile]);

  const selectFile = useCallback((file: File) => {
    setUploadFile(file);
    setUploadProgress(null);
  }, []);

  const handleUploadConfirm = useCallback(async (currentPath: string) => {
    if (!uploadFile) return;
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
  }, [uploadFile, dispatch, onLog, loadDir, pushFile]);

  const cancelUpload = useCallback(() => {
    setUploadFile(null);
    setUploadProgress(null);
  }, []);

  return { uploadFile, uploadProgress, selectFile, uploadFromDrop, handleUploadConfirm, cancelUpload };
}
