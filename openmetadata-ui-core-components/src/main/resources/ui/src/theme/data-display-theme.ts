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
import type { Components, Theme } from "@mui/material/styles";
import { shadows } from "./shadows";
import {
  BODY_FONT_SIZES,
  BODY_LINE_HEIGHTS,
  COMPONENT_FONT_SIZES,
} from './typography-constants';

export const dataDisplayTheme = (
  colors: any
): Components<Theme> & Record<string, any> => ({
  MuiCard: {
    styleOverrides: {
      root: {
        boxShadow:
          "0px 1px 3px rgba(10, 13, 18, 0.1), 0px 1px 2px -1px rgba(10, 13, 18, 0.1)",
        borderRadius: "12px",
        border: `1px solid ${colors.gray[200]}`,
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
      },
      elevation1: {
        boxShadow: "0px 1px 2px rgba(10, 13, 18, 0.05)",
      },
      elevation2: {
        boxShadow:
          "0px 1px 3px rgba(10, 13, 18, 0.1), 0px 1px 2px -1px rgba(10, 13, 18, 0.1)",
      },
      elevation3: {
        boxShadow:
          "0px 4px 6px -1px rgba(10, 13, 18, 0.1), 0px 2px 4px -2px rgba(10, 13, 18, 0.06)",
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: "12px",
        fontSize: "1rem",
        backgroundColor: colors.white,
        border: `1px solid ${colors.gray[300]}`,
        color: colors.gray[900],
        boxShadow: shadows.xs,

        "& .MuiAlert-icon .MuiSvgIcon-root": {
          position: "relative" as const,
          display: "flex" as const,
          alignItems: "center",
          justifyContent: "center",
          marginRight: "16px",

          "&::before": {
            content: '""',
            position: "absolute" as const,
            inset: "-8px",
            borderRadius: "50%",
            border: "2px solid",
            borderColor: "currentColor",
            opacity: 0.3,
            pointerEvents: "none",
          },
          "&::after": {
            content: '""',
            position: "absolute" as const,
            inset: "-16px",
            borderRadius: "50%",
            border: "2px solid",
            borderColor: "currentColor",
            opacity: 0.1,
            pointerEvents: "none",
          },
        },
      },
    },
  },
  MuiChip: {
    defaultProps: {
      variant: "filled",
      size: "medium",
    },
    styleOverrides: {
      root: {
        display: "inline-flex" as const,
        alignItems: "center",
        whiteSpace: "nowrap" as const,
        borderRadius: "6px",
        fontWeight: 500,
        border: "1px solid",
        transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",

        height: "auto",
        "& .MuiChip-label": {
          padding: 0,
          overflow: "visible" as const,
          textOverflow: "clip" as const,
        },
        "& .MuiChip-icon": {
          marginLeft: 0,
          marginRight: "4px",
        },
        "& .MuiChip-deleteIcon": {
          margin: 0,
          marginLeft: "4px",
          width: "12px",
          height: "12px",
          color: "inherit",
          "&:hover": {
            color: "inherit",
          },
        },
      },

      sizeSmall: {
        padding: "2px 6px",
        fontSize: BODY_FONT_SIZES.CAPTION,
        fontWeight: 500,
        lineHeight: BODY_LINE_HEIGHTS.CAPTION,
      },
      sizeMedium: {
        padding: "2px 8px",
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: BODY_LINE_HEIGHTS.BODY2,
      },

      colorPrimary: {
        backgroundColor: `${colors.brand[50]} !important`,
        color: `${colors.brand[700]} !important`,
        borderColor: `${colors.brand[200]} !important`,
      },
      colorSecondary: {
        backgroundColor: colors.gray[50],
        color: colors.gray[700],
        borderColor: colors.gray[200],
      },
      colorError: {
        backgroundColor: colors.error[50],
        color: colors.error[700],
        borderColor: colors.error[200],
      },
      colorWarning: {
        backgroundColor: colors.warning[50],
        color: colors.warning[700],
        borderColor: colors.warning[200],
      },
      colorSuccess: {
        backgroundColor: colors.success[50],
        color: colors.success[700],
        borderColor: colors.success[200],
      },
      colorInfo: {
        backgroundColor: colors.brand[50],
        color: colors.brand[700],
        borderColor: colors.brand[200],
      },

      filled: {},

      outlined: {
        boxShadow: "none",
      },
    },
    variants: [
      {
        props: { variant: "filled" as any },
        style: {
          borderRadius: "9999px",
        },
      },

      {
        props: { variant: "filled" as any, size: "small" as any },
        style: {
          padding: "2px 8px",
          fontSize: BODY_FONT_SIZES.CAPTION,
          fontWeight: 500,
          borderRadius: "9999px",
        },
      },

      {
        props: { variant: "filled" as any, color: "primary" as any },
        style: {
          backgroundColor: `${colors.brand[50]} !important`,
          color: `${colors.brand[700]} !important`,
          borderColor: `${colors.brand[200]} !important`,
        },
      },
      {
        props: { variant: "filled" as any, color: "secondary" as any },
        style: {
          backgroundColor: `${colors.gray[50]} !important`,
          color: `${colors.gray[700]} !important`,
          borderColor: `${colors.gray[200]} !important`,
        },
      },
      {
        props: { variant: "filled" as any, color: "success" as any },
        style: {
          backgroundColor: `${colors.success[50]} !important`,
          color: `${colors.success[700]} !important`,
          borderColor: `${colors.success[200]} !important`,
        },
      },
      {
        props: { variant: "filled" as any, color: "warning" as any },
        style: {
          backgroundColor: `${colors.warning[50]} !important`,
          color: `${colors.warning[700]} !important`,
          borderColor: `${colors.warning[200]} !important`,
        },
      },
      {
        props: { variant: "filled" as any, color: "error" as any },
        style: {
          backgroundColor: `${colors.error[50]} !important`,
          color: `${colors.error[700]} !important`,
          borderColor: `${colors.error[200]} !important`,
        },
      },

      {
        props: { size: "large" as any },
        style: {
          padding: "4px 8px",
          fontSize: "1rem",
          fontWeight: 500,
          borderRadius: "8px",
          lineHeight: BODY_LINE_HEIGHTS.BODY2, // 20px line height to achieve 30px total height
        },
      },
      {
        props: { variant: "blueGray" as any },
        style: {
          backgroundColor: colors.blueGray[75],
          border: `1px solid ${colors.blueGray[150]}`,
          color: colors.gray[750],
          fontWeight: 400,
          fontSize: "12px",
          borderRadius: "8px",
        },
      },
    ],
  },
  MuiAvatar: {
    styleOverrides: {
      root: {
        backgroundColor: colors.blue[50],
        color: colors.blue[600],
      },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: colors.gray[200],
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        zIndex: 50,
        display: "flex" as const,
        maxWidth: "320px",
        flexDirection: "column" as const,
        alignItems: "flex-start",
        gap: "4px",
        borderRadius: "8px",
        backgroundColor: colors.white,
        color: colors.gray[700],
        padding: "8px 12px",
        fontSize: BODY_FONT_SIZES.CAPTION,
        fontWeight: 600,
        lineHeight: BODY_LINE_HEIGHTS.CAPTION,

        boxShadow:
          shadows.lg ||
          "0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)",

        willChange: "transform",

        "&.MuiTooltip-tooltipPlacementTop": {
          transformOrigin: "center bottom",
        },
        "&.MuiTooltip-tooltipPlacementBottom": {
          transformOrigin: "center top",
        },
        "&.MuiTooltip-tooltipPlacementLeft": {
          transformOrigin: "right center",
        },
        "&.MuiTooltip-tooltipPlacementRight": {
          transformOrigin: "left center",
        },
      },
      arrow: {
        color: colors.white,

        fontSize: "10px",
      },
    },
  },
  MuiModal: {
    styleOverrides: {
      root: {
        position: "fixed" as const,
        inset: 0,
        zIndex: 50,
        display: "flex" as const,
        minHeight: "100dvh",
        width: "100%",
        alignItems: "flex-end",
        justifyContent: "center",
        overflowY: "auto",
        padding: "16px 16px 16px 16px",
        paddingBottom: "clamp(16px, 8vh, 64px)",
        outline: "none",

        "@media (min-width: 640px)": {
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
        },
      },
    },
  },
  MuiBackdrop: {
    styleOverrides: {
      root: {
        ".MuiDialog-root &, .MuiModal-root:not(.MuiPopover-root) &": {
          backgroundColor: "rgba(10, 13, 18, 0.7)",
          backdropFilter: "blur(0px)",
          WebkitBackdropFilter: "blur(0px)",
        },

        ".MuiPopover-root &": {
          backgroundColor: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      root: {
        zIndex: 50,
      },
      paper: {
        borderRadius: "16px",
        backgroundColor: colors.white,
        boxShadow: shadows.xl,
        maxWidth: "544px",
        width: "100%",
        margin: 0,
        position: "relative" as const,
        overflow: "hidden" as const,

        "@media (max-width: 639px)": {
          maxWidth: "100%",
          borderRadius: "12px",
          maxHeight: "100%",
          overflowY: "auto",
        },
      },
      container: {
        display: "flex" as const,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        outline: "none",
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: COMPONENT_FONT_SIZES.INPUT,
        fontWeight: 600,
        color: colors.gray[900],
        padding: "20px 16px 0 16px",
        margin: 0,

        "@media (min-width: 640px)": {
          padding: "24px 24px 0 24px",
        },
      },
    },
  },
  MuiDialogContent: {
    styleOverrides: {
      root: {
        padding: "8px 16px 0 16px",
        fontSize: "1rem",
        color: colors.gray[600],
        margin: 0,

        "@media (min-width: 640px)": {
          padding: "8px 24px 0 24px",
        },
      },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        display: "flex" as const,
        flexDirection: "column-reverse" as const,
        gap: "12px",
        padding: "24px 16px 16px 16px",
        margin: 0,

        "@media (min-width: 640px)": {
          flexDirection: "row" as const,
          alignItems: "center",
          padding: "32px 24px 24px 24px",

          "& .MuiButton-root:first-of-type": {
            marginLeft: "auto",
          },
        },
      },
    },
  },
  MuiTable: {
    styleOverrides: {
      root: {
        tableLayout: "auto",
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        overflowX: "hidden",
      },
    },
  },
  MuiTableContainer: {
    styleOverrides: {
      root: {
        borderRadius: "12px",
        backgroundColor: colors.white,
        boxShadow: `0px 1px 2px rgba(10, 13, 18, 0.05)`,
        border: `1px solid ${colors.gray[200]}`,
        overflow: "hidden" as const,
      },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: {
        backgroundColor: colors.gray[50],
        position: "relative" as const,
        "& .MuiTableRow-root": {
          height: "44px",
        },
        "& .MuiTableCell-root": {
          padding: "8px 24px",
          fontSize: BODY_FONT_SIZES.CAPTION,
          fontWeight: 500,
          color: colors.gray[500],
          whiteSpace: "nowrap" as const,
          position: "relative" as const,
          lineHeight: 1.5,
          letterSpacing: "0.025em",
          textTransform: "none" as const,

          "&::after": {
            content: '""',
            position: "absolute" as const,
            left: 0,
            right: 0,
            bottom: 0,
            height: "1px",
            backgroundColor: colors.gray[200],
            pointerEvents: "none",
          },
          "&:focus-visible::after": {
            backgroundColor: "transparent",
          },
        },
      },
    },
  },
  MuiTableBody: {
    styleOverrides: {
      root: {
        backgroundColor: colors.white,
        "& .MuiTableRow-root": {
          height: "72px",
          position: "relative" as const,
          transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          backgroundColor: "transparent",
          outline: "none",
          "&:hover": {
            backgroundColor: colors.gray[50],
          },
          "&.Mui-selected": {
            backgroundColor: colors.gray[50],
            "&:hover": {
              backgroundColor: colors.gray[50],
            },
          },
          "&:focus-visible": {
            outline: `2px solid ${colors.brand[500]}`,
            outlineOffset: "-2px",
          },

          "&:last-child .MuiTableCell-root::after": {
            display: "none" as const,
          },
        },
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        position: "relative" as const,
        transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&.MuiTableRow-hover:hover": {
          backgroundColor: colors.gray[50],
        },

        "thead &": {
          height: "44px",
        },

        "tbody &": {
          height: "72px",
        },
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: "none",
        position: "relative" as const,
        outline: "none",
        "&:focus-visible": {
          zIndex: 1,
          outline: `2px solid ${colors.brand[500]}`,
          outlineOffset: "-2px",
        },
      },
      head: {
        padding: "8px 24px",
        fontSize: BODY_FONT_SIZES.CAPTION,
        fontWeight: 600,
        color: colors.gray[500],
        whiteSpace: "nowrap" as const,
        position: "relative" as const,
        "&::after": {
          content: '""',
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "1px",
          backgroundColor: colors.gray[200],
          pointerEvents: "none",
        },
        "&:focus-visible::after": {
          backgroundColor: "transparent",
        },
      },
      body: {
        padding: "16px 24px",
        fontFamily:
          'var(--font-inter, "Inter"), -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        fontSize: "1rem", // text-sm
        fontWeight: 400,
        lineHeight: BODY_LINE_HEIGHTS.BODY2, // line-height for text-sm
        letterSpacing: "0%",
        color: "#181D27", // --Component-colors-Utility-Gray-utility-gray-900
        position: "relative" as const,

        "&::after": {
          content: '""',
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "1px",
          width: "100%",
          backgroundColor: colors.gray[200],
          pointerEvents: "none",
        },
        "&:focus-visible::after": {
          opacity: 0,
        },
      },

      sizeSmall: {
        padding: "12px 20px",
        "&.MuiTableCell-head": {
          padding: "8px 20px",
        },
        "&.MuiTableCell-body": {
          padding: "12px 20px",
        },
      },

      paddingCheckbox: {
        width: "44px",
        paddingLeft: "24px",
        paddingRight: 0,
        "&.MuiTableCell-sizeSmall": {
          width: "36px",
          paddingLeft: "20px",
        },
      },
    },
  },
  MuiTableSortLabel: {
    styleOverrides: {
      root: {
        color: "inherit",
        display: "flex" as const,
        alignItems: "center",
        gap: "4px",
        cursor: "pointer" as const,
        "&:hover": {
          color: colors.gray[500],
        },
      },
      icon: {
        fontSize: "12px",
        transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: 1,
      },
    },
  },

  MuiPickersCalendarHeader: {
    styleOverrides: {
      switchViewButton: {
        border: "none !important",
        boxShadow: "none !important",
        "&:hover": {
          border: "none !important",
          boxShadow: "none !important",
        },
      },
    },
  },
  MuiPickersArrowSwitcher: {
    styleOverrides: {
      button: {
        border: "none !important",
        boxShadow: "none !important",
        "&:hover": {
          border: "none !important",
          boxShadow: "none !important",
        },
      },
    },
  },
});
