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
import {
  Checkbox as MuiCheckbox,
  CheckboxProps,
  useTheme,
} from '@mui/material';
import React from 'react';

// Small size checkbox icons (16x16, size-4)
const CheckboxBlankIcon = ({
  disabled,
  theme,
}: {
  disabled?: boolean;
  theme: any;
}) => {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        backgroundColor: disabled
          ? theme.palette.grey[50]
          : theme.palette.background.paper,
        borderRadius: 4,
        boxShadow: `0 0 0 1px ${theme.palette.grey[300]} inset`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    />
  );
};

const CheckboxCheckedIcon = ({
  disabled,
  theme,
}: {
  disabled?: boolean;
  theme: any;
}) => {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        backgroundColor: disabled
          ? theme.palette.grey[50]
          : theme.palette.primary.main,
        borderRadius: 4,
        boxShadow: disabled
          ? `0 0 0 1px ${theme.palette.grey[300]} inset`
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      <svg
        fill="none"
        height="12"
        style={{ position: 'absolute' }}
        viewBox="0 0 14 14"
        width="12">
        <path
          d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
          stroke={
            disabled
              ? theme.palette.grey[300]
              : theme.palette.primary.contrastText
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

const CheckboxIndeterminateIcon = ({
  disabled,
  theme,
}: {
  disabled?: boolean;
  theme: any;
}) => {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        backgroundColor: disabled
          ? theme.palette.grey[50]
          : theme.palette.primary.main,
        borderRadius: 4,
        boxShadow: disabled
          ? `0 0 0 1px ${theme.palette.grey[300]} inset`
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      <svg
        fill="none"
        height="10"
        style={{ position: 'absolute' }}
        viewBox="0 0 14 14"
        width="10">
        <path
          d="M2.91675 7H11.0834"
          stroke={
            disabled
              ? theme.palette.grey[300]
              : theme.palette.primary.contrastText
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

// Medium size checkbox icons (20x20, size-5)
const CheckboxBlankIconMedium = ({
  disabled,
  theme,
}: {
  disabled?: boolean;
  theme: any;
}) => {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        backgroundColor: disabled
          ? theme.palette.grey[50]
          : theme.palette.background.paper,
        borderRadius: 6,
        boxShadow: `0 0 0 1px ${theme.palette.grey[300]} inset`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    />
  );
};

const CheckboxCheckedIconMedium = ({
  disabled,
  theme,
}: {
  disabled?: boolean;
  theme: any;
}) => {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        backgroundColor: disabled
          ? theme.palette.grey[50]
          : theme.palette.primary.main,
        borderRadius: 6,
        boxShadow: disabled
          ? `0 0 0 1px ${theme.palette.grey[300]} inset`
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      <svg
        fill="none"
        height="14"
        style={{ position: 'absolute' }}
        viewBox="0 0 14 14"
        width="14">
        <path
          d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
          stroke={
            disabled
              ? theme.palette.grey[300]
              : theme.palette.primary.contrastText
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

const CheckboxIndeterminateIconMedium = ({
  disabled,
  theme,
}: {
  disabled?: boolean;
  theme: any;
}) => {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        backgroundColor: disabled
          ? theme.palette.grey[50]
          : theme.palette.primary.main,
        borderRadius: 6,
        boxShadow: disabled
          ? `0 0 0 1px ${theme.palette.grey[300]} inset`
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      <svg
        fill="none"
        height="14"
        style={{ position: 'absolute' }}
        viewBox="0 0 14 14"
        width="14">
        <path
          d="M2.91675 7H11.0834"
          stroke={
            disabled
              ? theme.palette.grey[300]
              : theme.palette.primary.contrastText
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

// Themed checkbox component that uses correct icons based on size
export const ThemedCheckbox = React.forwardRef<
  HTMLButtonElement,
  CheckboxProps
>(({ size = 'small', disabled, ...props }, ref) => {
  const theme = useTheme();
  const isMedium = size === 'medium';

  // Create icon components with disabled prop and theme
  const BlankIcon = () =>
    isMedium ? (
      <CheckboxBlankIconMedium disabled={disabled} theme={theme} />
    ) : (
      <CheckboxBlankIcon disabled={disabled} theme={theme} />
    );
  const CheckedIcon = () =>
    isMedium ? (
      <CheckboxCheckedIconMedium disabled={disabled} theme={theme} />
    ) : (
      <CheckboxCheckedIcon disabled={disabled} theme={theme} />
    );
  const IndeterminateIcon = () =>
    isMedium ? (
      <CheckboxIndeterminateIconMedium disabled={disabled} theme={theme} />
    ) : (
      <CheckboxIndeterminateIcon disabled={disabled} theme={theme} />
    );

  return (
    <MuiCheckbox
      checkedIcon={<CheckedIcon />}
      disabled={disabled}
      icon={<BlankIcon />}
      indeterminateIcon={<IndeterminateIcon />}
      ref={ref}
      size={size}
      {...props}
    />
  );
});

ThemedCheckbox.displayName = 'ThemedCheckbox';
