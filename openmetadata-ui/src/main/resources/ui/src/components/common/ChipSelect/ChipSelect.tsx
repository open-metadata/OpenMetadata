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

import { Box, Chip, FormHelperText, Typography, useTheme } from '@mui/material';
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
  'data-testid': dataTestId,
}) => {
  const theme = useTheme();
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
          sx={{ mb: 2 }}
          variant="body2">
          {label}
          {required && (
            <Typography color="error" component="span">
              {' *'}
            </Typography>
          )}
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
              sx={{
                fontSize: '12px',

                borderColor: isSelected ? 'primary.main' : 'grey.200',
                backgroundColor: isSelected ? 'primary.main' : 'grey.50',
                color: isSelected ? 'primary.contrastText' : 'text.primary',
                '&:hover': {
                  backgroundColor: isSelected ? 'primary.dark' : 'action.hover',
                },
                '& .MuiChip-icon': {
                  color: isSelected ? 'primary.contrastText' : 'text.primary',
                },
                borderRadius: '4px',
              }}
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
