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
import type { ThemeColors } from "../types";
import { BODY_FONT_SIZES, BODY_LINE_HEIGHTS } from "./typography-constants";

export const tabTheme = (
  colors: ThemeColors
): Pick<Components<Theme>, "MuiTabs" | "MuiTab"> => ({
  MuiTabs: {
    styleOverrides: {
      root: () => ({
        width: "100%",
        background: colors.white,
        color: colors.gray[900],
        "& .MuiTabs-scroller": {
          height: "48px",
          backgroundColor: colors.white,
          borderRadius: "12px",
          border: `1px solid ${colors.blueGray?.[100] || colors.gray[200]}`,
          padding: "0 20px",
        },
        "& .MuiTabs-flexContainer": {
          gap: "8px",
        },
        "& .MuiTab-root": {
          textTransform: "none" as const,
          fontSize: BODY_FONT_SIZES.BODY1,
          fontWeight: 400,
          color: colors.gray[900],
          textAlign: "center",
          "&.Mui-selected": {
            color: colors.blue?.[700],
            fontWeight: 600,
            fontSize: BODY_FONT_SIZES.BODY1,
          },
          "&.Mui-disabled": {
            color: colors.gray[400],
            cursor: "not-allowed",
            "&:hover": {
              backgroundColor: "transparent",
              color: colors.gray[300],
            },
          },
          "&:hover": {
            color: colors.brand[600],
            backgroundColor: "transparent",
          },
        },
        "& .MuiTabs-indicator": {
          height: "2px",
          backgroundColor: colors.blue?.[700],
          bottom: "6px",
        },
      }),
    },
  },
  MuiTab: {
    styleOverrides: {
      root: () => ({
        textTransform: "none" as const,
        fontSize: BODY_FONT_SIZES.BODY1,
        fontWeight: 400,
        lineHeight: BODY_LINE_HEIGHTS.BODY1,
        color: colors.gray[900],
        textAlign: "center",
        minWidth: "auto",
        padding: "8px 12px",
        "&.Mui-selected": {
          color: colors.blue?.[700],
          fontWeight: 600,
          fontSize: BODY_FONT_SIZES.BODY1,
          lineHeight: BODY_LINE_HEIGHTS.BODY1,
        },
        "&.Mui-disabled": {
          color: colors.gray[400],
          cursor: "not-allowed",
        },
      }),
    },
  },
});
