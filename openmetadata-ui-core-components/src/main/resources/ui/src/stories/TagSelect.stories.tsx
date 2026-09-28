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
import { useState } from 'react';
import { TagSelect } from '../components/base/select/tag-select';

const OPTIONS = [
  { id: 'pii', label: 'PII.Sensitive' },
  { id: 'tier1', label: 'Tier.Tier1' },
  { id: 'gold', label: 'Certification.Gold' },
  { id: 'deprecated', label: 'Lifecycle.Deprecated', isDisabled: true },
];

const meta = {
  title: 'Components/TagSelect',
  component: TagSelect,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    options: OPTIONS,
    value: [],
    onChange: () => undefined,
    label: 'Tags',
    placeholder: 'Select tags',
  },
  render: (args) => {
    const [value, setValue] = useState<string[]>(args.value);

    return (
      <div className="tw:w-96">
        <TagSelect {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof TagSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValueAndClear: Story = {
  args: { value: ['pii', 'tier1'], allowClear: true, hint: 'Up to 5 tags.' },
};

export const Disabled: Story = {
  args: { value: ['gold'], isDisabled: true },
};

export const Dark: Story = {
  parameters: { theme: 'dark' },
  args: { value: ['pii'], allowClear: true, size: 'md' },
};
