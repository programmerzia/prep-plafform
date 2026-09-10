import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Today', icon: '☀' },
  { to: '/learn', label: 'Learn', icon: '📖' },
  { to: '/practice', label: 'Practice', icon: '⌨' },
  { to: '/drill', label: 'Drill', icon: '🃏' },
  { to: '/interview', label: 'Interview', icon: '🎙' },
  { to: '/mock', label: 'Mock', icon: '⏱' },
  { to: '/more', label: 'More', icon: '⋯' },
];

/** Sidebar width on desktop (≥ 900px). Keep in sync with the padding in App.tsx. */
export const SIDEBAR_W = 220;

/**
 * Navigation: a bottom tab bar on phones, a left sidebar from 900px up.
 * Both are rendered; CSS picks one so the markup never changes between widths.
 */
export function TabBar() {
  return (
    <>
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur min-[900px]:hidden dark:border-[#2a2e38] dark:bg-[#0f1115]/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-[560px] grid-cols-7">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive ? 'text-accent font-semibold' : 'text-neutral-500 dark:text-neutral-400'
                }`
              }
            >
              <span className="text-lg leading-none" aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <nav
        className="no-print fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-line bg-white px-3 py-5 min-[900px]:flex dark:border-[#2a2e38] dark:bg-[#171a21]"
        style={{ width: SIDEBAR_W }}
      >
        <div className="mb-5 px-2">
          <div className="text-xl font-semibold">Rebuild</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Senior prep — retrieval over reading</div>
        </div>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `mb-1 flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] ${
                isActive
                  ? 'bg-accent-soft font-semibold text-accent dark:bg-[#123a22] dark:text-[#8fe3ad]'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-[#1f232b]'
              }`
            }
          >
            <span className="w-6 text-center text-lg leading-none" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
