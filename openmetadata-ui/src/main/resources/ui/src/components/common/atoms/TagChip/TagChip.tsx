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

import { Tag01, X as XClose } from '@untitledui/icons';
import classNames from 'classnames';
import { CSSProperties, FC, MouseEventHandler, ReactElement } from 'react';
import './tag-chip.less';

export type TagChipSize = 'small' | 'medium' | 'large';
export type TagChipVariant = 'filled' | 'outlined' | 'blueGray' | 'brand-soft';

export interface TagChipProps {
  label: string;
  icon?: ReactElement;
  onDelete?: (e: React.SyntheticEvent) => void;
  size?: TagChipSize;
  variant?: TagChipVariant;
  /** Optional left color bar (3px wide, 70% height). */
  tagColor?: string;
  /** Cap on outer chip width — string ('200px') or number (px). */
  maxWidth?: string | number;
  showEllipsis?: boolean;
  showIcon?: boolean;
  className?: string;
  /** Inline style on the chip root (use for one-off overrides). */
  style?: CSSProperties;
  /** Extra className applied to the inner label span. */
  labelClassName?: string;
  /** data-testid for the inner label span (back-compat). */
  labelDataTestId?: string;
  'data-testid'?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const ICON_SIZE_BY_CHIP_SIZE: Record<TagChipSize, number> = {
  small: 12,
  medium: 13,
  large: 14,
};

const DELETE_ICON_SIZE_BY_CHIP_SIZE: Record<TagChipSize, number> = {
  small: 12,
  medium: 14,
  large: 16,
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
  className,
  style,
  labelClassName,
  labelDataTestId,
  'data-testid': dataTestId,
  onClick,
}) => {
  const resolvedIcon = icon ? (
    icon
  ) : showIcon ? (
    <Tag01 size={ICON_SIZE_BY_CHIP_SIZE[size]} />
  ) : null;

  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete?.(event);
  };

  return (
    <div
      className={classNames(
        'tag-chip',
        `tag-chip--size-${size}`,
        `tag-chip--variant-${variant}`,
        {
          'tag-chip--has-color-bar': Boolean(tagColor),
          'tag-chip--has-ellipsis': showEllipsis,
        },
        className
      )}
      data-testid={dataTestId}
      style={{ ...(maxWidth !== undefined ? { maxWidth } : null), ...style }}
      onClick={onClick}>
      {tagColor && (
        <span
          aria-hidden="true"
          className="tag-chip__color-bar"
          style={{ backgroundColor: tagColor }}
        />
      )}
      {resolvedIcon && (
        <span aria-hidden="true" className="tag-chip__icon">
          {resolvedIcon}
        </span>
      )}
      <span
        className={classNames('tag-chip__label', labelClassName)}
        data-testid={labelDataTestId}>
        {label}
      </span>
      {onDelete && (
        <button
          aria-label="Remove"
          className="tag-chip__delete"
          type="button"
          onClick={handleDeleteClick}>
          <XClose size={DELETE_ICON_SIZE_BY_CHIP_SIZE[size]} />
        </button>
      )}
    </div>
  );
};

export default TagChip;
