import type { DeviceStatus as DeviceStatusType } from '../lib/adb';

interface DeviceStatusProps {
  status: DeviceStatusType;
  model?: string;
  serial?: string;
}

export function DeviceStatus({ status, model, serial }: DeviceStatusProps) {
  const statusConfig: Record<DeviceStatusType, { led: string; text: string; color: string }> = {
    idle: { led: 'disconnected', text: '等待连接', color: 'text-slate-400' },
    connecting: { led: 'disconnected', text: '连接中…', color: 'text-yellow-500' },
    connected: { led: 'connected', text: `已连接${model ? ` - ${model}` : ''}`, color: 'text-green-600' },
    error: { led: 'error', text: '连接失败', color: 'text-red-500' },
  };

  const cfg = statusConfig[status];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      <span className={`status-led ${cfg.led}`} />
      <div className="flex-1">
        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.text}</span>
        {serial && status === 'connected' && (
          <span className="text-xs text-slate-400 ml-2">SN: {serial}</span>
        )}
      </div>
    </div>
  );
}
