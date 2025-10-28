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
import { BODY_FONT_SIZES } from './typography-constants';

export const navigationTheme = (colors: any): Components<Theme> => ({
  MuiTabs: {
    styleOverrides: {
      root: {
        width: '100%',
      },

      scroller: {
        margin: 0,
        padding: '0 20px',
        height: '48px',
        backgroundColor: colors.white,
        borderRadius: '12px',
        border: `1px solid ${colors.gray[200]}`,
      },

      indicator: {
        bottom: '6px',
        height: '2px',
        backgroundColor: colors.brand[600],
      },
      flexContainer: {
        borderBottom: 'none',
        height: '100%',
        alignItems: 'center',
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        padding: '8px 12px',
        position: 'relative' as const,
        color: colors.gray[600],
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 0,
        minHeight: 'auto',
        textTransform: 'none' as const,
        fontSize: BODY_FONT_SIZES.BODY2,
        fontWeight: 500,

        '&:not(:first-of-type)': {
          marginLeft: '14px',
        },

        '&:hover': {
          backgroundColor: 'transparent',
          color: colors.gray[700],
        },

        '&:focus-visible': {
          outline: `2px solid ${colors.brand[600]} !important`,
          outlineOffset: '2px',
        },

        '&.Mui-selected': {
          color: colors.brand[600],
          fontWeight: 600,
          backgroundColor: 'transparent',

          '&:hover': {
            color: colors.brand[600],
            backgroundColor: 'transparent',
          },
        },

        '&.Mui-disabled': {
          cursor: 'not-allowed',
          color: colors.gray[300],
          '&:hover': {
            backgroundColor: 'transparent',
            color: colors.gray[300],
          },
        },
      },
    },
  },
  MuiBreadcrumbs: {
    styleOverrides: {
      root: {
        display: 'flex' as const,
        alignItems: 'center',
      },
      ol: {
        display: 'flex' as const,
        alignItems: 'center',
        gap: '8px',
        margin: 0,
        padding: 0,
      },
      separator: {
        fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: BODY_FONT_SIZES.CAPTION,
        fontWeight: 400,
        lineHeight: '18px',
        color: 'rgba(120, 116, 134, 1)',
        margin: 0,
      },
    },
  },
  MuiLink: {
    styleOverrides: {
      root: {
        fontFamily:
          'var(--font-inter, "Inter"), -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        fontSize: BODY_FONT_SIZES.BODY2,
        fontWeight: 400,
        lineHeight: '20px',
        textDecoration: 'none',
        transition: 'color 150ms ease-in-out',

        '&:hover': {
          textDecoration: 'none',
        },

        '&:focus-visible': {
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
          borderRadius: '2px',
        },

        '.MuiBreadcrumbs-root &': {
          color: '#787486',
          '&:hover': {
            color: '#535862',
          },
        },
      },
    },
  },
  MuiPagination: {
    styleOverrides: {
      root: {
        display: 'flex' as const,
        alignItems: 'center',
        gap: '2px',
      },
      ul: {
        margin: 0,
        padding: 0,
        display: 'flex' as const,
        alignItems: 'center',
        gap: '2px',
      },
    },
  },
  MuiPaginationItem: {
    styleOverrides: {
      root: {
        display: 'flex' as const,
        width: '40px',
        height: '40px',
        cursor: 'pointer' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        fontSize: BODY_FONT_SIZES.BODY2,
        fontWeight: 500,
        color: colors.gray[500],
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: '8px',
        minWidth: '40px',
        minHeight: '40px',
        transition: 'all 100ms linear',

        '&:hover': {
          backgroundColor: colors.gray[50],
          color: colors.gray[700],
          borderRadius: '8px',
        },

        '&:focus-visible': {
          zIndex: 10,
          backgroundColor: colors.gray[50],
          outline: `2px solid ${colors.brand[600]}`,
          outlineOffset: '2px',
          borderRadius: '8px',
        },

        '&.Mui-selected': {
          backgroundColor: colors.brand[50],
          color: colors.gray[700],
          borderRadius: '8px',
          '&:hover': {
            backgroundColor: colors.brand[50],
            color: colors.gray[700],
          },
        },

        '&.Mui-disabled': {
          cursor: 'not-allowed',
          color: colors.gray[300],
          '&:hover': {
            backgroundColor: 'transparent',
            color: colors.gray[300],
          },
        },
      },

      rounded: {
        borderRadius: '50%',
      },
      outlined: {
        borderRadius: '8px',
      },

      page: {},

      text: {
        width: 'auto',
        height: 'auto',
        padding: '8px 12px',
        minWidth: 'auto',
        minHeight: 'auto',
      },

      ellipsis: {
        color: colors.gray[600],
        cursor: 'default',
        '&:hover': {
          backgroundColor: 'transparent',
          color: colors.gray[600],
        },
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        width: '248px',
        overflow: 'auto',
        borderRadius: '8px',
        backgroundColor: colors.white,

        boxShadow:
          '0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)',

        border: `1px solid rgba(0, 0, 0, 0.08)`,
        marginTop: '4px',
        willChange: 'transform',
      },
      list: {
        height: 'min-content',
        overflowY: 'auto',
        padding: '4px 0',
        margin: 0,
        outline: 'none',
        userSelect: 'none',
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        position: 'relative' as const,
        display: 'flex' as const,
        alignItems: 'center',
        borderRadius: '6px',
        cursor: 'pointer' as const,
        margin: '1px 6px',
        padding: '8px 10px',
        fontSize: BODY_FONT_SIZES.BODY2,
        fontWeight: 600,
        color: colors.gray[700],
        backgroundColor: 'transparent',
        minHeight: 'auto',
        overflow: 'hidden' as const,
        textOverflow: 'ellipsis' as const,
        whiteSpace: 'nowrap' as const,
        transition: 'all 100ms linear',
        outline: `2px solid ${colors.brand[500]}`,
        outlineOffset: '-2px',
        outlineColor: 'transparent',

        '& .MuiTouchRipple-root': {
          display: 'none',
        },

        '&:hover': {
          backgroundColor: colors.gray[50],
          color: colors.gray[800],
        },

        '&:focus-visible': {
          outlineColor: colors.brand[500],
          backgroundColor: colors.gray[50],
        },

        '&.Mui-selected': {
          backgroundColor: colors.gray[50],
          color: colors.gray[800],
        },

        '&.Mui-disabled': {
          cursor: 'not-allowed',
          color: colors.gray[500],
          '&:hover': {
            backgroundColor: 'transparent',
          },
        },
      },
    },
  },
  MuiTablePagination: {
    styleOverrides: {
      root: {
        borderTop: `1px solid ${colors.gray[200]}`,
        backgroundColor: colors.gray[50],
      },
      toolbar: {
        padding: '12px 24px',
        minHeight: '56px',
      },
      selectLabel: {
        fontSize: BODY_FONT_SIZES.BODY2,
        color: colors.gray[600],
      },
      displayedRows: {
        fontSize: BODY_FONT_SIZES.BODY2,
        color: colors.gray[600],
      },
      select: {
        fontSize: BODY_FONT_SIZES.BODY2,
      },
      actions: {
        marginLeft: '20px',
        '& .MuiIconButton-root': {
          padding: '8px',
          '&:hover': {
            backgroundColor: colors.gray[100],
          },
        },
      },
    },
  },
});
