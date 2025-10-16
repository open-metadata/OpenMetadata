import { AlertCircle, Trash2, Clock, Eye, DollarSign, Ghost, RefreshCw, HardDrive, CalendarX, Cpu, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import GlassCard from '../ui/GlassCard';
import AnimatedButton from '../ui/AnimatedButton';
import ActionItemReport from './ActionItemReport';
import ErrorBoundary from '../ui/ErrorBoundary';
import { trpc } from '../../lib/trpc-client';
import './ActionItems.css';

const ActionItems = () => {
  const { data: actionItemsData, isLoading, error } = trpc.actionItems.getActionItems.useQuery();
  
  // State for report modal
  const [reportState, setReportState] = useState<{
    isOpen: boolean;
    actionItemId: string | null;
    actionItemTitle: string;
    actionItemDescription: string;
  }>({
    isOpen: false,
    actionItemId: null,
    actionItemTitle: '',
    actionItemDescription: '',
  });

  const handleDetailsClick = (item: any) => {
    console.log('🔍 Details clicked for item:', { 
      id: item.id, 
      title: item.title,
      fullItem: item 
    });
    setReportState({
      isOpen: true,
      actionItemId: item.id,
      actionItemTitle: item.title,
      actionItemDescription: item.description,
    });
  };

  const handleCloseReport = () => {
    setReportState({
      isOpen: false,
      actionItemId: null,
      actionItemTitle: '',
      actionItemDescription: '',
    });
  };
  
  // Handle potential data wrapping (tRPC with superjson might wrap data)
  const rawData = actionItemsData?.json || actionItemsData;
  
  // Extract action items from the response
  const actionItems = rawData?.actionItems || [];
  const totalItems = rawData?.totalItems || 0;
  const pendingItems = rawData?.pendingItems || 0;

  const getUrgencyColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'action-items__urgency--high';
      case 'medium':
        return 'action-items__urgency--medium';
      case 'low':
        return 'action-items__urgency--low';
      default:
        return 'action-items__urgency--medium';
    }
  };

  const getIcon = (iconName) => {
    const iconProps = { size: 18, className: "text-blue-400" };
    
    switch (iconName) {
      case 'trash-2':
        return <Trash2 {...iconProps} />;
      case 'clock':
        return <Clock {...iconProps} />;
      case 'eye':
        return <Eye {...iconProps} />;
      case 'dollar-sign':
        return <DollarSign {...iconProps} />;
      case 'ghost':
        return <Ghost {...iconProps} />;
      case 'refresh-cw':
        return <RefreshCw {...iconProps} />;
      case 'hard-drive':
        return <HardDrive {...iconProps} />;
      case 'calendar-x':
        return <CalendarX {...iconProps} />;
      case 'cpu':
        return <Cpu {...iconProps} />;
      case 'trending-down':
        return <TrendingDown {...iconProps} />;
      default:
        return <AlertCircle {...iconProps} />;
    }
  };

  if (isLoading) {
    return (
      <div className="action-items">
        <div className="action-items__header flex items-center">
          <div className="action-items__header-icon">
            <AlertCircle />
          </div>
          <h2 className="action-items__title">Action Items</h2>
        </div>
        <div className="text-center text-gray-400 py-8">Loading action items...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="action-items">
        <div className="action-items__header">
          <AlertCircle className="action-items__header-icon" />
          <h2 className="action-items__title">Action Items</h2>
        </div>
        <div className="text-center text-red-400 py-8">Error loading action items: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="action-items">
      <div className="action-items__header">
        <AlertCircle className="action-items__header-icon" />
        <h2 className="action-items__title">
          Actions
        </h2>
      </div>

      <div className="action-items__grid">
        {actionItems.map((item, index) => (
          <GlassCard key={item.id || index} className="action-items__card" hover>
            <div className="action-items__card-content">
              <div className="action-items__card-header">
                <div className="flex items-center gap-2">
                  {getIcon(item.icon)}
                  <h3 className="action-items__card-title">{item.title}</h3>
                </div>
                <div className={`action-items__urgency ${getUrgencyColor(item.priority)}`} />
              </div>
              
              <p className="action-items__card-subtitle">{item.description}</p>
              
              <div className="action-items__card-detail">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-green-400">
                    ${item.cost ? item.cost.toLocaleString() : '0'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {item.count ? `${parseInt(item.count).toLocaleString()} tables` : 'No data'}
                  </span>
                </div>
                <span className="text-xs text-gray-400 mt-1">• {item.category} • {item.subtitle}</span>
              </div>
              
              <div className="action-items__card-actions">
                {(item.action === 'DELETE' || item.action === 'CONVERT_TRANSIENT') && (
                  <AnimatedButton variant="primary" size="small">
                    {item.action === 'DELETE' ? 'Purge' : 'Convert'}
                  </AnimatedButton>
                )}
                <AnimatedButton 
                  variant="secondary" 
                  size="small"
                  onClick={() => handleDetailsClick(item)}
                >
                  Details
                </AnimatedButton>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {actionItems.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No action items available at the moment.
        </div>
      )}

      {/* Action Item Report Modal */}
      {reportState.isOpen && reportState.actionItemId && (
        <ErrorBoundary>
          <ActionItemReport
            actionItemId={reportState.actionItemId}
            actionItemTitle={reportState.actionItemTitle}
            actionItemDescription={reportState.actionItemDescription}
            isOpen={reportState.isOpen}
            onClose={handleCloseReport}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default ActionItems;
