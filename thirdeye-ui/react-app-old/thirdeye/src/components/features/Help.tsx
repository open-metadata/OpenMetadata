import React from 'react';
import { 
  Book, 
  Target, 
  TrendingUp, 
  Database, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  BarChart3,
  Info,
  ArrowRight
} from 'lucide-react';

const Help: React.FC = () => {
  return (
    <div className="min-h-screen p-8 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl mb-4">
            <Book className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Help Center
          </h1>
        </div>

        {/* ZI Score Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
              <Target className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">ZI Score (Zero Index)</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">What is ZI Score?</h3>
              <p className="text-gray-300 leading-relaxed">
                The ZI (Zero Index) Score is a comprehensive metric that measures the overall health and efficiency 
                of your data lake infrastructure. It provides a single score from 0-100 that represents how well 
                your data ecosystem is performing across multiple dimensions.
              </p>
              
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-2">Score Ranges:</h4>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-gray-300"><strong>80-100:</strong> Excellent - Highly optimized</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                    <span className="text-gray-300"><strong>60-79:</strong> Good - Some optimization needed</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                    <span className="text-gray-300"><strong>40-59:</strong> Fair - Significant improvements required</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                    <span className="text-gray-300"><strong>0-39:</strong> Poor - Immediate action required</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">ZI Score Components</h3>
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <BarChart3 className="w-5 h-5 text-purple-400 mr-2" />
                    <span className="font-semibold text-white">Compute Efficiency</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Measures CPU and memory utilization, query performance, and resource allocation efficiency.
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <Database className="w-5 h-5 text-cyan-400 mr-2" />
                    <span className="font-semibold text-white">Storage Optimization</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Evaluates storage usage patterns, data compression, and unused table identification.
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <TrendingUp className="w-5 h-5 text-green-400 mr-2" />
                    <span className="font-semibold text-white">Query Performance</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Analyzes query execution times, frequency patterns, and optimization opportunities.
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <DollarSign className="w-5 h-5 text-yellow-400 mr-2" />
                    <span className="font-semibold text-white">Cost Efficiency</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Tracks spending patterns, identifies cost anomalies, and suggests savings opportunities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Purge Score Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center mr-4">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">Purge Score</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">Understanding Purge Scores</h3>
              <p className="text-gray-300 leading-relaxed">
                The Purge Score is a risk assessment metric (0-10) that indicates how safe it is to delete or 
                optimize a particular table or dataset. Higher scores indicate safer candidates for purging or optimization.
              </p>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-3">Factors Considered:</h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 mt-1 mr-2 text-purple-400 flex-shrink-0" />
                    <span>Last access date and frequency</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 mt-1 mr-2 text-purple-400 flex-shrink-0" />
                    <span>Number of active users</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 mt-1 mr-2 text-purple-400 flex-shrink-0" />
                    <span>Query patterns and dependencies</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 mt-1 mr-2 text-purple-400 flex-shrink-0" />
                    <span>Data freshness and update frequency</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 mt-1 mr-2 text-purple-400 flex-shrink-0" />
                    <span>Business criticality indicators</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">Purge Score Categories</h3>
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                    <span className="font-semibold text-white">Safe to Purge (9-10)</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Tables with minimal risk - no recent activity, no active users, and no critical dependencies.
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <Clock className="w-5 h-5 text-yellow-400 mr-2" />
                    <span className="font-semibold text-white">Convert to Transient (8-9)</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Medium-risk tables suitable for conversion to Snowflake transient tables to reduce costs.
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400 mr-2" />
                    <span className="font-semibold text-white">Review Required (7-8)</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Tables requiring manual review before any optimization actions are taken.
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center mb-2">
                    <Info className="w-5 h-5 text-red-400 mr-2" />
                    <span className="font-semibold text-white">Keep Active (0-7)</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Critical tables with active usage patterns that should not be modified or deleted.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Items Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mr-4">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">Optimization Action Items</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Immediate Actions</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <Trash2 className="w-4 h-4 mt-1 mr-2 text-red-400 flex-shrink-0" />
                  <span>Safe to Purge tables</span>
                </li>
                <li className="flex items-start">
                  <Database className="w-4 h-4 mt-1 mr-2 text-purple-400 flex-shrink-0" />
                  <span>Zombie tables (no activity)</span>
                </li>
                <li className="flex items-start">
                  <DollarSign className="w-4 h-4 mt-1 mr-2 text-green-400 flex-shrink-0" />
                  <span>Most expensive tables</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Medium Priority</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <Clock className="w-4 h-4 mt-1 mr-2 text-yellow-400 flex-shrink-0" />
                  <span>Convert to transient</span>
                </li>
                <li className="flex items-start">
                  <BarChart3 className="w-4 h-4 mt-1 mr-2 text-cyan-400 flex-shrink-0" />
                  <span>Large unused tables</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="w-4 h-4 mt-1 mr-2 text-blue-400 flex-shrink-0" />
                  <span>Refresh waste optimization</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Long-term Planning</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <AlertTriangle className="w-4 h-4 mt-1 mr-2 text-orange-400 flex-shrink-0" />
                  <span>Review required tables</span>
                </li>
                <li className="flex items-start">
                  <Database className="w-4 h-4 mt-1 mr-2 text-purple-400 flex-shrink-0" />
                  <span>Stale table analysis</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="w-4 h-4 mt-1 mr-2 text-green-400 flex-shrink-0" />
                  <span>Automated query optimization</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Best Practices Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">Best Practices</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">Monitoring & Maintenance</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Regular ZI Score Reviews</p>
                    <p className="text-gray-300 text-sm">Monitor your ZI Score weekly and investigate any significant drops</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Automated Purge Policies</p>
                    <p className="text-gray-300 text-sm">Set up automated policies for tables with purge scores ≥ 9</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Cost Monitoring</p>
                    <p className="text-gray-300 text-sm">Track monthly costs and savings opportunities regularly</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">Optimization Strategy</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Start with High-Impact Items</p>
                    <p className="text-gray-300 text-sm">Focus on action items with the highest cost savings potential first</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Gradual Implementation</p>
                    <p className="text-gray-300 text-sm">Implement changes gradually and monitor impact on system performance</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Stakeholder Communication</p>
                    <p className="text-gray-300 text-sm">Communicate with data owners before making significant changes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-gray-400">
            Need additional help? Contact your system administrator or data engineering team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Help;
