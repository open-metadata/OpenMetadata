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
import { useEffect } from 'react';
import { DEFAULT_THEME } from '../constants/Appearance.constants';
import { generatePalette } from '../styles/colorPallet';
import { useApplicationStore } from './useApplicationStore';

// The LESS reads the brand and status colours through these variables
// (`@primary-color: var(--ant-primary-color)`, `@success-color`, ...). The
// antd stylesheet still supplies their defaults; only the configured ones are
// written, as antd's ConfigProvider.config did.
const THEME_COLOR_VARIABLES = {
  primaryColor: '--ant-primary-color',
  successColor: '--ant-success-color',
  warningColor: '--ant-warning-color',
  errorColor: '--ant-error-color',
  infoColor: '--ant-info-color',
} as const;

/** Writes the configured theme into the app-wide CSS variables. */
export const useThemeCssVariables = () => {
  const applicationConfig = useApplicationStore(
    (state) => state.applicationConfig
  );
  const customTheme = applicationConfig?.customTheme;

  useEffect(() => {
    Object.entries(THEME_COLOR_VARIABLES).forEach(([key, variable]) => {
      const color = customTheme?.[key as keyof typeof THEME_COLOR_VARIABLES];
      if (color) {
        document.documentElement.style.setProperty(variable, color);
      } else {
        // A cleared colour falls back to the stylesheet default again.
        document.documentElement.style.removeProperty(variable);
      }
    });
  }, [customTheme]);

  useEffect(() => {
    const palette = generatePalette(
      customTheme?.primaryColor ?? DEFAULT_THEME.primaryColor
    );
    // Use custom hover color if provided, otherwise use generated palette[1]
    const hoverColor =
      customTheme?.hoverColor || palette[2] || DEFAULT_THEME.hoverColor;
    const selectedColor =
      customTheme?.selectedColor || palette[8] || DEFAULT_THEME.hoverColor;
    palette.forEach((color, index) => {
      switch (index) {
        case 0:
          document.documentElement.style.setProperty(`--ant-primary-25`, color);

          break;
        case 1:
          document.documentElement.style.setProperty(`--ant-primary-50`, color);

          break;
        case 2:
          document.documentElement.style.setProperty(
            `--ant-primary-1`,
            hoverColor
          );

          break;
        case 8:
          document.documentElement.style.setProperty(
            `--ant-primary-7`,
            selectedColor
          );

          break;
        default:
          document.documentElement.style.setProperty(
            `--ant-primary-${index - 1}`,
            color
          );
      }
    });

    document.documentElement.style.setProperty(
      `--ant-primary-color-hover`,
      palette[6]
    );
    document.documentElement.style.setProperty(
      `--ant-primary-color-active`,
      selectedColor
    );
  }, [
    customTheme?.primaryColor,
    customTheme?.hoverColor,
    customTheme?.selectedColor,
  ]);
};
