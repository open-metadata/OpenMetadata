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

import { defaultColors, Typography } from '@openmetadata/ui-core-components';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ShareBar, { ShareSegment } from './ShareBar';

export interface TestStatusBarProps {
  passed: number;
  failed: number;
  aborted: number;
  total: number;
}

// Status colours are fixed across colour modes, as everywhere in the core
// charts — the chart theme only covers the chrome (axes, grid, tooltip).
const SEGMENTS = [
  {
    color: defaultColors.success[500],
    key: 'passed',
    labelKey: 'label.passed',
  },
  { color: defaultColors.error[500], key: 'failed', labelKey: 'label.failed' },
  {
    color: defaultColors.warning[500],
    key: 'aborted',
    labelKey: 'label.aborted',
  },
] as const;

/** The pass/fail/abort split as one bar plus its legend. */
const TestStatusBar: React.FC<TestStatusBarProps> = ({
  passed,
  failed,
  aborted,
  total,
}) => {
  const { t } = useTranslation();
  const counts = useMemo(
    () => ({ aborted, failed, passed }),
    [aborted, failed, passed]
  );

  const segments = useMemo<ShareSegment[]>(
    () =>
      SEGMENTS.map((segment) => ({
        color: segment.color,
        key: segment.key,
        name: t(segment.labelKey),
        value: counts[segment.key],
      })),
    [counts, t]
  );

  if (total === 0) {
    return null;
  }

  return (
    <div data-testid="test-status-bar">
      {/* The runs that are neither passed, failed nor aborted stay as track,
        so the bar is a share of every test rather than of the ones that
        reached a verdict. */}
      <ShareBar
        ariaLabel={t('message.count-total-tests', { count: total })}
        className="tw:h-2 tw:bg-secondary"
        segments={segments}
        total={total}
      />

      <div className="tw:mt-2.5 tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1.5">
        {/* `!` on the colours: Typography renders `.prose`, whose unlayered
          `color` rule is emitted after the Tailwind utilities. */}
        <Typography className="tw:text-text-tertiary!" size="text-sm">
          {t('message.count-total-tests', { count: total })}
        </Typography>
        {segments.map((segment) => (
          // Name and count as two nodes, not one concatenated string, matching
          // the connector legend — a locale reads the pair as a label and its
          // figure rather than as a sentence it has to word-order.
          <span
            className="tw:flex tw:items-center tw:gap-1.5"
            data-testid={`test-status-${segment.key}`}
            key={segment.key}>
            <span
              aria-hidden
              className="tw:size-1.5 tw:shrink-0 tw:rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <Typography className="tw:text-text-secondary!" size="text-sm">
              {segment.name}
            </Typography>
            <Typography
              className="tw:text-text-primary!"
              data-testid={`test-status-${segment.key}-count`}
              size="text-sm"
              weight="medium">
              {segment.value}
            </Typography>
          </span>
        ))}
      </div>
    </div>
  );
};

export default TestStatusBar;
