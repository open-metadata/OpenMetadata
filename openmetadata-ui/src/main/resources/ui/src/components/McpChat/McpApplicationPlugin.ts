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

import React from 'react';
import i18n from '../../utils/i18next/LocalUtil';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import {
  AppPlugin,
  LeftSidebarItemExample,
  PluginRouteProps,
  RoutePosition,
} from '../Settings/Applications/plugins/AppPlugin';
import { ReactComponent as McpIcon } from '../../assets/svg/McpApplication.svg';

const McpChatPage = withSuspenseFallback(
  React.lazy(() =>
    import('./McpChatPage/McpChatPage.component').then((m) => ({
      default: m.McpChatPage,
    }))
  )
);

export class McpApplicationPlugin implements AppPlugin {
  name: string;
  isInstalled: boolean;

  constructor(name: string, isInstalled: boolean) {
    this.name = name;
    this.isInstalled = isInstalled;
  }

  getRoutes(): Array<PluginRouteProps> {
    return [
      {
        path: '/mcp-chat',
        Component: McpChatPage,
        position: RoutePosition.APP,
      },
      {
        path: '/mcp-chat/:conversationId',
        Component: McpChatPage,
        position: RoutePosition.APP,
      },
    ];
  }

  getSidebarActions(): Array<LeftSidebarItemExample> {
    return [
      {
        key: 'mcp-chat',
        title: i18n.t('label.ai-assistant'),
        icon: McpIcon,
        redirect_url: '/mcp-chat',
        dataTestId: 'mcp-chat-sidebar',
        index: 10,
      },
    ];
  }
}
