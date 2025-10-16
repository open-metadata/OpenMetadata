'use client';

import { Database, Users, Activity, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import KpiCard from '@/components/ui/KpiCard';
import StackedBar from '@/components/data/StackedBar';
import BasicTable from '@/components/data/BasicTable';

// Mock data
const workloadData = [
  { name: 'Mon', running: 12, completed: 8, failed: 2 },
  { name: 'Tue', running: 15, completed: 10, failed: 1 },
  { name: 'Wed', running: 18, completed: 12, failed: 3 },
  { name: 'Thu', running: 14, completed: 15, failed: 2 },
  { name: 'Fri', running: 20, completed: 18, failed: 1 },
  { name: 'Sat', running: 8, completed: 6, failed: 0 },
  { name: 'Sun', running: 10, completed: 8, failed: 1 },
];

const recentActivity = [
  { id: 1, action: 'Pipeline completed', resource: 'sales_data_pipeline', time: '2 minutes ago', status: 'success' },
  { id: 2, action: 'New connection added', resource: 'snowflake_prod', time: '15 minutes ago', status: 'info' },
  { id: 3, action: 'Alert triggered', resource: 'user_activity_dashboard', time: '1 hour ago', status: 'warning' },
  { id: 4, action: 'Data quality check failed', resource: 'customer_data', time: '2 hours ago', status: 'error' },
  { id: 5, action: 'Scheduled backup completed', resource: 'analytics_db', time: '3 hours ago', status: 'success' },
];

const workloadTableData = [
  { id: 1, name: 'Sales Data Pipeline', status: 'Running', duration: '2h 15m', lastRun: '2 minutes ago', nextRun: 'In 6 hours' },
  { id: 2, name: 'User Analytics ETL', status: 'Completed', duration: '45m', lastRun: '1 hour ago', nextRun: 'Tomorrow 6:00 AM' },
  { id: 3, name: 'Financial Reports', status: 'Failed', duration: '1h 30m', lastRun: '3 hours ago', nextRun: 'Retry in 2 hours' },
  { id: 4, name: 'Data Quality Checks', status: 'Running', duration: '15m', lastRun: '15 minutes ago', nextRun: 'In 4 hours' },
  { id: 5, name: 'Backup Process', status: 'Scheduled', duration: '2h', lastRun: 'Yesterday', nextRun: 'Tonight 11:00 PM' },
];

const tableColumns = [
  { key: 'name', header: 'Workload Name' },
  { 
    key: 'status', 
    header: 'Status',
    render: (value: string) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        value === 'Running' ? 'bg-blue-100 text-blue-800' :
        value === 'Completed' ? 'bg-green-100 text-green-800' :
        value === 'Failed' ? 'bg-red-100 text-red-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {value}
      </span>
    )
  },
  { key: 'duration', header: 'Duration' },
  { key: 'lastRun', header: 'Last Run' },
  { key: 'nextRun', header: 'Next Run' },
];

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening with your ZeroHuman data infrastructure.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          title="Total Services" 
          value="24" 
          change={{ value: 12, isPositive: true }} 
          icon={<Database className="h-4 w-4" />} 
        />
        <KpiCard 
          title="Active Users" 
          value="156" 
          change={{ value: 8, isPositive: true }} 
          icon={<Users className="h-4 w-4" />} 
        />
        <KpiCard 
          title="Queries Today" 
          value="1,247" 
          change={{ value: 23, isPositive: false }} 
          icon={<Activity className="h-4 w-4" />} 
        />
        <KpiCard 
          title="Success Rate" 
          value="98.2%" 
          change={{ value: 0.5, isPositive: true }} 
          icon={<TrendingUp className="h-4 w-4" />} 
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Workload Status Chart */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Workload Status (Last 7 Days)</h3>
          <StackedBar data={workloadData} height={300} />
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === 'success' ? 'bg-green-500' :
                  activity.status === 'warning' ? 'bg-yellow-500' :
                  activity.status === 'error' ? 'bg-red-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-gray-600">{activity.resource}</p>
                </div>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Workloads Table */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Active Workloads</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>All systems operational</span>
          </div>
        </div>
        <BasicTable data={workloadTableData} columns={tableColumns} />
      </div>
    </div>
  );
}
