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
        'tw:relative tw:overflow-hidden tw:rounded-xl tw:bg-secondary tw:p-4',
        className
      )}>
      {/* The trend sits behind the numbers, as in the design — anchored to the
        bottom so it reads as a footprint rather than a background wash. */}
      {series && series.length > 1 && (
        <div
          aria-hidden
          className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-0 tw:h-2/3 tw:opacity-60">
          <Sparkline ariaLabel={label} series={series} tone="brand" />
        </div>
      )}

      {/* `!` on the colours: Typography renders `.prose`, whose unlayered
        `color` rule is emitted after the Tailwind utilities and would
        otherwise silently win. */}
      <Typography className="tw:relative tw:text-text-tertiary!" size="text-sm">
        {label}
      </Typography>
      <div className="tw:relative tw:mt-1 tw:flex tw:items-baseline tw:gap-2">
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
  );
};

export default CoverageStat;
