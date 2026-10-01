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

import classNames from 'classnames';
import React from 'react';

export type TopicFilterTone = 'brand' | 'error' | 'warning' | 'muted';

export interface TopicFilterChip {
  id: string;
  label: string;
  count: number;
  tone: TopicFilterTone;
}

// Dot, count and selected outline share a hue per tone. Spelled out rather than
// interpolated, which Tailwind cannot see.
const TONES: Record<
  TopicFilterTone,
  { dot: string; count: string; selected: string }
> = {
  brand: {
    count: 'tw:text-utility-brand-700',
    dot: 'tw:bg-utility-brand-600',
    selected: 'tw:border-utility-brand-300 tw:bg-utility-brand-50',
  },
  error: {
    count: 'tw:text-utility-error-700',
    dot: 'tw:bg-utility-error-600',
    selected: 'tw:border-utility-error-300 tw:bg-utility-error-50',
  },
  warning: {
    count: 'tw:text-utility-warning-700',
    dot: 'tw:bg-utility-warning-500',
    selected: 'tw:border-utility-warning-300 tw:bg-utility-warning-50',
  },
  muted: {
    count: 'tw:text-text-tertiary',
    dot: 'tw:bg-utility-gray-300',
    selected: 'tw:border-secondary tw:bg-secondary',
  },
};

export interface TopicFilterChipsProps {
  chips: TopicFilterChip[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}

/**
 * The bucket filters above a topic card's list: a tone dot, the label, and the
 * count in the same hue. Only the selected chip carries an outline, so the row
 * reads as one control rather than four competing buttons.
 */
const TopicFilterChips: React.FC<TopicFilterChipsProps> = ({
  chips,
  value,
  onChange,
  label,
}) => (
  <div
    aria-label={label}
    className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-1 tw:gap-y-2"
    role="radiogroup">
    {chips.map((chip) => {
      const tone = TONES[chip.tone];
      const isSelected = chip.id === value;

      return (
        <button
          aria-checked={isSelected}
          className={classNames(
            'tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-full tw:border tw:px-3 tw:py-1.5 tw:transition-colors',
            isSelected ? tone.selected : 'tw:border-transparent'
          )}
          data-testid={`topic-filter-${chip.id}`}
          key={chip.id}
          role="radio"
          type="button"
          onClick={() => onChange(chip.id)}>
          <span
            aria-hidden
            className={classNames(
              'tw:size-2 tw:shrink-0 tw:rounded-full',
              tone.dot
            )}
          />
          <span className="tw:text-sm tw:text-text-secondary">
            {chip.label}
          </span>
          <span
            className={classNames('tw:text-sm tw:font-semibold', tone.count)}>
            {chip.count}
          </span>
        </button>
      );
    })}
  </div>
);

export default TopicFilterChips;
