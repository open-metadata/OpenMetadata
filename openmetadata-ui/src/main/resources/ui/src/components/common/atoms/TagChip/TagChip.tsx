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

import { ButtonUtility, Typography } from '@openmetadata/ui-core-components';
import { Tag01, XClose } from '@untitledui/icons';
import classNames from 'classnames';
import { FC, KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export interface TagChipProps {
  label: string;
  icon?: ReactElement;
  onDelete?: (e: Event) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outlined' | 'blueGray';
  tagColor?: string; // For the colored bar indicator
  maxWidth?: string | number;
  showEllipsis?: boolean;
  showIcon?: boolean;
  labelDataTestId?: string;
  className?: string;
  'data-testid'?: string;
  disabled?: boolean;
  tabIndex?: number;
  'data-tag-index'?: number;
}

const sizeStyles = {
  small: {
    root: 'tw:h-[24px] tw:px-1.5 tw:py-0.5',
    typography: 'text-xs' as const,
    icon: 14,
    deleteIcon: 'tw:*:data-icon:size-3',
  },
  medium: {
    root: 'tw:h-[28px] tw:px-2 tw:py-0.5',
    typography: 'text-sm' as const,
    icon: 16,
    deleteIcon: 'tw:*:data-icon:size-3.5',
  },
  large: {
    root: 'tw:h-[30px] tw:px-2 tw:py-1',
    typography: 'text-sm' as const,
    icon: 18,
    deleteIcon: 'tw:*:data-icon:size-4',
  },
};

const variantStyles = {
  blueGray:
    'tw:rounded-lg tw:border tw:border-utility-gray-blue-200 tw:bg-utility-gray-blue-50 tw:text-utility-gray-blue-700',
  filled: 'tw:rounded-full tw:bg-secondary tw:text-secondary',
  outlined:
    'tw:rounded-lg tw:border tw:border-primary tw:bg-transparent tw:text-secondary',
};

const TagChip: FC<TagChipProps> = ({
  label,
  icon,
  onDelete,
  size = 'small',
  variant = 'blueGray',
  tagColor,
  maxWidth,
  showEllipsis = true,
  showIcon = true,
  labelDataTestId,
  className,
  disabled,
  tabIndex,
  ...otherProps
}) => {
  const { t } = useTranslation();
  const defaultIcon = showIcon ? (
    <Tag01 size={sizeStyles[size].icon} />
  ) : undefined;
  const chipIcon = icon ?? defaultIcon;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (
      onDelete &&
      !disabled &&
      (e.key === 'Backspace' || e.key === 'Delete')
    ) {
      e.preventDefault();
      onDelete(e.nativeEvent);
    }
  };

  return (
    <div
      aria-disabled={disabled}
      className={classNames(
        'tw:inline-flex tw:min-w-0 tw:items-center tw:whitespace-nowrap tw:transition-all tw:duration-150',
        sizeStyles[size].root,
        variantStyles[variant],
        {
          'tw:relative tw:pl-3': tagColor,
          'tw:cursor-not-allowed tw:opacity-50': disabled,
        },
        className
      )}
      data-tag-index={otherProps['data-tag-index']}
      data-testid={otherProps['data-testid']}
      role={onDelete ? 'button' : undefined}
      style={{ maxWidth }}
      tabIndex={tabIndex}
      onKeyDown={onDelete ? handleKeyDown : undefined}>
      {tagColor && (
        <span
          className="tw:absolute tw:left-0 tw:top-1/2 tw:h-[70%] tw:w-0.75 tw:-translate-y-1/2 tw:rounded-[2px_0_0_2px]"
          style={{ backgroundColor: tagColor }}
        />
      )}
      {chipIcon && (
        <span className="tw:mr-1 tw:inline-flex tw:shrink-0 tw:items-center">
          {chipIcon}
        </span>
      )}
      <Typography
        className='tw:text-secondary'
        data-testid={labelDataTestId}
        ellipsis={showEllipsis}
        size={sizeStyles[size].typography}
        weight={variant === 'blueGray' ? 'regular' : 'medium'}>
        {label}
      </Typography>
      {onDelete && (
        <ButtonUtility
          aria-label={t('label.remove')}
          className={classNames(
            'tw:ml-1 tw:size-auto tw:shrink-0 tw:rounded-none tw:p-0 tw:text-inherit tw:shadow-none tw:ring-0 tw:hover:bg-transparent tw:hover:text-inherit',
            sizeStyles[size].deleteIcon
          )}
          icon={XClose}
          isDisabled={disabled}
          size="xs"
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onDelete(e.nativeEvent)
          }
          }
        />
      )}
    </div>
  );
};

export default TagChip;
