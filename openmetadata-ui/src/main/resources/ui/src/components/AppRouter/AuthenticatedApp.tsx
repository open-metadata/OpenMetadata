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

import { GlobalStyles, ThemeProvider } from '@mui/material';
import {
  createMuiTheme,
  SnackbarContent,
} from '@openmetadata/ui-core-components';
import { SnackbarProvider } from 'notistack';
import { FC, ReactNode, useMemo } from 'react';
import { RouterProvider } from 'react-aria-components';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_THEME } from '../../constants/Appearance.constants';
import AirflowStatusProvider from '../../context/AirflowStatusProvider/AirflowStatusProvider';
import AsyncDeleteProvider from '../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import PermissionProvider from '../../context/PermissionProvider/PermissionProvider';
import RuleEnforcementProvider from '../../context/RuleEnforcementProvider/RuleEnforcementProvider';
import TourProvider from '../../context/TourProvider/TourProvider';
import WebSocketProvider from '../../context/WebSocketProvider/WebSocketProvider';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { EntityExportModalProvider } from '../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import ApplicationsProvider from '../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import WebAnalyticsProvider from '../WebAnalytics/WebAnalyticsProvider';
import { ThemeProvider as UntitledUIThemeProvider } from './../../context/UntitledUIThemeProvider/theme-provider';

const ReactAriaRouterBridge = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  return <RouterProvider navigate={navigate}>{children}</RouterProvider>;
};

interface AuthenticatedAppProps {
  children: React.ReactNode;
}

const AuthenticatedApp: FC<AuthenticatedAppProps> = ({ children }) => {
  const { applicationConfig } = useApplicationStore(
    useShallow((state) => ({
      applicationConfig: state.applicationConfig,
    }))
  );

  const muiTheme = useMemo(
    () => createMuiTheme(applicationConfig?.customTheme, DEFAULT_THEME),
    [applicationConfig?.customTheme]
  );

  return (
    <UntitledUIThemeProvider brandColors={applicationConfig?.customTheme}>
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
          <ReactAriaRouterBridge>
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
                                {children}
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
          </ReactAriaRouterBridge>
        </SnackbarProvider>
      </ThemeProvider>
    </UntitledUIThemeProvider>
  );
};

export default AuthenticatedApp;
