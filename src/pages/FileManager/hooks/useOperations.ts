import { useState, useRef, useCallback } from 'react';
import type { FileOpType } from '../types';

export interface QueueItem {
  id: string;
  type: FileOpType;
  name: string;
  source?: string;
  target: string;
  progress: number;
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  error?: string;
  totalBytes?: number;
  transferredBytes?: number;
}

export interface UseOperationsReturn {
  queue: QueueItem[];
  current: QueueItem | null;
  isRunning: boolean;
  enqueue: (op: Omit<QueueItem, 'id' | 'progress' | 'status'>) => string;
  updateProgress: (id: string, progress: number) => void;
  cancel: (id: string) => void;
  cancelAll: () => void;
  clearDone: () => void;
  retry: (id: string) => void;
}

let opCounter = 0;
function genId() { return `op_${++opCounter}_${Date.now()}`; }

export function useOperations(): UseOperationsReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const processNext = useCallback((currentQueue: QueueItem[]) => {
    const next = currentQueue.find(op => op.status === 'pending');
    if (!next) {
      runningRef.current = false;
      return;
    }

    runningRef.current = true;
    setQueue(prev => prev.map(op =>
      op.id === next.id ? { ...op, status: 'running' as const } : op
    ));
  }, []);

  const enqueue = useCallback((op: Omit<QueueItem, 'id' | 'progress' | 'status'>): string => {
    const id = genId();
    const newOp: QueueItem = {
      ...op,
      id,
      progress: 0,
      status: 'pending',
    };

    setQueue(prev => {
      const next = [...prev, newOp];
      if (!runningRef.current) processNext(next);
      return next;
    });

    return id;
  }, [processNext]);

  const updateProgress = useCallback((id: string, progress: number) => {
    setQueue(prev => prev.map(op =>
      op.id === id ? { ...op, progress: Math.min(progress, 100) } : op
    ));
  }, []);

  const cancel = useCallback((id: string) => {
    abortRef.current?.abort();
    setQueue(prev => prev.map(op =>
      op.id === id ? { ...op, status: 'cancelled' as const } : op
    ));
    runningRef.current = false;
  }, []);

  const cancelAll = useCallback(() => {
    abortRef.current?.abort();
    setQueue(prev => prev.map(op =>
      op.status === 'pending' || op.status === 'running'
        ? { ...op, status: 'cancelled' as const }
        : op
    ));
    runningRef.current = false;
  }, []);

  const clearDone = useCallback(() => {
    setQueue(prev => prev.filter(op =>
      op.status === 'pending' || op.status === 'running'
    ));
  }, []);

  const retry = useCallback((id: string) => {
    setQueue(prev => prev.map(op =>
      op.id === id ? { ...op, status: 'pending' as const, progress: 0, error: undefined } : op
    ));
    if (!runningRef.current) {
      setQueue(prev => {
        processNext(prev);
        return prev;
      });
    }
  }, [processNext]);

  const current = queue.find(op => op.status === 'running') || null;
  const isRunning = runningRef.current;

  return {
    queue,
    current,
    isRunning,
    enqueue,
    updateProgress,
    cancel,
    cancelAll,
    clearDone,
    retry,
  };
}
