import React, { useState } from 'react';
import { 
  Database, 
  Cpu, 
  Search, 
  MoreHorizontal,
  BarChart3,
  TrendingUp,
  Activity,
  Settings
} from 'lucide-react';
import InsightsReport from './InsightsReport';

const Insights: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const reportOptions = [
    {
      id: 'storage',
      title: 'Storage Analysis',
      description: 'Analyze storage usage patterns, table sizes, and optimization opportunities',
      icon: Database,
      color: 'from-purple-500 to-purple-600',
      stats: 'Table storage and usage metrics'
    },
    {
      id: 'compute',
      title: 'Compute Performance',
      description: 'Review compute resource utilization and performance metrics',
      icon: Cpu,
      color: 'from-cyan-500 to-cyan-600',
      stats: 'CPU and memory utilization data'
    },
    {
      id: 'query',
      title: 'Query Analytics',
      description: 'Examine query patterns, performance, and optimization opportunities',
      icon: Search,
      color: 'from-green-500 to-green-600',
      stats: 'Query execution and frequency metrics'
    },
    {
      id: 'other',
      title: 'Other Metrics',
      description: 'Additional data lake metrics and miscellaneous analytics',
      icon: MoreHorizontal,
      color: 'from-orange-500 to-orange-600',
      stats: 'Miscellaneous data lake metrics'
    }
  ];

  const handleReportClick = (reportId: string) => {
    setSelectedReport(reportId);
    setIsReportOpen(true);
  };

  const handleCloseReport = () => {
    setIsReportOpen(false);
    setSelectedReport(null);
  };

  const getReportTitle = (reportId: string) => {
    const report = reportOptions.find(r => r.id === reportId);
    return report?.title || 'Report';
  };

  const getReportDescription = (reportId: string) => {
    const report = reportOptions.find(r => r.id === reportId);
    return report?.description || 'Detailed analytics report';
  };

  return (
    <div className="min-h-screen p-8 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl mb-4">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Data Lake Insights
          </h1>
        </div>

        {/* Report Options Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {reportOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <div
                key={option.id}
                className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer group"
                onClick={() => handleReportClick(option.id)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                      {option.title}
                    </h3>
                    <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                      {option.description}
                    </p>
                    <div className="flex items-center text-xs text-gray-400">
                      <Activity className="w-3 h-3 mr-1" />
                      <span>{option.stats}</span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Click to view detailed report</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-green-400">Available</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats Overview */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-4">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Report Overview</h2>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">4</div>
              <div className="text-sm text-gray-300">Report Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400 mb-1">∞</div>
              <div className="text-sm text-gray-300">Data Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">Real-time</div>
              <div className="text-sm text-gray-300">Data Updates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400 mb-1">Advanced</div>
              <div className="text-sm text-gray-300">Analytics</div>
            </div>
          </div>
        </div>

      </div>

      {/* Insights Report Modal */}
      {selectedReport && (
        <InsightsReport
          reportType={selectedReport as 'storage' | 'compute' | 'query' | 'other'}
          reportTitle={getReportTitle(selectedReport)}
          reportDescription={getReportDescription(selectedReport)}
          isOpen={isReportOpen}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
};

export default Insights;
