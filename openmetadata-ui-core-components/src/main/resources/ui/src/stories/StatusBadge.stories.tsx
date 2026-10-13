/*
 *  Copyright 2025 Collate.
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
import type { BadgeColors } from '../components/base/badges/badge-types';
import { Badge } from '../components/base/badges/badges';

/**
 * Reference for the app `StatusBadge` migration: each domain status maps to a
 * core `Badge` (utility-scale) color. The utility palette auto-flips in dark,
 * so toggling the Storybook theme verifies every status in both modes. Keep
 * this list in sync with `STATUS_TYPE_TO_BADGE_COLOR` in the app.
 */
const STATUS_TO_COLOR: { status: string; color: BadgeColors }[] = [
  { status: 'success', color: 'success' },
  { status: 'warning', color: 'warning' },
  { status: 'pending', color: 'warning' },
  { status: 'failure', color: 'error' },
  { status: 'stopped', color: 'error' },
  { status: 'activeError', color: 'error' },
  { status: 'aborted', color: 'orange' },
  { status: 'running', color: 'brand' },
  { status: 'acknowledged', color: 'blue' },
  { status: 'started', color: 'purple' },
  { status: 'inReview', color: 'purple' },
  { status: 'version', color: 'purple' },
  { status: 'deprecated', color: 'gray' },
  { status: 'archived', color: 'gray' },
  { status: 'unprocessed', color: 'gray' },
];

const meta = {
  title: 'Components/StatusBadge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StatusColorMapping: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 520 }}>
      {STATUS_TO_COLOR.map(({ status, color }) => (
        <Badge color={color} key={status} size="sm" type="color">
          {status}
        </Badge>
      ))}
    </div>
  ),
};
