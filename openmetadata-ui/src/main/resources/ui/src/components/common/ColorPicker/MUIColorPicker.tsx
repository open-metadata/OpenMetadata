/*
 *  Copyright 2024 Collate.
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

import { Box, FormControl, FormLabel, useTheme } from '@mui/material';
import { FC } from 'react';

interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  colors?: string[];
  label?: string;
}

// Default color palette from Figma design
const defaultColorOptions = [
  '#1470EF',
  '#7D81E9',
  '#F14C75',
  '#F689A6',
  '#05C4EA',
  '#05A580',
  '#FFB01A',
  '#BF4CF1',
  '#99AADF',
  '#C0B3F2',
  '#EDB3B3',
  '#ECB892',
  '#90DAE3',
  '#82E6C4',
];

// Check icon component following the checkbox-icons pattern
const CheckIcon: FC = () => (
  <Box
    sx={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '45%',
      height: '45%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <svg fill="none" height="100%" viewBox="0 0 14 14" width="100%">
      <path
        d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  </Box>
);

const MUIColorPicker: FC<ColorPickerProps> = ({
  value,
  onChange,
  colors = defaultColorOptions,
  label,
}) => {
  const theme = useTheme();

  const handleColorClick = (color: string) => {
    if (onChange) {
      onChange(color);
    }
  };

  return (
    <FormControl component="fieldset">
      {label && <FormLabel>{label}</FormLabel>}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
        {colors.map((color) => {
          const isSelected = value?.toLowerCase() === color.toLowerCase();

          return (
            <Box
              aria-label={`Select color ${color}`}
              aria-pressed={isSelected}
              key={color}
              role="button"
              sx={{
                position: 'relative',
                width: 34,
                height: 34,
                borderRadius: '4px',
                backgroundColor: color,
                padding: '2px 3px',
                cursor: 'pointer',
                border: '2px solid transparent',
                transition: 'all 0.2s ease',
                opacity: 1,
                '&:focus-visible': {
                  outline: `2px solid ${
                    theme.palette.primary?.main || '#1470EF'
                  }`,
                  outlineOffset: '2px',
                },
              }}
              tabIndex={0}
              onClick={() => handleColorClick(color)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleColorClick(color);
                }
              }}>
              {isSelected && <CheckIcon />}
            </Box>
          );
        })}
      </Box>
    </FormControl>
  );
};

export default MUIColorPicker;
