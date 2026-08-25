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
import {
  RadioButton,
  RadioGroup,
} from '../components/base/radio-buttons/radio-buttons';

const meta = {
  title: 'Components/RadioButtons',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Select an option',
    defaultValue: 'option1',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioButton label="Option 1" value="option1" />
      <RadioButton label="Option 2" value="option2" />
      <RadioButton label="Option 3" value="option3" />
    </RadioGroup>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 40 }}>
      <RadioGroup defaultValue="sm1" label="Small" size="sm">
        <RadioButton label="Option A" value="sm1" />
        <RadioButton label="Option B" value="sm2" />
        <RadioButton label="Option C" value="sm3" />
      </RadioGroup>
      <RadioGroup defaultValue="md1" label="Medium" size="md">
        <RadioButton label="Option A" value="md1" />
        <RadioButton label="Option B" value="md2" />
        <RadioButton label="Option C" value="md3" />
      </RadioGroup>
    </div>
  ),
};

export const WithHints: StoryObj = {
  render: () => (
    <RadioGroup defaultValue="pro" label="Pricing plan">
      <RadioButton
        hint="Up to 5 users, 10 GB storage"
        label="Basic"
        value="basic"
      />
      <RadioButton
        hint="Up to 50 users, 100 GB storage"
        label="Pro"
        value="pro"
      />
      <RadioButton
        hint="Unlimited users, unlimited storage"
        label="Enterprise"
        value="enterprise"
      />
    </RadioGroup>
  ),
};

export const WithDisabled: StoryObj = {
  render: () => (
    <RadioGroup defaultValue="available" label="Options">
      <RadioButton label="Available" value="available" />
      <RadioButton isDisabled label="Disabled option" value="disabled" />
      <RadioButton label="Another option" value="another" />
    </RadioGroup>
  ),
};

export const StandaloneButtons: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <RadioButton label="Standalone Radio A" value="a" />
      <RadioButton label="Standalone Radio B" value="b" />
      <RadioButton isDisabled label="Standalone Radio C (disabled)" value="c" />
    </div>
  ),
};
