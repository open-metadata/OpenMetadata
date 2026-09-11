/*
 *  Copyright 2026 Collate.
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

import { PageLayout } from '@openmetadata/ui-core-components';
import React, { PropsWithChildren, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from 'use-analytics';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { useAppModeBanners, useAppModeOverlays } from './appModeExtensions';
import './AssistantLayout/assistant-layout.less';
import Sidebar from './Sidebar/Sidebar';

// Core personal-space chrome is OSS-owned, while proprietary overlays continue
// to arrive through the app-mode extension registry below.
const PersonalSpaceModal = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../discovery/personal-space/PersonalSpaceModal/PersonalSpaceModal'
      )
  )
);

/**
 * Outer chrome for app mode — sidebar, banners, routed content, and overlays.
 * Mounted exactly once by `AppModeRoutes` so individual modules only own their
 * page layout.
 */
export const AppShell = ({ children }: PropsWithChildren) => {
  const banners = useAppModeBanners();
  const overlays = useAppModeOverlays();
  const { pathname, search, hash } = useLocation();
  const analytics = useAnalytics();

  // App-mode routes render outside `AppContainer`, so the shell owns the page
  // tracking that authenticated OpenMetadata routes normally receive there.
  useEffect(() => {
    if (pathname !== '/') {
      analytics?.page();
    }
  }, [pathname, search, hash, analytics]);

  return (
    <>
      <PageLayout className="assistant-layout tw:p-0!" data-testid="app-shell">
        <PageLayout.LeftPanel
          bordered={false}
          className="tw:p-0!"
          data-testid="app-shell-sidebar"
          width="auto">
          <Sidebar />
        </PageLayout.LeftPanel>

        {/* Routed pages own the main landmark. A neutral grid cell here avoids
            nesting a second main around every PageLayout.Content. */}
        <div
          className="assistant-content m-r-md tw:my-1.5 p-b-0 border-radius-card"
          data-testid="app-shell-content">
          {banners.map(({ key, component: Banner }) => (
            <Banner key={key} />
          ))}
          {children}
        </div>
      </PageLayout>
      {overlays.map(({ key, component: Overlay }) => (
        <Overlay key={key} />
      ))}
      <PersonalSpaceModal />
    </>
  );
};

export default AppShell;
