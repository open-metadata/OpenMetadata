'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StackedBarProps {
  data: Array<{
    name: string;
    success: number;
    failed: number;
    pending: number;
  }>;
  height?: number;
}

export default function StackedBar({ data, height = 300 }: StackedBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="success" stackId="a" fill="#22c55e" name="Success" />
        <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
        <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
      </BarChart>
    </ResponsiveContainer>
  );
}
