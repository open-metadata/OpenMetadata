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

import { Layout } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useAppModeBanners, useAppModeOverlays } from '../appModeExtensions';
import Sidebar from '../Sidebar/Sidebar';
import './assistant-layout.less';

const { Content } = Layout;

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

  return (
    <>
      <Layout className="assistant-layout h-full flex flex-row">
        <Sidebar />

        <Content
          className={classNames(
            'assistant-content m-r-md tw:my-1.5 p-b-0 border-radius-card'
          )}>
          {banners.map(({ key, component: Banner }) => (
            <Banner key={key} />
          ))}
          {children}
        </Content>
      </Layout>
      {overlays.map(({ key, component: Overlay }) => (
        <Overlay key={key} />
      ))}
    </>
  );
};

export default AssistantLayout;
