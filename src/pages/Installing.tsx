import { ProgressBar } from '../components/ProgressBar';
import { LogViewer } from '../components/LogViewer';
import { ErrorCard } from '../components/ErrorCard';
import type { InstallState } from '../lib/installer';

interface InstallingProps {
  installState: InstallState | null;
  error: string | null;
  onRetry?: () => void;
  onBack?: () => void;
}

const phaseLabels: Record<string, string> = {
  'pushing-files': '推送文件到设备…',
  installing: '执行安装脚本…',
  rebooting: '重启设备…',
  done: '安装完成！',
};

export function Installing({ installState, error, onRetry, onBack }: InstallingProps) {
  const progress = installState?.progress ?? 0;
  const phase = installState?.phase ?? 'preparing';
  const currentFile = installState?.currentFile ?? '';
  const log = installState?.log ?? [];

  return (
    <div className="px-6 py-8">
      <h2 className="text-xl font-bold text-slate-800 mb-2">正在安装</h2>
      <p className="text-sm text-slate-500 mb-6">请勿断开设备连接</p>

      <div className="max-w-md space-y-5">
        {/* 阶段标题 */}
        <div className="flex items-center gap-3">
          {phase !== 'done' && phase !== 'error' && (
            <span className="flex gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-dot" />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-dot" />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-dot" />
            </span>
          )}
          <span className="font-medium text-slate-700">
            {phaseLabels[phase] || phase}
          </span>
        </div>

        {/* 进度条 */}
        <ProgressBar
          progress={progress}
          label="安装进度"
          color={phase === 'error' ? 'red' : phase === 'done' ? 'green' : 'blue'}
          size="md"
        />

        {/* 当前操作 */}
        {currentFile && (
          <div className="text-xs text-slate-500">
            当前: {currentFile}
          </div>
        )}

        {/* 日志 */}
        <LogViewer lines={log} maxHeight="250px" />

        {/* 错误 */}
        {error && (
          <ErrorCard
            message={error}
            onRetry={onRetry}
            onBack={onBack}
          />
        )}

        {/* 完成 */}
        {phase === 'done' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-green-700 mb-2">安装成功！</h3>
            <p className="text-sm text-green-600">设备正在重启，请稍候…</p>
            <p className="text-xs text-green-500 mt-2">重启后如果屏幕不可用，请再关机重启一次即可。</p>
          </div>
        )}
      </div>
    </div>
  );
}
