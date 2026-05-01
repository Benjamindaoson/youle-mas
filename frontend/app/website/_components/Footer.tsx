'use client';

const FOOTER_LINKS = {
  '产品': ['链接一', '链接二', '链接三'],
  '公司': ['链接一', '链接二', '链接三'],
  '资源': ['链接一', '链接二', '链接三'],
  '联系': ['链接一', '链接二', '链接三'],
};

export function Footer() {
  return (
    <footer style={{ background: '#0D1117' }} className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #5B8CFF, #FF6B35)' }}
              >
                有
              </div>
              <span className="text-white font-semibold">有了</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
              品牌口号或一句话简介占位。
            </p>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold mb-4 tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {group}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-xs transition-colors"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')
                      }
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            © {new Date().getFullYear()} 有了科技. 版权所有
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            ICP 备案号占位 · 隐私政策 · 服务条款
          </p>
        </div>
      </div>
    </footer>
  );
}
