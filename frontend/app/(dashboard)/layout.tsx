'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  ChevronRight,
  FileText,
  History,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Trophy,
  Upload,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import { useTaxStore } from '@/store/taxStore';
import { getInitials } from '@/lib/utils';

const navItems = [
  {
    href: '/upload',
    icon: Upload,
    label: 'Upload Documents',
    description: 'Form 16, 26AS, AIS',
  },
  {
    href: '/compute',
    icon: BarChart3,
    label: 'Tax Computation',
    description: 'Income & deductions',
  },
  {
    href: '/results',
    icon: Trophy,
    label: 'Results',
    description: 'Old vs New Regime',
  },
  {
    href: '/sessions',
    icon: History,
    label: 'Sessions History',
    description: 'Past computations',
  },
  {
    href: '/filing-guide',
    icon: FileText,
    label: 'Filing Guide',
    description: 'How to file on portal',
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { computationResult } = useTaxStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-900 transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-500">
              <IndianRupee className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">
              FileTax<span className="text-saffron-400">AI</span>
            </span>
          </Link>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tax Year Badge */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-slate-300">
              AY {process.env.NEXT_PUBLIC_TAX_YEAR || '2024-25'}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const hasResult = item.href === '/results' && !!computationResult;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                  isActive
                    ? 'bg-saffron-500 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.label}</span>
                    {hasResult && (
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                    )}
                  </div>
                  <span className={cn('text-xs', isActive ? 'text-saffron-100' : 'text-slate-500')}>
                    {item.description}
                  </span>
                </div>
                {isActive && <ChevronRight className="h-3 w-3 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        <Separator className="bg-white/10" />

        {/* User section */}
        <div className="p-3 space-y-1">
          <Link
            href="/profile"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
              pathname === '/profile'
                ? 'bg-saffron-500 text-white'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <User className="h-4 w-4 text-slate-400" />
            <span className="font-medium">Profile</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Logout</span>
          </button>
        </div>

        {/* User profile footer */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-saffron-500 text-sm font-bold text-white">
              {user ? getInitials(user.name) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-slate-500 hover:text-slate-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden md:block">
              <h2 className="text-sm font-semibold text-slate-900">
                {navItems.find((n) => n.href === pathname)?.label || 'Dashboard'}
              </h2>
              <p className="text-xs text-slate-500">
                {navItems.find((n) => n.href === pathname)?.description || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex text-xs">
              AY {process.env.NEXT_PUBLIC_TAX_YEAR || '2024-25'}
            </Badge>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">
              {user ? getInitials(user.name) : 'U'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
