import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AnimatedButton from '../ui/AnimatedButton';

interface ActionItemReportPaginationProps {
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
  totalCount: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onSetPageIndex: (pageIndex: number) => void;
}

const ActionItemReportPagination: React.FC<ActionItemReportPaginationProps> = ({
  pagination,
  totalCount,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  onSetPageIndex,
}) => {
  return (
    <div className="p-6 border-t border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>
            Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
            {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount || 0)} of{' '}
            {totalCount || 0} results
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AnimatedButton
            variant="secondary"
            size="small"
            onClick={onPreviousPage}
            disabled={!canPreviousPage}
          >
            <ChevronLeft size={16} />
            Previous
          </AnimatedButton>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
              const pageIndex = Math.max(0, pagination.pageIndex - 2) + i;
              if (pageIndex >= pageCount) return null;
              
              return (
                <button
                  key={pageIndex}
                  onClick={() => onSetPageIndex(pageIndex)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    pageIndex === pagination.pageIndex
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {pageIndex + 1}
                </button>
              );
            })}
          </div>
          <AnimatedButton
            variant="secondary"
            size="small"
            onClick={onNextPage}
            disabled={!canNextPage}
          >
            Next
            <ChevronRight size={16} />
          </AnimatedButton>
        </div>
      </div>
    </div>
  );
};

export default ActionItemReportPagination;
