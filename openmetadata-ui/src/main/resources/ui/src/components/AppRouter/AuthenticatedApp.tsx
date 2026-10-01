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

import { FC, ReactNode } from 'react';
import { RouterProvider } from 'react-aria-components';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useHref, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import AirflowStatusProvider from '../../context/AirflowStatusProvider/AirflowStatusProvider';
import AsyncDeleteProvider from '../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import PermissionProvider from '../../context/PermissionProvider/PermissionProvider';
import RuleEnforcementProvider from '../../context/RuleEnforcementProvider/RuleEnforcementProvider';
import TourProvider from '../../context/TourProvider/TourProvider';
import WebSocketProvider from '../../context/WebSocketProvider/WebSocketProvider';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { CsvJobsTrayContainer } from '../common/EntityImport/CsvJobsTray/CsvJobsTrayContainer.component';
import { EntityExportModalProvider } from '../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { PersonaLandingRedirect } from '../platform/persona/PersonaLandingRedirect/PersonaLandingRedirect';
import ApplicationsProvider from '../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import WebAnalyticsProvider from '../WebAnalytics/WebAnalyticsProvider';
import { ThemeProvider as UntitledUIThemeProvider } from './../../context/UntitledUIThemeProvider/theme-provider';

// react-aria resolves every link href through this hook, including external
// URLs. Only app paths get the router basename; absolute URLs, mailto: and
// anchors pass through untouched (useHref would treat them as relative paths).
const useRouterHref = (href: string) => {
  const resolvedHref = useHref(href);

  return href.startsWith('/') && !href.startsWith('//') ? resolvedHref : href;
};

const ReactAriaRouterBridge = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  return (
    <RouterProvider navigate={navigate} useHref={useRouterHref}>
      {children}
    </RouterProvider>
  );
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

  return (
    <UntitledUIThemeProvider brandColors={applicationConfig?.customTheme}>
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
                            <PersonaLandingRedirect>
                              {children}
                            </PersonaLandingRedirect>
                          </DndProvider>
                        </RuleEnforcementProvider>
                      </AirflowStatusProvider>
                      <CsvJobsTrayContainer />
                    </EntityExportModalProvider>
                  </AsyncDeleteProvider>
                </ApplicationsProvider>
              </WebSocketProvider>
            </PermissionProvider>
          </WebAnalyticsProvider>
        </TourProvider>
      </ReactAriaRouterBridge>
    </UntitledUIThemeProvider>
  );
};

export default AuthenticatedApp;
