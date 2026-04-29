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

import { Check } from '@untitledui/icons';
import { normalizeHexColor } from '@/colors/colorValidation';
import { ENTITY_PALETTE_HEX } from '@/colors/entityPalette';
import { Box } from '@/components/base/box/box';
import { Button } from '@/components/base/buttons/button';
import { Typography } from '@/components/foundations/typography';
import { cx } from '@/utils/cx';

export interface ColorPickerFieldProps {
  ariaLabel?: string;
  colors?: string[];
  'data-testid'?: string;
  disabled?: boolean;
  emptyStateLabel?: string;
  id?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  value: string;
}

export const ColorPickerField = ({
  ariaLabel,
  colors,
  'data-testid': dataTestId,
  disabled = false,
  emptyStateLabel,
  id,
  onBlur,
  onChange,
  value,
}: ColorPickerFieldProps) => {
  const normalizedValue = normalizeHexColor(value);
  const palette = (Array.isArray(colors) ? colors : ENTITY_PALETTE_HEX)
    .map((color) => normalizeHexColor(color))
    .filter((color): color is string => Boolean(color));

  if (normalizedValue && !palette.includes(normalizedValue)) {
    palette.push(normalizedValue);
  }

  return (
    <Box
      className="tw:gap-1.5"
      data-testid={dataTestId}
      role="group"
      wrap="wrap">
      {palette.map((color, index) => {
        const isSelected = normalizedValue === color;

        return (
          <Button
            aria-label={`Select color ${color}`}
            aria-pressed={isSelected}
            className={cx(
              'tw:size-[34px] tw:rounded-[10px] tw:p-0! tw:shadow-xs tw:transition tw:duration-150',
              !disabled && 'tw:hover:scale-[1.02]',
              disabled && 'tw:opacity-50',
              isSelected && 'tw:ring-2 tw:ring-white tw:ring-offset-2',
              !isSelected && 'tw:ring-1 tw:ring-black/5',
              'tw:focus-visible:ring-2 tw:focus-visible:ring-brand tw:focus-visible:ring-offset-2'
            )}
            color="tertiary"
            data-testid={dataTestId ? `${dataTestId}-${index}` : undefined}
            iconLeading={
              isSelected ? (
                <Check aria-hidden="true" className="tw:size-5 tw:text-white" />
              ) : undefined
            }
            id={index === 0 ? id : undefined}
            isDisabled={disabled}
            key={color}
            size="sm"
            style={{
              backgroundColor: color,
              boxShadow: isSelected
                ? '0 0 0 1px rgba(16, 24, 40, 0.08)'
                : undefined,
            }}
            onBlur={() => onBlur?.()}
            onClick={() => onChange?.(color)}
          />
        );
      })}

      {!palette.length && (
        <Typography
          aria-label={ariaLabel}
          className="tw:text-tertiary"
          id={id}
          size="text-sm">
          {emptyStateLabel ?? 'No colors available'}
        </Typography>
      )}
    </Box>
  );
};
