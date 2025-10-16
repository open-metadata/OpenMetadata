import React, { useState } from 'react';
import { SortingState, ColumnFiltersState } from '@tanstack/react-table';
import { trpc } from '../../lib/trpc-client';
import ActionItemReportModal from './ActionItemReportModal';
import ActionItemReportHeader from './ActionItemReportHeader';
import ActionItemReportControls from './ActionItemReportControls';
import ActionItemDataTable from './ActionItemDataTable';
import ActionItemReportPagination from './ActionItemReportPagination';

interface ActionItemReportProps {
  actionItemId: string;
  actionItemTitle: string;
  actionItemDescription: string;
  isOpen: boolean;
  onClose: () => void;
}

const ActionItemReport: React.FC<ActionItemReportProps> = ({
  actionItemId,
  actionItemTitle,
  actionItemDescription,
  isOpen,
  onClose,
}) => {
  // Early return if not open or no actionItemId
  if (!isOpen || !actionItemId) {
    return null;
  }

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });

  // Fetch data using tRPC
  const { data, isLoading, error } = trpc.actionItems.getActionItemTables.useQuery(
    {
      actionItemId: actionItemId,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    {
      enabled: !!actionItemId && actionItemId.trim() !== '',
      retry: 1,
      refetchOnWindowFocus: false,
      // Force refetch when actionItemId changes
      refetchOnMount: true,
      staleTime: 0, // Always consider data stale
    }
  );

  // Debug the query parameters
  React.useEffect(() => {
    console.log('🔍 ActionItemReport Query parameters:', {
      actionItemId,
      isOpen,
      enabled: isOpen && !!actionItemId && actionItemId.trim() !== '',
      queryParams: {
        actionItemId: actionItemId || '',
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      }
    });
  }, [actionItemId, isOpen, pagination]);

  // Log data reception for monitoring
  React.useEffect(() => {
    if (data) {
      console.log('📋 Report data loaded:', {
        actionItemId,
        totalCount: data.totalCount,
        tablesCount: data.tables?.length,
        firstTable: data.tables?.[0],
        isLoading,
        error: error?.message
      });
    }
    if (isLoading) {
      console.log('⏳ Report loading...', { actionItemId });
    }
    if (error) {
      console.log('❌ Report error:', { actionItemId, error: error.message });
    }
  }, [data, actionItemId, isLoading, error]);

  // Calculate table props for react-table
  const totalCount = data?.json?.totalCount || data?.totalCount || 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pagination.pageSize) : 0;
  const canPreviousPage = pagination.pageIndex > 0;
  const canNextPage = pagination.pageIndex < pageCount - 1;

  const handlePreviousPage = () => {
    if (canPreviousPage) {
      setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }));
    }
  };

  const handleNextPage = () => {
    if (canNextPage) {
      setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }));
    }
  };

  const handleSetPageIndex = (pageIndex: number) => {
    setPagination(prev => ({ ...prev, pageIndex }));
  };

  return (
    <ActionItemReportModal isOpen={isOpen} onClose={onClose}>
      <ActionItemReportHeader
        title={actionItemTitle}
        description={actionItemDescription}
        onClose={onClose}
      />

      <ActionItemReportControls
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        totalCount={data?.json?.totalCount || data?.totalCount || 0}
      />

      <ActionItemDataTable
        data={data?.json?.tables || data?.tables || []}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        globalFilter={globalFilter}
        pagination={pagination}
        onPaginationChange={setPagination}
        totalCount={data?.json?.totalCount || data?.totalCount || 0}
        isLoading={isLoading}
        error={error}
      />


      <ActionItemReportPagination
        pagination={pagination}
        totalCount={totalCount}
        pageCount={pageCount}
        canPreviousPage={canPreviousPage}
        canNextPage={canNextPage}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
        onSetPageIndex={handleSetPageIndex}
      />
    </ActionItemReportModal>
  );
};

export default ActionItemReport;
