import { Bell, LogOut, Menu, Search, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';

export default function Header({ onMenuToggle, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-40 h-16 shrink-0 border-b border-hairline dark:border-hairline-dark bg-card dark:bg-card-dark text-ink dark:text-ink-dark shadow-sm transition-colors">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">

        {/* Left section: Menu Toggle & Search Bar */}
        <div className="flex flex-1 items-center gap-3 sm:gap-4 max-w-xl">
          <button
            onClick={onMenuToggle}
            className="lg:hidden rounded-xl p-2 transition-colors hover:bg-surface dark:hover:bg-white/5 text-muted dark:text-muted-dark"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar matching mock UI */}
          <div className="relative w-full max-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle dark:text-subtle-dark" />
            <input
              type="text"
              readOnly
              placeholder="Search..."
              className="w-full bg-surface dark:bg-white/5 border border-hairline dark:border-hairline-dark text-ink dark:text-ink-dark text-xs rounded-xl py-2.5 pl-10 pr-10 focus:outline-none placeholder:text-subtle dark:placeholder:text-subtle-dark"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-0.5 pointer-events-none">
              <span className="text-[10px] font-medium text-subtle dark:text-subtle-dark bg-card dark:bg-card-dark border border-hairline dark:border-hairline-dark px-1 rounded">⌘</span>
              <span className="text-[10px] font-medium text-subtle dark:text-subtle-dark bg-card dark:bg-card-dark border border-hairline dark:border-hairline-dark px-1 rounded">F</span>
            </div>
          </div>
        </div>

        {/* Right section: Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">

          {/* Language Selector */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-surface dark:bg-white/5 border border-hairline dark:border-hairline-dark rounded-xl px-3 py-2 text-xs font-medium text-ink dark:text-ink-dark cursor-pointer hover:bg-card-muted dark:hover:bg-white/10 transition-colors">
            <span className="text-sm leading-none">🇬🇧</span>
            <span>English</span>
            <svg className="w-3.5 h-3.5 text-subtle dark:text-subtle-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Notification Button */}
          <button className="relative rounded-xl p-2.5 transition-colors hover:bg-surface dark:hover:bg-white/5 border border-hairline dark:border-hairline-dark text-muted dark:text-muted-dark bg-surface/60 dark:bg-white/[0.03]">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 dark:bg-brand-400 rounded-full"></span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle color theme"
            className="rounded-xl p-2.5 transition-colors hover:bg-surface dark:hover:bg-white/5 border border-hairline dark:border-hairline-dark text-muted dark:text-muted-dark bg-surface/60 dark:bg-white/[0.03]"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="mx-1 h-6 w-px bg-hairline dark:bg-hairline-dark"></div>

          {/* Logout Button */}
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-hairline dark:border-hairline-dark hover:bg-surface dark:hover:bg-white/5 px-3.5 py-2 text-ink dark:text-ink-dark transition-colors text-xs font-semibold shadow-sm"
            onClick={onLogout}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5 text-muted dark:text-muted-dark" />
            <span className="hidden sm:block">Sign out</span>
          </button>

        </div>
      </div>
    </header>
  );
}
