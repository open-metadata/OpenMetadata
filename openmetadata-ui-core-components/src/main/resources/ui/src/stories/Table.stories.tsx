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
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { SortDescriptor } from 'react-aria-components';
import {
  ColumnResizer,
  Dialog,
  DialogTrigger,
  Popover,
  ResizableTableContainer,
  TableBody as AriaTableBody,
} from 'react-aria-components';
import { ChevronDown, ChevronRight } from '@untitledui/icons';
import { Badge } from '../components/base/badges/badges';
import { PaginationPageDefault } from '../components/application/pagination/pagination';
import {
  Table,
  TableCard,
  TableRowActionsDropdown,
} from '../components/application/table/table';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

const SAMPLE_DATA: User[] = [
  {
    id: 1,
    name: 'Olivia Rhye',
    email: 'olivia@example.com',
    role: 'Admin',
    status: 'active',
  },
  {
    id: 2,
    name: 'Phoenix Baker',
    email: 'phoenix@example.com',
    role: 'Editor',
    status: 'active',
  },
  {
    id: 3,
    name: 'Lana Steiner',
    email: 'lana@example.com',
    role: 'Viewer',
    status: 'inactive',
  },
  {
    id: 4,
    name: 'Demi Wilkinson',
    email: 'demi@example.com',
    role: 'Editor',
    status: 'active',
  },
  {
    id: 5,
    name: 'Candice Wu',
    email: 'candice@example.com',
    role: 'Admin',
    status: 'inactive',
  },
];

const StatusBadge = ({ status }: { status: 'active' | 'inactive' }) => (
  <Badge
    color={status === 'active' ? 'success' : 'gray'}
    size="sm"
    type="pill-color">
    {status === 'active' ? 'Active' : 'Inactive'}
  </Badge>
);

const meta = {
  title: 'Components/Table',
  component: Table,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table aria-label="Users table">
      <Table.Header>
        <Table.Head isRowHeader>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Name
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Email
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Role
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Status
          </span>
        </Table.Head>
      </Table.Header>
      <AriaTableBody>
        {SAMPLE_DATA.map((user) => (
          <Table.Row id={String(user.id)} key={user.id}>
            <Table.Cell>
              <span className="tw:text-sm tw:font-medium tw:text-primary">
                {user.name}
              </span>
            </Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{user.role}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={user.status} />
            </Table.Cell>
          </Table.Row>
        ))}
      </AriaTableBody>
    </Table>
  ),
};

export const SmallSize: Story = {
  render: () => (
    <Table aria-label="Users table (small)" size="sm">
      <Table.Header>
        <Table.Head isRowHeader>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Name
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Email
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Role
          </span>
        </Table.Head>
      </Table.Header>
      <AriaTableBody>
        {SAMPLE_DATA.map((user) => (
          <Table.Row id={String(user.id)} key={user.id}>
            <Table.Cell>
              <span className="tw:text-sm tw:font-medium tw:text-primary">
                {user.name}
              </span>
            </Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{user.role}</Table.Cell>
          </Table.Row>
        ))}
      </AriaTableBody>
    </Table>
  ),
};

const WithSelectionExample = () => {
  const [selectedKeys, setSelectedKeys] = useState<'all' | Set<string>>(
    new Set()
  );

  return (
    <div>
      <Table
        aria-label="Users table with selection"
        selectedKeys={selectedKeys}
        selectionBehavior="toggle"
        selectionMode="multiple"
        onSelectionChange={(keys) =>
          setSelectedKeys(keys as 'all' | Set<string>)
        }>
        <Table.Header>
          <Table.Head isRowHeader>
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              Name
            </span>
          </Table.Head>
          <Table.Head>
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              Email
            </span>
          </Table.Head>
          <Table.Head>
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              Role
            </span>
          </Table.Head>
          <Table.Head>
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              Status
            </span>
          </Table.Head>
        </Table.Header>
        <AriaTableBody>
          {SAMPLE_DATA.map((user) => (
            <Table.Row id={String(user.id)} key={user.id}>
              <Table.Cell>
                <span className="tw:text-sm tw:font-medium tw:text-primary">
                  {user.name}
                </span>
              </Table.Cell>
              <Table.Cell>{user.email}</Table.Cell>
              <Table.Cell>{user.role}</Table.Cell>
              <Table.Cell>
                <StatusBadge status={user.status} />
              </Table.Cell>
            </Table.Row>
          ))}
        </AriaTableBody>
      </Table>
      <p className="tw:mt-4 tw:text-sm tw:text-tertiary">
        Selected:{' '}
        {selectedKeys === 'all'
          ? 'All'
          : [...selectedKeys].join(', ') || 'None'}
      </p>
    </div>
  );
};

export const WithSelection: StoryObj = {
  render: () => <WithSelectionExample />,
};

const WithSortingExample = () => {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'name',
    direction: 'ascending',
  });

  const sorted = [...SAMPLE_DATA].sort((a, b) => {
    const key = sortDescriptor.column as keyof User;
    const cmp = String(a[key]).localeCompare(String(b[key]));

    return sortDescriptor.direction === 'descending' ? -cmp : cmp;
  });

  return (
    <Table
      aria-label="Users table with sorting"
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}>
      <Table.Header>
        <Table.Head allowsSorting isRowHeader id="name">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Name
          </span>
        </Table.Head>
        <Table.Head allowsSorting id="email">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Email
          </span>
        </Table.Head>
        <Table.Head allowsSorting id="role">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Role
          </span>
        </Table.Head>
        <Table.Head id="status">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Status
          </span>
        </Table.Head>
      </Table.Header>
      <AriaTableBody>
        {sorted.map((user) => (
          <Table.Row id={String(user.id)} key={user.id}>
            <Table.Cell>
              <span className="tw:text-sm tw:font-medium tw:text-primary">
                {user.name}
              </span>
            </Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{user.role}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={user.status} />
            </Table.Cell>
          </Table.Row>
        ))}
      </AriaTableBody>
    </Table>
  );
};

export const WithSorting: StoryObj = {
  render: () => <WithSortingExample />,
};

export const WithRowActions: StoryObj = {
  render: () => (
    <Table aria-label="Users table with actions">
      <Table.Header>
        <Table.Head isRowHeader>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Name
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Email
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Role
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Status
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary" />
        </Table.Head>
      </Table.Header>
      <AriaTableBody>
        {SAMPLE_DATA.map((user) => (
          <Table.Row id={String(user.id)} key={user.id}>
            <Table.Cell>
              <span className="tw:text-sm tw:font-medium tw:text-primary">
                {user.name}
              </span>
            </Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{user.role}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={user.status} />
            </Table.Cell>
            <Table.Cell>
              <TableRowActionsDropdown />
            </Table.Cell>
          </Table.Row>
        ))}
      </AriaTableBody>
    </Table>
  ),
};

export const InsideTableCard: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 900 }}>
      <TableCard.Root>
        <TableCard.Header
          badge="5 users"
          description="Manage your team members and their account permissions here."
          title="Team Members"
        />
        <Table aria-label="Team members">
          <Table.Header>
            <Table.Head isRowHeader>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                Name
              </span>
            </Table.Head>
            <Table.Head>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                Email
              </span>
            </Table.Head>
            <Table.Head>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                Role
              </span>
            </Table.Head>
            <Table.Head>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                Status
              </span>
            </Table.Head>
          </Table.Header>
          <AriaTableBody>
            {SAMPLE_DATA.map((user) => (
              <Table.Row id={String(user.id)} key={user.id}>
                <Table.Cell>
                  <span className="tw:text-sm tw:font-medium tw:text-primary">
                    {user.name}
                  </span>
                </Table.Cell>
                <Table.Cell>{user.email}</Table.Cell>
                <Table.Cell>{user.role}</Table.Cell>
                <Table.Cell>
                  <StatusBadge status={user.status} />
                </Table.Cell>
              </Table.Row>
            ))}
          </AriaTableBody>
        </Table>
      </TableCard.Root>
    </div>
  ),
};

export const EmptyState: StoryObj = {
  render: () => (
    <Table aria-label="Empty table">
      <Table.Header>
        <Table.Head isRowHeader>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Name
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Email
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Role
          </span>
        </Table.Head>
      </Table.Header>
      <AriaTableBody
        renderEmptyState={() => (
          <div className="tw:py-12 tw:text-center tw:text-sm tw:text-tertiary">
            No data available
          </div>
        )}>
        {[]}
      </AriaTableBody>
    </Table>
  ),
};

export const WithColumnTooltips: StoryObj = {
  render: () => (
    <Table aria-label="Table with column tooltips">
      <Table.Header>
        <Table.Head isRowHeader tooltip="Full name of the team member">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Name
          </span>
        </Table.Head>
        <Table.Head tooltip="Primary email address">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Email
          </span>
        </Table.Head>
        <Table.Head tooltip="Access level assigned to this user">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Role
          </span>
        </Table.Head>
        <Table.Head tooltip="Current account status">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Status
          </span>
        </Table.Head>
      </Table.Header>
      <AriaTableBody>
        {SAMPLE_DATA.slice(0, 3).map((user) => (
          <Table.Row id={String(user.id)} key={user.id}>
            <Table.Cell>
              <span className="tw:text-sm tw:font-medium tw:text-primary">
                {user.name}
              </span>
            </Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{user.role}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={user.status} />
            </Table.Cell>
          </Table.Row>
        ))}
      </AriaTableBody>
    </Table>
  ),
};

const WithSingleSelectionExample = () => {
  const [selectedKeys, setSelectedKeys] = useState<'all' | Set<string>>(
    new Set()
  );

  return (
    <div>
      <Table
        aria-label="Single selection table"
        selectedKeys={selectedKeys}
        selectionBehavior="toggle"
        selectionMode="single"
        onSelectionChange={(keys) =>
          setSelectedKeys(keys as 'all' | Set<string>)
        }>
        <Table.Header>
          <Table.Head isRowHeader>
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              Name
            </span>
          </Table.Head>
          <Table.Head>
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              Email
            </span>
          </Table.Head>
          <Table.Head>
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              Role
            </span>
          </Table.Head>
        </Table.Header>
        <AriaTableBody>
          {SAMPLE_DATA.map((user) => (
            <Table.Row id={String(user.id)} key={user.id}>
              <Table.Cell>
                <span className="tw:text-sm tw:font-medium tw:text-primary">
                  {user.name}
                </span>
              </Table.Cell>
              <Table.Cell>{user.email}</Table.Cell>
              <Table.Cell>{user.role}</Table.Cell>
            </Table.Row>
          ))}
        </AriaTableBody>
      </Table>
      <p className="tw:mt-4 tw:text-sm tw:text-tertiary">
        Selected:{' '}
        {selectedKeys === 'all'
          ? 'All'
          : [...selectedKeys].join(', ') || 'None'}
      </p>
    </div>
  );
};

export const WithSingleSelection: StoryObj = {
  render: () => <WithSingleSelectionExample />,
};

export const TableCardSmall: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 700 }}>
      <TableCard.Root size="sm">
        <TableCard.Header
          description="Latest actions performed by team members."
          title="Recent Activity"
        />
        <Table aria-label="Recent activity">
          <Table.Header>
            <Table.Head isRowHeader>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                Name
              </span>
            </Table.Head>
            <Table.Head>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                Role
              </span>
            </Table.Head>
            <Table.Head>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                Status
              </span>
            </Table.Head>
          </Table.Header>
          <AriaTableBody>
            {SAMPLE_DATA.slice(0, 3).map((user) => (
              <Table.Row id={String(user.id)} key={user.id}>
                <Table.Cell>
                  <span className="tw:text-sm tw:font-medium tw:text-primary">
                    {user.name}
                  </span>
                </Table.Cell>
                <Table.Cell>{user.role}</Table.Cell>
                <Table.Cell>
                  <StatusBadge status={user.status} />
                </Table.Cell>
              </Table.Row>
            ))}
          </AriaTableBody>
        </Table>
      </TableCard.Root>
    </div>
  ),
};

// ─── WithColumnFilterDropdown ─────────────────────────────────────────────────
// Demonstrates the pattern used in TableV2: a controlled DialogTrigger in a
// column header where confirm() / close() both close the popover, so the filter
// panel dismisses after the user applies their selection.

const WithColumnFilterDropdownExample = () => {
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set()
  );

  const visibleData =
    selectedStatuses.size === 0
      ? SAMPLE_DATA
      : SAMPLE_DATA.filter((u) => selectedStatuses.has(u.status));

  const toggleStatus = (status: string, checked: boolean) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      checked ? next.add(status) : next.delete(status);

      return next;
    });
  };

  const confirm = () => setOpenCol(null);
  const clearFilters = () => {
    setSelectedStatuses(new Set());
    setOpenCol(null);
  };

  return (
    <div>
      <Table aria-label="Table with column filter dropdown">
        <Table.Header>
          <Table.Head isRowHeader>Name</Table.Head>
          <Table.Head>Email</Table.Head>
          <Table.Head>Role</Table.Head>
          <Table.Head>
            <div className="tw:flex tw:items-center tw:gap-1">
              Status
              <DialogTrigger
                isOpen={openCol === 'status'}
                onOpenChange={(isOpen) => setOpenCol(isOpen ? 'status' : null)}>
                <button
                  aria-label="Filter status"
                  className="tw:ml-1 tw:p-0.5 tw:bg-transparent tw:border-0 tw:cursor-pointer tw:text-xs tw:text-tertiary tw:rounded tw:hover:bg-secondary">
                  {selectedStatuses.size > 0 ? '●' : '○'}
                </button>
                <Popover placement="bottom right">
                  <Dialog className="tw:outline-none">
                    <div className="tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt tw:rounded-lg tw:p-3 tw:min-w-48">
                      <p className="tw:text-xs tw:font-medium tw:text-secondary tw:mb-2">
                        Filter by status
                      </p>
                      {(['active', 'inactive'] as const).map((s) => (
                        <label
                          className="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:p-1 tw:cursor-pointer"
                          key={s}>
                          <input
                            checked={selectedStatuses.has(s)}
                            type="checkbox"
                            onChange={(e) => toggleStatus(s, e.target.checked)}
                          />
                          <span className="tw:capitalize">{s}</span>
                        </label>
                      ))}
                      <div className="tw:flex tw:gap-2 tw:mt-3 tw:pt-2 tw:border-t tw:border-secondary_alt">
                        <button
                          className="tw:flex-1 tw:text-xs tw:bg-brand-solid tw:text-white tw:rounded tw:px-2 tw:py-1 tw:cursor-pointer tw:border-0"
                          onClick={confirm}>
                          Confirm
                        </button>
                        <button
                          className="tw:flex-1 tw:text-xs tw:bg-transparent tw:text-secondary tw:rounded tw:px-2 tw:py-1 tw:cursor-pointer tw:border tw:border-secondary_alt"
                          onClick={clearFilters}>
                          Clear
                        </button>
                      </div>
                    </div>
                  </Dialog>
                </Popover>
              </DialogTrigger>
            </div>
          </Table.Head>
        </Table.Header>
        <AriaTableBody>
          {visibleData.map((user) => (
            <Table.Row id={String(user.id)} key={user.id}>
              <Table.Cell>
                <span className="tw:text-sm tw:font-medium tw:text-primary">
                  {user.name}
                </span>
              </Table.Cell>
              <Table.Cell>{user.email}</Table.Cell>
              <Table.Cell>{user.role}</Table.Cell>
              <Table.Cell>
                <StatusBadge status={user.status} />
              </Table.Cell>
            </Table.Row>
          ))}
        </AriaTableBody>
      </Table>
      <p className="tw:mt-3 tw:text-xs tw:text-tertiary">
        Active filter:{' '}
        {selectedStatuses.size > 0
          ? [...selectedStatuses].join(', ')
          : 'none — showing all rows'}
      </p>
    </div>
  );
};

export const WithColumnFilterDropdown: StoryObj = {
  render: () => <WithColumnFilterDropdownExample />,
  parameters: {
    docs: {
      description: {
        story:
          'Column header filter using a controlled `DialogTrigger`. Clicking **Confirm** calls `confirm()` which sets `isOpen=false`, closing the popover immediately — the same fix applied in `TableV2`.',
      },
    },
  },
};

// ─── WithNestedRowDepth ────────────────────────────────────────────────────────
// Demonstrates that rowClassName receives the actual nesting depth, not 0.
// Rows at depth 0 are plain, depth 1 are indented + muted, depth 2 further
// indented + lighter — matching what TableV2 now passes to rowClassName.

interface TreeRow {
  id: string;
  name: string;
  type: string;
  depth: number;
}

const TREE_DATA: TreeRow[] = [
  { id: '1', name: 'Users', type: 'Folder', depth: 0 },
  { id: '1-1', name: 'Olivia Rhye', type: 'Admin', depth: 1 },
  { id: '1-2', name: 'Phoenix Baker', type: 'Editor', depth: 1 },
  { id: '2', name: 'Groups', type: 'Folder', depth: 0 },
  { id: '2-1', name: 'Engineering', type: 'Group', depth: 1 },
  { id: '2-1-1', name: 'Backend', type: 'Sub-group', depth: 2 },
  { id: '2-1-2', name: 'Frontend', type: 'Sub-group', depth: 2 },
  { id: '2-2', name: 'Design', type: 'Group', depth: 1 },
];

const depthRowClass = (depth: number): string => {
  if (depth === 1) {
    return 'tw:bg-secondary/50';
  }
  if (depth >= 2) {
    return 'tw:bg-secondary tw:text-tertiary';
  }

  return '';
};

export const WithNestedRowDepth: StoryObj = {
  render: () => (
    <div>
      <Table aria-label="Tree table with depth-aware row styles">
        <Table.Header>
          <Table.Head isRowHeader>Name</Table.Head>
          <Table.Head>Type</Table.Head>
          <Table.Head>Depth</Table.Head>
        </Table.Header>
        <AriaTableBody>
          {TREE_DATA.map((row) => (
            <Table.Row
              className={depthRowClass(row.depth)}
              id={row.id}
              key={row.id}>
              <Table.Cell>
                <span
                  className="tw:text-sm tw:font-medium tw:text-primary"
                  style={{ paddingLeft: `${row.depth * 20}px` }}>
                  {row.depth > 0 ? '↳ ' : ''}
                  {row.name}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="tw:text-sm tw:text-secondary">{row.type}</span>
              </Table.Cell>
              <Table.Cell>
                <Badge color="gray" size="sm" type="pill-color">
                  depth {row.depth}
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </AriaTableBody>
      </Table>
      <p className="tw:mt-3 tw:text-xs tw:text-tertiary">
        Each row receives its actual <code>depth</code> value (0 / 1 / 2) in{' '}
        <code>rowClassName(record, index, depth)</code> — previously always{' '}
        <code>0</code>.
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '`rowClassName` now receives the real nesting depth instead of a hardcoded `0`. Rows at depth 0/1/2 get progressively stronger background tints via `depthRowClass(depth)`.',
      },
    },
  },
};

// ─── WithResizableColumns ─────────────────────────────────────────────────────
// Wraps the table in ResizableTableContainer and adds a ColumnResizer drag
// handle to each header cell — the same pattern used in TableV2's
// `resizableColumns` prop.

export const WithResizableColumns: StoryObj = {
  render: () => (
    <ResizableTableContainer className="tw:overflow-auto tw:relative">
      <Table aria-label="Resizable columns table" className="tw:table-fixed">
        <Table.Header>
          {['Name', 'Email', 'Role', 'Status'].map((col) => (
            <Table.Head
              isRowHeader={col === 'Name'}
              key={col}
              style={{ position: 'relative', width: 180, minWidth: 80 }}>
              <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                {col}
              </span>
              <ColumnResizer className="tw:absolute tw:right-0 tw:top-1/4 tw:h-1/2 tw:w-2 tw:cursor-col-resize tw:touch-none tw:after:absolute tw:after:left-1/2 tw:after:h-full tw:after:w-px tw:after:-translate-x-1/2 tw:after:bg-secondary_alt tw:after:content-['']" />
            </Table.Head>
          ))}
        </Table.Header>
        <AriaTableBody>
          {SAMPLE_DATA.map((user) => (
            <Table.Row id={String(user.id)} key={user.id}>
              <Table.Cell>
                <span className="tw:text-sm tw:font-medium tw:text-primary tw:truncate">
                  {user.name}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="tw:text-sm tw:truncate">{user.email}</span>
              </Table.Cell>
              <Table.Cell>{user.role}</Table.Cell>
              <Table.Cell>
                <StatusBadge status={user.status} />
              </Table.Cell>
            </Table.Row>
          ))}
        </AriaTableBody>
      </Table>
    </ResizableTableContainer>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Wrap the table in `ResizableTableContainer` and add a `ColumnResizer` to each `Table.Head` to enable drag-to-resize. This is the primitive behind `TableV2`'s `resizableColumns` prop.",
      },
    },
  },
};

// ─── WithExpandableRows ───────────────────────────────────────────────────────
// Controlled expand/collapse tree using ChevronDown / ChevronRight icons.
// Matches the expand-icon pattern in TableV2's `expandable` prop support.

interface Department {
  id: string;
  name: string;
  headCount: number;
  members?: { id: string; name: string; role: string }[];
}

const DEPT_DATA: Department[] = [
  {
    id: 'eng',
    name: 'Engineering',
    headCount: 3,
    members: [
      { id: 'eng-1', name: 'Olivia Rhye', role: 'Backend' },
      { id: 'eng-2', name: 'Phoenix Baker', role: 'Frontend' },
      { id: 'eng-3', name: 'Lana Steiner', role: 'DevOps' },
    ],
  },
  {
    id: 'design',
    name: 'Design',
    headCount: 2,
    members: [
      { id: 'des-1', name: 'Demi Wilkinson', role: 'UX' },
      { id: 'des-2', name: 'Candice Wu', role: 'Visual' },
    ],
  },
  { id: 'legal', name: 'Legal', headCount: 0 },
];

const WithExpandableRowsExample = () => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);

      return next;
    });

  return (
    <Table aria-label="Expandable rows table">
      <Table.Header>
        <Table.Head isRowHeader>Department</Table.Head>
        <Table.Head>Head Count</Table.Head>
        <Table.Head>Member</Table.Head>
        <Table.Head>Role</Table.Head>
      </Table.Header>
      <AriaTableBody>
        {DEPT_DATA.flatMap((dept) => {
          const isExpanded = expandedIds.has(dept.id);
          const hasChildren = (dept.members?.length ?? 0) > 0;

          return [
            <Table.Row id={dept.id} key={dept.id}>
              <Table.Cell>
                <div className="tw:flex tw:items-center tw:gap-1">
                  {hasChildren ? (
                    <button
                      aria-expanded={isExpanded}
                      className="tw:p-0 tw:bg-transparent tw:border-0 tw:cursor-pointer tw:inline-flex"
                      data-testid="expand-icon"
                      onClick={() => toggle(dept.id)}>
                      {isExpanded ? (
                        <ChevronDown className="tw:size-4 tw:text-tertiary" />
                      ) : (
                        <ChevronRight className="tw:size-4 tw:text-tertiary" />
                      )}
                    </button>
                  ) : (
                    <span className="tw:inline-block tw:w-4" />
                  )}
                  <span className="tw:text-sm tw:font-medium tw:text-primary">
                    {dept.name}
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge color="gray" size="sm" type="pill-color">
                  {dept.headCount}
                </Badge>
              </Table.Cell>
              <Table.Cell />
              <Table.Cell />
            </Table.Row>,
            ...(isExpanded && dept.members
              ? dept.members.map((m) => (
                  <Table.Row
                    className="tw:bg-secondary/40"
                    id={m.id}
                    key={m.id}>
                    <Table.Cell />
                    <Table.Cell />
                    <Table.Cell>
                      <span
                        className="tw:text-sm tw:text-primary"
                        style={{ paddingLeft: 24 }}>
                        {m.name}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="tw:text-sm tw:text-secondary">
                        {m.role}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))
              : []),
          ];
        })}
      </AriaTableBody>
    </Table>
  );
};

export const WithExpandableRows: StoryObj = {
  render: () => <WithExpandableRowsExample />,
  parameters: {
    docs: {
      description: {
        story:
          'Controlled expand/collapse using `ChevronDown`/`ChevronRight` icons and a `Set` of expanded IDs. This is the same expand-icon pattern that `TableV2` renders when the `expandable` prop is provided.',
      },
    },
  },
};

// ─── WithLoadingState ─────────────────────────────────────────────────────────
// Shows an absolute spinner overlay while the table content is loading.
// Matches the `loading` prop behavior in TableV2.

const WithLoadingStateExample = () => {
  const [loading, setLoading] = useState(true);

  return (
    <div>
      <div className="tw:mb-3">
        <button
          className="tw:text-sm tw:px-3 tw:py-1 tw:rounded tw:border tw:border-secondary_alt tw:cursor-pointer tw:bg-transparent"
          onClick={() => setLoading((v) => !v)}>
          Toggle loading
        </button>
      </div>
      <div className="tw:relative">
        {loading && (
          <div className="tw:absolute tw:inset-0 tw:z-10 tw:flex tw:items-center tw:justify-center tw:bg-white/60 tw:rounded">
            <div className="tw:size-6 tw:rounded-full tw:border-2 tw:border-brand-solid tw:border-t-transparent tw:animate-spin" />
          </div>
        )}
        <Table aria-label="Table with loading state">
          <Table.Header>
            <Table.Head isRowHeader>Name</Table.Head>
            <Table.Head>Email</Table.Head>
            <Table.Head>Role</Table.Head>
            <Table.Head>Status</Table.Head>
          </Table.Header>
          <AriaTableBody>
            {SAMPLE_DATA.map((user) => (
              <Table.Row id={String(user.id)} key={user.id}>
                <Table.Cell>
                  <span className="tw:text-sm tw:font-medium tw:text-primary">
                    {user.name}
                  </span>
                </Table.Cell>
                <Table.Cell>{user.email}</Table.Cell>
                <Table.Cell>{user.role}</Table.Cell>
                <Table.Cell>
                  <StatusBadge status={user.status} />
                </Table.Cell>
              </Table.Row>
            ))}
          </AriaTableBody>
        </Table>
      </div>
    </div>
  );
};

export const WithLoadingState: StoryObj = {
  render: () => <WithLoadingStateExample />,
  parameters: {
    docs: {
      description: {
        story:
          "An absolute overlay with a spinner covers the table while `loading=true`. Toggle the button to switch between states — same as `TableV2`'s `loading` prop.",
      },
    },
  },
};

// ─── WithPagination ────────────────────────────────────────────────────────────
// Client-side pagination using PaginationPageDefault below the table.
// Matches TableV2's internal pagination behaviour when the `pagination` prop is
// provided with a `pageSize`.

const PAGE_SIZE = 2;

const WithPaginationExample = () => {
  const [page, setPage] = useState(1);
  const total = SAMPLE_DATA.length;
  const slice = SAMPLE_DATA.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <Table aria-label="Paginated table">
        <Table.Header>
          <Table.Head isRowHeader>Name</Table.Head>
          <Table.Head>Email</Table.Head>
          <Table.Head>Role</Table.Head>
          <Table.Head>Status</Table.Head>
        </Table.Header>
        <AriaTableBody>
          {slice.map((user) => (
            <Table.Row id={String(user.id)} key={user.id}>
              <Table.Cell>
                <span className="tw:text-sm tw:font-medium tw:text-primary">
                  {user.name}
                </span>
              </Table.Cell>
              <Table.Cell>{user.email}</Table.Cell>
              <Table.Cell>{user.role}</Table.Cell>
              <Table.Cell>
                <StatusBadge status={user.status} />
              </Table.Cell>
            </Table.Row>
          ))}
        </AriaTableBody>
      </Table>
      <div className="tw:mt-4 tw:flex tw:justify-between tw:items-center tw:px-1">
        <span className="tw:text-xs tw:text-tertiary">
          {total} results · page {page} of {Math.ceil(total / PAGE_SIZE)}
        </span>
        <PaginationPageDefault
          page={page}
          total={Math.ceil(total / PAGE_SIZE)}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export const WithPagination: StoryObj = {
  render: () => <WithPaginationExample />,
  parameters: {
    docs: {
      description: {
        story:
          "Client-side pagination: slice `dataSource` by `pageSize` and render `PaginationPageDefault` below the table. This mirrors `TableV2`'s internal `clientPagination` logic.",
      },
    },
  },
};

export const WithStickyHeader: StoryObj = {
  render: () => (
    <Table stickyHeader aria-label="Sticky header table">
      <Table.Header>
        <Table.Head isRowHeader>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Name
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Email
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Role
          </span>
        </Table.Head>
        <Table.Head>
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            Status
          </span>
        </Table.Head>
      </Table.Header>
      <AriaTableBody>
        {[...SAMPLE_DATA, ...SAMPLE_DATA, ...SAMPLE_DATA].map((user, i) => (
          <Table.Row id={`${user.id}-${i}`} key={`${user.id}-${i}`}>
            <Table.Cell>
              <span className="tw:text-sm tw:font-medium tw:text-primary">
                {user.name}
              </span>
            </Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{user.role}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={user.status} />
            </Table.Cell>
          </Table.Row>
        ))}
      </AriaTableBody>
    </Table>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Pass `stickyHeader` to keep the `<thead>` pinned while the body scrolls. The table wrapper automatically gains `overflow-auto max-h-100`.',
      },
    },
  },
};
