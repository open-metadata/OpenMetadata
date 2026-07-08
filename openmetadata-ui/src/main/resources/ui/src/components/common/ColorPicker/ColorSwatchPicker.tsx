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

import { Box, Label } from '@openmetadata/ui-core-components';
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
    align="center"
    className="tw:absolute tw:top-1/2 tw:left-1/2 tw:h-[45%] tw:w-[45%] tw:-translate-x-1/2 tw:-translate-y-1/2"
    justify="center">
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

const ColorSwatchPicker: FC<ColorPickerProps> = ({
  value,
  onChange,
  colors = defaultColorOptions,
  label,
}) => {
  const handleColorClick = (color: string) => {
    if (onChange) {
      onChange(color);
    }
  };

  return (
    <Box direction="col" gap={2}>
      {label && <Label>{label}</Label>}
      <Box className="tw:gap-1.5" direction="row" wrap="wrap">
        {colors.map((color) => {
          const isSelected = value?.toLowerCase() === color.toLowerCase();

          return (
            <Box
              aria-label={`Select color ${color}`}
              aria-pressed={isSelected}
              className="tw:relative tw:h-8.5 tw:w-8.5 tw:cursor-pointer tw:rounded tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus-ring"
              key={color}
              role="button"
              style={{ backgroundColor: color }}
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
    </Box>
  );
};

export default ColorSwatchPicker;
