interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const colorMap = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-3',
  lg: 'h-4',
};

export function ProgressBar({ progress, label, color = 'blue', size = 'md' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1.5">
          <span className="text-sm text-slate-600">{label}</span>
          <span className="text-sm font-medium text-slate-700">{clamped}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-200 rounded-full overflow-hidden ${sizeMap[size]}`}>
        <div
          className={`${colorMap[color]} ${sizeMap[size]} rounded-full transition-all duration-300 ease-out progress-animated`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
