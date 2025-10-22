'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Settings,
  User,
  LogOut,
  Lightbulb,
  Shield,
  HelpCircle,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSession } from '@/hooks/useSession';
import Footer from './Footer';

const zeroHumanNavigation = [
  { name: 'ZeroInsight Home', href: '/dashboard/thirdeye', icon: Sparkles },
  { name: 'ZeroInsight Reports', href: '/dashboard/thirdeye/insights', icon: Lightbulb },
  { name: 'ZeroAct Strategies', href: '/dashboard/thirdeye/techniques', icon: Shield },
  { name: 'ZeroExplain Guide', href: '/dashboard/thirdeye/help', icon: HelpCircle },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useSession();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Logged out successfully');
        router.push('/auth/signin');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast.error('Logout failed');
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "flex h-full flex-col w-64 bg-sidebar border-r transition-transform duration-300 ease-in-out",
        "fixed lg:relative z-50 lg:z-auto",
        !isOpen && "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand & Close Button */}
        <div className="p-4 flex items-center justify-between">
          <Link href="/dashboard/thirdeye" className="flex items-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
              ZeroHuman
            </h1>
          </Link>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-sidebar-accent rounded-md"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {/* Zero-Human Intelligence Section */}
        <div className="pt-2">
          <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
            Zero-Human Intelligence
          </div>
          <div className="space-y-1">
            {zeroHumanNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    isActive 
                      ? 'bg-gradient-to-r from-purple-500/10 to-cyan-500/10 text-primary border-l-2 border-primary' 
                      : 'text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Settings Menu at Bottom */}
      <div className="px-3 pb-3">
        <Link
          href="/dashboard/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            pathname === '/dashboard/settings'
              ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
              : 'text-sidebar-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>

      {/* User block */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary">
            <User className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-sidebar-foreground">
              {loading 
                ? 'Loading...' 
                : user 
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email?.split('@')[0] || 'User'
                  : 'Guest User'
              }
            </p>
            <p className="text-xs text-sidebar-foreground/70">
              {loading 
                ? 'Loading...' 
                : user 
                  ? user.email || 'user@example.com' 
                  : 'Please sign in'
              }
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>

      <Footer />
    </div>
    </>
  );
}
