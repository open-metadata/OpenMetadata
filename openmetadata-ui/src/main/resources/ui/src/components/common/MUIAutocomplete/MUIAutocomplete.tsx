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
import { Autocomplete } from '@mui/material';
import { FC, memo, useCallback, useMemo } from 'react';
import MUITextField from '../MUITextField/MUITextField';
import { MUIAutocompleteProps } from './MUIAutocomplete.interface';

const MUIAutocomplete: FC<MUIAutocompleteProps> = ({
  value = [],
  onChange,
  label,
  placeholder,
  required = false,
  options = [],
  dataTestId,
  ...props
}) => {
  const handleChange = useCallback(
    (_event: unknown, newValue: string[]) => {
      onChange?.(newValue);
    },
    [onChange]
  );

  const hasValue = useMemo(() => value && value.length > 0, [value]);

  return (
    <Autocomplete
      freeSolo
      multiple
      options={options}
      renderInput={(params) => (
        <MUITextField
          {...params}
          label={label}
          placeholder={hasValue ? undefined : placeholder}
          required={required}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            htmlInput: {
              ...params.inputProps,
              'data-testid': dataTestId,
            },
          }}
        />
      )}
      value={value}
      onChange={handleChange}
      {...props}
    />
  );
};

export default memo(MUIAutocomplete);
