interface WelcomeProps {
  onStart: () => void;
}

export function Welcome({ onStart }: WelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      {/* Logo */}
      <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg mb-6">
        <span className="text-3xl font-bold text-white">PM</span>
      </div>

      <h1 className="text-3xl font-bold text-slate-800 mb-3">
        PenMods 安装器
      </h1>

      <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
        无需电脑，只需手机 + OTG 线，即可为您的有道词典笔安装 PenMods 增强功能。
        全程可视化操作，只需几步点击。
      </p>

      {/* 特性列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full max-w-lg">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl mb-2">📱</div>
          <div className="text-sm font-medium text-slate-700">手机操作</div>
          <div className="text-xs text-slate-400 mt-1">OTG 连接即用</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-sm font-medium text-slate-700">一键安装</div>
          <div className="text-xs text-slate-400 mt-1">全自动流程</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl mb-2">🛡️</div>
          <div className="text-sm font-medium text-slate-700">安全可靠</div>
          <div className="text-xs text-slate-400 mt-1">自动备份还原</div>
        </div>
      </div>

      {/* 开始按钮 */}
      <button
        onClick={onStart}
        className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-lg font-semibold shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-[0.98]"
      >
        开始安装
      </button>

      <p className="text-xs text-slate-400 mt-6">
        需要 Chrome 浏览器 · 支持 Android / Windows / macOS
      </p>

      {/* 兼容性提示 */}
      <div className="mt-8 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 max-w-md">
        ⚠️ 安装 PenMods 会屏蔽官方系统更新。如需更新需先卸载 Mod。操作有风险，请自行承担。
      </div>
    </div>
  );
}
