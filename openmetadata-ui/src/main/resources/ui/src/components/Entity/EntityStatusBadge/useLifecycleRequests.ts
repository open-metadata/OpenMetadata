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
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getRequestableStages } from '../../../rest/metadataTypeAPI';
import {
  closeTask,
  createTask,
  listTasks,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
} from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

interface LifecycleRequestsOptions {
  entityType: string;
  entityId?: string;
  entityFqn?: string;
  /** The asset's stage; a move re-reads what its lifecycle offers. */
  entityStatus?: EntityStatus;
  /** Whether the user may write the asset; a request is a write its approvers then decide. */
  canRequest: boolean;
}

/** A status request still waiting for its approvers. */
export interface PendingLifecycleRequest {
  stage: EntityStatus;
  taskId: string;
  requestedBy?: string;
}

export interface LifecycleRequests {
  /** Stages the asset's lifecycle offers on request; empty while a request is pending. */
  stages: EntityStatus[];
  pending?: PendingLifecycleRequest;
  /** Raises a status update task; resolves true once the request exists. */
  request: (stage: EntityStatus, reason: string) => Promise<boolean>;
  /** Withdraws the pending request; set for the user who raised it and for admins. */
  withdraw?: () => Promise<void>;
}

const readPending = async (
  entityFqn: string
): Promise<PendingLifecycleRequest | undefined> => {
  const { data } = await listTasks({
    aboutEntity: entityFqn,
    type: TaskEntityType.StatusUpdate,
    status: TaskEntityStatus.Open,
    fields: 'payload,createdBy',
    limit: 1,
  });
  const [task] = data;
  const stage = (task?.payload as { newStatus?: EntityStatus } | undefined)
    ?.newStatus;

  return task && stage
    ? { stage, taskId: task.id, requestedBy: task.createdBy?.name }
    : undefined;
};

/**
 * Status requests for an asset, such as Deprecated or Archived: the stages its lifecycle offers on
 * request, the request still pending, and raising or withdrawing one. A request is a status update
 * task the lifecycle's approvers decide.
 */
export const useLifecycleRequests = ({
  entityType,
  entityId,
  entityFqn,
  entityStatus,
  canRequest,
}: LifecycleRequestsOptions): LifecycleRequests => {
  const [requestable, setRequestable] = useState<EntityStatus[]>([]);
  const [pending, setPending] = useState<PendingLifecycleRequest>();
  const [refreshKey, setRefreshKey] = useState(0);
  const { currentUser } = useApplicationStore();
  const entityLink = entityFqn ? getEntityFeedLink(entityType, entityFqn) : '';

  // A stage move or a decided request changes what the lifecycle offers next.
  useEffect(() => {
    let active = true;
    if (canRequest && entityId && entityFqn) {
      // Either read can fail on its own; a failed pending read still offers the stages.
      Promise.allSettled([
        getRequestableStages(entityType, entityId),
        readPending(entityFqn),
      ]).then(([stages, open]) => {
        if (active) {
          setRequestable(
            stages.status === 'fulfilled'
              ? (stages.value as EntityStatus[])
              : []
          );
          setPending(open.status === 'fulfilled' ? open.value : undefined);
        }
      });
    } else {
      setRequestable([]);
      setPending(undefined);
    }

    return () => {
      active = false;
    };
  }, [entityType, entityId, entityFqn, entityStatus, canRequest, refreshKey]);

  const request = useCallback(
    async (stage: EntityStatus, reason: string) => {
      let raised = false;
      try {
        await createTask({
          category: TaskCategory.MetadataUpdate,
          type: TaskEntityType.StatusUpdate,
          about: entityLink,
          description: reason,
          payload: { newStatus: stage, reason },
        });
        raised = true;
        setRefreshKey((key) => key + 1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }

      return raised;
    },
    [entityLink]
  );

  const withdraw = useCallback(async () => {
    if (pending) {
      try {
        await closeTask(pending.taskId);
        setRefreshKey((key) => key + 1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  }, [pending]);

  const mayWithdraw =
    pending !== undefined &&
    (currentUser?.isAdmin || pending.requestedBy === currentUser?.name);

  return {
    stages: pending ? [] : requestable,
    pending,
    request,
    withdraw: mayWithdraw ? withdraw : undefined,
  };
};
