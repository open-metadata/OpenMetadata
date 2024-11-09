/*
 *  Copyright 2022 Collate.
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

import { isEmpty } from 'lodash';
import React, { FC, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import { Router } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import AppRouter from './components/AppRouter/AppRouter';
import { AuthProvider } from './components/Auth/AuthProviders/AuthProvider';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import { EntityExportModalProvider } from './components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import ApplicationsProvider from './components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import WebAnalyticsProvider from './components/WebAnalytics/WebAnalyticsProvider';
import { TOAST_OPTIONS } from './constants/Toasts.constants';
import AntDConfigProvider from './context/AntDConfigProvider/AntDConfigProvider';
import PermissionProvider from './context/PermissionProvider/PermissionProvider';
import TourProvider from './context/TourProvider/TourProvider';
import WebSocketProvider from './context/WebSocketProvider/WebSocketProvider';
import { useApplicationStore } from './hooks/useApplicationStore';
import { getCustomUiThemePreference } from './rest/settingConfigAPI';
import { history } from './utils/HistoryUtils';
import i18n from './utils/i18next/LocalUtil';
import { getThemeConfig } from './utils/ThemeUtils';

const App: FC = () => {
  const { applicationConfig, setApplicationConfig } = useApplicationStore();

  const fetchApplicationConfig = async () => {
    try {
      const data = await getCustomUiThemePreference();

      setApplicationConfig({
        ...data,
        customTheme: getThemeConfig(data.customTheme),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  useEffect(() => {
    fetchApplicationConfig();
  }, []);

  useEffect(() => {
    const faviconHref = isEmpty(
      applicationConfig?.customLogoConfig?.customFaviconUrlPath
    )
      ? '/favicon.png'
      : applicationConfig?.customLogoConfig?.customFaviconUrlPath ??
        '/favicon.png';
    const link = document.querySelector('link[rel~="icon"]');

    if (link) {
      link.setAttribute('href', faviconHref);
    }
  }, [applicationConfig]);

  return (
    <div className="main-container">
      <div className="content-wrapper" data-testid="content-wrapper">
        <Router history={history}>
          <I18nextProvider i18n={i18n}>
            <ErrorBoundary>
              <AntDConfigProvider>
                <AuthProvider childComponentType={AppRouter}>
                  <TourProvider>
                    <HelmetProvider>
                      <WebAnalyticsProvider>
                        <PermissionProvider>
                          <WebSocketProvider>
                            <ApplicationsProvider>
                              <EntityExportModalProvider>
                                <AppRouter />
                              </EntityExportModalProvider>
                            </ApplicationsProvider>
                          </WebSocketProvider>
                        </PermissionProvider>
                      </WebAnalyticsProvider>
                    </HelmetProvider>
                  </TourProvider>
                </AuthProvider>
              </AntDConfigProvider>
            </ErrorBoundary>
          </I18nextProvider>
        </Router>
        <ToastContainer {...TOAST_OPTIONS} newestOnTop />
      </div>
    </div>
  );
};

export default App;
