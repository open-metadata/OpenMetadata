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
import { HomeLine } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Breadcrumbs,
  type BreadcrumbItemType,
} from '../components/application/breadcrumbs/breadcrumbs';

const items: BreadcrumbItemType[] = [
  { id: 'home', label: 'Home', href: '#', icon: HomeLine },
  { id: 'settings', label: 'Settings', href: '#' },
  { id: 'team', label: 'Team', href: '#' },
  { id: 'members', label: 'Members' },
];

const deepItems: BreadcrumbItemType[] = [
  { id: 'home', label: 'Home', href: '#', icon: HomeLine },
  { id: 'workspace', label: 'Workspace', href: '#' },
  { id: 'projects', label: 'Projects', href: '#' },
  { id: 'analytics', label: 'Analytics', href: '#' },
  { id: 'dashboards', label: 'Dashboards', href: '#' },
  { id: 'overview', label: 'Overview' },
];

const meta = {
  title: 'Components/Breadcrumbs',
  component: Breadcrumbs,
  parameters: {
    layout: 'padded',
  },
  args: {
    items,
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: { type: 'text' },
};

export const ButtonWhite: Story = {
  args: { type: 'button-white' },
};

export const ButtonGray: Story = {
  args: { type: 'button-gray' },
};

export const SlashDivider: Story = {
  args: { divider: 'slash' },
};

export const Collapsed: Story = {
  args: { items: deepItems, maxItems: 3 },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <Breadcrumbs {...args} size="xs" />
      <Breadcrumbs {...args} size="sm" />
      <Breadcrumbs {...args} size="md" />
    </div>
  ),
};

export const AutoCollapse: Story = {
  args: { items: deepItems, autoCollapse: true },
  render: (args) => (
    <div
      className="tw:resize-x tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:p-3"
      style={{ width: 320 }}>
      <Breadcrumbs {...args} />
    </div>
  ),
};
