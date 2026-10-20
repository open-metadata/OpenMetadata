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
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CaptureOntologyRelease } from '../../../generated/api/data/captureOntologyRelease';
import {
  TaskCategory,
  TaskType,
} from '../../../generated/api/tasks/createTask';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../generated/entity/data/ontologyRelease';
import { OntologyState } from '../../../generated/type/ontologyState';
import {
  activateOntologyRelease,
  captureOntologyRelease,
  getOntologyRelease,
  getOntologyState,
  getOntologyWorkingDiff,
  listOntologyReleaseHistory,
} from '../../../rest/ontologyAPI';
import { createTask } from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getTaskDetailPath } from '../../../utils/TaskUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { latestVersionedOntologyRelease } from './useOntologyPublication.utils';

const RELEASE_QUERY = 'ontology-release';

export type OntologyReleaseMetadata = Pick<
  CaptureOntologyRelease,
  'versionBump' | 'releaseNotes'
>;

export const useOntologyPublication = (
  ontologyId: string,
  canEdit: boolean,
  showHistory = true
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [pendingReview, setPendingReview] = useState<OntologyRelease>();
  const [isBusy, setIsBusy] = useState(false);
  const busy = useRef(false);
  const state = useQuery({
    queryKey: ['ontology-state', ontologyId],
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => getOntologyState(ontologyId, signal),
  });
  const working = useQuery({
    queryKey: ['ontology-working-diff', ontologyId, undefined],
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) =>
      getOntologyWorkingDiff(ontologyId, { limit: 25 }, signal),
  });
  const lastReleaseRevision = working.data?.state.lastReleaseRevision;
  const latestVersioned = useQuery({
    queryKey: [
      'ontology-latest-versioned-release',
      ontologyId,
      lastReleaseRevision,
    ],
    enabled: working.isSuccess,
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => latestVersionedOntologyRelease(ontologyId, signal),
  });
  const history = useInfiniteQuery({
    queryKey: [
      'ontology-release-history',
      ontologyId,
      state.data?.lastReleaseRevision,
    ],
    enabled: showHistory,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const response = await listOntologyReleaseHistory(
        ontologyId,
        { limit: 25, after: pageParam },
        signal
      );
      if (
        response.data.some((candidate) => candidate.ontology.id !== ontologyId)
      ) {
        throw new Error('Ontology release owner does not match the selection');
      }

      return response;
    },
    getNextPageParam: (last, pages) =>
      pages.length < 40 ? last.paging.after : undefined,
    retry: false,
    gcTime: 0,
  });
  const activeReleaseId = state.isSuccess
    ? state.data.activeReleaseId
    : undefined;
  const releaseId = selectedId ?? activeReleaseId;
  const selected = useQuery({
    queryKey: [RELEASE_QUERY, ontologyId, releaseId],
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
      state.refetch(),
      working.refetch(),
      queryClient.invalidateQueries({
        queryKey: ['ontology-release-history', ontologyId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['ontology-latest-versioned-release', ontologyId],
      }),
      ...(releaseId
        ? [
            selected.refetch(),
            queryClient.invalidateQueries({
              queryKey: ['ontology-release-events', releaseId],
            }),
          ]
        : []),
    ]);
  };
  const run = async (action: () => Promise<void>) => {
    if (!canEdit || busy.current) {
      return;
    }
    busy.current = true;
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
      busy.current = false;
    }
  };
  const captureCandidate = async (
    previewState: OntologyState,
    metadata?: OntologyReleaseMetadata
  ) => {
    const candidate = await captureOntologyRelease(ontologyId, {
      expectedActivationRevision: previewState.activationRevision,
      expectedWorkingRevision: previewState.workingRevision,
      ...(metadata?.versionBump
        ? { expectedLatestReleaseRevision: previewState.lastReleaseRevision }
        : {}),
      ...metadata,
    });
    queryClient.setQueryData(
      [RELEASE_QUERY, ontologyId, candidate.id],
      candidate
    );
    setSelectedId(candidate.id);

    return candidate;
  };
  const capture = (
    previewState: OntologyState,
    metadata?: OntologyReleaseMetadata
  ) =>
    run(async () => {
      await captureCandidate(previewState, metadata);
    });
  const submitReview = async (candidate: OntologyRelease) => {
    if (candidate.entityStatus !== EntityStatus.Draft || candidate.reviewTask) {
      return;
    }
    const task = await createTask({
      category: TaskCategory.Approval,
      type: TaskType.RequestApproval,
      about: getEntityFeedLink('ontologyRelease', candidate.fullyQualifiedName),
    });
    navigate(getTaskDetailPath(task));
  };
  const captureAndRequestApproval = (
    previewState: OntologyState,
    metadata: OntologyReleaseMetadata
  ) =>
    run(async () => {
      const candidate = pendingReview
        ? await getOntologyRelease(pendingReview.id)
        : await captureCandidate(previewState, metadata);
      if (
        candidate.ontology.id !== ontologyId ||
        (pendingReview && candidate.id !== pendingReview.id)
      ) {
        throw new Error(
          'Ontology release identity does not match the review candidate'
        );
      }
      setPendingReview(candidate);
      queryClient.setQueryData(
        [RELEASE_QUERY, ontologyId, candidate.id],
        candidate
      );
      if (candidate.reviewTask) {
        navigate(`/tasks/${encodeURIComponent(candidate.reviewTask)}`);
        setPendingReview(undefined);

        return;
      }
      await submitReview(candidate);
      setPendingReview(undefined);
    });
  const requestApproval = () =>
    run(async () => {
      if (!release) {
        return;
      }
      await submitReview(release);
      if (release.id === pendingReview?.id) {
        setPendingReview(undefined);
      }
    });
  const activate = () =>
    run(async () => {
      if (
        !release ||
        !state.isSuccess ||
        state.isFetching ||
        release.entityStatus !== EntityStatus.Approved
      ) {
        return;
      }
      await activateOntologyRelease(ontologyId, {
        releaseId: release.id,
        expectedActivationRevision: state.data.activationRevision,
      });
    });

  return {
    state,
    activeReleaseId,
    working,
    selected,
    selectedId,
    releaseId,
    release,
    latestVersioned,
    history,
    pendingReview,
    setSelectedId,
    isBusy,
    refresh,
    capture,
    captureAndRequestApproval,
    requestApproval,
    activate,
  };
};
