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
import { ConfigProvider } from 'antd';
import { FC, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_THEME } from '../../constants/Appearance.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { generatePalette } from '../../styles/colorPallet';

const AntDConfigProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const { applicationConfig } = useApplicationStore();

  useEffect(() => {
    const palette = generatePalette(
      applicationConfig?.customTheme?.primaryColor ?? DEFAULT_THEME.primaryColor
    );
    // Use custom hover color if provided, otherwise use generated palette[1]
    const hoverColor =
      applicationConfig?.customTheme?.hoverColor ||
      palette[2] ||
      DEFAULT_THEME.hoverColor;
    const selectedColor =
      applicationConfig?.customTheme?.selectedColor ||
      palette[8] ||
      DEFAULT_THEME.hoverColor;
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
    applicationConfig?.customTheme?.primaryColor,
    applicationConfig?.customTheme?.hoverColor,
    applicationConfig?.customTheme?.selectedColor,
  ]);

  ConfigProvider.config({
    theme: {
      ...applicationConfig?.customTheme,
    },
  });

  return <ConfigProvider direction={i18n.dir()}>{children}</ConfigProvider>;
};

export default AntDConfigProvider;
