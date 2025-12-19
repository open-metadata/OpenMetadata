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
  getRootProps: () => React.HTMLAttributes<HTMLDivElement>;
  getInputProps: () => React.InputHTMLAttributes<HTMLInputElement> & {
    ref: React.Ref<HTMLInputElement>;
  };
  getTagProps: (params: { index: number }) => {
    key: number;
    'data-tag-index': number;
    tabIndex: -1;
    onDelete: (event: React.SyntheticEvent) => void;
  };
  getClearProps: () => React.HTMLAttributes<HTMLButtonElement>;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClear?: () => void;
  'data-testid'?: string;
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
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();
  const inputProps = getInputProps();
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus();
  };

  const handleBlur = (e: React.FocusEvent) => {
    setIsFocused(false);
    onBlur(e);
  };

  return (
    <Box
      {...getRootProps()}
      className={isFocused ? 'focused' : undefined}
      sx={{
        '&.focused .MuiIconButton-root': {
          visibility: 'visible',
        },
        '@media (pointer: fine)': {
          '&:hover .MuiIconButton-root': {
            visibility: 'visible',
          },
        },
      }}>
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
          htmlInput: {
            ...inputProps,
            'data-testid': dataTestId,
          },
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
                      visibility: 'hidden',
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
                      onDelete={() => onDelete({} as React.SyntheticEvent)}
                    />
                  );
                })}
              </>
            ),
          },
        }}
        sx={{
          '& .MuiInputBase-root': {
            position: 'relative',
            flexWrap: 'wrap',
            padding:
              size === 'small'
                ? hasClearableValue || loading
                  ? '6px 39px 6px 6px'
                  : '6px'
                : hasClearableValue || loading
                ? '9px 39px 9px 9px'
                : '9px',
            '& .MuiInputBase-input': {
              width: 0,
              minWidth: 30,
              flexGrow: 1,
              padding:
                size === 'small'
                  ? '2.5px 4px 2.5px 8px'
                  : '7.5px 4px 7.5px 5px',
            },
            '& .MuiChip-root': {
              margin: size === 'small' ? '2px' : '3px',
              maxWidth:
                size === 'small' ? 'calc(100% - 4px)' : 'calc(100% - 6px)',
            },
            '& .MuiInputAdornment-root': {
              position: 'absolute',
              right: 9,
              top: '50%',
              transform: 'translateY(-50%)',
            },
          },
        }}
        variant="outlined"
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={onKeyDown}
      />
    </Box>
  );
};

export default memo(TreeSearchInput);
