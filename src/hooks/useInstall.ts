import { useState, useCallback, useRef } from 'react';
import { AdbManager, type AdbProgressEvent } from '../lib/adb';
import { Installer, type InstallState } from '../lib/installer';

export interface InstallFlowState {
  adbManager: AdbManager | null;
  installer: Installer | null;
  deviceStatus: 'idle' | 'connecting' | 'connected' | 'error';
  /** 密码认证状态 */
  authStatus: 'none' | 'authenticating' | 'done' | 'error';
  deviceInfo: { model: string; version: string; serial: string } | null;
  installState: InstallState | null;
  error: string | null;
  isRunning: boolean;
}

export function useInstall() {
  const [state, setState] = useState<InstallFlowState>({
    adbManager: null,
    installer: null,
    deviceStatus: 'idle',
    authStatus: 'none',
    deviceInfo: null,
    installState: null,
    error: null,
    isRunning: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const updateState = useCallback((partial: Partial<InstallFlowState>) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      stateRef.current = next;
      return next;
    });
  }, []);

  const onAdbProgress = useCallback((event: AdbProgressEvent) => {
    if (event.type === 'connected') {
      updateState({ deviceStatus: 'connected' });
    } else if (event.type === 'error') {
      updateState({ error: event.message });
    }
  }, [updateState]);

  /** 创建 ADB 管理器 */
  const initAdb = useCallback(() => {
    const manager = new AdbManager(onAdbProgress);
    updateState({ adbManager: manager });
    return manager;
  }, [onAdbProgress, updateState]);

  /** 连接设备 + 自动密码认证 */
  const connectDevice = useCallback(async () => {
    const manager = stateRef.current.adbManager || initAdb();
    updateState({ deviceStatus: 'connecting', error: null, authStatus: 'none' });

    try {
      await manager.requestDevice();

      // 获取设备信息
      const model = await manager.getProp('ro.product.model');
      const version = await manager.getProp('ro.build.version.release');

      updateState({
        deviceStatus: 'connected',
        deviceInfo: { model, version, serial: manager.serial || '' },
        authStatus: 'authenticating',
      });

      // 自动执行密码认证 (adb shell auth + CherryYoudao)
      try {
        await manager.authPassword();
        updateState({ authStatus: 'done' });
      } catch {
        // 密码认证失败仍可重试，不阻塞流程
        updateState({ authStatus: 'error', error: '密码认证失败，请重试' });
      }
    } catch (err) {
      updateState({
        deviceStatus: 'error',
        error: err instanceof Error ? err.message : '连接失败',
      });
    }
  }, [initAdb, updateState]);

  /** 开始安装 */
  const startInstall = useCallback(async (components: {
    base: boolean;
    certs: boolean;
    rime: boolean;
  }) => {
    const adb = stateRef.current.adbManager;
    if (!adb) {
      updateState({ error: '请先连接设备' });
      return;
    }

    const installer = new Installer(adb, (installState) => {
      updateState({ installState });
    });

    updateState({ installer, isRunning: true, error: null });

    try {
      await installer.install(components);
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : '安装失败',
      });
    } finally {
      updateState({ isRunning: false });
    }
  }, [updateState]);

  /** 断开连接 */
  const disconnect = useCallback(async () => {
    await stateRef.current.adbManager?.disconnect();
    updateState({
      adbManager: null,
      installer: null,
      deviceStatus: 'idle',
      authStatus: 'none',
      deviceInfo: null,
      installState: null,
      error: null,
    });
  }, [updateState]);

  /** 重置状态 */
  const reset = useCallback(() => {
    updateState({
      installState: null,
      error: null,
      isRunning: false,
    });
  }, [updateState]);

  return {
    ...state,
    connectDevice,
    startInstall,
    disconnect,
    reset,
  };
}
