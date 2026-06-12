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
import { ReactComponent as McpChatIcon } from '../../../../assets/svg/add-chat.svg';
import { ROUTES } from '../../../../constants/constants';
import { SidebarItem } from '../../../../enums/sidebar.enum';
import { AppPlugin, LeftSidebarItemExample } from './AppPlugin';

export class McpChatPlugin implements AppPlugin {
  name: string;
  isInstalled: boolean;

  constructor(name: string, isInstalled: boolean) {
    this.name = name;
    this.isInstalled = isInstalled;
  }

  getSidebarActions(): LeftSidebarItemExample[] {
    return [
      {
        key: ROUTES.MCP_CHAT,
        title: 'label.mcp-chat',
        redirect_url: ROUTES.MCP_CHAT,
        icon: McpChatIcon,
        dataTestId: `app-bar-item-${SidebarItem.MCP_CHAT}`,
        index: 8,
      },
    ];
  }
}
