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
import { Select } from '../components/base/select/select';

const ITEMS = [
  { id: '1', label: 'Option 1' },
  { id: '2', label: 'Option 2' },
  { id: '3', label: 'Option 3', isDisabled: true },
  { id: '4', label: 'Option 4', supportingText: '(recommended)' },
  { id: '5', label: 'Option 5' },
];

const meta = {
  title: 'Components/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Select items={ITEMS} placeholder="Select an option">
        {(item) => (
          <Select.Item
            id={item.id}
            isDisabled={item.isDisabled}
            key={item.id}
            textValue={item.label}>
            {item.label}
          </Select.Item>
        )}
      </Select>
    </div>
  ),
};

export const WithLabel: StoryObj = {
  render: () => (
    <div style={{ width: 280 }}>
      <Select items={ITEMS} label="Country" placeholder="Select a country">
        {(item) => (
          <Select.Item id={item.id} key={item.id} textValue={item.label}>
            {item.label}
          </Select.Item>
        )}
      </Select>
    </div>
  ),
};

export const WithHint: StoryObj = {
  render: () => (
    <div style={{ width: 280 }}>
      <Select
        hint="Your role determines your access level."
        items={ITEMS}
        label="Role"
        placeholder="Select a role">
        {(item) => (
          <Select.Item id={item.id} key={item.id} textValue={item.label}>
            {item.label}
          </Select.Item>
        )}
      </Select>
    </div>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
      <Select items={ITEMS} placeholder="Small select" size="sm">
        {(item) => (
          <Select.Item id={item.id} key={item.id} textValue={item.label}>
            {item.label}
          </Select.Item>
        )}
      </Select>
      <Select items={ITEMS} placeholder="Medium select" size="md">
        {(item) => (
          <Select.Item id={item.id} key={item.id} textValue={item.label}>
            {item.label}
          </Select.Item>
        )}
      </Select>
    </div>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <div style={{ width: 280 }}>
      <Select
        isDisabled
        items={ITEMS}
        label="Disabled Select"
        placeholder="Cannot select">
        {(item) => (
          <Select.Item id={item.id} key={item.id} textValue={item.label}>
            {item.label}
          </Select.Item>
        )}
      </Select>
    </div>
  ),
};

export const WithSupportingText: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Select items={ITEMS} label="Plan" placeholder="Choose plan">
        {(item) => (
          <Select.Item id={item.id} key={item.id} textValue={item.label}>
            {item.label}
            {item.supportingText && (
              <span
                style={{ marginLeft: 8, color: 'gray', fontSize: '0.875rem' }}>
                {item.supportingText}
              </span>
            )}
          </Select.Item>
        )}
      </Select>
    </div>
  ),
};
