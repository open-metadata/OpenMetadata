'use client';

import Link from 'next/link';
import { Settings, Users, Database, User, Shield, Bell, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsCategories = [
  {
    title: 'Account',
    description: 'Manage your personal account settings',
    icon: User,
    items: [
      { name: 'Profile', description: 'Personal information and preferences', href: '/settings/profile' },
      { name: 'Security', description: 'Password and authentication settings', href: '/settings/security' },
      { name: 'Notifications', description: 'Email and alert preferences', href: '/settings/notifications' },
    ]
  },
  {
    title: 'Organization',
    description: 'Team and user management',
    icon: Users,
    items: [
      { name: 'Users & Teams', description: 'Manage users and team access', href: '/settings/users' },
      { name: 'Roles & Permissions', description: 'Configure access control', href: '/settings/roles' },
    ]
  },
  {
    title: 'Data Sources',
    description: 'Connect and manage your data infrastructure',
    icon: Database,
    items: [
      { name: 'Connectors', description: 'Database and service connections', href: '/dashboard/settings/data-sources' },
      { name: 'Ingestion Pipelines', description: 'Data pipeline configurations', href: '/dashboard/settings/pipelines' },
    ]
  },
  {
    title: 'Preferences',
      description: 'Customize your ZeroHuman experience',
    icon: Palette,
    items: [
      { name: 'Appearance', description: 'Theme and display settings', href: '/settings/appearance' },
      { name: 'Integrations', description: 'Third-party service connections', href: '/settings/integrations' },
    ]
  }
];

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your ZeroHuman configuration and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {settingsCategories.map((category) => (
          <Card key={category.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <category.icon className="h-5 w-5" />
                {category.title}
              </CardTitle>
              <CardDescription>
                {category.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {category.items.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block p-3 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      <Settings className="h-4 w-4 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
