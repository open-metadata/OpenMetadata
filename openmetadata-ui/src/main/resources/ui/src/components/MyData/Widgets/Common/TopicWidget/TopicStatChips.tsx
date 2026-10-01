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

import { Button } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';

export type TopicStatTone = 'critical' | 'success' | 'muted';

export interface TopicStat {
  id: string;
  label: string;
  tone: TopicStatTone;
  /** Omitted when the count is zero — an empty bucket is not worth a click. */
  onPress?: () => void;
}

// Dot and label colour per bucket. The chip surface stays neutral so the row
// reads as one control group rather than three competing statuses.
const TONE_CLASSES: Record<TopicStatTone, { dot: string; label: string }> = {
  critical: {
    dot: 'tw:bg-utility-error-500',
    label: 'tw:text-utility-error-700',
  },
  success: {
    dot: 'tw:bg-utility-success-500',
    label: 'tw:text-utility-success-700',
  },
  muted: {
    dot: 'tw:bg-utility-gray-400',
    label: 'tw:text-text-secondary',
  },
};

// Button draws its own border on `::after` (see CLAUDE.md §Styling), so the
// tone recolours that rather than adding a second border around it.
const TONE_SURFACE: Record<TopicStatTone, string> = {
  critical: 'tw:bg-utility-error-50 tw:after:outline-utility-error-200',
  success: 'tw:bg-primary',
  muted: 'tw:bg-primary',
};

export interface TopicStatChipsProps {
  stats: TopicStat[];
}

/** The bucket chips above a topic card's rows, e.g. "15 of 25 failing". */
const TopicStatChips: React.FC<TopicStatChipsProps> = ({ stats }) => (
  <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
    {stats.map((stat) => (
      <Button
        className={classNames(
          'tw:rounded-lg tw:px-3 tw:py-1.5',
          TONE_SURFACE[stat.tone]
        )}
        color="secondary"
        data-testid={`topic-stat-${stat.id}`}
        isDisabled={!stat.onPress}
        key={stat.id}
        size="sm"
        onPress={stat.onPress}>
        <span className="tw:flex tw:items-center tw:gap-2">
          <span
            aria-hidden
            className={classNames(
              'tw:size-1.5 tw:shrink-0 tw:rounded-full',
              TONE_CLASSES[stat.tone].dot
            )}
          />
          <span
            className={classNames(
              'tw:text-xs tw:font-semibold',
              TONE_CLASSES[stat.tone].label
            )}>
            {stat.label}
          </span>
        </span>
      </Button>
    ))}
  </div>
);

export default TopicStatChips;
