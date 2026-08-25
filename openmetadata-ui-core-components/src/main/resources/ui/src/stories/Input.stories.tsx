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
import { HelpCircle, SearchLg } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../components/base/input/input';
import { TextArea } from '../components/base/textarea/textarea';

const meta = {
  title: 'Components/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
    size: 'sm',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email address',
    placeholder: 'you@example.com',
    size: 'sm',
  },
};

export const WithHint: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    hint: 'Your username must be 3–20 characters long.',
    size: 'sm',
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <Input label="Small" placeholder="Small input" size="sm" />
      <Input label="Medium" placeholder="Medium input" size="md" />
    </div>
  ),
};

export const WithLeadingIcon: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <Input icon={SearchLg} label="Search" placeholder="Search..." size="sm" />
      <Input
        icon={HelpCircle}
        label="Email"
        placeholder="you@example.com"
        size="md"
      />
    </div>
  ),
};

export const WithTooltip: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Input
        label="API Key"
        placeholder="Enter API key"
        size="sm"
        tooltip="Your API key is used to authenticate requests."
      />
    </div>
  ),
};

export const Invalid: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Input
        isInvalid
        hint="Please enter a valid email address."
        label="Email"
        placeholder="you@example.com"
        size="sm"
      />
    </div>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Input
        isDisabled
        label="Disabled Input"
        placeholder="Cannot edit"
        size="sm"
      />
    </div>
  ),
};

export const Required: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Input
        isRequired
        label="Required Field"
        placeholder="This field is required"
        size="sm"
      />
    </div>
  ),
};

export const TextAreaDefault: StoryObj = {
  render: () => (
    <div style={{ width: 380 }}>
      <TextArea
        label="Description"
        placeholder="Enter description..."
        rows={4}
      />
    </div>
  ),
};

export const TextAreaWithHint: StoryObj = {
  render: () => (
    <div style={{ width: 380 }}>
      <TextArea
        hint="Maximum 500 characters"
        label="Bio"
        placeholder="Tell us about yourself"
        rows={4}
      />
    </div>
  ),
};

export const TextAreaInvalid: StoryObj = {
  render: () => (
    <div style={{ width: 380 }}>
      <TextArea
        isInvalid
        hint="This field is required."
        label="Description"
        placeholder="Enter description..."
        rows={4}
      />
    </div>
  ),
};
