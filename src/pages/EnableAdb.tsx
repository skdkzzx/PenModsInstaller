interface EnableAdbProps {
  onNext: () => void;
  onBack: () => void;
}

export function EnableAdb({ onNext, onBack }: EnableAdbProps) {
  return (
    <div className="px-6 py-8">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <h2 className="text-xl font-bold text-slate-800 mb-2">第一步：开启 ADB 调试</h2>
      <p className="text-sm text-slate-500 mb-6">请在词典笔上按以下步骤操作：</p>

      {/* 步骤卡片 */}
      <div className="space-y-4 max-w-md">
        <div className="bg-white rounded-xl p-4 border border-slate-200 flex gap-4">
          <span className="flex-shrink-0 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
          <div>
            <div className="font-medium text-slate-700">打开「设置」</div>
            <div className="text-xs text-slate-400 mt-1">在词典笔主屏幕找到并点击"设置"图标</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex gap-4">
          <span className="flex-shrink-0 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
          <div>
            <div className="font-medium text-slate-700">进入「关于」</div>
            <div className="text-xs text-slate-400 mt-1">在设置列表中向下滑动，找到并点击"关于"</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex gap-4">
          <span className="flex-shrink-0 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
          <div>
            <div className="font-medium text-slate-700">点击「法律监管」10次</div>
            <div className="text-xs text-slate-400 mt-1">快速连续点击"法律监管"或"法律信息"10次，直到屏幕提示"ADB 已开启"</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex gap-4">
          <span className="flex-shrink-0 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
          <div>
            <div className="font-medium text-slate-700">确认开启</div>
            <div className="text-xs text-slate-400 mt-1">如果看到"ADB 已开启"的提示，说明操作成功</div>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
      >
        已完成，下一步 →
      </button>
    </div>
  );
}
