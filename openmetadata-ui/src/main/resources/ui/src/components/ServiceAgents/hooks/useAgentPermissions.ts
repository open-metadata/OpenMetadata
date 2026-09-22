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

import { useMemo } from 'react';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { useBulkEntityPermissions } from '../../../hooks/useEntityPermissions/useBulkEntityPermissions';
import { AgentActionPermissions } from '../AgentsPage.interface';

/**
 * Row-level trigger/edit/delete permissions for the agent list, one cached
 * query per FQN via {@link useBulkEntityPermissions} — a failed row degrades
 * to no-permission instead of failing the list (same contract the old
 * Promise.allSettled loop had). `fqns` is re-filtered on every render, but
 * useBulkEntityPermissions keys its queries off resource+fqn (not array
 * identity), so an SSE-driven re-map of `agentFqns` with unchanged content
 * doesn't trigger a refetch.
 */
export const useAgentPermissions = (
  agentFqns: string[],
  resourceEntity: ResourceEntity = ResourceEntity.INGESTION_PIPELINE
) => {
  const fqns = useMemo(() => agentFqns.filter(Boolean), [agentFqns]);
  const { flagsByFqn } = useBulkEntityPermissions(resourceEntity, fqns);

  const agentPermissions = useMemo(
    () =>
      fqns.reduce<Record<string, AgentActionPermissions>>((acc, fqn) => {
        const flags = flagsByFqn[fqn];
        acc[fqn] = {
          trigger: flags?.can(Operation.Trigger) ?? false,
          edit: flags?.canEditAll ?? false,
          delete: flags?.canDelete ?? false,
        };

        return acc;
      }, {}),
    [fqns, flagsByFqn]
  );

  return { agentPermissions };
};
