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
import { Dot } from '../components/foundations/dot-icon';

const meta = {
  title: 'Foundations/DotIcon',
  component: Dot,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Dot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'md',
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Dot size="sm" />
      <Dot size="md" />
    </div>
  ),
};

export const Colors: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Dot className="tw:text-fg-success-secondary" />
      <Dot className="tw:text-fg-error-secondary" />
      <Dot className="tw:text-fg-warning-secondary" />
      <Dot style={{ color: '#6366f1' }} />
      <Dot style={{ color: '#8b5cf6' }} />
    </div>
  ),
};
