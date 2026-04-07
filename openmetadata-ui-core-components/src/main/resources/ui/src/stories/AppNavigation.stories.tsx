/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  BarChart01,
  BookOpen01,
  Database01,
  File06,
  Grid01,
  Home01,
  LifeBuoy01,
  PieChart03,
  Settings01,
  Tag01,
  Users01,
} from '@untitledui/icons';
import { NavAccountCard } from '../components/application/app-navigation/base-components/nav-account-card';
import { NavItemButton } from '../components/application/app-navigation/base-components/nav-item-button';
import { NavList } from '../components/application/app-navigation/base-components/nav-list';

const meta = {
  title: 'Application/AppNavigation',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj;

const sampleNavItems = [
  { label: 'Home', href: '/home', icon: Home01 },
  { label: 'Dashboard', href: '/dashboard', icon: BarChart01 },
  { label: 'Explore', href: '/explore', icon: Grid01 },
  {
    label: 'Data Assets',
    href: '/data-assets',
    icon: Database01,
    items: [
      { label: 'Tables', href: '/data-assets/tables' },
      { label: 'Topics', href: '/data-assets/topics' },
      { label: 'Dashboards', href: '/data-assets/dashboards' },
      { label: 'Pipelines', href: '/data-assets/pipelines' },
    ],
  },
  { label: 'Governance', href: '/governance', icon: Tag01, badge: '3' },
  { label: 'Quality', href: '/quality', icon: PieChart03 },
  { label: 'Insights', href: '/insights', icon: File06 },
  { divider: true as const },
  { label: 'Settings', href: '/settings', icon: Settings01 },
  { label: 'Documentation', href: '/docs', icon: BookOpen01 },
  { label: 'Support', href: '/support', icon: LifeBuoy01 },
];

const sampleNavItemsCompact = [
  { label: 'Home', href: '/home', icon: Home01 },
  { label: 'Dashboard', href: '/dashboard', icon: BarChart01 },
  { label: 'Explore', href: '/explore', icon: Grid01 },
  { label: 'Data Assets', href: '/data-assets', icon: Database01 },
  { label: 'Governance', href: '/governance', icon: Tag01 },
  { label: 'Quality', href: '/quality', icon: PieChart03 },
  { label: 'Insights', href: '/insights', icon: File06 },
  { divider: true as const },
  { label: 'Settings', href: '/settings', icon: Settings01 },
  { label: 'Support', href: '/support', icon: LifeBuoy01 },
];

/** Full-width sidebar with logo, nav items, and account card at the bottom. */
export const DefaultSidebar: Story = {
  render: () => (
    <div className="tw:flex tw:h-screen tw:bg-secondary">
      <nav className="tw:flex tw:w-72 tw:flex-col tw:border-r tw:border-secondary tw:bg-primary">
        <div className="tw:flex tw:h-16 tw:items-center tw:px-6">
          <Home01 className="tw:size-8 tw:text-fg-primary" />
        </div>

        <div className="tw:flex-1 tw:overflow-y-auto">
          <NavList activeUrl="/dashboard" items={sampleNavItems} />
        </div>

        <div className="tw:p-4">
          <NavAccountCard />
        </div>
      </nav>

      <main className="tw:flex-1 tw:p-8">
        <h1 className="tw:text-xl tw:font-semibold tw:text-primary">
          Main Content
        </h1>
        <p className="tw:mt-2 tw:text-sm tw:text-tertiary">
          Select a navigation item to explore the sidebar behavior.
        </p>
      </main>
    </div>
  ),
};

/** Collapsed icon-only sidebar. Used for space-constrained layouts or as a secondary sidebar variant. */
export const CollapsedIconSidebar: Story = {
  render: () => (
    <div className="tw:flex tw:h-screen tw:bg-secondary">
      <nav className="tw:flex tw:w-16 tw:flex-col tw:items-center tw:border-r tw:border-secondary tw:bg-primary tw:py-4">
        <div className="tw:mb-4 tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center">
          <Home01 className="tw:size-8 tw:text-fg-primary" />
        </div>

        <div className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:gap-1">
          {sampleNavItemsCompact.map((item, index) =>
            item.divider ? (
              <hr
                className="tw:my-1 tw:w-8 tw:border-none tw:bg-border-secondary tw:h-px"
                key={index}
              />
            ) : (
              item.icon && (
                <NavItemButton
                  current={item.href === '/dashboard'}
                  href={item.href}
                  icon={item.icon}
                  key={item.href}
                  label={item.label}
                  size="md"
                />
              )
            )
          )}
        </div>

        <div className="tw:mt-4">
          <NavItemButton href="/team" icon={Users01} label="Team" size="md" />
        </div>
      </nav>

      <main className="tw:flex-1 tw:p-8">
        <h1 className="tw:text-xl tw:font-semibold tw:text-primary">
          Main Content
        </h1>
        <p className="tw:mt-2 tw:text-sm tw:text-tertiary">
          Icon-only sidebar — hover icons to see tooltips.
        </p>
      </main>
    </div>
  ),
};

/** Toggle between expanded and collapsed sidebar states. */
export const TogglableSidebar: Story = {
  render: () => {
    const [collapsed, setCollapsed] = useState(false);

    return (
      <div className="tw:flex tw:h-screen tw:bg-secondary">
        <nav
          className={`tw:flex tw:flex-col tw:border-r tw:border-secondary tw:bg-primary tw:transition-all tw:duration-200 ${
            collapsed ? 'tw:w-16 tw:items-center' : 'tw:w-72'
          }`}>
          <div
            className={`tw:flex tw:h-16 tw:items-center tw:px-4 ${
              collapsed ? 'tw:justify-center' : 'tw:justify-between'
            }`}>
            <Home01 className="tw:size-8 tw:text-fg-primary" />
            <button
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`tw:rounded-md tw:p-1.5 tw:text-fg-quaternary tw:transition tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover ${
                collapsed ? 'tw:mt-0' : ''
              }`}
              onClick={() => setCollapsed((c) => !c)}>
              <Grid01 className="tw:size-4" />
            </button>
          </div>

          {collapsed ? (
            <div className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:gap-1 tw:px-2">
              {sampleNavItemsCompact.map((item, index) =>
                item.divider ? (
                  <hr
                    className="tw:my-1 tw:w-8 tw:h-px tw:border-none tw:bg-border-secondary"
                    key={index}
                  />
                ) : (
                  item.icon && (
                    <NavItemButton
                      current={item.href === '/dashboard'}
                      href={item.href}
                      icon={item.icon}
                      key={item.href}
                      label={item.label}
                      size="md"
                    />
                  )
                )
              )}
            </div>
          ) : (
            <div className="tw:flex-1 tw:overflow-y-auto">
              <NavList activeUrl="/dashboard" items={sampleNavItems} />
            </div>
          )}

          {!collapsed && (
            <div className="tw:p-4">
              <NavAccountCard />
            </div>
          )}
        </nav>

        <main className="tw:flex-1 tw:p-8">
          <h1 className="tw:text-xl tw:font-semibold tw:text-primary">
            Main Content
          </h1>
          <p className="tw:mt-2 tw:text-sm tw:text-tertiary">
            Click the grid icon in the sidebar header to toggle between expanded
            and collapsed states.
          </p>
        </main>
      </div>
    );
  },
};

/** Sidebar with a nested collapsible section expanded by default. */
export const WithNestedNavigation: Story = {
  render: () => (
    <div className="tw:flex tw:h-screen tw:bg-secondary">
      <nav className="tw:flex tw:w-72 tw:flex-col tw:border-r tw:border-secondary tw:bg-primary">
        <div className="tw:flex tw:h-16 tw:items-center tw:px-6">
          <Home01 className="tw:size-8 tw:text-fg-primary" />
        </div>

        <div className="tw:flex-1 tw:overflow-y-auto">
          <NavList activeUrl="/data-assets/tables" items={sampleNavItems} />
        </div>

        <div className="tw:p-4">
          <NavAccountCard />
        </div>
      </nav>

      <main className="tw:flex-1 tw:p-8">
        <h1 className="tw:text-xl tw:font-semibold tw:text-primary">Tables</h1>
        <p className="tw:mt-2 tw:text-sm tw:text-tertiary">
          Active URL is set to{' '}
          <code className="tw:rounded tw:bg-secondary tw:px-1 tw:font-mono tw:text-xs">
            /data-assets/tables
          </code>{' '}
          — the parent collapsible section opens automatically.
        </p>
      </main>
    </div>
  ),
};

/** Sidebar with a badge on a nav item to surface counts or alerts. */
export const WithBadges: Story = {
  render: () => {
    const itemsWithBadges = [
      { label: 'Home', href: '/home', icon: Home01 },
      { label: 'Dashboard', href: '/dashboard', icon: BarChart01 },
      { label: 'Governance', href: '/governance', icon: Tag01, badge: '5' },
      { label: 'Quality', href: '/quality', icon: PieChart03, badge: '12' },
      { label: 'Insights', href: '/insights', icon: File06, badge: 'New' },
      { divider: true as const },
      { label: 'Settings', href: '/settings', icon: Settings01 },
    ];

    return (
      <div className="tw:flex tw:h-screen tw:bg-secondary">
        <nav className="tw:flex tw:w-72 tw:flex-col tw:border-r tw:border-secondary tw:bg-primary">
          <div className="tw:flex tw:h-16 tw:items-center tw:px-6">
            <Home01 className="tw:size-8 tw:text-fg-primary" />
          </div>

          <div className="tw:flex-1 tw:overflow-y-auto">
            <NavList activeUrl="/home" items={itemsWithBadges} />
          </div>

          <div className="tw:p-4">
            <NavAccountCard />
          </div>
        </nav>

        <main className="tw:flex-1 tw:p-8">
          <h1 className="tw:text-xl tw:font-semibold tw:text-primary">
            Main Content
          </h1>
          <p className="tw:mt-2 tw:text-sm tw:text-tertiary">
            Nav items can display badge counts or labels.
          </p>
        </main>
      </div>
    );
  },
};
