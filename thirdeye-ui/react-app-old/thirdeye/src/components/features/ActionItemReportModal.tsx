import React from 'react';
import GlassCard from '../ui/GlassCard';

interface ActionItemReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const ActionItemReportModal: React.FC<ActionItemReportModalProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-7xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <GlassCard className="flex flex-col min-h-[80vh] max-h-none">
          <div className="flex flex-col h-full">
            {children}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default ActionItemReportModal;
