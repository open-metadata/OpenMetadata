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

import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  SelectProps,
} from '@mui/material';
import { FC, memo, ReactNode } from 'react';

interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface MUISelectProps extends Omit<SelectProps, 'variant'> {
  helperText?: ReactNode;
  options?: SelectOption[];
  placeholder?: string;
}

const MUISelect: FC<MUISelectProps> = ({
  label,
  helperText,
  options = [],
  placeholder,
  required,
  value,
  onChange,
  error,
  size = 'small',
  id,
  ...props
}) => {
  const labelId = id ? `${id}-label` : 'mui-select-label';

  return (
    <FormControl fullWidth error={error} required={required} size={size}>
      {label && <InputLabel id={labelId}>{label}</InputLabel>}
      <Select
        MenuProps={{
          // Set z-index higher than drawer (drawer is now at 1000)
          style: { zIndex: 1100 },
          // Ensure the menu renders in a portal (default behavior)
          disablePortal: false,
          // Additional props to ensure visibility
          PaperProps: {
            style: {
              maxHeight: 300, // Limit dropdown height
            },
          },
        }}
        label={label}
        labelId={labelId}
        value={value || ''}
        onChange={onChange}
        {...props}>
        {placeholder && (
          <MenuItem disabled value="">
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem
            disabled={option.disabled}
            key={option.value}
            value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

export default memo(MUISelect);
