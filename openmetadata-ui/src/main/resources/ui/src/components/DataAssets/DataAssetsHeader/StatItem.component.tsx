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

import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { StatItemProps } from './StatItem.interface';

export const StatItem = ({
  icon: Icon,
  iconNode,
  iconClassName = 'tw:size-5',
  count,
  tooltip,
  testId,
  countTestId,
  onClick,
  loading,
  disabled,
  isActive,
  srLabel,
}: StatItemProps) => {
  const isDisabled = disabled || loading;
  const labelClassName = classNames(
    'tw:inline-flex tw:items-center tw:gap-1 tw:text-xs tw:font-medium tw:transition-colors',
    isActive ? 'tw:text-brand-secondary' : 'tw:text-quaternary',
    onClick && !isDisabled
      ? 'tw:cursor-pointer tw:hover:text-secondary'
      : 'tw:cursor-default'
  );

  const label = (
    <>
      {iconNode ??
        (Icon && (
          <Icon className={classNames(iconClassName, 'tw:text-current')} />
        ))}
      {count !== undefined && (
        <span
          className="tw:text-quaternary tw:text-sm"
          data-testid={countTestId}>
          {count}
        </span>
      )}
      {srLabel && <span className="tw:sr-only">{srLabel}</span>}
    </>
  );

  const interactive = onClick ? (
    <button
      aria-busy={loading || undefined}
      aria-label={srLabel ?? tooltip}
      className="tw:rounded tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-brand"
      data-testid={testId}
      disabled={isDisabled}
      type="button"
      onClick={onClick}>
      <span className={labelClassName}>{label}</span>
    </button>
  ) : (
    <span className={labelClassName} data-testid={testId}>
      {label}
    </span>
  );

  return (
    <Tooltip placement="top" title={tooltip}>
      <TooltipTrigger>{interactive}</TooltipTrigger>
    </Tooltip>
  );
};
