import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Database,
  DollarSign,
  Calendar,
  HardDrive,
  TrendingUp
} from 'lucide-react';

interface TableRecord {
  FQN: string;
  DATABASE_NAME: string;
  DB_SCHEMA: string;
  TABLE_NAME: string;
  SIZE_GB: number;
  days_since_access: number;
  ROLL_30D_TBL_QC: number;
  ROLL_30D_TBL_UC: number;
  purge_score: number;
  monthly_cost_usd: number;
  LAST_ACCESSED_DATE: string;
  LAST_REFRESHED_DATE: string;
}

interface ActionItemDataTableProps {
  data: TableRecord[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: (filters: ColumnFiltersState) => void;
  globalFilter: string;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void;
  totalCount: number;
  isLoading: boolean;
  error: any;
}

const columnHelper = createColumnHelper<TableRecord>();

const ActionItemDataTable: React.FC<ActionItemDataTableProps> = ({
  data,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  globalFilter,
  pagination,
  onPaginationChange,
  totalCount,
  isLoading,
  error,
}) => {
  const columns = useMemo(
    () => [
      columnHelper.accessor('FQN', {
        header: ({ column }) => (
          <div className="flex items-center gap-2">
            <Database size={16} className="text-blue-400" />
            <button
              className="flex items-center gap-1 hover:text-blue-400 transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Fully Qualified Name
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp size={14} />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown size={14} />
              ) : (
                <ArrowUpDown size={14} />
              )}
            </button>
          </div>
        ),
        cell: ({ getValue }) => (
          <div className="font-mono text-sm text-blue-300 break-all">
            {getValue()}
          </div>
        ),
        size: 300,
      }),
      columnHelper.accessor('SIZE_GB', {
        header: ({ column }) => (
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-purple-400" />
            <button
              className="flex items-center gap-1 hover:text-purple-400 transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Size (GB)
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp size={14} />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown size={14} />
              ) : (
                <ArrowUpDown size={14} />
              )}
            </button>
          </div>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          return (
            <div className="text-right font-semibold">
              {value ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
            </div>
          );
        },
        size: 120,
      }),
      columnHelper.accessor('days_since_access', {
        header: ({ column }) => (
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-orange-400" />
            <button
              className="flex items-center gap-1 hover:text-orange-400 transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Days Since Access
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp size={14} />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown size={14} />
              ) : (
                <ArrowUpDown size={14} />
              )}
            </button>
          </div>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          const daysSince = value || 0;
          let colorClass = 'text-green-400';
          if (daysSince > 90) colorClass = 'text-red-400';
          else if (daysSince > 30) colorClass = 'text-yellow-400';
          
          return (
            <div className={`text-right font-semibold ${colorClass}`}>
              {daysSince > 0 ? daysSince.toLocaleString() : 'N/A'}
            </div>
          );
        },
        size: 150,
      }),
      columnHelper.accessor('monthly_cost_usd', {
        header: ({ column }) => (
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-green-400" />
            <button
              className="flex items-center gap-1 hover:text-green-400 transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Monthly Cost (USD)
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp size={14} />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown size={14} />
              ) : (
                <ArrowUpDown size={14} />
              )}
            </button>
          </div>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          return (
            <div className="text-right font-semibold text-green-400">
              ${value ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </div>
          );
        },
        size: 150,
      }),
      columnHelper.accessor('purge_score', {
        header: ({ column }) => (
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-cyan-400" />
            <button
              className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Purge Score
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp size={14} />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown size={14} />
              ) : (
                <ArrowUpDown size={14} />
              )}
            </button>
          </div>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          const score = value || 0;
          let colorClass = 'text-red-400';
          if (score >= 9) colorClass = 'text-green-400';
          else if (score >= 7) colorClass = 'text-yellow-400';
          
          return (
            <div className={`text-center font-bold ${colorClass}`}>
              {score.toFixed(1)}
            </div>
          );
        },
        size: 120,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange,
    onColumnFiltersChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: totalCount ? Math.ceil(totalCount / pagination.pageSize) : 0,
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto min-h-[400px]">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading table data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto min-h-[400px]">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-400 mb-2">Error loading data</p>
            <p className="text-gray-400 text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Debug logging to see what's happening
  console.log('🎯 ActionItemDataTable render:', {
    dataLength: data?.length || 0,
    dataType: typeof data,
    dataIsArray: Array.isArray(data),
    rawData: data,
    isLoading,
    error: error?.message,
    totalCount,
    tableRowsLength: table.getRowModel().rows.length
  });

  return (
    <div className="flex-1 overflow-auto min-h-[400px]">
      <div className="min-w-full">
        {data && data.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-400 mb-2">No data available</p>
              <p className="text-gray-500 text-sm">No tables match the current criteria</p>
            </div>
          </div>
        )}
        {data && data.length > 0 && (
          <table className="w-full">
            <thead className="sticky top-0 bg-black/40 backdrop-blur-sm border-b border-white/10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-300"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                    index % 2 === 0 ? 'bg-white/2' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 text-sm text-gray-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ActionItemDataTable;
