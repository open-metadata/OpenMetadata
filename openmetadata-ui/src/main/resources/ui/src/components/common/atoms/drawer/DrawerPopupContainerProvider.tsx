/*
 *  Copyright 2025 Collate.
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
import { ReactNode } from 'react';

/**
 * Resolves the popup container for an Ant Design overlay rendered inside a
 * SlideoutMenu drawer. The drawer is a react-aria modal that contains focus and
 * blocks pointer/scroll events outside its dialog subtree. Ant overlays portal
 * to document.body by default, which lands outside that subtree and leaves the
 * popup non-interactive (options can't be selected or scrolled). Returning the
 * enclosing dialog keeps the popup within the focus scope.
 */
export const getDrawerPopupContainer = (
  triggerNode?: HTMLElement
): HTMLElement =>
  triggerNode?.closest<HTMLElement>('[role="dialog"]') ?? document.body;

/**
 * Sets {@link getDrawerPopupContainer} as the default `getPopupContainer` for
 * every Ant Design overlay (Select, Dropdown, DatePicker, TreeSelect, Tooltip,
 * ...) rendered within a drawer's content, so drawer-hosted overlays stay
 * interactive without each call site remembering to wire it up. A component
 * that passes its own `getPopupContainer` still takes precedence.
 */
export const DrawerPopupContainerProvider = ({
  children,
}: {
  children: ReactNode;
}) => (
  <ConfigProvider getPopupContainer={getDrawerPopupContainer}>
    {children}
  </ConfigProvider>
);
