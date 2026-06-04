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
import { XClose } from '@untitledui/icons';
import type { ComponentPropsWithRef, FC, ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cx } from '@/utils/cx';

interface FilterBarRootProps extends ComponentPropsWithRef<'div'> {
  /** Content and actions for the filter bar */
  children: ReactNode;
}

/** Root layout container for the filter bar. Arranges content and actions horizontally with wrapping. */
const FilterBarRoot = ({
  children,
  className,
  ...props
}: FilterBarRootProps) => (
  <div
    className={cx('tw:flex tw:flex-wrap tw:items-end tw:gap-3', className)}
    {...props}>
    {children}
  </div>
);

interface FilterBarContentProps extends ComponentPropsWithRef<'div'> {
  /** Filter inputs, tabs, or other content */
  children: ReactNode;
}

/** Left content area of the filter bar. Grows to fill available space. */
const FilterBarContent = ({
  children,
  className,
  ...props
}: FilterBarContentProps) => (
  <div
    className={cx(
      'tw:flex tw:min-w-0 tw:flex-1 tw:flex-wrap tw:items-end tw:gap-3',
      className
    )}
    {...props}>
    {children}
  </div>
);

interface FilterBarActionsProps extends ComponentPropsWithRef<'div'> {
  /** Action buttons such as date picker, filters, search */
  children: ReactNode;
}

/** Right actions area of the filter bar. Shrinks to fit content. */
const FilterBarActions = ({
  children,
  className,
  ...props
}: FilterBarActionsProps) => (
  <div
    className={cx('tw:flex tw:shrink-0 tw:items-center tw:gap-3', className)}
    {...props}>
    {children}
  </div>
);

interface FilterRowProps extends ComponentPropsWithRef<'div'> {
  /** Filter field, operator, and value inputs */
  children: ReactNode;
  /** Callback when the remove button is clicked */
  onRemove?: () => void;
}

/** A single advanced filter row with inputs and a remove button. */
const FilterRow = ({
  children,
  onRemove,
  className,
  ...props
}: FilterRowProps) => (
  <div className={cx('tw:flex tw:items-start tw:gap-1', className)} {...props}>
    <div className="tw:flex tw:items-center tw:gap-3">{children}</div>
    <AriaButton
      aria-label="Remove filter"
      className="tw:flex tw:size-9 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-lg tw:text-fg-quaternary tw:transition tw:duration-100 tw:ease-linear tw:hover:text-fg-quaternary_hover"
      onPress={onRemove}>
      <XClose className="tw:size-5" />
    </AriaButton>
  </div>
);

interface FilterIconButtonProps {
  /** Icon component to render */
  icon: FC<{ className?: string }>;
  /** Accessible label */
  label?: string;
  /** Additional class names */
  className?: string;
  /** Click handler */
  onPress?: () => void;
}

/** Icon-only button styled to match filter bar controls (secondary button appearance). */
const FilterIconButton = ({
  icon: Icon,
  label,
  onPress,
  className,
}: FilterIconButtonProps) => (
  <AriaButton
    aria-label={label}
    className={cx(
      'tw:flex tw:size-9 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:shadow-xs tw:transition tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover',
      className
    )}
    onPress={onPress}>
    <Icon className="tw:size-5 tw:text-fg-quaternary" />
  </AriaButton>
);

export const FilterBar = {
  Root: FilterBarRoot,
  Content: FilterBarContent,
  Actions: FilterBarActions,
  FilterRow,
  FilterIconButton,
};
