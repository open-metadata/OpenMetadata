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

import axiosClient from '.';
import { MCPConfiguration } from '../generated/configuration/mcpConfiguration';

/**
 * The MCP server reads its configuration from the `mcpConfiguration` system setting, not from the
 * MCP app entity. These dedicated endpoints are used instead of the generic `/system/settings`
 * route because only they invalidate the settings cache and call `reloadSecuritySystem()`, which
 * is what applies a change without a server restart.
 */
export const getMcpConfig = async () => {
  const response = await axiosClient.get<MCPConfiguration>(
    '/system/mcp/config'
  );

  return response.data;
};

export const updateMcpConfig = async (payload: MCPConfiguration) => {
  const response = await axiosClient.put<MCPConfiguration>(
    '/system/mcp/config',
    payload
  );

  return response.data;
};
