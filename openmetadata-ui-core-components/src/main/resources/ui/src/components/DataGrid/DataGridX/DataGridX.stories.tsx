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
import { Button, Chip, TextField } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import DataGridX from './DataGridX';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const meta = {
  title: 'Components/DataGrid/DataGridX',
  component: DataGridX,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <DndProvider backend={HTML5Backend}>
        <div style={{ height: '600px', width: '100%' }}>
          <Story />
        </div>
      </DndProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof DataGridX>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleColumns: GridColDef[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: 70,
  },
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
  },
  {
    field: 'email',
    headerName: 'Email',
    width: 250,
  },
  {
    field: 'role',
    headerName: 'Role',
    width: 150,
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
  },
  {
    field: 'createdAt',
    headerName: 'Created At',
    width: 180,
  },
];

const sampleRows = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Admin',
    status: 'Active',
    createdAt: '2024-01-15',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    role: 'User',
    status: 'Active',
    createdAt: '2024-02-20',
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    role: 'Editor',
    status: 'Inactive',
    createdAt: '2024-03-10',
  },
  {
    id: 4,
    name: 'Alice Williams',
    email: 'alice.williams@example.com',
    role: 'User',
    status: 'Active',
    createdAt: '2024-04-05',
  },
  {
    id: 5,
    name: 'Charlie Brown',
    email: 'charlie.brown@example.com',
    role: 'Admin',
    status: 'Active',
    createdAt: '2024-05-12',
  },
];

export const Basic: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
  },
};

export const WithLoading: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    loading: true,
  },
};

export const WithColumnCustomization: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    staticVisibleColumns: ['id', 'name'],
    defaultVisibleColumns: ['id', 'name', 'email', 'role'],
    entityType: 'users',
  },
};

export const WithSearch: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    searchProps: {
      options: ['John Doe', 'Jane Smith', 'Bob Johnson'],
      renderInput: (params) => <TextField {...params} placeholder="Search..." />,
      freeSolo: true,
      size: 'small',
    },
  },
};

export const WithExtraFilters: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    extraTableFilters: (
      <>
        <Chip label="Active" size="small" color="primary" />
        <Chip label="Inactive" size="small" variant="outlined" />
        <Button size="small" variant="outlined">
          Export
        </Button>
      </>
    ),
  },
};

export const WithResizableColumns: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    resizableColumns: true,
  },
};

export const WithSearchAndFilters: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    searchProps: {
      options: ['John Doe', 'Jane Smith', 'Bob Johnson'],
      renderInput: (params) => <TextField {...params} placeholder="Search users..." />,
      freeSolo: true,
      size: 'small',
    },
    extraTableFilters: (
      <>
        <Chip label="Active" size="small" color="success" />
        <Chip label="All" size="small" variant="outlined" />
      </>
    ),
    staticVisibleColumns: ['id', 'name'],
    defaultVisibleColumns: ['id', 'name', 'email', 'role', 'status'],
    entityType: 'users',
  },
};

export const WithPagination: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    pagination: true,
    pageSizeOptions: [5, 10, 25],
    initialState: {
      pagination: { paginationModel: { pageSize: 5 } },
    },
  },
};

export const Empty: Story = {
  args: {
    columns: sampleColumns,
    rows: [],
  },
};

export const LargeDataset: Story = {
  args: {
    columns: sampleColumns,
    rows: Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `User ${index + 1}`,
      email: `user${index + 1}@example.com`,
      role: ['Admin', 'User', 'Editor'][index % 3],
      status: index % 2 === 0 ? 'Active' : 'Inactive',
      createdAt: `2024-${String(Math.floor(index / 30) + 1).padStart(2, '0')}-${String((index % 30) + 1).padStart(2, '0')}`,
    })),
    pagination: true,
    pageSizeOptions: [10, 25, 50, 100],
    initialState: {
      pagination: { paginationModel: { pageSize: 10 } },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    containerClassName: 'custom-table',
    sx: {
      '& .MuiDataGrid-cell': {
        borderBottom: '1px solid #e0e0e0',
      },
      '& .MuiDataGrid-columnHeaders': {
        backgroundColor: '#f5f5f5',
        fontWeight: 'bold',
      },
    },
  },
};

export const WithSorting: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    initialState: {
      sorting: {
        sortModel: [{ field: 'name', sort: 'asc' }],
      },
    },
  },
};

export const WithCheckboxSelection: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    checkboxSelection: true,
  },
};

export const FullFeatured: Story = {
  args: {
    columns: sampleColumns,
    rows: sampleRows,
    checkboxSelection: true,
    resizableColumns: true,
    pagination: true,
    pageSizeOptions: [5, 10, 25],
    searchProps: {
      options: sampleRows.map((row) => row.name),
      renderInput: (params) => <TextField {...params} placeholder="Search by name..." />,
      freeSolo: true,
      size: 'small',
    },
    extraTableFilters: (
      <>
        <Chip label="Active" size="small" color="success" />
        <Chip label="Inactive" size="small" color="default" />
        <Button size="small" variant="contained">
          Export
        </Button>
      </>
    ),
    staticVisibleColumns: ['id', 'name'],
    defaultVisibleColumns: ['id', 'name', 'email', 'role', 'status'],
    entityType: 'users',
    initialState: {
      pagination: { paginationModel: { pageSize: 5 } },
    },
  },
};
