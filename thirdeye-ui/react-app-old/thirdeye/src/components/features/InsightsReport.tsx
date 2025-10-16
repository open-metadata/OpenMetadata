import React, { useState } from 'react';
import { SortingState, ColumnFiltersState } from '@tanstack/react-table';
import { trpc } from '../../lib/trpc-client';
import ActionItemReportModal from './ActionItemReportModal';
import ActionItemReportHeader from './ActionItemReportHeader';
import ActionItemReportControls from './ActionItemReportControls';
import ActionItemDataTable from './ActionItemDataTable';
import ActionItemReportPagination from './ActionItemReportPagination';

interface InsightsReportProps {
  reportType: 'storage' | 'compute' | 'query' | 'other';
  reportTitle: string;
  reportDescription: string;
  isOpen: boolean;
  onClose: () => void;
}

const InsightsReport: React.FC<InsightsReportProps> = ({
  reportType,
  reportTitle,
  reportDescription,
  isOpen,
  onClose,
}) => {
  // Early return if not open
  if (!isOpen) {
    return null;
  }

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });

  // Fetch data using tRPC insights endpoint
  const { data, isLoading, error } = trpc.insights.getInsightReport.useQuery(
    {
      reportType: reportType,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    {
      enabled: isOpen,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      staleTime: 0,
    }
  );

  // Debug the query parameters
  React.useEffect(() => {
    console.log('🔍 InsightsReport Query parameters:', {
      reportType,
      isOpen,
      queryParams: {
        reportType,
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      }
    });
  }, [reportType, isOpen, pagination]);

  // Log data reception for monitoring
  React.useEffect(() => {
    if (data) {
      console.log('📋 Insights report data loaded:', {
        reportType,
        totalCount: data.totalCount,
        tablesCount: data.tables?.length,
        firstTable: data.tables?.[0],
        isLoading,
        error: error?.message
      });
    }
    if (isLoading) {
      console.log('⏳ Insights report loading...', { reportType });
    }
    if (error) {
      console.log('❌ Insights report error:', { reportType, error: error.message });
    }
  }, [data, reportType, isLoading, error]);

  // Calculate table props for react-table
  const totalCount = data?.totalCount || 0;
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
        title={reportTitle}
        description={reportDescription}
        onClose={onClose}
      />

      <ActionItemReportControls
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        totalCount={data?.totalCount || 0}
      />

      <ActionItemDataTable
        data={data?.tables || []}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        globalFilter={globalFilter}
        pagination={pagination}
        onPaginationChange={setPagination}
        totalCount={data?.totalCount || 0}
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

export default InsightsReport;
