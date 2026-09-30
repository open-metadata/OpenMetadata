/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import {
  AreaChart,
  BarChart,
  ComposedChart,
  EChart,
  LineChart,
  PieChart,
} from '../charts';

const meta = {
  title: 'Charts/Overview',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const runs = DAYS.map((day, i) => ({
  day,
  success: 40 + ((i * 7) % 13),
  failed: 3 + ((i * 5) % 6),
  aborted: (i * 3) % 4,
}));

const runtime = Array.from({ length: 30 }, (_, i) => ({
  ts: Date.UTC(2026, 8, 1 + i),
  p50: 120 + Math.round(20 * Math.sin(i / 3)),
  p95: 260 + Math.round(40 * Math.cos(i / 4)),
}));

const completeness = [
  { field: 'Description', delta: 12 },
  { field: 'Owners', delta: -4 },
  { field: 'Tags', delta: 7 },
  { field: 'Glossary terms', delta: -9 },
  { field: 'Domain', delta: 3 },
];

const cost = DAYS.map((day, i) => ({
  day,
  storage: 1200 + i * 150,
  compute: 800 + ((i * 230) % 700),
  queries: 30_000 + i * 4_500,
}));

const status = [
  { name: 'Success', value: 42, color: '#17b26a' },
  { name: 'Failed', value: 7, color: '#f04438' },
  { name: 'Aborted', value: 3, color: '#f79009' },
];

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ maxWidth: 720 }}>{children}</div>
);

export const Line: Story = {
  render: () => (
    <Frame>
      <LineChart
        ariaLabel="Pipeline runs per day"
        data={runs}
        series={[
          { key: 'success', name: 'Success' },
          { key: 'failed', name: 'Failed' },
          { key: 'aborted', name: 'Aborted' },
        ]}
        xKey="day"
        yAxis={{ label: 'Runs' }}
      />
    </Frame>
  ),
};

export const LineOnTimeAxisWithZoom: Story = {
  render: () => (
    <Frame>
      <LineChart
        ariaLabel="Runtime percentiles"
        data={runtime}
        series={[
          { key: 'p50', name: 'p50' },
          { key: 'p95', name: 'p95', showDots: true },
        ]}
        tooltip={{ valueFormatter: (value) => `${value}s` }}
        xAxis={{ type: 'time' }}
        xKey="ts"
        yAxis={{ label: 'Seconds' }}
        zoom="auto"
      />
    </Frame>
  ),
};

export const StackedArea: Story = {
  render: () => (
    <Frame>
      <AreaChart
        ariaLabel="Test case status over time"
        data={runs}
        legend={{ position: 'top' }}
        series={[
          {
            key: 'success',
            name: 'Success',
            stack: 'status',
            color: '#17b26a',
          },
          { key: 'failed', name: 'Failed', stack: 'status', color: '#f04438' },
          {
            key: 'aborted',
            name: 'Aborted',
            stack: 'status',
            color: '#f79009',
          },
        ]}
        xKey="day"
      />
    </Frame>
  ),
};

export const BarWithReferenceLine: Story = {
  render: () => (
    <Frame>
      <BarChart
        showValueLabels
        ariaLabel="Failed runs per day"
        data={runs}
        referenceLines={[{ axis: 'y', value: 5, label: 'Threshold' }]}
        series={[{ key: 'failed', name: 'Failed', color: '#f04438' }]}
        xKey="day"
      />
    </Frame>
  ),
};

export const HorizontalDivergingBar: Story = {
  render: () => (
    <Frame>
      <BarChart
        ariaLabel="Completeness change by field"
        data={completeness}
        getBarColor={(row) => (row.delta < 0 ? '#f04438' : '#17b26a')}
        layout="horizontal"
        referenceLines={[{ axis: 'x', value: 0 }]}
        series={[{ key: 'delta', name: 'Change' }]}
        showValueLabels={(p) => `${p.value}%`}
        xKey="field"
      />
    </Frame>
  ),
};

export const ComposedTwoAxes: Story = {
  render: () => (
    <Frame>
      <ComposedChart
        ariaLabel="Cost and query volume"
        data={cost}
        series={[
          { key: 'storage', name: 'Storage ($)', type: 'bar', stack: 'cost' },
          { key: 'compute', name: 'Compute ($)', type: 'bar', stack: 'cost' },
          { key: 'queries', name: 'Queries', type: 'line', yAxisIndex: 1 },
        ]}
        xKey="day"
        yAxis={[{ label: 'Cost' }, { label: 'Queries' }]}
      />
    </Frame>
  ),
};

export const Pie: Story = {
  render: () => (
    <Frame>
      <PieChart showLabels ariaLabel="Test status" data={status} />
    </Frame>
  ),
};

export const DonutWithCentreLabel: Story = {
  render: () => (
    <Frame>
      <PieChart
        ariaLabel="Test status"
        centerLabel={
          <span className="tw:text-lg tw:font-semibold tw:text-primary">
            52 tests
          </span>
        }
        data={status}
        innerRadius="55%"
      />
    </Frame>
  ),
};

export const Empty: Story = {
  render: () => (
    <Frame>
      <LineChart
        ariaLabel="No runs"
        data={[]}
        series={[{ key: 'success', name: 'Success' }]}
        xKey="day"
      />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame>
      <BarChart
        loading
        ariaLabel="Loading runs"
        data={runs}
        series={[{ key: 'success', name: 'Success' }]}
        xKey="day"
      />
    </Frame>
  ),
};

export const RawEChart: Story = {
  render: () => (
    <Frame>
      <EChart
        ariaLabel="Raw ECharts option"
        option={(theme) => ({
          xAxis: {
            type: 'category',
            data: DAYS,
            axisLabel: { color: theme.axisTick },
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: theme.grid } },
          },
          series: [
            { type: 'bar', data: runs.map((r) => r.success) },
            { type: 'line', data: runs.map((r) => r.failed * 10) },
          ],
        })}
      />
    </Frame>
  ),
};

export const LightAndDark: Story = {
  parameters: { theme: 'both' },
  render: () => (
    <Frame>
      <LineChart
        ariaLabel="Pipeline runs per day"
        data={runs}
        series={[
          { key: 'success', name: 'Success' },
          { key: 'failed', name: 'Failed' },
        ]}
        xKey="day"
      />
    </Frame>
  ),
};
