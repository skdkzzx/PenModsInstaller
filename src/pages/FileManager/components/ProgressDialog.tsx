import type { QueueItem } from '../hooks/useOperations';

interface ProgressDialogProps {
  current: QueueItem | null;
  queue: QueueItem[];
  onCancel: (id: string) => void;
  onCancelAll: () => void;
  onClearDone: () => void;
  onRetry: (id: string) => void;
}

const OP_LABELS: Record<string, string> = {
  upload: '上传',
  download: '下载',
  copy: '复制',
  move: '移动',
  delete: '删除',
};

export function ProgressDialog({ current, queue, onCancel, onCancelAll, onClearDone, onRetry }: ProgressDialogProps) {
  const runningCount = queue.filter(op => op.status === 'running').length;
  const pendingCount = queue.filter(op => op.status === 'pending').length;
  const doneCount = queue.filter(op => op.status === 'done').length;
  const errorCount = queue.filter(op => op.status === 'error').length;
  const total = queue.length;

  if (total === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[999] w-80 max-w-[calc(100vw-2rem)]">
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
          <span className="text-xs font-semibold text-[#0f172a]">
            操作进度
            {runningCount > 0 && <span className="ml-1.5 text-[#2563eb]">({runningCount + pendingCount} 项)</span>}
          </span>
          <div className="flex items-center gap-1">
            {doneCount + errorCount > 0 && (
              <button onClick={onClearDone} className="text-[10px] px-2 py-0.5 text-[#64748b] hover:bg-[#e2e8f0] rounded">
                清除
              </button>
            )}
            {runningCount + pendingCount > 0 && (
              <button onClick={onCancelAll} className="text-[10px] px-2 py-0.5 text-[#dc2626] hover:bg-[#fef2f2] rounded">
                全部取消
              </button>
            )}
          </div>
        </div>

        {/* Current operation */}
        {current && (
          <div className="px-4 py-3 border-b border-[#e2e8f0]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#0f172a] truncate flex-1">
                {OP_LABELS[current.type] || current.type}: {current.name}
              </span>
              <span className="text-[10px] text-[#2563eb] font-mono ml-2">{current.progress}%</span>
            </div>
            <div className="progress-track h-1.5">
              <div className="progress-bar" style={{ width: `${current.progress}%` }} />
            </div>
            <button onClick={() => onCancel(current.id)} className="mt-1.5 text-[10px] text-[#94a3b8] hover:text-[#dc2626]">
              取消
            </button>
          </div>
        )}

        {/* Error items */}
        {queue.filter(op => op.status === 'error').slice(0, 3).map(op => (
          <div key={op.id} className="px-4 py-2 border-b border-[#e2e8f0] flex items-center gap-2">
            <span className="text-xs text-[#dc2626] truncate flex-1">✗ {op.name}</span>
            <button onClick={() => onRetry(op.id)} className="text-[10px] text-[#2563eb] hover:underline flex-shrink-0">重试</button>
          </div>
        ))}

        {/* Completed summary */}
        {doneCount > 0 && doneCount === total && (
          <div className="px-4 py-3 text-center">
            <span className="text-xs text-[#059669] font-medium">✓ 所有操作已完成</span>
            <span className="text-[10px] text-[#94a3b8] ml-2">({doneCount} 项)</span>
          </div>
        )}
      </div>
    </div>
  );
}
