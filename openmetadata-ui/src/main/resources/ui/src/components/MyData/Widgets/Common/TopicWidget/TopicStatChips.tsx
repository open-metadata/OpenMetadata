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
  /** An empty bucket has no list to show, so its chip cannot be picked. */
  isDisabled?: boolean;
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

// The selected chip takes its tone's surface; the rest stay neutral. Button
// draws its own border on `::after` (see CLAUDE.md §Styling), so the tone
// recolours that rather than adding a second border around it.
// ADR:2026-10-23-landing-page-segmented-controls-are-styled-at-the-call-site
const SELECTED_SURFACE: Record<TopicStatTone, string> = {
  critical: 'tw:bg-utility-error-50 tw:after:outline-utility-error-200',
  success: 'tw:bg-utility-success-50 tw:after:outline-utility-success-200',
  muted: 'tw:bg-secondary',
};

export interface TopicStatChipsProps {
  stats: TopicStat[];
  /** The id of the bucket whose rows the card is showing. */
  value: string;
  onChange: (id: string) => void;
  /** Names the group for assistive tech. */
  label: string;
}

/**
 * The bucket chips above a topic card's rows, e.g. "15 of 25 failing". They
 * filter the rows below in place — one is always selected — rather than leave
 * the page.
 */
const TopicStatChips: React.FC<TopicStatChipsProps> = ({
  stats,
  value,
  onChange,
  label,
}) => (
  <div
    aria-label={label}
    className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5"
    role="group">
    {stats.map((stat) => (
      <Button
        aria-pressed={stat.id === value}
        className={classNames(
          'tw:rounded-lg tw:px-2.5 tw:py-1',
          stat.id === value && SELECTED_SURFACE[stat.tone]
        )}
        color="secondary"
        data-testid={`topic-stat-${stat.id}`}
        isDisabled={stat.isDisabled && stat.id !== value}
        key={stat.id}
        size="sm"
        onPress={() => onChange(stat.id)}>
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
