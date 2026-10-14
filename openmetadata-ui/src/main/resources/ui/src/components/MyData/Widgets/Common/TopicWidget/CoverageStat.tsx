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

import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import Sparkline from './Sparkline';

export interface CoverageStatProps {
  label: string;
  /** Percentage, 0-100. */
  value: number;
  /** Percentage-point change across the window; null hides the delta. */
  delta: number | null;
  dataTestId?: string;
  className?: string;
  /** Value per day, oldest first. Fewer than two points draws nothing. */
  series?: number[];
}

/** A percentage with its point movement, e.g. description coverage. */
const CoverageStat: React.FC<CoverageStatProps> = ({
  label,
  value,
  delta,
  dataTestId,
  className,
  series,
}) => {
  const hasDelta = delta !== null && delta !== 0;
  const isUp = (delta ?? 0) > 0;

  return (
    <div
      className={classNames(
        // Same surface as the AI insight banner (Collate's `AIInsightCard`):
        // the two sit side by side on the landing page, so a plain `bg-secondary`
        // read as a second, slightly-off tint. The dark value is a deliberate
        // lift off gray-blue-950 (near-black) per Collate #6491 — keep the pair
        // in step if either moves.
        'tw:flex tw:items-end tw:gap-4 tw:overflow-hidden tw:rounded-xl tw:bg-utility-gray-blue-50 tw:dark:bg-[rgb(41,53,74)] tw:p-4',
        className
      )}>
      <div className="tw:shrink-0">
        {/* `!` on the colours: Typography renders `.prose`, whose unlayered
          `color` rule is emitted after the Tailwind utilities and would
          otherwise silently win. */}
        <Typography className="tw:text-text-tertiary!" size="text-sm">
          {label}
        </Typography>
        <div className="tw:mt-1 tw:flex tw:items-baseline tw:gap-2">
          <Typography
            className="tw:text-text-primary!"
            data-testid={dataTestId}
            size="text-xl"
            weight="semibold">
            {`${Math.round(value)}%`}
          </Typography>
          {hasDelta && (
            <Typography
              className={
                isUp
                  ? 'tw:text-utility-success-700!'
                  : 'tw:text-utility-error-700!'
              }
              size="text-sm"
              weight="medium">
              {`${isUp ? '+' : ''}${(delta as number).toFixed(1)}`}
            </Typography>
          )}
        </div>
      </div>

      {/* The trend takes the width the figure leaves, rather than spanning the
        tile behind it: the label is translated, so there is no inset that
        clears it in every locale — only a column the text cannot reach. */}
      {series && series.length > 1 && (
        <div aria-hidden className="tw:h-12 tw:min-w-0 tw:flex-1">
          <Sparkline ariaLabel={label} series={series} tone="brand" />
        </div>
      )}
    </div>
  );
};

export default CoverageStat;
