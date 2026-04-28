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

/**
 * TableV2 stories — usage examples including scrollable behaviour.
 *
 * These stories follow the CSF3 format (same as openmetadata-ui-core-components).
 * They require Storybook to be configured for the main UI, but can also serve
 * as runnable copy-paste examples and visual regression targets.
 *
 * Storybook setup:
 *   cd openmetadata-ui/src/main/resources/ui
 *   yarn storybook   (once configured)
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import type { TableColumnsType } from './TableV2.interface';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

interface Column {
  id: string;
  name: string;
  dataType: string;
  description: string;
  nullable: boolean;
  tags: string;
}

const makeRows = (count: number): Column[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `column_${i + 1}`,
    dataType: ['VARCHAR', 'INTEGER', 'BOOLEAN', 'TIMESTAMP', 'FLOAT'][i % 5],
    description: `Description for column ${i + 1}. This may be a longer text.`,
    nullable: i % 3 !== 0,
    tags: i % 2 === 0 ? 'PII, Sensitive' : 'Public',
  }));

const SAMPLE_COLUMNS: TableColumnsType<Column> = [
  {
    key: 'name',
    dataIndex: 'name',
    title: 'Column Name',
    width: 160,
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  {
    key: 'dataType',
    dataIndex: 'dataType',
    title: 'Data Type',
    width: 120,
  },
  {
    key: 'nullable',
    dataIndex: 'nullable',
    title: 'Nullable',
    width: 100,
    render: (val) => (val ? 'Yes' : 'No'),
  },
  {
    key: 'tags',
    dataIndex: 'tags',
    title: 'Tags',
    width: 180,
  },
  {
    key: 'description',
    dataIndex: 'description',
    title: 'Description',
  },
];

// ---------------------------------------------------------------------------
// Minimal stand-alone wrapper that renders TableV2 without OM app providers.
// Real usage inside the app goes through the full TableV2 component directly.
// ---------------------------------------------------------------------------

/**
 * Lightweight demo that renders just the UntitledTable internals.
 * TableV2 itself requires OM app context (GenericProvider, user store, i18n).
 * Run `yarn start` in the main UI to see the full component.
 */
import {
  Table as UntitledTable,
} from '@openmetadata/ui-core-components';

interface DemoTableProps {
  rows: Column[];
  /** Vertical scroll — pass a px number to cap the table body height. */
  scrollY?: number;
  size?: 'sm' | 'md';
}

const DemoTable = ({ rows, scrollY, size = 'md' }: DemoTableProps) => (
  <UntitledTable
    stickyHeader
    aria-label="demo-table"
    containerStyle={
      scrollY
        ? {
            maxHeight: scrollY,
            overflowX: 'auto',
            overflowY: 'auto',
          }
        : undefined
    }
    size={size}>
    <UntitledTable.Header>
      {SAMPLE_COLUMNS.map((col) => (
        <UntitledTable.Head
          id={String(col.key)}
          key={String(col.key)}
          style={col.width ? { width: col.width, minWidth: col.width } : {}}>
          {col.title as React.ReactNode}
        </UntitledTable.Head>
      ))}
    </UntitledTable.Header>
    <UntitledTable.Body>
      {rows.map((row) =>
        <UntitledTable.Row id={row.id} key={row.id}>
          {SAMPLE_COLUMNS.map((col) => (
            <UntitledTable.Cell key={String(col.key)}>
              {col.render
                ? (col.render(
                    (row as Record<string, unknown>)[col.dataIndex as string],
                    row,
                    0
                  ) as React.ReactNode)
                : String(
                    (row as Record<string, unknown>)[col.dataIndex as string] ??
                      ''
                  )}
            </UntitledTable.Cell>
          ))}
        </UntitledTable.Row>
      )}
    </UntitledTable.Body>
  </UntitledTable>
);

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/TableV2',
  component: DemoTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'TableV2 is the Untitled-UI-based drop-in replacement for the legacy Ant Design table. ' +
          'Stories here use a minimal wrapper; see TableV2.tsx for the full component with ' +
          'search, column customization, pagination, and sorting.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    scrollY: {
      control: { type: 'number', min: 100, max: 800, step: 50 },
      description: 'Vertical scroll threshold in px. Unset = no vertical limit.',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md'],
    },
  },
} satisfies Meta<typeof DemoTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    rows: makeRows(5),
  },
};

export const ManyRows: Story = {
  name: 'Many rows (no scroll cap)',
  args: {
    rows: makeRows(30),
  },
};

/**
 * Vertical scroll — 30 rows capped at 300 px.
 * The header is sticky so it stays visible while scrolling.
 */
export const VerticalScroll: Story = {
  name: 'Vertical scroll (scrollY = 300)',
  args: {
    rows: makeRows(30),
    scrollY: 300,
  },
};

/**
 * Small size variant with vertical scroll — common for dense detail panels.
 */
export const SmallWithScroll: Story = {
  name: 'Small size + vertical scroll',
  args: {
    rows: makeRows(20),
    scrollY: 240,
    size: 'sm',
  },
};

/**
 * Single page of data — no scrollbar appears since content fits.
 */
export const FewRowsScrollCapped: Story = {
  name: 'Few rows — scroll cap but no scrollbar',
  args: {
    rows: makeRows(3),
    scrollY: 300,
  },
};

/**
 * Empty state — verify no scrollbar and the empty message renders correctly.
 */
export const Empty: Story = {
  args: {
    rows: [],
  },
};
