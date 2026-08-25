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

import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from 'use-analytics';
import { useAppModeBanners, useAppModeOverlays } from '../appModeExtensions';
import Sidebar from '../Sidebar/Sidebar';
import './assistant-layout.less';

interface AssistantLayoutProps {
  children: React.ReactNode;
}

/**
 * Outer chrome for app mode — sidebar, top-of-content banners, the content
 * slot, and overlays. Proprietary banners (usage/credits, availability
 * notices) and overlays (modals, prompts) are NOT hardcoded here: they render
 * from the `app-mode.layout.banners` / `app-mode.layout.overlays`
 * contributions, so the neutral shell has an empty banner/overlay slot when
 * nothing is contributed.
 */
const AssistantLayout: React.FC<AssistantLayoutProps> = ({ children }) => {
  const banners = useAppModeBanners();
  const overlays = useAppModeOverlays();
  const { pathname, search, hash } = useLocation();
  const analytics = useAnalytics();

  // App-mode routes render outside `AppContainer`, which is what records page
  // views for authenticated OpenMetadata routes. Mirror that here so navigation
  // inside the AI shell also reaches web analytics (and downstream adoption
  // metrics), which it otherwise would not.
  useEffect(() => {
    if (pathname !== '/') {
      analytics?.page();
    }
  }, [pathname, search, hash, analytics]);

  return (
    <>
      <div className="assistant-layout h-full flex flex-row">
        <Sidebar />

        <main className="assistant-content m-r-md tw:my-1.5 p-b-0 border-radius-card">
          {banners.map(({ key, component: Banner }) => (
            <Banner key={key} />
          ))}
          {children}
        </main>
      </div>
      {overlays.map(({ key, component: Overlay }) => (
        <Overlay key={key} />
      ))}
    </>
  );
};

export default AssistantLayout;
