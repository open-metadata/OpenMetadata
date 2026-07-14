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
import { ConfigProvider } from 'antd';
import { PropsWithChildren } from 'react';

const PORTAL_CONTAINER_ID = 'drawer-popup-portal';

const getPopupContainer = (): HTMLElement => {
  let container = document.getElementById(PORTAL_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = PORTAL_CONTAINER_ID;
    container.setAttribute('data-react-aria-top-layer', 'true');
    container.style.position = 'absolute';
    container.style.zIndex = '10001';
    document.body.appendChild(container);
  }

  return container;
};

export const DrawerPopupContainerProvider = ({
  children,
}: PropsWithChildren) => (
  <ConfigProvider getPopupContainer={getPopupContainer}>
    {children}
  </ConfigProvider>
);
