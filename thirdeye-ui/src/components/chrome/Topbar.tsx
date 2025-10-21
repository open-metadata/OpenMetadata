'use client';

import { Search, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ConnectionSetup from '@/components/ConnectionSetup';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Topbar() {
  return (
    <header className="h-14 border-b bg-white/70 dark:bg-gray-900/70 backdrop-blur flex items-center px-4 gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search services, tables, users..." 
          className="pl-10"
        />
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Button variant="outline" size="sm">
          Last 7 days
        </Button>
      </div>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Connection setup */}
      <ConnectionSetup />
    </header>
  );
}
