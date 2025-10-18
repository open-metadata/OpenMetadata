'use client';

import { 
  Book, Target, TrendingUp, Database, DollarSign, 
  AlertTriangle, CheckCircle, Clock, Trash2, BarChart3, 
  Info, ArrowRight 
} from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function Help() {
  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl">
          <Book className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold">
          <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
            ZeroExplain
          </span> Guide
        </h1>
        <p className="text-muted-foreground">Human-readable insight narration for ZeroIndex Score and optimization strategies</p>
      </div>

      {/* ZI Score Section */}
      <Card className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              ZeroIndex
            </span> Score
          </h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">What is ZeroIndex Score?</h3>
            <p className="text-muted-foreground leading-relaxed">
              The ZeroIndex Score is a comprehensive health index and KPI evaluation metric that measures the overall 
              efficiency of your data infrastructure. It provides a single autonomous score from 0-100 representing 
              how well your data ecosystem is performing across multiple intelligence dimensions.
            </p>
            
            <Card className="p-4">
              <h4 className="text-lg font-semibold mb-3">Score Ranges:</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm"><strong>80-100:</strong> Excellent - Highly optimized</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm"><strong>60-79:</strong> Good - Some optimization needed</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm"><strong>40-59:</strong> Fair - Significant improvements required</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm"><strong>0-39:</strong> Poor - Immediate action required</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">ZeroIndex Components</h3>
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  <span className="font-semibold">Compute Efficiency</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Measures CPU and memory utilization, query performance, and resource allocation efficiency.
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-5 h-5 text-cyan-500" />
                  <span className="font-semibold">Storage Optimization</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Evaluates storage usage patterns, data compression, and unused table identification.
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <span className="font-semibold">Query Performance</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Analyzes query execution times, frequency patterns, and optimization opportunities.
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-yellow-500" />
                  <span className="font-semibold">Cost Efficiency</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tracks spending patterns, identifies cost anomalies, and suggests savings opportunities.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </Card>

      {/* Purge Score Section */}
      <Card className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold">Purge Score</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Understanding Purge Scores</h3>
            <p className="text-muted-foreground leading-relaxed">
              The Purge Score is a risk assessment metric (0-10) that indicates how safe it is to delete or 
              optimize a particular table or dataset. Higher scores indicate safer candidates for purging or optimization.
            </p>

            <Card className="p-4">
              <h4 className="text-lg font-semibold mb-3">Factors Considered:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary" />
                  <span>Last access date and frequency</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary" />
                  <span>Number of active users</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary" />
                  <span>Query patterns and dependencies</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary" />
                  <span>Data freshness and update frequency</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary" />
                  <span>Business criticality indicators</span>
                </li>
              </ul>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Purge Score Categories</h3>
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-semibold">Safe to Purge (9-10)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tables with minimal risk - no recent activity, no active users, and no critical dependencies.
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  <span className="font-semibold">Convert to Transient (8-9)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Medium-risk tables suitable for conversion to Snowflake transient tables to reduce costs.
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <span className="font-semibold">Review Required (7-8)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tables requiring manual review before any optimization actions are taken.
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-red-500" />
                  <span className="font-semibold">Keep Active (0-7)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Critical tables with active usage patterns that should not be modified or deleted.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </Card>

      {/* Best Practices Section */}
      <Card className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold">Best Practices</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Monitoring & Maintenance</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Regular ZeroIndex Reviews</p>
                  <p className="text-sm text-muted-foreground">Monitor your ZeroIndex Score weekly and investigate any significant drops</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Automated Purge Policies</p>
                  <p className="text-sm text-muted-foreground">Set up automated policies for tables with purge scores ≥ 9</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Cost Monitoring</p>
                  <p className="text-sm text-muted-foreground">Track monthly costs and savings opportunities regularly</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Optimization Strategy</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Start with High-Impact Items</p>
                  <p className="text-sm text-muted-foreground">Focus on action items with the highest cost savings potential first</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Gradual Implementation</p>
                  <p className="text-sm text-muted-foreground">Implement changes gradually and monitor impact on system performance</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Stakeholder Communication</p>
                  <p className="text-sm text-muted-foreground">Communicate with data owners before making significant changes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Need additional help? Contact your system administrator or data engineering team.
        </p>
      </div>
    </div>
  );
}

