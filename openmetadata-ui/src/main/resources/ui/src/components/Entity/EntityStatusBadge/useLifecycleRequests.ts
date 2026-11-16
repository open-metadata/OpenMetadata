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
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getRequestableStages } from '../../../rest/metadataTypeAPI';
import { showErrorToast } from '../../../utils/ToastUtils';

interface LifecycleRequestsOptions {
  entityType: string;
  entityId?: string;
  /** The asset's stage; a move re-reads what its lifecycle offers. */
  entityStatus?: EntityStatus;
  lifecycleRequest?: EntityStatus;
  /** Whether the user may write the asset; a request is a write the lifecycle then decides. */
  canRequest: boolean;
  onRequest: (stage: EntityStatus) => Promise<void>;
}

export interface LifecycleRequests {
  /** Stages the asset's lifecycle moves it to on request; empty while a request is pending. */
  stages: EntityStatus[];
  request: (stage: EntityStatus) => Promise<void>;
}

/**
 * The stages a user can ask the asset's lifecycle to move it to, such as Deprecated or Archived:
 * the on-request exits of the lifecycle that owns the asset's stage.
 */
export const useLifecycleRequests = ({
  entityType,
  entityId,
  entityStatus,
  lifecycleRequest,
  canRequest,
  onRequest,
}: LifecycleRequestsOptions): LifecycleRequests => {
  const [requestable, setRequestable] = useState<EntityStatus[]>([]);

  // A stage move or a decided request can change what the owning lifecycle offers next.
  useEffect(() => {
    let active = true;
    if (canRequest && entityId) {
      getRequestableStages(entityType, entityId)
        .then((stages) => {
          if (active) {
            setRequestable(stages as EntityStatus[]);
          }
        })
        .catch(() => {
          if (active) {
            setRequestable([]);
          }
        });
    } else {
      setRequestable([]);
    }

    return () => {
      active = false;
    };
  }, [entityType, entityId, entityStatus, lifecycleRequest, canRequest]);

  const request = useCallback(
    async (stage: EntityStatus) => {
      try {
        await onRequest(stage);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [onRequest]
  );

  return { stages: lifecycleRequest ? [] : requestable, request };
};
