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

import { Box, Chip, FormHelperText, Typography } from '@mui/material';
import { Check } from '@untitledui/icons';
import { FC } from 'react';
import { ChipSelectProps } from './ChipSelect.interface';

const ChipSelect: FC<ChipSelectProps> = ({
  options,
  value,
  onChange,
  label,
  required = false,
  error,
  helperText,
  disabled = false,
  dataTestId,
}) => {
  const handleChipClick = (optionValue: string) => {
    if (!disabled) {
      onChange(optionValue);
    }
  };

  return (
    <Box data-testid={dataTestId}>
      {label && (
        <Typography
          color={error ? 'error' : 'text.secondary'}
          fontWeight={500}
          sx={{
            mb: 2,
            '&::after': required
              ? {
                  content: '" *"',
                  color: 'error.main',
                }
              : undefined,
          }}
          variant="body2">
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <Chip
              clickable
              data-testid={`chip-${option.value}`}
              disabled={disabled}
              icon={isSelected ? <Check height={12} width={12} /> : undefined}
              key={option.value}
              label={option.label}
              sx={(theme) => ({
                fontSize: theme.typography.caption.fontSize,
                borderColor: isSelected
                  ? theme.palette.allShades.brand[600]
                  : theme.palette.grey[200],
                backgroundColor: isSelected
                  ? theme.palette.allShades.brand[600]
                  : theme.palette.grey[50],
                color: isSelected
                  ? theme.palette.primary.contrastText
                  : theme.palette.grey[900],
                '&:hover': {
                  backgroundColor: isSelected
                    ? theme.palette.primary.dark
                    : theme.palette.grey[100],
                },
                '& .MuiChip-icon': {
                  color: isSelected
                    ? theme.palette.primary.contrastText
                    : theme.palette.grey[900],
                },
                borderRadius: (theme.shape.borderRadius as number) / 2,
              })}
              variant={isSelected ? 'filled' : 'outlined'}
              onClick={() => handleChipClick(option.value)}
            />
          );
        })}
      </Box>
      {helperText && (
        <FormHelperText error={error} sx={{ mt: 0.5 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
};

export default ChipSelect;
