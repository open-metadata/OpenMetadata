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

import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import React, { FC, memo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TagChip } from '../../../atoms/TagChip';

export interface TreeSearchInputProps {
  open: boolean;
  searchable: boolean;
  searchPlaceholder?: string;
  placeholder?: string;
  label?: ReactNode;
  helperText?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  autoFocus?: boolean;
  loading?: boolean;
  multiple?: boolean;
  selectedOptions: Array<{ id: string; label: string }>;
  hasClearableValue: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  getRootProps: () => any;
  getInputProps: () => any;
  getTagProps: (params: { index: number }) => any;
  getClearProps: () => any;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClear?: () => void;
}

const TreeSearchInput: FC<TreeSearchInputProps> = ({
  open,
  searchable,
  searchPlaceholder,
  placeholder,
  label,
  helperText,
  required = false,
  disabled = false,
  error = false,
  fullWidth = true,
  size = 'small',
  autoFocus = false,
  loading = false,
  multiple = false,
  selectedOptions,
  hasClearableValue,
  inputRef,
  getRootProps,
  getInputProps,
  getTagProps,
  getClearProps,
  onFocus,
  onBlur,
  onKeyDown,
  onClear,
}) => {
  const { t } = useTranslation();
  const inputProps = getInputProps();

  return (
    <Box {...getRootProps()}>
      <TextField
        autoFocus={autoFocus}
        disabled={disabled}
        error={error}
        fullWidth={fullWidth}
        helperText={helperText}
        inputRef={inputRef}
        label={label}
        placeholder={
          searchable && open
            ? searchPlaceholder || t('label.search')
            : placeholder
        }
        required={required}
        size={size}
        slotProps={{
          htmlInput: inputProps,
          input: {
            endAdornment: (
              <InputAdornment position="end">
                {loading && <CircularProgress size={20} />}
                {hasClearableValue && !disabled && (
                  <IconButton
                    disableFocusRipple
                    edge="end"
                    size="small"
                    sx={{
                      visibility: hasClearableValue ? 'visible' : 'hidden',
                    }}
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur from happening
                      e.stopPropagation();
                      if (onClear) {
                        onClear();
                      } else {
                        const clearProps = getClearProps() as unknown as Record<
                          string,
                          unknown
                        >;
                        if (clearProps.onClick) {
                          (clearProps.onClick as (e: React.MouseEvent) => void)(
                            {} as React.MouseEvent
                          );
                        }
                      }
                    }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </InputAdornment>
            ),
            startAdornment: multiple && (
              <>
                {selectedOptions.map((option, index: number) => {
                  const { onDelete, ...tagProps } = getTagProps({ index });

                  return (
                    <TagChip
                      {...tagProps}
                      key={option.id}
                      label={option.label}
                      size="small"
                      onDelete={onDelete}
                    />
                  );
                })}
              </>
            ),
          },
        }}
        sx={{
          '& .MuiInputBase-root': {
            flexWrap: 'wrap',
            alignItems: 'center',
            paddingTop: '6px',
            paddingBottom: '6px',
            paddingLeft: '6px',
            '& .MuiInputBase-input': {
              minWidth: 30,
              width: 'auto',
              flexGrow: 1,
              padding: '4px 0 4px 6px',
            },
            '& .MuiChip-root': {
              margin: '3px',
            },
          },
        }}
        variant="outlined"
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />
    </Box>
  );
};

export default memo(TreeSearchInput);
