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

export function TabBar() {
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur dark:border-[#2a2e38] dark:bg-[#0f1115]/95" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
  );
}
