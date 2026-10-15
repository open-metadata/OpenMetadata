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
import type { ReactNode } from 'react';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { cx } from '@/utils/cx';

export type RunHistoryStatus =
  | 'success'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'running';

export interface RunHistoryItem {
  /** Stable identity for the React key; falls back to the run's position. */
  id?: string;
  status: RunHistoryStatus;
  /** Tooltip content for this run, e.g. "Run 3 · Failed". Omit for no tooltip. */
  label?: ReactNode;
}

export interface RunHistoryBarProps {
  /** Runs oldest first; only the newest `max` are drawn. */
  runs: RunHistoryItem[];
  /**
   * Slots in the strip. Fewer runs than slots leaves empty slots on the left,
   * so strips of different pipelines line up run-for-run.
   * @default 10
   */
  max?: number;
  /** Summarises the whole strip for assistive tech, e.g. "Last 10 runs: 8 successful, 2 failed". */
  ariaLabel: string;
  className?: string;
  'data-testid'?: string;
}

// Height says as much as colour, so the strip still reads for a colour-blind
// viewer: a failure is the only full-height bar, a run still waiting the
// shortest. Spelled out rather than interpolated, which Tailwind cannot see.
const STATUS_CLASSES: Record<RunHistoryStatus, string> = {
  success: 'tw:h-2.5 tw:bg-utility-success-500',
  failed: 'tw:h-4 tw:bg-utility-error-500',
  skipped: 'tw:h-2.5 tw:bg-utility-warning-500',
  running: 'tw:h-2.5 tw:bg-utility-blue-500',
  pending: 'tw:h-1.5 tw:bg-utility-gray-300',
};

const EMPTY_SLOT_CLASS = 'tw:h-1 tw:bg-quaternary';
const BAR_CLASS = 'tw:block tw:w-1 tw:shrink-0 tw:rounded-xs';

/**
 * A pipeline's recent runs as a row of thin bars, newest on the right.
 *
 * The strip is one image to assistive tech, labelled with its summary: ten
 * focusable bars per row would put a hundred tab stops in a ten-row list. The
 * per-run tooltips are a pointer affordance on top of that, so their triggers
 * stay out of the tab order.
 */
export const RunHistoryBar = ({
  runs,
  max = 10,
  ariaLabel,
  className,
  'data-testid': dataTestId,
}: RunHistoryBarProps) => {
  const shown = runs.slice(-max);
  const emptySlots = Math.max(0, max - shown.length);

  return (
    <div
      aria-label={ariaLabel}
      className={cx('tw:flex tw:h-4 tw:items-end tw:gap-0.5', className)}
      data-testid={dataTestId}
      role="img">
      {Array.from({ length: emptySlots }, (_, index) => (
        <span
          aria-hidden
          className={cx(BAR_CLASS, EMPTY_SLOT_CLASS)}
          data-status="empty"
          key={`empty-${index}`}
        />
      ))}
      {shown.map((run, index) => {
        const bar = (
          <span
            aria-hidden
            className={cx(BAR_CLASS, STATUS_CLASSES[run.status])}
            data-status={run.status}
          />
        );
        const key = run.id ?? `run-${index}`;

        return run.label ? (
          <Tooltip
            excludeTriggerFromTabOrder
            key={key}
            title={run.label}
            triggerClassName="tw:flex tw:h-full tw:items-end">
            {bar}
          </Tooltip>
        ) : (
          <span className="tw:flex tw:h-full tw:items-end" key={key}>
            {bar}
          </span>
        );
      })}
    </div>
  );
};
