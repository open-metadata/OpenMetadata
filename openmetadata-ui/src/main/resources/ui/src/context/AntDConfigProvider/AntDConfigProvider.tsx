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
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../hooks/useApplicationStore';

const AntDConfigProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const { applicationConfig } = useApplicationStore();

  ConfigProvider.config({
    theme: {
      ...applicationConfig?.customTheme,
    },
  });

  return <ConfigProvider direction={i18n.dir()}>{children}</ConfigProvider>;
};

export default AntDConfigProvider;
