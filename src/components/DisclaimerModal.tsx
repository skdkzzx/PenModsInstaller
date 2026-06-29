// DisclaimerModal — 使用须知 & 免责声明弹窗，每次打开页面都会展示

import { useRef, useState, useEffect, useCallback } from 'react';

interface DisclaimerModalProps {
  onAccept: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const reached = scrollPct >= 99;

  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const pct = Math.min(100, Math.round(
      (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
    ));
    setScrollPct(isNaN(pct) ? 100 : pct);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    onScroll(); // initial calc in case content fits without scroll
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  // SVG 环形进度条参数
  const r = 9.5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (scrollPct / 100) * circ;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ overscrollBehavior: 'contain' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-[#e2e8f0] flex-shrink-0">
          <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3m0 12v3M5.3 7.7l2.1 2.1m9.3-2.1l-2.1 2.1M3 12h3m12 0h3" />
              <path d="M8 12h8l-2 4H10l-2-4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a]">使用须知 &amp; 免责声明</h2>
            <p className="text-[11px] text-[#94a3b8]">请仔细阅读以下条款后再使用本工具</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm text-[#334155] leading-relaxed">
          {/* 风险提示 */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-semibold text-red-700 text-xs mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              风险提示
            </p>
            <p className="text-xs text-red-600 leading-relaxed">
              本工具会修改词典笔系统文件（替换系统应用、注入动态库、修改系统分区），
              操作不当或意外中断可能导致设备变砖、功能异常、数据丢失、保修失效等<strong className="text-red-700">不可逆后果</strong>。
            </p>
          </div>

          {/* 免责条款 */}
          <Section title="免责条款">
            <ul className="space-y-1.5">
              <Li>本工具基于 <Link href="https://github.com/PenUniverse/PenMods">PenUniverse/PenMods</Link> 修改，仅供学习研究使用，严禁用于商业用途。</Li>
              <Li>作者不对软件完整性、适用性、可靠性做任何明示或暗示的保证。</Li>
              <Li>使用本工具造成的任何直接或间接损失（包括但不限于设备损坏、数据丢失、功能异常），作者不承担任何责任。</Li>
              <Li>使用本工具即表示您理解并接受上述所有风险，自行承担一切后果。</Li>
              <Li>本项目与网易有道无任何关联，用户如因使用本工具违反有道用户协议而导致账号/设备受限，作者不承担任何责任。</Li>
            </ul>
          </Section>

          {/* 使用守则 */}
          <Section title="使用守则">
            <ul className="space-y-1.5">
              <Li>请确保设备电量充足（建议 &gt;50%），安装过程中不要拔线或关机。</Li>
              <Li>安装前建议备份重要数据（单词本、学习记录可通过系统设置备份）。</Li>
              <Li>如安装后屏幕不可用，长按电源键强制关机再开机即可恢复。</Li>
              <Li>本工具为开源项目，请从官方渠道（GitHub）获取，谨防恶意修改版。</Li>
              <Li>禁止将本工具用于任何违法或违反有道词典笔用户协议的行为。</Li>
              <Li>仅支持有道词典笔二代（YDP02x）和三代（YDPG3），其他型号请勿尝试。</Li>
            </ul>
          </Section>

          {/* 知识产权声明 */}
          <Section title="知识产权声明">
            <ul className="space-y-1.5">
              <Li>本项目是<strong className="text-[#0f172a]">第三方独立开源项目</strong>，与网易有道公司（NetEase Youdao）及其关联公司<strong className="text-[#0f172a]">无任何隶属关系</strong>，也未获其官方授权或认可。</Li>
              <Li>「有道」「Youdao」「有道词典笔」等商标、品牌名称及设备固件版权均属<Link href="https://www.youdao.com">网易有道信息技术（北京）有限公司</Link>所有。</Li>
              <Li>本工具仅提供技术接口层面的辅助安装功能，<strong className="text-[#0f172a]">不包含</strong>任何有道词典笔的专有固件代码、逆向工程产物或受版权保护的系统资源。</Li>
              <Li>用户在使用本工具时，应自行遵守有道词典笔的<a href="https://www.youdao.com" target="_blank" rel="noopener" className="text-blue-600 underline underline-offset-2">最终用户许可协议（EULA）</a>及相关法律法规。</Li>
              <Li>若您认为本项目的任何内容侵犯了您的合法权益，请通过下方联系方式与作者沟通，我们将在核实后尽快处理。</Li>
            </ul>
          </Section>

          {/* 开源协议 */}
          <Section title="开源协议">
            <p className="text-xs text-[#64748b] leading-relaxed">
              本项目以 <Link href="https://www.gnu.org/licenses/gpl-3.0.html">GNU General Public License v3.0</Link> 在 GitHub 公开发布，
              欢迎查阅源码、提交 Issue 或贡献代码。
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <a href="https://github.com/skdkzzx/PenModsInstaller" target="_blank" rel="noopener"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                skdkzzx/PenModsInstaller
              </a>
              <span className="text-[#94a3b8]">遵循原项目 <Link href="https://github.com/PenUniverse/PenMods">PenUniverse/PenMods</Link></span>
            </div>
          </Section>

          {/* 赞助支持 */}
          <div className="bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50 border border-amber-200 rounded-xl p-4">
            <p className="font-medium text-[#b45309] text-xs mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#b45309]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              赞助支持
            </p>
            <p className="text-xs text-[#92400e] leading-relaxed mb-3">
              如果你觉得这个工具帮到了你，欢迎请作者喝杯咖啡
              <svg className="w-3.5 h-3.5 inline ml-0.5 -mt-0.5 text-[#92400e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/>
                <line x1="10" y1="1" x2="10" y2="4"/>
                <line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
              <br />
              你的赞助会直接鼓励我把这个项目维护得更好，感谢每一位支持者！
            </p>
            <div className="flex items-start gap-4">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https%3A%2F%2Fifdian.net%2Forder%2Fcreate%3Fuser_id%3Dc2e3740cb7a811ef93d85254001e7c00"
                alt="爱发电赞助二维码"
                className="w-[90px] h-[90px] rounded-xl bg-white border border-amber-200 flex-shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              <div className="flex flex-col gap-1.5 min-w-0">
                <a href="https://ifdian.net/order/create?user_id=c2e3740cb7a811ef93d85254001e7c00&remark=&affiliate_code=&fr=afcom"
                  target="_blank" rel="noopener"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#f97316] text-white text-xs font-medium rounded-lg hover:bg-[#ea580c] transition-colors shadow-sm shadow-orange-200 whitespace-nowrap">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                  爱发电赞助
                </a>
                <p className="text-[10px] text-[#b45309] opacity-70">
                  扫码或点链接，金额随心
                </p>
                <p className="text-[10px] text-[#b45309] opacity-50">
                  GitHub: <span className="font-mono">skdkzzx</span>
                </p>
              </div>
            </div>
          </div>

          {/* 联系作者 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="font-medium text-[#0f172a] text-xs mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              联系作者
            </p>
            <div className="text-xs text-[#64748b] space-y-1">
              <p>QQ：<span className="font-mono text-[#0f172a] font-medium">1481705136</span></p>
              <p>邮箱：<a href="mailto:1583400854@qq.com" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">1583400854@qq.com</a></p>
              <p>邮箱：<a href="mailto:skdkzzx@gmail.com" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">skdkzzx@gmail.com</a></p>
            </div>
          </div>
        </div>

        {/* Footer with accept button */}
        <div className="px-6 pb-5 pt-3 border-t border-[#e2e8f0] flex-shrink-0">
          <button
            disabled={!reached}
            onClick={onAccept}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-3
              disabled:bg-white disabled:text-slate-400 disabled:cursor-not-allowed disabled:border disabled:border-slate-200
              enabled:bg-[#2563eb] enabled:text-white enabled:hover:bg-[#1d4ed8] enabled:active:scale-[0.98] enabled:shadow-sm enabled:shadow-blue-200"
          >
            <span>{reached ? '我已阅读并同意以上条款' : '请阅读以上条款'}</span>
            {/* 右侧蓝色圆环进度 */}
            <span className="relative flex items-center justify-center w-5 h-5">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r={9.5} fill="none" strokeWidth="2"
                  className={reached ? 'stroke-white/30' : 'stroke-slate-200'} />
                <circle cx="12" cy="12" r={9.5} fill="none" strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  className={reached ? 'stroke-white' : 'stroke-blue-400'} />
              </svg>
              {reached && <span className="text-white text-xs font-bold leading-none">✓</span>}
            </span>
          </button>
          <p className="text-[10px] text-center text-[#94a3b8] mt-2">同意即表示您接受免责声明、使用守则及 GPL-3.0 协议</p>
        </div>
      </div>
    </div>
  );
}

// ── helpers ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-[#0f172a] text-xs mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-xs text-[#64748b] leading-relaxed flex items-start gap-2">
      <span className="text-slate-300 mt-0.5 flex-shrink-0">·</span>
      <span>{children}</span>
    </li>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">
      {children}
    </a>
  );
}
