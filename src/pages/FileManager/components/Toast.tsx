import { useState, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
const listeners: Set<(msg: ToastMessage) => void> = new Set();

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'info') {
  const msg: ToastMessage = { id: `toast_${++toastId}`, text, type };
  listeners.forEach(fn => fn(msg));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts(prev => [...prev, msg]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== msg.id));
      }, 2500);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-[300px]">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="text-xs">{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
