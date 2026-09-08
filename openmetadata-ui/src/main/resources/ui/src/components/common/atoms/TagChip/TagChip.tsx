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

import { Chip, ChipProps as MuiChipProps, SxProps, Theme } from '@mui/material';
import { Tag01, XClose } from '@untitledui/icons';
import { FC, ReactElement } from 'react';
import { reduceColorOpacity } from '../../../../utils/ColorUtils';

export interface TagChipProps extends Omit<MuiChipProps, 'variant' | 'color'> {
  label: string;
  icon?: ReactElement;
  onDelete?: (e: Event) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outlined' | 'blueGray';
  tagColor?: string; // For the colored bar indicator
  sx?: SxProps<Theme>;
  maxWidth?: string | number;
  showEllipsis?: boolean;
  showIcon?: boolean;
  labelDataTestId?: string;
}

const TagChip: FC<TagChipProps> = ({
  label,
  icon,
  onDelete,
  size = 'small',
  variant = 'blueGray',
  tagColor,
  sx,
  maxWidth,
  showEllipsis = true,
  showIcon = true,
  labelDataTestId,
  ...otherProps
}) => {
  const defaultIcon = showIcon ? (
    <Tag01 size={size === 'small' ? 12 : size === 'large' ? 14 : 13} />
  ) : undefined;
  const chipIcon = icon !== undefined ? icon : defaultIcon;

  const labelStyles = {
    ...(showEllipsis
      ? {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }
      : {}),
    ...(tagColor ? { color: tagColor } : {}),
  };

  const colorBarStyles = tagColor
    ? {
        position: 'relative' as const,
        overflow: 'hidden',
        paddingLeft: '12px',
        backgroundColor: reduceColorOpacity(tagColor, 0.05),
        borderColor: reduceColorOpacity(tagColor, 0.2),
        '&::before': {
          content: '""',
          position: 'absolute' as const,
          left: 0,
          top: 0,
          bottom: 0,
          width: '6px',
          backgroundColor: tagColor,
        },
      }
    : {};

  const heightStyles =
    size === 'small'
      ? { height: 24 }
      : size === 'medium'
      ? { height: 28 }
      : size === 'large'
      ? { height: 30 }
      : {};

  // Custom delete icon with appropriate sizing
  const deleteIcon = onDelete ? (
    <XClose size={size === 'small' ? 12 : size === 'large' ? 16 : 14} />
  ) : undefined;

  return (
    <Chip
      {...otherProps}
      deleteIcon={deleteIcon}
      icon={chipIcon}
      label={label}
      size={size}
      slotProps={{
        label: labelDataTestId ? { 'data-testid': labelDataTestId } : undefined,
      }}
      sx={{
        maxWidth,
        minWidth: 0,
        ...colorBarStyles,
        ...heightStyles,
        '& .MuiChip-label': labelStyles,
        '& .MuiChip-icon': {
          flexShrink: 0,
          marginLeft: 0,
          ...(tagColor ? { color: tagColor } : {}),
        },
        ...sx,
      }}
      variant={variant as 'filled' | 'outlined'}
      onDelete={onDelete}
    />
  );
};

export default TagChip;
