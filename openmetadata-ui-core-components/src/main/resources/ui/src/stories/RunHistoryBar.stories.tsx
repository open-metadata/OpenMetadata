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
import {
  RunHistoryBar,
  RunHistoryItem,
  RunHistoryStatus,
} from '../components/base/progress-indicators/run-history-bar';

const toRuns = (statuses: RunHistoryStatus[]): RunHistoryItem[] =>
  statuses.map((status, index) => ({
    label: `Run ${index + 1} · ${status}`,
    status,
  }));

const meta = {
  title: 'Components/RunHistoryBar',
  component: RunHistoryBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RunHistoryBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ariaLabel: 'Last 10 runs: 7 successful, 3 failed',
    runs: toRuns([
      'success',
      'success',
      'failed',
      'success',
      'failed',
      'success',
      'success',
      'success',
      'success',
      'failed',
    ]),
  },
};

export const AllStatuses: Story = {
  args: {
    ariaLabel: 'One run of every status',
    max: 5,
    runs: toRuns(['success', 'failed', 'skipped', 'running', 'pending']),
  },
};

export const FewerRunsThanSlots: Story = {
  args: {
    ariaLabel: 'Last 3 runs: 3 successful',
    runs: toRuns(['success', 'success', 'success']),
  },
};
