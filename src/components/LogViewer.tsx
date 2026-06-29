import { useEffect, useRef } from 'react';

interface LogViewerProps {
  lines: string[];
  maxHeight?: string;
}

export function LogViewer({ lines, maxHeight = '200px' }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 text-green-400 rounded-lg p-3 overflow-y-auto font-mono text-xs leading-5"
      style={{ maxHeight }}
    >
      {lines.length === 0 ? (
        <span className="text-slate-500">等待输出…</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            <span className="text-slate-600 mr-2">{'>'}</span>
            {line}
          </div>
        ))
      )}
    </div>
  );
}
