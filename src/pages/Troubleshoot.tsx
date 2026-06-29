interface TroubleshootProps {
  onBack: () => void;
}

const issues = [
  {
    q: '浏览器不支持 WebUSB',
    a: '请使用 Chrome 或 Edge 浏览器。Android 手机请用 Chrome。如果使用其他浏览器，请下载 Chrome。',
  },
  {
    q: '点击"检测设备"没反应',
    a: '确认 OTG 线已正确连接。部分手机需在设置中开启 OTG 功能。尝试重新插拔数据线。',
  },
  {
    q: 'WebUSB 弹出窗口中没有设备',
    a: '确认词典笔已开启 ADB（设置→关于→法律监管→点10次）。确认 OTG 线可以传输数据。',
  },
  {
    q: '连接后自动断开',
    a: '请使用高质量的数据线。部分 OTG 转接头可能存在兼容性问题。',
  },
  {
    q: '安装到一半失败了',
    a: '不要慌张，设备不会变砖。重新运行安装器重试即可。如果多次失败，请在 QQ 群寻求帮助。',
  },
  {
    q: '安装后屏幕不可用',
    a: '长按电源键强制关机，再重新开机即可。这是已知问题，第二次启动就正常了。',
  },
  {
    q: '安装后想恢复原版',
    a: '进入设置 → 关于 → 重置 → 卸载 PenMods。或者在电脑上 adb shell 中执行恢复命令。',
  },
];

export function Troubleshoot({ onBack }: TroubleshootProps) {
  return (
    <div className="px-6 py-8">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <h2 className="text-xl font-bold text-slate-800 mb-2">故障排除</h2>
      <p className="text-sm text-slate-500 mb-6">常见问题与解决方法</p>

      <div className="space-y-3 max-w-md">
        {issues.map((item, i) => (
          <details
            key={i}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden group"
          >
            <summary className="px-4 py-3 font-medium text-sm text-slate-700 cursor-pointer hover:bg-slate-50 flex items-center gap-2">
              <span className="text-blue-500">Q:</span>
              {item.q}
            </summary>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-600">
              <span className="text-green-600 font-medium">A: </span>
              {item.a}
            </div>
          </details>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 max-w-md">
        💬 如果上述方法无法解决问题，请加入 QQ 群或访问 GitHub Issues 寻求帮助。
      </div>
    </div>
  );
}
