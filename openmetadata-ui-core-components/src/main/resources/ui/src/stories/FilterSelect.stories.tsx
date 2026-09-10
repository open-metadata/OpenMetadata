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

const CERTIFICATION_OPTIONS = [
  { value: 'certified', label: 'Certified', count: 3210 },
  { value: 'pending', label: 'Pending review', count: 418 },
  { value: 'deprecated', label: 'Deprecated', count: 96 },
  { value: 'none', label: 'Not certified', count: 111892 },
];

// Real-world glossary FQNs: quoted segments, UUID prefixes, long strings —
// exercises row truncation and the wider popover.
const GLOSSARY_OPTIONS = [
  { value: 'g1', label: '"Bug.Test"."Bug.Testing%done".term' },
  { value: 'g2', label: 'Business Department.test_business_term' },
  { value: 'g3', label: '"Bug.Test".terming' },
  { value: 'g4', label: 'f15cfcb0fb65471eacd432b392d576fe.4b2a19c0' },
  { value: 'g5', label: 'ef2c7acc226a41308a19fb1e2908ae03.finance_kpi' },
  { value: 'g6', label: 'Marketing.campaign_attribution' },
  { value: 'g7', label: 'Sales.pipeline_stage' },
  { value: 'g8', label: 'Product.active_user' },
];

const NULL_SERVICE = { value: 'OM_NULL_FIELD', label: 'No Service', count: 45 };

const ControlledFilter = ({
  initialSelected = [],
  ...props
}: Partial<FilterSelectProps> & { initialSelected?: string[] }) => {
  const [selected, setSelected] = useState<string[]>(initialSelected);

  return (
    <FilterSelect
      label="Service"
      options={SERVICE_OPTIONS}
      selectedValues={selected}
      triggerVariant="button"
      onChange={setSelected}
      {...props}
    />
  );
};

const Row = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: '16px 32px',
    }}>
    {children}
  </div>
);

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

const baseArgs = {
  label: 'Service',
  options: SERVICE_OPTIONS,
  selectedValues: [],
  onChange: () => undefined,
};

export const Triggers: Story = {
  args: baseArgs,
  render: () => (
    <Row>
      <ControlledFilter label="Borderless (Explore)" />
      <ControlledFilter bordered label="Bordered" />
      <ControlledFilter
        label="Input variant"
        selectionMode="single"
        triggerVariant="input"
      />
    </Row>
  ),
};

// Medium (default) for primary filter bars; Regular when the filter sits
// inside dense content and shouldn't compete with it.
export const TriggerWeight: Story = {
  args: baseArgs,
  render: () => (
    <Row>
      <ControlledFilter
        searchable
        showSelectAll
        initialSelected={['snowflake', 'bigquery']}
        label="Medium (default)"
      />
      <ControlledFilter
        searchable
        showSelectAll
        initialSelected={['snowflake', 'bigquery']}
        label="Regular"
        typography="regular"
      />
      <ControlledFilter label="Regular, empty" typography="regular" />
    </Row>
  ),
};

// The full product pattern: search, Select all with an indeterminate state,
// counts, and a footer where nothing takes effect until Apply.
export const FilterBar: Story = {
  args: baseArgs,
  render: () => (
    <Row>
      <ControlledFilter
        searchable
        showSelectAll
        commitMode="staged"
        initialSelected={['OM_NULL_FIELD', 'redshift']}
        nullOption={NULL_SERVICE}
      />
      <ControlledFilter
        searchable
        showSelectAll
        commitMode="staged"
        label="Certification"
        options={CERTIFICATION_OPTIONS}
      />
      <ControlledFilter
        hideCounts
        searchable
        showSelectAll
        commitMode="staged"
        initialSelected={['g1', 'g4']}
        label="Glossary Term"
        options={GLOSSARY_OPTIONS}
        popoverClassName="tw:w-96"
      />
    </Row>
  ),
};

// Same list without the Apply step — each toggle commits instantly. For short
// lists and client-side filtering where each toggle is cheap.
export const Immediate: Story = {
  args: baseArgs,
  render: () => (
    <Row>
      <ControlledFilter
        searchable
        showSelectAll
        initialSelected={['snowflake', 'bigquery']}
      />
      <ControlledFilter label="No search" typography="regular" />
    </Row>
  ),
};

// Boxed trigger for table toolbars beside buttons and inputs.
export const Bordered: Story = {
  args: baseArgs,
  render: () => (
    <Row>
      <ControlledFilter bordered searchable />
      <ControlledFilter
        bordered
        searchable
        showSelectAll
        initialSelected={['snowflake']}
      />
      <ControlledFilter
        bordered
        hideCounts
        searchable
        initialSelected={['g1', 'g3', 'g5']}
        label="Glossary Term"
        options={GLOSSARY_OPTIONS}
        popoverClassName="tw:w-96"
      />
    </Row>
  ),
};

// Behaves like a form field: full width, placeholder when empty, chips or a
// count for chosen values. Instant commit — the form's own Save is the commit.
export const InputForms: Story = {
  args: baseArgs,
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <ControlledFilter
        className="tw:w-full"
        label="Services"
        placeholder="Choose services"
        triggerDisplay="chips"
        triggerVariant="input"
      />
      <ControlledFilter
        hideCounts
        className="tw:w-full"
        initialSelected={['g2', 'g4']}
        label="Glossary Terms"
        options={GLOSSARY_OPTIONS}
        triggerDisplay="chips"
        triggerVariant="input"
      />
      <ControlledFilter
        className="tw:w-full"
        initialSelected={['snowflake', 'mssql']}
        label="Services"
        placeholder="Choose services"
        triggerVariant="input"
      />
    </div>
  ),
};

export const SingleSelect: Story = {
  args: { ...baseArgs, label: 'Owner' },
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
