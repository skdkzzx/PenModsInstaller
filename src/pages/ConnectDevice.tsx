interface ConnectDeviceProps {
  onNext: () => void;
  onBack: () => void;
}

export function ConnectDevice({ onNext, onBack }: ConnectDeviceProps) {
  return (
    <div className="px-6 py-8">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <h2 className="text-xl font-bold text-slate-800 mb-2">第二步：连接设备</h2>
      <p className="text-sm text-slate-500 mb-6">用 OTG 线将手机与词典笔连接</p>

      <div className="space-y-4 max-w-md">
        {/* 手机示意图 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
          <div className="text-5xl mb-3">📱</div>
          <div className="text-sm font-medium text-slate-700">你的手机</div>
          <div className="text-xs text-slate-400 mt-1">需要支持 OTG 功能</div>
        </div>

        {/* 连接线 */}
        <div className="flex items-center gap-2 justify-center text-slate-400">
          <div className="h-px flex-1 bg-slate-300" />
          <span className="text-sm">🔌 OTG 数据线</span>
          <div className="h-px flex-1 bg-slate-300" />
        </div>

        {/* 词典笔示意图 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
          <div className="text-5xl mb-3">🖊️</div>
          <div className="text-sm font-medium text-slate-700">有道词典笔</div>
          <div className="text-xs text-slate-400 mt-1">确认已开启 ADB（上一步）</div>
        </div>

        {/* 温馨提示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <div className="font-medium mb-1">💡 温馨提示</div>
          <ul className="space-y-1 text-xs list-disc list-inside">
            <li>请使用数据线（非充电线），确保可传输数据</li>
            <li>部分手机需在设置中开启 OTG 功能</li>
            <li>连接后词典笔可能有提示，选择"仅充电"以外的模式</li>
          </ul>
        </div>
      </div>

      <button
        onClick={onNext}
        className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
      >
        已连接，下一步 →
      </button>
    </div>
  );
}
