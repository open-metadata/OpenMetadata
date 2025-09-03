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
  checkboxBlankIcon,
  checkboxCheckedIcon,
  checkboxIndeterminateIcon,
} from '../components/checkbox-icons';

export const formTheme = (colors: any) => ({
  MuiTextField: {
    defaultProps: {
      variant: 'outlined',
      InputLabelProps: {
        shrink: true,
      },
      autoComplete: 'off',
      InputProps: {
        autoComplete: 'off',
      },
    },
    styleOverrides: {
      root: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: '6px',
        height: 'max-content',
        width: '100%',
        margin: 0,
        padding: 0,

        '& .MuiInputLabel-root': {
          position: 'static',
          transform: 'none',
          display: 'flex',
          cursor: 'default',
          alignItems: 'center',
          gap: '2px',
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          fontWeight: 500,
          color: colors.gray[700],
          margin: 0,
          padding: 0,

          '&.Mui-error': {
            color: colors.error[600],
          },
        },
        '& .MuiInputLabel-shrink': {
          transform: 'none',
        },

        '& .MuiFormHelperText-root': {
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          color: colors.gray[600],
          margin: 0,
          padding: 0,

          '&.Mui-error': {
            color: colors.error[600],
          },
        },
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          backgroundColor: colors.white,

          boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.gray[300]} inset`,
          transition: 'box-shadow 100ms linear',
          border: 'none',
          margin: 0,
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
          '&:hover': {
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
          },
          '&.Mui-focused': {
            boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 2px ${colors.brand[600]} inset`,
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
          },
          '&.Mui-disabled': {
            backgroundColor: colors.gray[50],
            boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.gray[300]} inset`,
            cursor: 'not-allowed',
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
          },
          '&.Mui-error': {
            boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.error[300]} inset`,
            '&.Mui-focused': {
              boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 2px ${colors.error[600]} inset`,
            },
          },
        },

        '& .MuiInputAdornment-root': {
          '& .MuiSvgIcon-root': {
            fontSize: '20px',
            width: '20px',
            height: '20px',
            color: '${colors.gray[400]}',
          },
          '&.MuiInputAdornment-positionStart': {
            marginLeft: 0,
            marginRight: '8px',
            paddingLeft: 0,
          },
        },

        '&:has(.MuiInputAdornment-positionStart) .MuiOutlinedInput-input': {
          paddingLeft: 0,
        },

        '&.Mui-disabled': {
          '& .MuiInputAdornment-root .MuiSvgIcon-root': {
            color: colors.gray[500],
          },
        },

        '& .MuiInputBase-multiline': {
          padding: '12px 14px',

          '& .MuiOutlinedInput-input': {
            padding: 0,
            fontSize: '1rem',
            lineHeight: '1.5rem',
            resize: 'vertical',
            minHeight: 'auto',
          },
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        fontSize: '1rem',
        lineHeight: '1.5rem',

        '& .MuiOutlinedInput-notchedOutline': {
          border: 'none',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          border: 'none',
        },
        '&.Mui-disabled': {
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
        },

        '&.MuiOutlinedInput-adornedStart': {
          paddingLeft: '14px',
          '& .MuiInputAdornment-positionStart': {
            marginLeft: 0,
            marginRight: '8px',
          },
        },
      },
      input: {
        display: 'flex',
        height: 'max-content',
        alignItems: 'center',
        padding: '10px 14px',
        margin: 0,
        width: '100%',
        backgroundColor: 'transparent',
        fontSize: '1rem',
        color: '${colors.gray[900]}',
        lineHeight: '1.5rem',
        outline: 'none',
        border: 'none',
        '&::placeholder': {
          color: colors.gray[500],
          opacity: 1,
        },
        '&:disabled': {
          cursor: 'not-allowed',
          color: colors.gray[500],
          backgroundColor: 'transparent',
          '-webkit-text-fill-color': colors.gray[500],
        },
      },

      sizeSmall: {
        fontSize: '1rem',
        '& .MuiOutlinedInput-input': {
          padding: '8px 12px',
        },
      },
    },
  },
  MuiFormControl: {
    styleOverrides: {
      root: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: '6px',
        height: 'max-content',
        width: '100%',
        margin: 0,
        padding: 0,

        '& .MuiInputLabel-root': {
          position: 'static',
          transform: 'none',
          display: 'flex',
          cursor: 'default',
          alignItems: 'center',
          gap: '2px',
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          fontWeight: 500,
          color: colors.gray[700],
          margin: 0,
          padding: 0,

          '&.Mui-error': {
            color: colors.error[600],
          },
        },
        '& .MuiInputLabel-shrink': {
          transform: 'none',
        },

        '& .MuiFormHelperText-root': {
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          color: colors.gray[600],
          margin: 0,
          padding: 0,

          '&.Mui-error': {
            color: colors.error[600],
          },
        },
      },
    },
  },
  MuiSelect: {
    styleOverrides: {
      root: {
        width: '100%',
      },

      outlined: {
        width: '100%',
        borderRadius: '8px',
        backgroundColor: colors.white,
        boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.gray[300]} inset`,
        transition: 'box-shadow 100ms linear',
        border: 'none',

        '& .MuiOutlinedInput-notchedOutline': {
          border: 'none',
        },

        '&.Mui-focused': {
          boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 2px ${colors.brand[600]} inset`,
        },

        '&:focus-visible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
        },

        '&.Mui-disabled': {
          backgroundColor: colors.gray[50],
          boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.gray[300]} inset`,
          cursor: 'not-allowed',
        },

        '&.Mui-error': {
          boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.error[300]} inset`,
          '&.Mui-focused': {
            boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 2px ${colors.error[600]} inset`,
          },
          '&:focus-visible': {
            outline: `2px solid ${colors.error[600]}`,
            outlineOffset: '2px',
          },
        },
      },

      select: {
        display: 'flex',
        height: 'max-content',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-start',
        textAlign: 'left',
        padding: '10px 14px',
        paddingRight: '40px',
        fontSize: '1rem',
        lineHeight: '1.5rem',
        color: '${colors.gray[900]}',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',

        '&.Mui-disabled': {
          color: colors.gray[500],
          cursor: 'not-allowed',
          '-webkit-text-fill-color': colors.gray[500],
        },

        '&.MuiInputBase-inputSizeSmall': {
          padding: '8px 12px',
          paddingRight: '36px',
        },
      },

      icon: {
        color: '${colors.gray[400]}',
        fontSize: '20px',
        right: '14px',

        '.Mui-disabled &': {
          color: colors.gray[500],
        },
      },
    },
  },
  MuiCheckbox: {
    defaultProps: {
      disableRipple: true,
      disableFocusRipple: true,
      icon: checkboxBlankIcon,
      checkedIcon: checkboxCheckedIcon,
      indeterminateIcon: checkboxIndeterminateIcon,
    },
    styleOverrides: {
      root: {
        padding: 0,
        width: '16px',
        height: '16px',
        cursor: 'pointer',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: 0,
        color: colors.gray[300], // Border color for unchecked state

        '&:hover, &:focus, &:focus-visible, &:focus-within, &:active': {
          backgroundColor: 'transparent !important',
          borderRadius: 0,
        },

        '&.Mui-checked': {
          color: colors.brand[600], // Background color for checked state
        },

        '&.Mui-disabled': {
          cursor: 'not-allowed',
          color: colors.gray[300],
          
          '&.Mui-checked': {
            color: colors.gray[200],
          },
        },

        '&.Mui-focusVisible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
          backgroundColor: 'transparent !important',
          borderRadius: '4px',
        },

        '& .MuiTouchRipple-root': {
          display: 'none !important',
        },
      },
      sizeSmall: {
        width: '16px',
        height: '16px',
      },
      sizeMedium: {
        width: '20px',
        height: '20px',

        '&:hover, &:focus, &:focus-visible, &:focus-within, &:active': {
          backgroundColor: 'transparent !important',
          borderRadius: 0,
        },

        '&.Mui-focusVisible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
          backgroundColor: 'transparent !important',
          borderRadius: '6px',
        },

        // Update icon border radius for medium size
        '& .checkbox-icon': {
          borderRadius: '6px !important',
        },

        '& .MuiTouchRipple-root': {
          display: 'none !important',
        },
      },
    },
  },
  MuiRadio: {
    defaultProps: {},
    styleOverrides: {
      root: {
        padding: 0,
        display: 'flex',
        width: '20px',
        height: '20px',
        minWidth: '20px',
        minHeight: '20px',
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        backgroundColor: colors.white,

        boxShadow: `0px 0px 0px 1px ${colors.gray[300]} inset`,
        border: 'none',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',

        '&:hover': {
          backgroundColor: 'transparent',
        },

        '&.Mui-checked': {
          backgroundColor: colors.brand[600],
          boxShadow: `0px 0px 0px 1px ${colors.brand[600]} inset`,

          '& .MuiSvgIcon-root': {
            display: 'none',
          },
          '&::after': {
            content: '""',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: colors.white,
            opacity: 1,
          },
        },

        '&.Mui-disabled': {
          cursor: 'not-allowed',
          backgroundColor: colors.gray[50],
          boxShadow: `0px 0px 0px 1px ${colors.gray[200]} inset`,

          '&.Mui-checked::after': {
            backgroundColor: colors.gray[300],
          },
        },

        '&.Mui-focusVisible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
        },

        '& .MuiSvgIcon-root': {
          display: 'none',
        },
      },

      sizeSmall: {
        width: '16px',
        height: '16px',
        minWidth: '16px',
        minHeight: '16px',

        '&.Mui-checked::after': {
          width: '6px',
          height: '6px',
        },
      },
    },
  },
  MuiRadioGroup: {
    styleOverrides: {
      root: {
        '& .MuiFormControlLabel-root': {
          margin: 0,
          marginBottom: '16px',

          '&:last-child': {
            marginBottom: 0,
          },
        },
      },
    },
  },
  MuiFormControlLabel: {
    styleOverrides: {
      root: {
        display: 'flex',
        alignItems: 'flex-start',
        margin: 0,
        gap: '12px',
        cursor: 'pointer',

        '&.Mui-disabled': {
          cursor: 'not-allowed',
        },

        '&:has(.MuiRadio-sizeSmall), &:has(.MuiCheckbox-sizeSmall)': {
          gap: '8px',

          '& .MuiFormControlLabel-label': {
            fontSize: '0.875rem',
            lineHeight: '1.25rem',
          },
        },

        '& .MuiRadio-root, & .MuiCheckbox-root': {
          marginTop: '2px',
        },
      },
      label: {
        fontSize: '1rem',
        lineHeight: '1.5rem',
        fontWeight: 500,
        color: colors.gray[700],
        cursor: 'pointer',
        userSelect: 'none',
        margin: 0,

        '&.Mui-disabled': {
          color: colors.gray[500],
          cursor: 'not-allowed',
        },
      },
    },
  },
  MuiSwitch: {
    styleOverrides: {
      root: {
        width: 36,
        height: 20,
        padding: 0,

        '&:has(.MuiSwitch-switchBase.Mui-focusVisible)': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
          borderRadius: '12px',
        },

        '& .MuiSwitch-switchBase': {
          padding: 2,
          margin: 0,
          transition: 'transform 150ms ease-linear',
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: colors.white,
            '& + .MuiSwitch-track': {
              backgroundColor: colors.brand[600],
              opacity: 1,
              border: 0,
            },
          },
          '&.Mui-disabled': {
            color: colors.gray[500],
            '& + .MuiSwitch-track': {
              backgroundColor: `${colors.gray[200]} !important`,
              opacity: 1,
            },
          },
          '&.Mui-focusVisible': {
            outline: 'none',
          },
        },
        '& .MuiSwitch-thumb': {
          boxSizing: 'border-box',
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: colors.white,
          boxShadow:
            '0px 1px 3px rgba(10, 13, 18, 0.1), 0px 1px 2px -1px rgba(10, 13, 18, 0.1)',
        },
        '& .MuiSwitch-track': {
          borderRadius: 20,
          backgroundColor: colors.gray[100],
          opacity: 1,
          border: 'none',
        },
      },

      sizeSmall: {
        width: 36,
        height: 20,
      },
      sizeMedium: {
        width: 44,
        height: 24,

        '& .MuiSwitch-switchBase': {
          '&.Mui-checked': {
            transform: 'translateX(20px)',
          },
        },
        '& .MuiSwitch-thumb': {
          width: 20,
          height: 20,
        },
        '& .MuiSwitch-track': {
          borderRadius: 24,
        },
      },
    },
  },
});
