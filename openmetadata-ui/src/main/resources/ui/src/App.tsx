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
import { FC, useEffect, useMemo } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import AppRouter from './components/AppRouter/AppRouter';
import { AuthProvider } from './components/Auth/AuthProviders/AuthProvider';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import { EntityExportModalProvider } from './components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import ApplicationsProvider from './components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import WebAnalyticsProvider from './components/WebAnalytics/WebAnalyticsProvider';
import AirflowStatusProvider from './context/AirflowStatusProvider/AirflowStatusProvider';
import AntDConfigProvider from './context/AntDConfigProvider/AntDConfigProvider';
import AsyncDeleteProvider from './context/AsyncDeleteProvider/AsyncDeleteProvider';
import PermissionProvider from './context/PermissionProvider/PermissionProvider';
import TourProvider from './context/TourProvider/TourProvider';
import WebSocketProvider from './context/WebSocketProvider/WebSocketProvider';
import { useApplicationStore } from './hooks/useApplicationStore';
import {
  getCustomUiThemePreference,
  getSystemConfig,
} from './rest/settingConfigAPI';
import { getBasePath } from './utils/HistoryUtils';

import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import {
  createMuiTheme,
  SnackbarContent,
} from '@openmetadata/ui-core-components';
import { SnackbarProvider } from 'notistack';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DEFAULT_THEME } from './constants/Appearance.constants';
import RuleEnforcementProvider from './context/RuleEnforcementProvider/RuleEnforcementProvider';
import i18n from './utils/i18next/LocalUtil';
import { getThemeConfig } from './utils/ThemeUtils';
const App: FC = () => {
  const { applicationConfig, setApplicationConfig, setRdfEnabled } =
    useApplicationStore(
      useShallow((state) => ({
        applicationConfig: state.applicationConfig,
        setApplicationConfig: state.setApplicationConfig,
        setRdfEnabled: state.setRdfEnabled,
      }))
    );

  // Create dynamic MUI theme based on user customizations
  const muiTheme = useMemo(
    () => createMuiTheme(applicationConfig?.customTheme, DEFAULT_THEME),
    [applicationConfig?.customTheme]
  );

  const fetchApplicationConfig = async () => {
    try {
      const [themeData, systemConfig] = await Promise.all([
        getCustomUiThemePreference(),
        getSystemConfig(),
      ]);

      setApplicationConfig({
        ...themeData,
        customTheme: getThemeConfig(themeData.customTheme),
      });

      // Set RDF enabled state
      setRdfEnabled(systemConfig.rdfEnabled || false);
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
        <BrowserRouter basename={getBasePath()}>
          <I18nextProvider i18n={i18n}>
            <HelmetProvider>
              <ErrorBoundary>
                <AntDConfigProvider>
                  <ThemeProvider theme={muiTheme}>
                    <GlobalStyles styles={{ html: { fontSize: '14px' } }} />
                    <SnackbarProvider
                      Components={{
                        default: SnackbarContent,
                        error: SnackbarContent,
                        success: SnackbarContent,
                        warning: SnackbarContent,
                        info: SnackbarContent,
                      }}
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                      autoHideDuration={6000}
                      maxSnack={3}>
                      <AuthProvider childComponentType={AppRouter}>
                        <TourProvider>
                          <WebAnalyticsProvider>
                            <PermissionProvider>
                              <WebSocketProvider>
                                <ApplicationsProvider>
                                  <AsyncDeleteProvider>
                                    <EntityExportModalProvider>
                                      <AirflowStatusProvider>
                                        <RuleEnforcementProvider>
                                          <DndProvider backend={HTML5Backend}>
                                            <AppRouter />
                                          </DndProvider>
                                        </RuleEnforcementProvider>
                                      </AirflowStatusProvider>
                                    </EntityExportModalProvider>
                                  </AsyncDeleteProvider>
                                </ApplicationsProvider>
                              </WebSocketProvider>
                            </PermissionProvider>
                          </WebAnalyticsProvider>
                        </TourProvider>
                      </AuthProvider>
                    </SnackbarProvider>
                  </ThemeProvider>
                </AntDConfigProvider>
              </ErrorBoundary>
            </HelmetProvider>
          </I18nextProvider>
        </BrowserRouter>
      </div>
    </div>
  );
};

export default App;
