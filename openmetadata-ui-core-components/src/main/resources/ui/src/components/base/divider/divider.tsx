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

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: DividerOrientation;
  label?: ReactNode;
  labelAlign?: DividerLabelAlignment;
}

export const Divider = ({
  orientation = 'horizontal',
  label,
  labelAlign = 'center',
  className,
  ...props
}: DividerProps) => {
  if (orientation === 'vertical') {
    return (
      <hr
        {...props}
        aria-orientation="vertical"
        className={cx(
          'tw:self-stretch tw:w-px tw:shrink-0 tw:bg-border-secondary',
          className
        )}
      />
    );
  }

  if (!label) {
    return (
      <hr
        {...props}
        aria-orientation="horizontal"
        className={cx(
          'tw:w-full tw:h-px tw:shrink-0 tw:bg-border-secondary',
          className
        )}
      />
    );
  }

  return (
    <hr
      {...props}
      aria-orientation="horizontal"
      className={cx('tw:flex tw:items-center tw:w-full tw:gap-2', className)}>
      {labelAlign !== 'start' && (
        <div className="tw:h-px tw:flex-1 tw:bg-border-secondary" />
      )}
      <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-tertiary">
        {label}
      </span>
      {labelAlign !== 'end' && (
        <div className="tw:h-px tw:flex-1 tw:bg-border-secondary" />
      )}
    </hr>
  );
};

Divider.displayName = 'Divider';
