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
import type { Meta, StoryObj } from "@storybook/react";
import { RadioButton, RadioGroup } from "../components/base/radio-buttons/radio-buttons";

const meta = {
  title: "Components/RadioButtons",
  component: RadioGroup,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Select an option",
    defaultValue: "option1",
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioButton value="option1" label="Option 1" />
      <RadioButton value="option2" label="Option 2" />
      <RadioButton value="option3" label="Option 3" />
    </RadioGroup>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 40 }}>
      <RadioGroup label="Small" size="sm" defaultValue="sm1">
        <RadioButton value="sm1" label="Option A" />
        <RadioButton value="sm2" label="Option B" />
        <RadioButton value="sm3" label="Option C" />
      </RadioGroup>
      <RadioGroup label="Medium" size="md" defaultValue="md1">
        <RadioButton value="md1" label="Option A" />
        <RadioButton value="md2" label="Option B" />
        <RadioButton value="md3" label="Option C" />
      </RadioGroup>
    </div>
  ),
};

export const WithHints: StoryObj = {
  render: () => (
    <RadioGroup label="Pricing plan" defaultValue="pro">
      <RadioButton
        value="basic"
        label="Basic"
        hint="Up to 5 users, 10 GB storage"
      />
      <RadioButton
        value="pro"
        label="Pro"
        hint="Up to 50 users, 100 GB storage"
      />
      <RadioButton
        value="enterprise"
        label="Enterprise"
        hint="Unlimited users, unlimited storage"
      />
    </RadioGroup>
  ),
};

export const WithDisabled: StoryObj = {
  render: () => (
    <RadioGroup label="Options" defaultValue="available">
      <RadioButton value="available" label="Available" />
      <RadioButton value="disabled" label="Disabled option" isDisabled />
      <RadioButton value="another" label="Another option" />
    </RadioGroup>
  ),
};

export const StandaloneButtons: StoryObj = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <RadioButton value="a" label="Standalone Radio A" />
      <RadioButton value="b" label="Standalone Radio B" />
      <RadioButton value="c" label="Standalone Radio C (disabled)" isDisabled />
    </div>
  ),
};
