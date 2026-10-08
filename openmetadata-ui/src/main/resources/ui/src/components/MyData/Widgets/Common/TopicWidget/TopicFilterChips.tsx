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

import { ButtonGroup, ButtonGroupItem } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import type { Key } from 'react-aria-components';

export type TopicFilterTone = 'brand' | 'error' | 'warning' | 'muted';

export interface TopicFilterChip {
  id: string;
  label: string;
  count: number;
  tone: TopicFilterTone;
}

// Dot, count and selected border share a hue per tone. Spelled out rather than
// interpolated, which Tailwind cannot see. ButtonGroupItem draws its border on
// `::after` (see CLAUDE.md §Styling), so the selected tone recolours that, and
// `selected:` restates the surface because the item's own `selected:bg-active`
// would otherwise win over a plain `bg-*`.
const TONES: Record<
  TopicFilterTone,
  { dot: string; count: string; selected: string }
> = {
  brand: {
    count: 'tw:text-utility-brand-700',
    dot: 'tw:bg-utility-brand-600',
    selected:
      'tw:after:outline-utility-brand-300 tw:bg-utility-brand-50 tw:selected:bg-utility-brand-50',
  },
  error: {
    count: 'tw:text-utility-error-700',
    dot: 'tw:bg-utility-error-600',
    selected:
      'tw:after:outline-utility-error-300 tw:bg-utility-error-50 tw:selected:bg-utility-error-50',
  },
  warning: {
    count: 'tw:text-utility-warning-700',
    dot: 'tw:bg-utility-warning-500',
    selected:
      'tw:after:outline-utility-warning-300 tw:bg-utility-warning-50 tw:selected:bg-utility-warning-50',
  },
  muted: {
    count: 'tw:text-text-tertiary',
    dot: 'tw:bg-utility-gray-300',
    selected:
      'tw:after:outline-secondary tw:bg-secondary tw:selected:bg-secondary',
  },
};

// Undoes the segmented-control look ButtonGroup is built for — joined edges,
// a shared shadow, square inner corners — so each option reads as a free
// standing chip. Only the selected chip keeps a border.
const GROUP_CLASSES =
  'tw:flex tw:w-auto tw:max-w-full tw:flex-wrap tw:items-center tw:gap-x-1 tw:gap-y-2 tw:space-x-0 tw:shadow-none';
const CHIP_CLASSES =
  'tw:gap-2 tw:rounded-full tw:px-3 tw:py-1.5 tw:font-normal tw:shadow-none tw:first:rounded-full tw:last:rounded-full tw:not-last:pr-3';
const UNSELECTED_CLASSES = 'tw:bg-transparent tw:after:outline-transparent';

export interface TopicFilterChipsProps {
  chips: TopicFilterChip[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /**
   * Prefixes every testid, so two cards with the same chip ids — Domains and
   * Data Products both offer "All / No owner / Empty" — stay distinguishable
   * on one page.
   */
  testIdPrefix: string;
}

/**
 * The bucket filters above a topic card's list: a tone dot, the label, and the
 * count in the same hue. Only the selected chip carries an outline, so the row
 * reads as one control rather than four competing buttons.
 *
 * A single-select ButtonGroup rather than hand-rolled radios: react-aria gives
 * it the radiogroup semantics plus the arrow-key movement between options that
 * a `role="radio"` promises and a bare button does not deliver.
 */
const TopicFilterChips: React.FC<TopicFilterChipsProps> = ({
  chips,
  value,
  onChange,
  label,
  testIdPrefix,
}) => {
  const handleSelectionChange = (keys: Set<Key>) => {
    const [next] = Array.from(keys);
    if (next !== undefined) {
      onChange(String(next));
    }
  };

  return (
    <ButtonGroup
      disallowEmptySelection
      aria-label={label}
      className={GROUP_CLASSES}
      data-testid={`${testIdPrefix}-filter-chips`}
      selectedKeys={[value]}
      size="sm"
      onSelectionChange={handleSelectionChange}>
      {chips.map((chip) => {
        const tone = TONES[chip.tone];

        return (
          <ButtonGroupItem
            className={classNames(
              CHIP_CLASSES,
              chip.id === value ? tone.selected : UNSELECTED_CLASSES
            )}
            data-testid={`${testIdPrefix}-filter-${chip.id}`}
            id={chip.id}
            key={chip.id}>
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
              className={classNames('tw:text-sm tw:font-semibold', tone.count)}
              data-testid={`${testIdPrefix}-filter-${chip.id}-count`}>
              {chip.count}
            </span>
          </ButtonGroupItem>
        );
      })}
    </ButtonGroup>
  );
};

export default TopicFilterChips;
