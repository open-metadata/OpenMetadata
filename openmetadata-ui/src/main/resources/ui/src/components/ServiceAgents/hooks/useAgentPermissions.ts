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

import { useEffect, useState } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/accessControl/resourceDescriptor';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { AgentActionPermissions } from '../AgentsPage.interface';

export const useAgentPermissions = (pipelines: IngestionPipeline[]) => {
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [agentPermissions, setAgentPermissions] = useState<
    Record<string, AgentActionPermissions>
  >({});

  useEffect(() => {
    if (pipelines.length === 0) {
      setAgentPermissions({});

      return;
    }

    let isMounted = true;

    Promise.allSettled(
      pipelines.map((pipeline) =>
        getEntityPermissionByFqn(
          ResourceEntity.INGESTION_PIPELINE,
          pipeline.fullyQualifiedName ?? ''
        )
      )
    ).then((results) => {
      if (!isMounted) {
        return;
      }

      setAgentPermissions(
        results.reduce<Record<string, AgentActionPermissions>>(
          (acc, result, index) => {
            const permissions =
              result.status === 'fulfilled' ? result.value : undefined;

            return {
              ...acc,
              [pipelines[index].fullyQualifiedName ?? '']: {
                trigger: permissions?.[Operation.Trigger] ?? false,
                edit: permissions?.[Operation.EditAll] ?? false,
                delete: permissions?.[Operation.Delete] ?? false,
              },
            };
          },
          {}
        )
      );
    });

    return () => {
      isMounted = false;
    };
  }, [pipelines]);

  return { agentPermissions };
};
