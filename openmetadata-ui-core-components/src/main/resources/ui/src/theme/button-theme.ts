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
import type { Components, Theme } from '@mui/material/styles';
import {
  buttonConstants,
  createIconButtonColorVariant,
  createIconButtonSizeVariant,
} from '../utils/buttonConstants';
import { COMPONENT_FONT_SIZES, COMPONENT_LINE_HEIGHTS } from './typography-constants';

export const buttonTheme = (
  colors: any
): Pick<
  Components<Theme>,
  'MuiButtonBase' | 'MuiButton' | 'MuiIconButton' | 'MuiButtonGroup'
> => ({
  MuiButtonBase: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: {
        '&.Mui-disabled': {
          cursor: 'not-allowed !important' as const,
          pointerEvents: 'auto !important' as const,
        },
      },
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        borderRadius: '8px',
        textTransform: 'none' as const,
        fontWeight: 600,
        lineHeight: 1.43,
        transition: 'all 100ms linear',
        position: 'relative' as const,
        '&:focus-visible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
        },
        '&.Mui-disabled': {
          backgroundColor: colors.gray[100],
          color: colors.gray[500],
          boxShadow: buttonConstants.shadows.XS_DISABLED(colors.gray[200]),
          border: 'none',
          '&:hover': {
            backgroundColor: colors.gray[100],
          },
        },

        '& .MuiButton-startIcon, & .MuiButton-endIcon': {
          '& > svg, & > *': {
            fontSize: '20px',
            width: '20px',
            height: '20px',
          },
        },
      },
      sizeSmall: {
        padding: '8px 12px',
        fontSize: COMPONENT_FONT_SIZES.BUTTON_SMALL,
        lineHeight: COMPONENT_LINE_HEIGHTS.BUTTON_SMALL,
        ...buttonConstants.iconStyles.sizeMargins.small,
      },
      sizeMedium: {
        padding: '10px 14px',
        fontSize: COMPONENT_FONT_SIZES.BUTTON_MEDIUM,
        lineHeight: COMPONENT_LINE_HEIGHTS.BUTTON_MEDIUM,
        ...buttonConstants.iconStyles.sizeMargins.medium,
      },
      sizeLarge: {
        padding: '10px 16px',
        fontSize: COMPONENT_FONT_SIZES.BUTTON_LARGE,
        lineHeight: COMPONENT_LINE_HEIGHTS.BUTTON_LARGE,
        ...buttonConstants.iconStyles.sizeMargins.large,
      },
      contained: {},
      containedPrimary: {
        backgroundColor: colors.brand[600],
        color: colors.white,
        boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC('transparent'),
        border: 'none',
        position: 'relative' as const,
        ...buttonConstants.pseudoElements.whiteBorder,
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.brand[700],
          boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC('transparent'),
        },
        '&.Mui-disabled': {
          backgroundColor: colors.gray[100],
          color: colors.gray[500],
          boxShadow: buttonConstants.shadows.XS_DISABLED(colors.gray[200]),
        },
      },
      containedSecondary: {
        backgroundColor: colors.white,
        color: colors.gray[700],
        boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.gray[300]),
        border: 'none',
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.gray[50],
          color: colors.gray[800],
          boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.gray[300]),
        },
        '&:focus-visible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
          boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.gray[300]),
        },
        '&.Mui-disabled': {
          backgroundColor: colors.gray[100],
          color: colors.gray[500],
          boxShadow: buttonConstants.shadows.XS_DISABLED(colors.gray[200]),
        },
      },
      containedError: {
        backgroundColor: colors.error[600],
        color: colors.white,
        boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC('transparent'),
        border: 'none',
        position: 'relative' as const,
        ...buttonConstants.pseudoElements.whiteBorder,
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.error[600],
          color: colors.white,
          boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC('transparent'),
        },
        '&:focus-visible': {
          outline: `2px solid ${colors.error[600]}`,
          outlineOffset: '2px',
        },
        '&.Mui-disabled': {
          backgroundColor: colors.gray[100],
          color: colors.gray[500],
          boxShadow: buttonConstants.shadows.XS_DISABLED(colors.gray[200]),
        },
      },
      outlined: {
        border: 'none',
        '&:hover': {
          border: 'none',
        },
      },
      outlinedPrimary: {
        borderColor: 'transparent',
        color: colors.gray[700],
        backgroundColor: colors.white,
        boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.gray[300]),
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.gray[50],
          borderColor: 'transparent',
          color: colors.gray[800],
          boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.gray[300]),
        },
        '&:focus-visible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
          boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.gray[300]),
        },
        '&.Mui-disabled': {
          backgroundColor: colors.gray[100],
          borderColor: 'transparent',
          color: colors.gray[500],
          boxShadow: buttonConstants.shadows.XS_DISABLED(colors.gray[200]),
        },
      },
      outlinedError: {
        borderColor: 'transparent',
        color: colors.error[600],
        backgroundColor: colors.white,

        boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.error[300]),
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.error[50],
          borderColor: 'transparent',
          color: colors.error[700],
          boxShadow: buttonConstants.shadows.XS_SKEUMORPHIC(colors.error[300]),
        },
        '&:focus-visible': {
          outline: `2px solid ${colors.error[600]}`,
          outlineOffset: '2px',
        },
        '&.Mui-disabled': {
          backgroundColor: colors.white,
          borderColor: 'transparent',
          color: colors.gray[500],

          boxShadow: buttonConstants.shadows.XS_DISABLED(colors.gray[200]),
        },
      },
      text: {
        color: colors.gray[600],
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.gray[50],
          color: colors.gray[700],
        },
      },
      textPrimary: {
        color: colors.gray[600],
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.gray[50],
          color: colors.gray[700],
        },
      },
      textSecondary: {
        color: colors.gray[600],
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.gray[50],
          color: colors.gray[700],
        },
      },
      textError: {
        color: colors.error[600],
        ...buttonConstants.iconStyles.createIconColors(),
        '&:hover': {
          backgroundColor: colors.error[50],
          color: colors.error[700],
        },
        '&:focus-visible': {
          outline: `2px solid ${colors.error[600]}`,
          outlineOffset: '2px',
        },
        '&.Mui-disabled': {
          backgroundColor: 'transparent',
          color: colors.gray[500],
        },
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: '6px',
        transition: 'all 100ms linear',
        position: 'relative' as const,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        height: 'max-content',
        border: 'none',
        '&:focus-visible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
        },

        ...createIconButtonSizeVariant('medium'),
      },

      sizeSmall: createIconButtonSizeVariant('small'),
      sizeMedium: createIconButtonSizeVariant('medium'),
      sizeLarge: createIconButtonSizeVariant('large'),

      colorPrimary: createIconButtonColorVariant('tertiary', colors),
      colorSecondary: createIconButtonColorVariant('secondary', colors),
    },
  },
  MuiButtonGroup: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: {
        position: 'relative' as const,
        zIndex: 0,
        display: 'inline-flex',
        width: 'max-content',
        borderRadius: '8px',
        boxShadow: 'none',

        '& .MuiButton-root': {
          marginLeft: '-1px',

          '&:first-of-type': {
            marginLeft: 0,
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },

          '&:last-of-type': {
            borderTopRightRadius: '8px',
            borderBottomRightRadius: '8px',
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },

          '&:not(:first-of-type):not(:last-of-type)': {
            borderRadius: 0,
          },

          position: 'relative' as const,
          zIndex: 1,
          borderColor: 'transparent',
          backgroundColor: colors.white,
          color: colors.gray[700],
          fontWeight: 600,
          whiteSpace: 'nowrap',

          boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.gray[300]} inset, 0px -2px 0px 0px rgba(10, 13, 18, 0.05) inset`,
          border: 'none',
          transition: 'all 100ms linear',

          '&:hover': {
            backgroundColor: colors.gray[50],
            borderColor: 'transparent',
            color: colors.gray[800],
            zIndex: 2,

            boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${colors.gray[300]} inset, 0px -2px 0px 0px rgba(10, 13, 18, 0.05) inset`,
          },

          '&:focus-visible': {
            zIndex: 10,
            outline: `2px solid ${colors.brand[600]}`,
            outlineOffset: '2px',
          },

          '&.Mui-disabled': {
            cursor: 'not-allowed',
            backgroundColor: colors.white,
            color: colors.gray[500],
          },

          '&.MuiButton-contained': {
            backgroundColor: colors.gray[50],
            color: colors.gray[800],
            zIndex: 1,

            boxShadow: `0px 0px 0px 1px rgba(10, 13, 18, 0.18) inset, 0px -2px 0px 0px rgba(10, 13, 18, 0.05) inset, 0px 0px 0px 1px rgb(213, 215, 218) inset`,

            '&:hover': {
              backgroundColor: colors.gray[50],
              color: colors.gray[800],
              zIndex: 2,
            },

            '&.Mui-disabled': {
              backgroundColor: colors.gray[50],
              color: colors.gray[500],
            },
          },
        },
      },
    },
  },
});
