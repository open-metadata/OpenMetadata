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
import React, { FC, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../hooks/useApplicationStore';

const AntDConfigProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const { applicationConfig } = useApplicationStore();

  useEffect(() => {
    if (applicationConfig?.customTheme?.primaryColor === '#1570ef') {
      // Set CSS custom property directly on document root
      document.documentElement.style.setProperty('--ant-primary-1', '#d1e9ff');
      document.documentElement.style.setProperty('--ant-primary-3', '#b2ddff');
      document.documentElement.style.setProperty('--ant-primary-4', '#1849a9');
      document.documentElement.style.setProperty('--ant-primary-5', '#1849a9');
      document.documentElement.style.setProperty('--ant-primary-7', '#175cd3');
    } else {
      // Clear the custom properties when primary color is not #1570ef
      document.documentElement.style.removeProperty('--ant-primary-1');
      document.documentElement.style.removeProperty('--ant-primary-3');
      document.documentElement.style.removeProperty('--ant-primary-4');
      document.documentElement.style.removeProperty('--ant-primary-5');
      document.documentElement.style.removeProperty('--ant-primary-7');
    }
  }, [applicationConfig?.customTheme?.primaryColor]);

  ConfigProvider.config({
    theme: {
      ...applicationConfig?.customTheme,
    },
  });

  return <ConfigProvider direction={i18n.dir()}>{children}</ConfigProvider>;
};

export default AntDConfigProvider;
