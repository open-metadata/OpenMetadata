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

import React, { FC, ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import { Router } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import ApplicationConfigProvider from './components/ApplicationConfigProvider/ApplicationConfigProvider';
import { AuthProvider } from './components/authentication/auth-provider/AuthProvider';
import DomainProvider from './components/Domain/DomainProvider/DomainProvider';
import { EntityExportModalProvider } from './components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import GlobalSearchProvider from './components/GlobalSearchProvider/GlobalSearchProvider';
import PermissionProvider from './components/PermissionProvider/PermissionProvider';
import AppRouter from './components/router/AppRouter';
import TourProvider from './components/TourProvider/TourProvider';
import WebSocketProvider from './components/web-scoket/web-scoket.provider';
import WebAnalyticsProvider from './components/WebAnalytics/WebAnalyticsProvider';
import { TOAST_OPTIONS } from './constants/Toasts.constants';
import { history } from './utils/HistoryUtils';
import i18n from './utils/i18next/LocalUtil';

interface AppProps {
  routeElements?: ReactNode;
  sideBarElements?: ReactNode;
}

const App: FC<AppProps> = ({ routeElements, sideBarElements }) => {
  return (
    <div className="main-container">
      <div className="content-wrapper" data-testid="content-wrapper">
        <Router history={history}>
          <I18nextProvider i18n={i18n}>
            <ErrorBoundary>
              <ApplicationConfigProvider
                routeElements={routeElements}
                sideBarElements={sideBarElements}>
                <AuthProvider childComponentType={AppRouter}>
                  <TourProvider>
                    <HelmetProvider>
                      <WebAnalyticsProvider>
                        <PermissionProvider>
                          <WebSocketProvider>
                            <GlobalSearchProvider>
                              <DomainProvider>
                                <EntityExportModalProvider>
                                  <AppRouter />
                                </EntityExportModalProvider>
                              </DomainProvider>
                            </GlobalSearchProvider>
                          </WebSocketProvider>
                        </PermissionProvider>
                      </WebAnalyticsProvider>
                    </HelmetProvider>
                  </TourProvider>
                </AuthProvider>
              </ApplicationConfigProvider>
            </ErrorBoundary>
          </I18nextProvider>
        </Router>
        <ToastContainer {...TOAST_OPTIONS} newestOnTop />
      </div>
    </div>
  );
};

export default App;
