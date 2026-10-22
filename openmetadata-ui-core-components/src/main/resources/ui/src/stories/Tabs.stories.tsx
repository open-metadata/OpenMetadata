/*
 *  Copyright 2026 Collate.
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
import { Tabs } from '../components/application/tabs/tabs';

const SIZES = ['xs', 'sm', 'md'] as const;

const SegmentedTabs = ({ size }: { size: (typeof SIZES)[number] }) => (
  <Tabs defaultSelectedKey="all">
    <Tabs.List fullWidth size={size} type="button-border">
      <Tabs.Item id="all">All · 16</Tabs.Item>
      <Tabs.Item id="ai">AI · 15</Tabs.Item>
      <Tabs.Item id="people">People · 1</Tabs.Item>
    </Tabs.List>
  </Tabs>
);

const meta = {
  title: 'Components/Tabs',
  component: SegmentedTabs,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { size: 'xs' },
  argTypes: { size: { control: 'inline-radio', options: SIZES } },
} satisfies Meta<typeof SegmentedTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ButtonBorder: Story = {};

export const Sizes: Story = {
  parameters: { theme: 'both' },
  render: () => (
    <div className="tw:flex tw:w-96 tw:flex-col tw:gap-4 tw:rounded-xl tw:bg-surface tw:p-4">
      {SIZES.map((size) => (
        <SegmentedTabs key={size} size={size} />
      ))}
    </div>
  ),
};
