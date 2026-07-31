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
import { Calendar, FilterLines, SearchLg } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/base/buttons/button';
import { Input } from '../components/base/input/input';
import { Select } from '../components/base/select/select';
import { FilterBar } from '../components/application/filter-bar/filter-bar';

const meta = {
  title: 'Components/FilterBar',
  component: FilterBar.Root,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FilterBar.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const operatorItems = [
  { id: 'is', label: 'is' },
  { id: 'is-not', label: 'is not' },
  { id: 'contains', label: 'contains' },
];

export const Default: Story = {
  render: () => (
    <div style={{ width: 720 }}>
      <FilterBar.Root>
        <FilterBar.Content>
          <Input aria-label="Search" icon={SearchLg} placeholder="Search" />
          <Select aria-label="Status" placeholder="Status">
            {(item) => <Select.Item {...item} />}
          </Select>
        </FilterBar.Content>
        <FilterBar.Actions>
          <FilterBar.FilterIconButton icon={Calendar} label="Date range" />
          <FilterBar.FilterIconButton icon={FilterLines} label="More filters" />
          <Button size="md">Apply</Button>
        </FilterBar.Actions>
      </FilterBar.Root>
    </div>
  ),
};

export const AdvancedFilterRows: Story = {
  render: () => (
    <div style={{ width: 720 }}>
      <FilterBar.Root>
        <FilterBar.Content>
          <FilterBar.FilterRow onRemove={() => undefined}>
            <Input aria-label="Field" placeholder="Field" />
            <Select
              aria-label="Operator"
              items={operatorItems}
              placeholder="Operator">
              {(item) => <Select.Item {...item} />}
            </Select>
            <Input aria-label="Value" placeholder="Value" />
          </FilterBar.FilterRow>
          <FilterBar.FilterRow onRemove={() => undefined}>
            <Input aria-label="Field" placeholder="Field" />
            <Select
              aria-label="Operator"
              items={operatorItems}
              placeholder="Operator">
              {(item) => <Select.Item {...item} />}
            </Select>
            <Input aria-label="Value" placeholder="Value" />
          </FilterBar.FilterRow>
        </FilterBar.Content>
        <FilterBar.Actions>
          <Button color="secondary" size="md">
            Add filter
          </Button>
        </FilterBar.Actions>
      </FilterBar.Root>
    </div>
  ),
};
