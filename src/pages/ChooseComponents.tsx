import { useState } from 'react';

interface ChooseComponentsProps {
  onInstall: (components: { base: boolean; certs: boolean; rime: boolean }) => void;
  onBack: () => void;
  deviceInfo: { model: string; version: string; serial: string };
}

interface ComponentOption {
  id: 'base' | 'certs' | 'rime';
  name: string;
  description: string;
  icon: string;
  required?: boolean;
  defaultEnabled?: boolean;
}

const COMPONENTS: ComponentOption[] = [
  {
    id: 'base',
    name: 'PenMods 核心',
    description: 'Mod 运行时、文件管理器、AI 助手等全部功能',
    icon: '⚡',
    required: true,
    defaultEnabled: true,
  },
  {
    id: 'certs',
    name: 'SSL 证书',
    description: 'HTTPS 根证书，用于 AI 助手等联网功能',
    icon: '🔒',
    defaultEnabled: true,
  },
  {
    id: 'rime',
    name: 'Rime 输入法',
    description: '中州韻输入引擎，提供更好的输入体验（开发中）',
    icon: '⌨️',
    defaultEnabled: false,
  },
];

export function ChooseComponents({ onInstall, onBack, deviceInfo }: ChooseComponentsProps) {
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(COMPONENTS.filter(c => c.defaultEnabled || c.required).map(c => c.id))
  );

  const toggle = (id: string) => {
    const comp = COMPONENTS.find(c => c.id === id);
    if (comp?.required) return;
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInstall = () => {
    onInstall({
      base: enabled.has('base'),
      certs: enabled.has('certs'),
      rime: enabled.has('rime'),
    });
  };

  return (
    <div className="px-6 py-8">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <h2 className="text-xl font-bold text-slate-800 mb-2">选择安装组件</h2>
      <p className="text-sm text-slate-500 mb-6">
        设备: {deviceInfo.model} (Android {deviceInfo.version})
      </p>

      <div className="space-y-3 max-w-md mb-8">
        {COMPONENTS.map((comp) => {
          const isEnabled = enabled.has(comp.id);
          return (
            <div
              key={comp.id}
              onClick={() => toggle(comp.id)}
              className={`
                flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${isEnabled
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
                }
                ${comp.required ? 'cursor-default' : ''}
              `}
            >
              {/* 复选框 */}
              <div
                className={`
                  flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center
                  ${isEnabled ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}
                `}
              >
                {isEnabled && <span className="text-white text-sm">✓</span>}
              </div>

              {/* 图标 */}
              <div className="text-2xl flex-shrink-0">{comp.icon}</div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-700">
                  {comp.name}
                  {comp.required && <span className="text-xs text-slate-400 ml-1">（必选）</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{comp.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 安装说明 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700 max-w-md mb-6">
        ⚡ 安装过程约 1-3 分钟，请确保设备电量充足且不要断开连接。
      </div>

      <button
        onClick={handleInstall}
        disabled={!enabled.has('base')}
        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        开始安装 ({enabled.size} 个组件)
      </button>
    </div>
  );
}
