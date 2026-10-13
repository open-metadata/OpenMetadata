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

/**
 * Route constants for the OSS `connections` app module. Values are copied
 * verbatim from Collate's `plugins/ai-chat/utils/aiModeRoutes.constants.ts`
 * (`AI_MODE_ROUTES.CONNECTIONS*` / `AGENT_JOB_DETAILS`) so the two route
 * tables stay byte-for-byte identical while the Connections surface is
 * migrated to OSS. `AGENT_JOB_DETAILS` is not owned by the OSS module's
 * static route array — it is spliced in via a `CONNECTIONS_ROUTES`
 * (`EXTENSION_POINTS.CONNECTIONS_ROUTES`) contribution from Collate — but
 * the value lives here so both sides reference the same literal.
 */
export const CONNECTIONS_ROUTES = {
  CONNECTIONS: '/connections',
  CONNECTIONS_SERVICE_DETAILS: '/connections/:serviceCategory/:fqn',
  CONNECTIONS_SERVICE_DETAILS_TAB: '/connections/:serviceCategory/:fqn/:tab',
  AGENT_JOB_DETAILS: '/connections/:serviceCategory/:fqn/agents/:agentFqn',
  CONNECTIONS_EDIT_CONNECTION:
    '/connections/:serviceCategory/:fqn/edit-connection',
  CONNECTIONS_ADD_SERVICE: '/connections/add-service/:serviceCategory',
  CONNECTIONS_EDIT_INGESTION:
    '/connections/service/:serviceCategory/:fqn/edit-ingestion/:ingestionFQN/:ingestionType',
  CONNECTIONS_ADD_INGESTION:
    '/connections/service/:serviceCategory/:fqn/add-ingestion/:ingestionType',
};
