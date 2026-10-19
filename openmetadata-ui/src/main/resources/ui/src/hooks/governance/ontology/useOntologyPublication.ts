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
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  TaskCategory,
  TaskType,
} from '../../../generated/api/tasks/createTask';
import { EntityStatus } from '../../../generated/entity/data/ontologyRelease';
import {
  activateOntologyRelease,
  captureOntologyRelease,
  getOntologyRelease,
  getOntologyState,
} from '../../../rest/ontologyAPI';
import { createTask } from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getTaskDetailPath } from '../../../utils/TaskUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export const useOntologyPublication = (
  ontologyId: string,
  canEdit: boolean
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  const working = useQuery({
    queryKey: ['ontology-publication', ontologyId],
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => ({
      state: await getOntologyState(ontologyId, signal),
    }),
  });
  const releaseId = selectedId ?? working.data?.state.activeReleaseId;
  const selected = useQuery({
    queryKey: ['ontology-release', ontologyId, releaseId],
    retry: false,
    gcTime: 0,
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error('Missing ontology release');
      }
      const release = await getOntologyRelease(releaseId, signal);
      if (release.ontology.id !== ontologyId || release.id !== releaseId) {
        throw new Error(
          'Ontology release identity does not match the selection'
        );
      }

      return release;
    },
  });
  const release = selected.data;
  const refresh = async () => {
    await Promise.all([
      working.refetch(),
      ...(releaseId ? [selected.refetch()] : []),
    ]);
  };
  const run = async (action: () => Promise<void>) => {
    if (!canEdit || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      await refresh();
      setIsBusy(false);
    }
  };
  const capture = () =>
    run(async () => {
      if (!working.data) {
        return;
      }
      const candidate = await captureOntologyRelease(ontologyId, {
        expectedWorkingRevision: working.data.state.workingRevision,
      });
      setSelectedId(candidate.id);
    });
  const requestApproval = () =>
    run(async () => {
      if (!release) {
        return;
      }
      const task = await createTask({
        category: TaskCategory.Approval,
        type: TaskType.RequestApproval,
        about: getEntityFeedLink('ontologyRelease', release.fullyQualifiedName),
      });
      navigate(getTaskDetailPath(task));
    });
  const activate = () =>
    run(async () => {
      if (
        !release ||
        !working.data ||
        release.entityStatus !== EntityStatus.Approved
      ) {
        return;
      }
      await activateOntologyRelease(ontologyId, {
        releaseId: release.id,
        expectedActivationRevision: working.data.state.activationRevision,
      });
    });

  return {
    working,
    selected,
    releaseId,
    release,
    setSelectedId,
    isBusy,
    refresh,
    capture,
    requestApproval,
    activate,
  };
};
