import React from 'react';
import { X, Database } from 'lucide-react';

interface ActionItemReportHeaderProps {
  title: string;
  description: string;
  onClose: () => void;
}

const ActionItemReportHeader: React.FC<ActionItemReportHeaderProps> = ({
  title,
  description,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between p-6 border-b border-white/10">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center border border-white/10">
          <Database className="text-blue-400" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {title}
          </h2>
          <p className="text-gray-400 text-sm">
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <X size={24} className="text-gray-400" />
      </button>
    </div>
  );
};

export default ActionItemReportHeader;
