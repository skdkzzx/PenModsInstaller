import { useState } from 'react';
import { DeviceStatus } from '../components/DeviceStatus';
import { ErrorCard } from '../components/ErrorCard';
import type { DeviceStatus as DeviceStatusType } from '../lib/adb';

interface DetectDeviceProps {
  onNext: (deviceInfo: { model: string; version: string; serial: string }) => void;
  onBack: () => void;
  onConnect: () => Promise<void>;
  deviceStatus: DeviceStatusType;
  authStatus: 'none' | 'authenticating' | 'done' | 'error';
  deviceInfo: { model: string; version: string; serial: string } | null;
  error: string | null;
}

export function DetectDevice({
  onNext,
  onBack,
  onConnect,
  deviceStatus,
  authStatus,
  deviceInfo,
  error,
}: DetectDeviceProps) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnect();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="px-6 py-8">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <h2 className="text-xl font-bold text-slate-800 mb-2">第三步：检测设备</h2>
      <p className="text-sm text-slate-500 mb-6">自动检测并认证词典笔</p>

      <div className="max-w-md space-y-4">
        <DeviceStatus
          status={deviceStatus}
          model={deviceInfo?.model}
          serial={deviceInfo?.serial}
        />

        {deviceStatus === 'idle' && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                连接中…
              </>
            ) : (
              '检测设备'
            )}
          </button>
        )}

        {/* 设备信息 */}
        {deviceStatus === 'connected' && deviceInfo && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-sm font-medium text-green-700 mb-2">✅ 设备已连接</div>
            <div className="text-xs text-green-600 space-y-1">
              <div>型号: {deviceInfo.model}</div>
              <div>系统: {deviceInfo.version}</div>
              <div>序列号: {deviceInfo.serial}</div>
            </div>
          </div>
        )}

        {/* 密码认证状态 */}
        {authStatus === 'authenticating' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
            <span className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
            <span className="text-sm text-yellow-700">正在执行密码认证 (CherryYoudao)…</span>
          </div>
        )}

        {authStatus === 'done' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-sm font-medium text-green-700">🔓 密码认证通过</div>
            <div className="text-xs text-green-600 mt-1">Shell 已解锁，可以执行安装操作</div>
          </div>
        )}

        {authStatus === 'error' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="text-sm font-medium text-yellow-700 mb-1">⚠️ 密码认证失败</div>
            <div className="text-xs text-yellow-600">如果设备已认证过，可以直接继续安装。点击重试重新认证。</div>
            <button
              onClick={handleConnect}
              className="mt-2 px-4 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              重试认证
            </button>
          </div>
        )}

        {/* 说明 */}
        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500">
          <div className="font-medium text-slate-600 mb-1">🔐 连接过程</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>弹窗选择您的词典笔设备</li>
            <li>自动建立 ADB 连接（RSA 密钥交换）</li>
            <li>自动执行密码认证（adb shell auth + CherryYoudao）</li>
          </ol>
        </div>

        {/* 错误 */}
        {error && (
          <ErrorCard message={error} onRetry={handleConnect} onBack={onBack} />
        )}

        {/* 下一步 */}
        {deviceStatus === 'connected' && (
          <button
            onClick={() => deviceInfo && onNext(deviceInfo)}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
          >
            下一步：选择组件 →
          </button>
        )}
      </div>
    </div>
  );
}
