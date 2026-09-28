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
import { cx } from '@/utils/cx';
import type { HTMLAttributes, ReactNode } from 'react';

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerLabelAlignment = 'start' | 'center' | 'end';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation;
  label?: ReactNode;
  labelAlign?: DividerLabelAlignment;
  /**
   * Draw the rule with a dashed stroke instead of a solid fill. A solid rule
   * is a 1px filled box; a dashed one has to be a border, since a background
   * cannot be dashed.
   */
  dashed?: boolean;
}

// Solid rules are a filled 1px box. Dashed ones must use a border instead, so
// the box collapses to zero in the relevant axis and the border supplies the
// visible line.
const ruleClasses = (dashed: boolean, axis: 'x' | 'y') => {
  if (!dashed) {
    return axis === 'y'
      ? 'tw:w-px tw:bg-border-secondary'
      : 'tw:h-px tw:bg-border-secondary';
  }

  return axis === 'y'
    ? 'tw:w-0 tw:border-l tw:border-dashed tw:border-secondary'
    : 'tw:h-0 tw:border-t tw:border-dashed tw:border-secondary';
};

export const Divider = ({
  orientation = 'horizontal',
  label,
  labelAlign = 'center',
  dashed = false,
  className,
  ...props
}: DividerProps) => {
  if (orientation === 'vertical') {
    return (
      <div
        {...props}
        aria-orientation="vertical"
        className={cx(
          // `self-stretch` only produces a height inside a flex or grid
          // parent, and a consumer aligning the divider itself (say
          // `self-center`) overrides it. `min-h-[1em]` keeps the rule visible
          // in both cases without capping it when stretching does apply.
          'tw:self-stretch tw:min-h-[1em] tw:shrink-0',
          ruleClasses(dashed, 'y'),
          className
        )}
        role="separator"
      />
    );
  }

  if (!label) {
    return (
      <div
        {...props}
        aria-orientation="horizontal"
        className={cx(
          'tw:w-full tw:shrink-0',
          ruleClasses(dashed, 'x'),
          className
        )}
        role="separator"
      />
    );
  }

  return (
    <div
      role="separator"
      {...props}
      aria-orientation="horizontal"
      className={cx('tw:flex tw:items-center tw:w-full tw:gap-2', className)}>
      {labelAlign !== 'start' && (
        <div className={cx('tw:flex-1', ruleClasses(dashed, 'x'))} />
      )}
      <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-tertiary">
        {label}
      </span>
      {labelAlign !== 'end' && (
        <div className={cx('tw:flex-1', ruleClasses(dashed, 'x'))} />
      )}
    </div>
  );
};

Divider.displayName = 'Divider';
