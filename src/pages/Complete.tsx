interface CompleteProps {
  deviceInfo: { model: string; version: string; serial: string } | null;
  onRestart: () => void;
}

export function Complete({ deviceInfo, onRestart }: CompleteProps) {
  return (
    <div className="px-6 py-8 text-center">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-6xl mb-2">🎉</div>

        <h2 className="text-2xl font-bold text-slate-800">
          PenMods 安装完成！
        </h2>

        <p className="text-slate-500">
          您的{deviceInfo?.model || '词典笔'}已成功安装 PenMods。
          设备正在重启中…
        </p>

        {/* 功能介绍 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-left">
          <h3 className="font-semibold text-slate-700 mb-3">✨ 新功能一览</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['🤖', 'AI 助手'],
              ['📖', '增强单词本'],
              ['📂', '文件管理器'],
              ['⌨️', '手动输入'],
              ['🔦', '手电筒'],
              ['🔐', '安全锁'],
            ].map(([icon, name]) => (
              <div key={name} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                <span>{icon}</span>
                <span className="text-slate-600">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 注意事项 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-700 text-left">
          <div className="font-medium mb-1">📌 注意事项</div>
          <ul className="list-disc list-inside space-y-1">
            <li>如果重启后屏幕不可用，请再关机重启一次</li>
            <li>在设置 → 关于 → 重置 中可以卸载 PenMods</li>
            <li>更新 PenMods 只需重新推送新的 libPenMods.so</li>
          </ul>
        </div>

        <button
          onClick={onRestart}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          给其他设备安装
        </button>
      </div>
    </div>
  );
}
