import { Map, Truck, Shield, Settings, X, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { clsx } from 'clsx';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Map, label: 'Map View', id: 'map' },
  { icon: Truck, label: 'Devices', id: 'devices' },
  { icon: Shield, label: 'Geofences', id: 'geofences' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

export default function Sidebar({ isOpen, onClose, activeView, onViewChange, onToggleCollapse }) {
  const isCollapsedDesktop = !isOpen;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed bottom-0 left-0 top-0 z-40 shrink-0 overflow-visible border-r border-hairline dark:border-hairline-dark bg-card dark:bg-card-dark transition-all duration-300 ease-in-out lg:relative lg:flex lg:flex-col',
          isOpen
            ? 'w-64 max-w-[85vw] translate-x-0 lg:max-w-none'
            : 'w-64 max-w-[85vw] -translate-x-full lg:w-20 lg:max-w-none lg:translate-x-0'
        )}
      >
        {/* Collapse/Expand button inside Sidebar - positioned absolutely on the right border line */}
        <button
          onClick={onToggleCollapse || onClose}
          className="hidden lg:flex absolute -right-3 top-6 z-50 h-6 w-6 items-center justify-center rounded-full border border-hairline dark:border-hairline-dark bg-card dark:bg-card-dark text-muted dark:text-muted-dark shadow-sm hover:bg-surface dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark transition-all active:scale-95"
          title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        <div className="flex h-full w-full flex-col justify-between py-6">

          {/* Logo Section */}
          <div className={clsx("px-4 relative", isCollapsedDesktop && "flex justify-center")}>
            <div className="flex items-center space-x-3">
              {/* Modern Waveform SVG Logo */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-400/10 shrink-0">
                <svg className="h-6 w-6 text-brand-500 dark:text-brand-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6H20M4 12H16M4 18H12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {isOpen && (
                <span className="text-lg font-black text-ink dark:text-ink-dark tracking-tight animate-fade-in">
                  VSmart
                </span>
              )}
            </div>

            {/* Close button for mobile */}
            {!isCollapsedDesktop && (
              <button
                onClick={onClose}
                className="lg:hidden absolute top-1 right-2 p-1.5 rounded-lg hover:bg-surface dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-muted dark:text-muted-dark" />
              </button>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 px-3 mt-12 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    if (window.innerWidth < 1024) {
                      onClose();
                    }
                  }}
                  className={clsx(
                    'flex items-center transition-all group duration-200 rounded-xl',
                    isCollapsedDesktop
                      ? 'h-12 w-12 justify-center mx-auto'
                      : 'w-full px-4 py-3.5 gap-3.5',
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-400/10 text-brand-600 dark:text-brand-300 font-semibold'
                      : 'text-muted dark:text-muted-dark hover:bg-surface dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark'
                  )}
                  title={isCollapsedDesktop ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={clsx("h-5 w-5 shrink-0 transition-transform group-hover:scale-105", isActive ? "text-brand-500 dark:text-brand-300" : "text-subtle dark:text-subtle-dark group-hover:text-muted dark:group-hover:text-muted-dark")} />
                  {isOpen && (
                    <span className="text-sm font-medium animate-fade-in">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Profile Section (Bottom) */}
          <div className="px-3 border-t border-hairline dark:border-hairline-dark pt-6">
            <div className={clsx("flex items-center", isCollapsedDesktop ? "justify-center" : "space-x-3")}>
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-400/10 ring-2 ring-brand-50 dark:ring-brand-400/10 text-sm font-bold text-brand-600 dark:text-brand-300">
                  VT
                </div>
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card dark:ring-card-dark" />
              </div>
              {isOpen && (
                <div className="min-w-0 flex-1 animate-fade-in">
                  <p className="text-sm font-semibold text-ink dark:text-ink-dark truncate">Vi Tran</p>
                  <p className="text-xs text-subtle dark:text-subtle-dark font-medium">Administrator</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}
