import React from 'react';
import { Search, Filter, Download } from 'lucide-react';
import AnimatedButton from '../ui/AnimatedButton';

interface ActionItemReportControlsProps {
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  totalCount: number;
}

const ActionItemReportControls: React.FC<ActionItemReportControlsProps> = ({
  globalFilter,
  onGlobalFilterChange,
  totalCount,
}) => {
  return (
    <div className="p-6 border-b border-white/10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tables..."
              value={globalFilter ?? ''}
              onChange={(e) => onGlobalFilterChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
          </div>
          <AnimatedButton variant="secondary" size="small">
            <Filter size={16} />
            Filters
          </AnimatedButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {totalCount || 0} records
          </span>
          <AnimatedButton variant="secondary" size="small">
            <Download size={16} />
            Export
          </AnimatedButton>
        </div>
      </div>
    </div>
  );
};

export default ActionItemReportControls;
