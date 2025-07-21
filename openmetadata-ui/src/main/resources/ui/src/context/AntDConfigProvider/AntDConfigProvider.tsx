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

  /**
   * Finds the nearest scrollable ancestor for a given trigger element.
   * Used to position dropdowns or overlays relative to the scroll context.
   * Falls back to document.body if no scrollable container is found.
   */
  const getScrollableContainer = (trigger?: HTMLElement): HTMLElement => {
    // Ensure this runs only in the browser
    if (typeof window === 'undefined' || !trigger) {
      return document.body;
    }

    let node: HTMLElement | null = trigger;

    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);

      // Skip non-rendered or display: contents elements
      const isHidden =
        style.display === 'none' || style.visibility === 'hidden';
      const isDisplayContents = style.display === 'contents';

      if (!isHidden && !isDisplayContents) {
        const overflowY = style.overflowY;
        const overflow = style.overflow;

        // Acceptable scroll values (also includes overlay for Safari)
        const scrollableValues = ['auto', 'scroll', 'overlay'];

        // Check both overflowY and fallback to general overflow
        const isScrollable =
          scrollableValues.includes(overflowY) ||
          scrollableValues.includes(overflow);

        // Ensure actual scroll capacity
        const canScroll = node.scrollHeight > node.clientHeight;

        if (isScrollable && canScroll) {
          return node;
        }
      }

      node = node.parentElement;
    }

    // Fallback to <body> if no scrollable container found
    return document.body;
  };

  useEffect(() => {
    const palette = generatePalette(
      applicationConfig?.customTheme?.primaryColor ?? DEFAULT_THEME.primaryColor
    );
    palette.forEach((color, index) => {
      switch (index) {
        case 0:
          document.documentElement.style.setProperty(`--ant-primary-25`, color);

          break;
        case 1:
          document.documentElement.style.setProperty(`--ant-primary-50`, color);

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
      palette[8]
    );
  }, [applicationConfig?.customTheme?.primaryColor]);

  ConfigProvider.config({
    theme: {
      ...applicationConfig?.customTheme,
    },
  });

  return (
    <ConfigProvider
      direction={i18n.dir()}
      getPopupContainer={getScrollableContainer}>
      {children}
    </ConfigProvider>
  );
};

export default AntDConfigProvider;
