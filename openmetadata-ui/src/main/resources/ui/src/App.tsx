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
import DomainProvider from './components/Domain/DomainProvider/DomainProvider';
import { EntityExportModalProvider } from './components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import ApplicationsProvider from './components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import WebAnalyticsProvider from './components/WebAnalytics/WebAnalyticsProvider';
import { TOAST_OPTIONS } from './constants/Toasts.constants';
import DirectionProvider from './context/DirectionProvider/DirectionProvider';
import GlobalSearchProvider from './context/GlobalSearchProvider/GlobalSearchProvider';
import PermissionProvider from './context/PermissionProvider/PermissionProvider';
import TourProvider from './context/TourProvider/TourProvider';
import WebSocketProvider from './context/WebSocketProvider/WebSocketProvider';
import { useApplicationStore } from './hooks/useApplicationStore';
import { getCustomLogoConfig } from './rest/settingConfigAPI';
import { history } from './utils/HistoryUtils';
import i18n from './utils/i18next/LocalUtil';

const App: FC = () => {
  const { applicationConfig, setApplicationConfig } = useApplicationStore();

  const fetchApplicationConfig = async () => {
    try {
      const data = await getCustomLogoConfig();

      setApplicationConfig({
        ...data,
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
    const faviconHref = isEmpty(applicationConfig?.customFaviconUrlPath)
      ? '/favicon.png'
      : applicationConfig?.customFaviconUrlPath ?? '/favicon.png';
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
              <DirectionProvider>
                <AuthProvider childComponentType={AppRouter}>
                  <TourProvider>
                    <HelmetProvider>
                      <WebAnalyticsProvider>
                        <PermissionProvider>
                          <WebSocketProvider>
                            <GlobalSearchProvider>
                              <ApplicationsProvider>
                                <DomainProvider>
                                  <EntityExportModalProvider>
                                    <AppRouter />
                                  </EntityExportModalProvider>
                                </DomainProvider>
                              </ApplicationsProvider>
                            </GlobalSearchProvider>
                          </WebSocketProvider>
                        </PermissionProvider>
                      </WebAnalyticsProvider>
                    </HelmetProvider>
                  </TourProvider>
                </AuthProvider>
              </DirectionProvider>
            </ErrorBoundary>
          </I18nextProvider>
        </Router>
        <ToastContainer {...TOAST_OPTIONS} newestOnTop />
      </div>
    </div>
  );
};

export default App;
