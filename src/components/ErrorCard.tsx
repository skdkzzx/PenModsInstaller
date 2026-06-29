interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ErrorCard({ title = '出错了', message, onRetry, onBack }: ErrorCardProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
      <div className="text-4xl mb-3">😵</div>
      <h3 className="text-lg font-semibold text-red-700 mb-2">{title}</h3>
      <p className="text-sm text-red-600 mb-4 break-words">{message}</p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
          >
            重试
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2 bg-white text-slate-600 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            返回
          </button>
        )}
      </div>
    </div>
  );
}
