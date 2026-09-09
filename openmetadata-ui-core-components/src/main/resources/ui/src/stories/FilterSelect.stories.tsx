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
import { Database01, User01 } from '@untitledui/icons';
import { useState } from 'react';
import { FilterSelect } from '../components/application/filter-select/filter-select';
import type { FilterSelectProps } from '../components/application/filter-select/filter-select.types';

const SERVICE_OPTIONS = [
  { value: 'snowflake', label: 'Snowflake', count: 1204, icon: Database01 },
  { value: 'bigquery', label: 'BigQuery', count: 867, icon: Database01 },
  { value: 'redshift', label: 'Redshift', count: 312, icon: Database01 },
  { value: 'mssql', label: 'MSSQL', count: 97, icon: Database01 },
];

const ControlledFilter = (props: Partial<FilterSelectProps>) => {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <FilterSelect
      label="Service"
      options={SERVICE_OPTIONS}
      selectedValues={selected}
      onChange={setSelected}
      {...props}
    />
  );
};

const meta = {
  title: 'Components/FilterSelect',
  component: FilterSelect,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FilterSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Immediate: Story = {
  args: {
    label: 'Service',
    options: SERVICE_OPTIONS,
    selectedValues: [],
    onChange: () => undefined,
  },
  render: () => <ControlledFilter searchable showSelectAll />,
};

export const Staged: Story = {
  args: {
    label: 'Service',
    options: SERVICE_OPTIONS,
    selectedValues: [],
    onChange: () => undefined,
  },
  render: () => (
    <ControlledFilter
      searchable
      commitMode="staged"
      nullOption={{ value: 'OM_NULL_FIELD', label: 'No Service', count: 45 }}
    />
  ),
};

export const SingleSelect: Story = {
  args: {
    label: 'Owner',
    options: SERVICE_OPTIONS,
    selectedValues: [],
    onChange: () => undefined,
  },
  render: () => (
    <ControlledFilter
      hideCounts
      label="Owner"
      options={[
        { value: 'aaron', label: 'Aaron Johnson', icon: User01 },
        { value: 'cynthia', label: 'Cynthia Meyer', icon: User01 },
      ]}
      selectionMode="single"
      triggerVariant="input"
    />
  ),
};
