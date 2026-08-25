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
import { Checkbox } from '../components/base/checkbox/checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Accept terms and conditions',
    size: 'sm',
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Checkbox label="Small checkbox" size="sm" />
      <Checkbox label="Medium checkbox" size="md" />
    </div>
  ),
};

export const WithHint: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Checkbox
        hint="You will receive email updates about your activity."
        label="Enable notifications"
        size="sm"
      />
      <Checkbox
        hint="Get weekly updates delivered to your inbox."
        label="Subscribe to newsletter"
        size="md"
      />
    </div>
  ),
};

export const States: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Checkbox label="Unchecked" />
      <Checkbox defaultSelected label="Checked" />
      <Checkbox isIndeterminate label="Indeterminate" />
      <Checkbox isDisabled label="Disabled" />
      <Checkbox defaultSelected isDisabled label="Disabled checked" />
    </div>
  ),
};

export const WithoutLabel: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <Checkbox />
      <Checkbox defaultSelected />
      <Checkbox isIndeterminate />
    </div>
  ),
};
