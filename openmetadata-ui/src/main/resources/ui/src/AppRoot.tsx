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

import { ToastProvider } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { FC, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import AntDConfigProvider from './context/AntDConfigProvider/AntDConfigProvider';
import { useApplicationStore } from './hooks/useApplicationStore';
import {
    getAppConfiguration, getCustomUiThemePreference,
    getSystemConfig
} from './rest/settingConfigAPI';
import { getBasePath } from './utils/HistoryUtils';
import i18n from './utils/i18next/LocalUtil';
import { isPlaywrightEnv } from './utils/PlaywrightUtils';
import { getThemeConfig } from './utils/ThemeUtils';

const AppRoot: FC = () => {
  const { initializeAuthState } = useApplicationStore();

  const {
    applicationConfig,
    setApplicationConfig,
    setRdfEnabled,
    setTimeFormat,
  } = useApplicationStore(
    useShallow((state) => ({
      applicationConfig: state.applicationConfig,
      setApplicationConfig: state.setApplicationConfig,
      setRdfEnabled: state.setRdfEnabled,
      setTimeFormat: state.setTimeFormat,
    }))
  );

  const fetchApplicationConfig = async () => {
    try {
      const themeDataPromise = getCustomUiThemePreference().catch((err) => {
        console.error('Failed to fetch theme data:', err);

        return null;
      });
      const systemConfigPromise = getSystemConfig().catch((err) => {
        console.error('Failed to fetch system config:', err);

        return null;
      });
      const appConfigPromise = getAppConfiguration().catch((err) => {
        console.error('Failed to fetch app configuration:', err);

        return null;
      });

      const [themeData, systemConfig, appConfig] = await Promise.all([
        themeDataPromise,
        systemConfigPromise,
        appConfigPromise,
      ]);

      if (themeData) {
        setApplicationConfig({
          ...themeData,
          customTheme: getThemeConfig(themeData.customTheme),
        });
      }
      if (systemConfig) {
        setRdfEnabled(systemConfig.rdfEnabled || false);
      }

      if (appConfig) {
        setTimeFormat((appConfig.defaultTimeFormat as '12h' | '24h') || '12h');
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchApplicationConfig();
    initializeAuthState();
  }, []);

  useEffect(() => {
    const faviconHref = isEmpty(
      applicationConfig?.customLogoConfig?.customFaviconUrlPath
    )
      ? '/favicon.png'
      : applicationConfig?.customLogoConfig?.customFaviconUrlPath ??
        '/favicon.png';
    const link = document.querySelectorAll('link[rel~="icon"]');

    if (!isEmpty(link)) {
      link.forEach((item) => {
        item.setAttribute('href', faviconHref);
      });
    }
  }, [applicationConfig]);

  return (
    <div className="main-container">
      <div className="content-wrapper" data-testid="content-wrapper">
        <BrowserRouter
          basename={getBasePath()}
          useTransitions={!isPlaywrightEnv()}>
          <I18nextProvider i18n={i18n}>
            <AntDConfigProvider>
              <HelmetProvider>
                <ErrorBoundary>
                  <App />
                  <ToastProvider />
                </ErrorBoundary>
              </HelmetProvider>
            </AntDConfigProvider>
          </I18nextProvider>
        </BrowserRouter>
      </div>
    </div>
  );
};

export default AppRoot;
