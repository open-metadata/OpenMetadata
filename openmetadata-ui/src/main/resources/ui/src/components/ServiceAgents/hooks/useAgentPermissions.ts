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

import { useEffect, useMemo, useState } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/accessControl/resourceDescriptor';
import { AgentActionPermissions } from '../AgentsPage.interface';

const FQN_KEY_SEPARATOR = '|';

export const useAgentPermissions = (
  agentFqns: string[],
  resourceEntity: ResourceEntity = ResourceEntity.INGESTION_PIPELINE
) => {
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [agentPermissions, setAgentPermissions] = useState<
    Record<string, AgentActionPermissions>
  >({});

  // Agent lists are re-mapped on every SSE progress tick; keying on the joined
  // FQNs keeps the effect from refetching permissions when only run state changed.
  const fqnKey = agentFqns.filter(Boolean).join(FQN_KEY_SEPARATOR);
  const fqns = useMemo(
    () => (fqnKey ? fqnKey.split(FQN_KEY_SEPARATOR) : []),
    [fqnKey]
  );

  useEffect(() => {
    if (fqns.length === 0) {
      setAgentPermissions({});

      return;
    }

    let isMounted = true;

    Promise.allSettled(
      fqns.map((fqn) => getEntityPermissionByFqn(resourceEntity, fqn))
    ).then((results) => {
      if (!isMounted) {
        return;
      }

      setAgentPermissions(
        results.reduce<Record<string, AgentActionPermissions>>(
          (acc, result, index) => {
            const permissions =
              result.status === 'fulfilled' ? result.value : undefined;

            acc[fqns[index]] = {
              trigger: permissions?.[Operation.Trigger] ?? false,
              edit: permissions?.[Operation.EditAll] ?? false,
              delete: permissions?.[Operation.Delete] ?? false,
            };

            return acc;
          },
          {}
        )
      );
    });

    return () => {
      isMounted = false;
    };
  }, [fqns, resourceEntity]);

  return { agentPermissions };
};
