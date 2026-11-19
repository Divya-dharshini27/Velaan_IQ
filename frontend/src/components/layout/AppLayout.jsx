import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldAlert,
  GitBranch,
  TrendingUp,
  Scale,
  Database,
  Menu,
  X,
  LogOut,
  User,
  Activity,
  Calendar,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';
import SimulatedDataBanner from '../common/SimulatedDataBanner';
import { healthApi } from '../../api/client';

const NAV_ITEMS = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: 'Procurement Advisor',
    path: '/advisor',
    icon: ShieldAlert,
    badge: 'Core',
  },
  {
    name: 'Scenario Simulator',
    path: '/scenarios',
    icon: GitBranch,
    badge: 'What-If',
  },
  {
    name: 'Market & Forecast',
    path: '/market',
    icon: TrendingUp,
    badge: null,
  },
  {
    name: 'Sourcing Compare',
    path: '/sourcing',
    icon: Scale,
    badge: 'Landed',
  },
  {
    name: 'Data Management',
    path: '/data',
    icon: Database,
    badge: null,
  },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [serverHealthy, setServerHealthy] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Check health on mount and periodically
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await healthApi.check();
        if (mounted) setServerHealthy(true);
      } catch {
        if (mounted) setServerHealthy(false);
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-soybean text-ink selection:bg-leaf selection:text-white">
      {/* Top persistent simulated data notice banner */}
      <SimulatedDataBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (Deep Forest Green #14432A) */}
        <aside className="hidden lg:flex lg:flex-col w-72 bg-forest text-white border-r border-forest-900/40 z-30 flex-shrink-0 bg-leaf-pattern">
          {/* Brand header */}
          <div className="p-6 border-b border-forest-800/80">
            <BrandLogo variant="dark" size="md" showTagline={true} />
          </div>

          {/* Core Decision Questions Capsule */}
          <div className="px-5 py-3.5 mx-4 mt-4 rounded-xl bg-forest-900/70 border border-forest-700/60 shadow-inner">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-forest-300 flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
              Decision Objectives
            </div>
            <div className="text-[12px] text-stone-200 font-medium leading-relaxed">
              <span className="text-gold font-bold">1. WHEN</span> to buy &bull;{' '}
              <span className="text-gold font-bold">2. HOW MUCH</span> &bull;{' '}
              <span className="text-gold font-bold">3. ROUTE</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-forest-400 px-3 pb-1">
              Intelligence Modules
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-leaf text-white shadow-md font-semibold'
                        : 'text-stone-300 hover:text-white hover:bg-forest-800/80'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-105" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-forest-950/60 text-gold-light border border-forest-700">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User profile and system status footer */}
          <div className="p-4 border-t border-forest-800/80 bg-forest-950/60">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    serverHealthy ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-rose-400'
                  }`}
                />
                <span className="text-[11px] text-stone-300 font-medium">
                  {serverHealthy ? 'FastAPI 127.0.0.1:8000' : 'Backend offline'}
                </span>
              </div>
              <span className="text-[10px] text-forest-400 uppercase font-mono">v1.0</span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-forest-900/70 border border-forest-700/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-leaf text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm flex-shrink-0">
                  {user?.full_name ? user.full_name.charAt(0) : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.full_name || 'Procurement Mgr'}
                  </p>
                  <p className="text-[10px] text-forest-300 truncate font-mono">
                    {user?.email || 'abt-cpd.com'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-forest-800 transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 w-72 bg-forest text-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col bg-leaf-pattern shadow-2xl ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-5 border-b border-forest-800 flex items-center justify-between">
            <BrandLogo variant="dark" size="sm" showTagline={false} />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-stone-300 hover:text-white rounded-lg hover:bg-forest-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-leaf text-white font-semibold'
                        : 'text-stone-300 hover:text-white hover:bg-forest-800'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-forest-950 text-gold-light">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-forest-800 bg-forest-950/60">
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-forest-900/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-leaf text-white flex items-center justify-center font-bold text-xs uppercase">
                  {user?.full_name ? user.full_name.charAt(0) : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.full_name || 'Manager'}
                  </p>
                  <p className="text-[10px] text-forest-300 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-stone-300 hover:text-white"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-soybean">
          {/* Top Header bar */}
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-stone-100 transition"
                aria-label="Open sidebar menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-forest font-mono">
                  ABT-CPD
                </span>
                <span className="text-stone-300">&bull;</span>
                <span className="text-xs text-ink-muted">
                  Soybean Decision Support System
                </span>
              </div>
            </div>

            {/* Right side status / user */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-forest-50 border border-forest-100 text-xs text-forest-800">
                <span className="w-2 h-2 rounded-full bg-leaf animate-pulse"></span>
                <span>Rule-based Decision Support</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-ink leading-tight">
                    {user?.full_name || 'Procurement Manager'}
                  </div>
                  <div className="text-[10px] text-ink-muted capitalize">
                    {user?.role?.replace('_', ' ').toLowerCase() || 'Procurement Manager'}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-xl text-ink-muted hover:text-forest hover:bg-forest-50 transition border border-stone-200"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Page body */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="border-t border-stone-200/80 bg-white/40 px-6 py-4 text-center text-xs text-ink-muted">
            <p>
              VELAAN IQ (வேளாண் IQ) &mdash; Agricultural Soybean Procurement Decision Intelligence &bull; ABT-CPD &bull; Rule-based &amp; Statistical Decision Support
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
