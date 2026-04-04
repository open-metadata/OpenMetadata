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
import { Toggle } from '../components/base/toggle/toggle';

const meta = {
  title: 'Components/Toggle',
  component: Toggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Enable feature',
    size: 'sm',
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle label="Small toggle" size="sm" />
      <Toggle label="Medium toggle" size="md" />
    </div>
  ),
};

export const WithHint: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle
        hint="Receive updates about your account activity."
        label="Email notifications"
        size="sm"
      />
      <Toggle
        hint="Get updates on new features and promotions."
        label="Marketing emails"
        size="md"
      />
    </div>
  ),
};

export const DefaultSelected: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle label="Off by default" />
      <Toggle defaultSelected label="On by default" />
    </div>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle isDisabled label="Disabled off" />
      <Toggle defaultSelected isDisabled label="Disabled on" />
    </div>
  ),
};

export const Slim: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle slim label="Slim small" size="sm" />
      <Toggle slim label="Slim medium" size="md" />
      <Toggle defaultSelected slim label="Slim selected" size="sm" />
    </div>
  ),
};

export const WithoutLabel: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <Toggle size="sm" />
      <Toggle size="md" />
      <Toggle defaultSelected size="sm" />
    </div>
  ),
};
