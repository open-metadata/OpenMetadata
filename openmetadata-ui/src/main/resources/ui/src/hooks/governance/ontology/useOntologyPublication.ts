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
  CancelledError,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  TaskCategory,
  TaskType,
} from '../../../generated/api/tasks/createTask';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../generated/entity/data/ontologyRelease';
import { OntologyState } from '../../../generated/type/ontologyState';
import {
  activateOntologyRelease,
  captureOntologyRelease,
  getOntology,
  getOntologyRelease,
  getOntologyReleaseReview,
  getOntologyState,
  getOntologyWorkingDiff,
  listOntologyReleaseHistory,
  patchOntology,
} from '../../../rest/ontologyAPI';
import { createTask } from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getTaskDetailPath } from '../../../utils/TaskUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useApplicationStore } from '../../useApplicationStore';
import type {
  OntologyReleaseMetadata,
  PublicationReceipt,
  ReceiptRead,
  ReceiptScope,
  ReviewSettings,
  SettingsOutcome,
} from './useOntologyPublication.types';
import {
  canEditPublicationSettings,
  capturedIdentity,
  eligiblePublicationReviewers,
  findCapturedAttempt,
  isReviewableCandidate,
  isValidReviewSettings,
  joinPublicationReads,
  latestVersionedOntologyRelease,
  matchesCapturedIdentity,
  matchesCaptureMetadata,
  matchesPublicationReview,
  matchesReviewSettings,
  nextPublicationVersion,
  readPublicationQuery,
  readPublicationReceipt,
  reusablePublicationCandidate,
  samePublicationState,
  savePublicationReceipt,
} from './useOntologyPublication.utils';
import { ONTOLOGY_STUDIO_MODEL_QUERY_KEY } from './useOntologyStudioModel';
import { ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY } from './useOntologyStudioScopes';

export type { OntologyReleaseMetadata } from './useOntologyPublication.types';
export const ONTOLOGY_RELEASE_VALIDATION_QUERY_KEY =
  'ontology-release-validation';
export const ONTOLOGY_WORKING_DIFF_QUERY_KEY = 'ontology-working-diff';
const RELEASE_QUERY = 'ontology-release';
const PROJECTION_QUERY = 'ontology-publication';
const REVIEW_QUERY = 'ontology-release-review';
const isDefinitiveWriteRejection = (error: unknown) =>
  isAxiosError(error) &&
  [400, 401, 403, 404, 409, 412, 422].includes(error.response?.status ?? 0);

export const useOntologyPublication = (
  ontologyId: string,
  canEdit: boolean,
  showHistory = true
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useApplicationStore((store) => store.currentUser);
  const userId = currentUser?.id ?? '';
  const scopeKey = `${userId}:${ontologyId}`;
  const owner = useRef(scopeKey);
  owner.current = scopeKey;
  useEffect(() => {
    owner.current = scopeKey;

    return () => {
      owner.current = '';
    };
  }, [scopeKey]);
  const [selection, setSelection] = useState<{ owner: string; id: string }>();
  const selectedId = selection?.owner === scopeKey ? selection.id : undefined;
  const setSelectedId = (id: string) => setSelection({ owner: scopeKey, id });
  const [receiptState, setReceiptState] = useState<{
    owner: string;
    read: ReceiptRead;
  }>();
  const receipt =
    receiptState?.owner === scopeKey
      ? receiptState.read
      : ({ kind: 'loading' } as const);
  const [busyFor, setBusyFor] = useState<{ owner: string } | null>(null);
  const isBusy = busyFor?.owner === scopeKey;
  const [refreshFailed, setRefreshFailed] = useState<string>();
  const busy = useRef<{ owner: string } | null>(null);
  const projection = useQuery({
    queryKey: [PROJECTION_QUERY, ontologyId, userId],
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const value = await getOntology(
        ontologyId,
        'publicationStatus,reviewers',
        signal
      );
      if (value.id !== ontologyId || !value.publicationStatus) {
        throw new Error('Ontology publication is unavailable');
      }

      return value;
    },
  });
  const state = useQuery({
    queryKey: ['ontology-state', ontologyId, userId],
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const value = await getOntologyState(ontologyId, signal);
      if (value.ontologyId !== ontologyId) {
        throw new Error('Ontology state owner does not match');
      }

      return value;
    },
  });
  const working = useQuery({
    queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, ontologyId, undefined, userId],
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const value = await getOntologyWorkingDiff(
        ontologyId,
        { limit: 25, groupBy: 'concept' },
        signal
      );
      if (value.state.ontologyId !== ontologyId) {
        throw new Error('Ontology working owner does not match');
      }

      return value;
    },
  });
  const latestVersioned = useQuery({
    queryKey: [
      'ontology-latest-versioned-release',
      ontologyId,
      working.data?.state.lastReleaseRevision,
      userId,
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
      userId,
    ],
    enabled: [showHistory, state.isSuccess].every(Boolean),
    initialPageParam: undefined as string | undefined,
    retry: false,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      const response = await listOntologyReleaseHistory(
        ontologyId,
        { limit: 25, after: pageParam },
        signal
      );
      if (
        response.data.some(
          (release) =>
            release.ontology.id !== ontologyId ||
            release.releaseRevision > (state.data?.lastReleaseRevision ?? 0)
        ) ||
        (response.paging.after && response.paging.after === pageParam)
      ) {
        throw new Error('Ontology history identity changed');
      }

      return response;
    },
    getNextPageParam: (last, pages) =>
      pages.length < 40 ? last.paging.after : undefined,
  });
  const currentId = projection.data?.publicationStatus?.latest?.releaseId;
  const releaseId = selectedId ?? currentId;
  const readRelease = async (id: string | undefined, signal: AbortSignal) => {
    if (!id) {
      throw new Error('Missing ontology release');
    }
    const value = await getOntologyRelease(id, signal);
    if (value.id !== id || value.ontology.id !== ontologyId) {
      throw new Error('Ontology release identity does not match');
    }

    return value;
  };
  const candidate = useQuery({
    queryKey: [RELEASE_QUERY, ontologyId, currentId, userId],
    enabled: Boolean(currentId),
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => readRelease(currentId, signal),
  });
  const selected = useQuery({
    queryKey: [RELEASE_QUERY, ontologyId, releaseId, userId],
    enabled: Boolean(releaseId),
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => readRelease(releaseId, signal),
  });
  const review = useQuery({
    queryKey: [
      REVIEW_QUERY,
      ontologyId,
      currentId,
      candidate.data?.reviewTask,
      userId,
    ],
    enabled: Boolean(candidate.data?.reviewTask),
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => getOntologyReleaseReview(currentId ?? '', signal),
  });
  const candidateRead = currentId
    ? readPublicationQuery(candidate)
    : { kind: 'ready' as const, value: null };
  const reviewRead = candidate.data?.reviewTask
    ? readPublicationQuery(review)
    : { kind: 'ready' as const, value: null };
  const current =
    refreshFailed === scopeKey
      ? ({ kind: 'unavailable', reason: 'failed' } as const)
      : joinPublicationReads(
          readPublicationQuery(projection),
          readPublicationQuery(state),
          candidateRead,
          reviewRead
        );
  const activeReleaseId = state.data?.activeReleaseId;
  const refresh = useCallback(async () => {
    const keys = [
      [PROJECTION_QUERY, ontologyId],
      ['ontology-state', ontologyId],
      [ONTOLOGY_WORKING_DIFF_QUERY_KEY, ontologyId],
      ['ontology-release-history', ontologyId],
      ['ontology-latest-versioned-release', ontologyId],
      [RELEASE_QUERY, ontologyId],
      [REVIEW_QUERY, ontologyId],
    ];
    const independentKeys = [
      ['ontology-release-events'],
      [ONTOLOGY_RELEASE_VALIDATION_QUERY_KEY],
      [ONTOLOGY_STUDIO_MODEL_QUERY_KEY],
      [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
    ];
    const results = await Promise.allSettled(
      [...keys, ...independentKeys].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }, { throwOnError: true })
      )
    );
    if (owner.current === scopeKey) {
      setRefreshFailed(
        results
          .slice(0, keys.length)
          .some(
            (result) =>
              result.status === 'rejected' &&
              !(result.reason instanceof CancelledError && result.reason.silent)
          )
          ? scopeKey
          : undefined
      );
    }
  }, [ontologyId, queryClient, scopeKey]);
  useEffect(() => {
    if (
      candidate.isSuccess &&
      (!candidate.data.reviewTask || review.isSuccess)
    ) {
      void queryClient.invalidateQueries({
        queryKey: [PROJECTION_QUERY, ontologyId],
      });
    }
  }, [
    candidate.dataUpdatedAt,
    review.dataUpdatedAt,
    candidate.isSuccess,
    candidate.data?.reviewTask,
    review.isSuccess,
    ontologyId,
    queryClient,
  ]);

  const storeReceipt = useCallback(
    (
      attempt: PublicationReceipt | null,
      previous: PublicationReceipt | null,
      scope: ReceiptScope
    ) => {
      savePublicationReceipt(scope, attempt, previous);
      if (owner.current === `${scope.userId}:${scope.ontologyId}`) {
        setReceiptState({
          owner: owner.current,
          read: { kind: 'ready', value: attempt },
        });
      }
    },
    []
  );
  const submitReview = useCallback(
    async (attempt: Extract<PublicationReceipt, { operation: 'review' }>) => {
      if (owner.current !== `${attempt.userId}:${attempt.ontologyId}`) {
        return;
      }
      const running: PublicationReceipt = { ...attempt, phase: 'running' };
      storeReceipt(running, attempt, attempt);
      let task: Awaited<ReturnType<typeof createTask>>;
      try {
        task = await createTask({
          category: TaskCategory.Approval,
          type: TaskType.RequestApproval,
          about: getEntityFeedLink(
            'ontologyRelease',
            attempt.release.fullyQualifiedName
          ),
        });
        if (
          task.about?.id !== attempt.release.id ||
          task.type !== TaskType.RequestApproval
        ) {
          throw new Error('Created task does not match the release');
        }
      } catch (error) {
        storeReceipt(
          {
            ...running,
            phase: isDefinitiveWriteRejection(error) ? 'failed' : 'unknown',
          },
          running,
          attempt
        );

        throw error;
      }
      storeReceipt(null, running, attempt);
      if (owner.current === `${attempt.userId}:${attempt.ontologyId}`) {
        navigate(getTaskDetailPath(task));
      }
    },
    [navigate, storeReceipt]
  );
  const reconcileActivation = useCallback(
    async (
      attempt: Extract<PublicationReceipt, { operation: 'activation' }>
    ) => {
      const fresh = await getOntologyState(attempt.ontologyId);
      if (fresh.ontologyId !== attempt.ontologyId) {
        throw new Error('Activation recovery owner does not match');
      }
      if (fresh.activeReleaseId === attempt.release.id) {
        storeReceipt(null, attempt, attempt);
      } else if (
        fresh.activationRevision !== attempt.state.activationRevision &&
        attempt.phase !== 'conflict'
      ) {
        storeReceipt({ ...attempt, phase: 'conflict' }, attempt, attempt);
      }
    },
    [storeReceipt]
  );
  const reconcileCapture = useCallback(
    async (attempt: Extract<PublicationReceipt, { operation: 'capture' }>) => {
      const fresh = await getOntologyState(attempt.ontologyId);
      if (fresh.ontologyId !== attempt.ontologyId) {
        throw new Error('Capture recovery owner does not match');
      }
      const captured = await findCapturedAttempt(attempt);
      if (!captured) {
        // The state is read before the history, so a capture whose
        // revisions had already moved cannot have landed in between.
        if (
          fresh.workingRevision !== attempt.state.workingRevision ||
          fresh.activationRevision !== attempt.state.activationRevision
        ) {
          storeReceipt(null, attempt, attempt);
        }

        return;
      }
      if (attempt.intent === 'capture') {
        storeReceipt(null, attempt, attempt);

        return;
      }
      const next: PublicationReceipt = {
        origin: attempt.origin,
        userId: attempt.userId,
        ontologyId: attempt.ontologyId,
        state: attempt.state,
        operation: 'review',
        phase: 'failed',
        release: capturedIdentity(captured),
      };
      storeReceipt(next, attempt, attempt);
    },
    [storeReceipt]
  );
  const reconcileReview = useCallback(
    async (
      attempt: Extract<PublicationReceipt, { operation: 'review' }>,
      allowSubmit: boolean
    ) => {
      const fresh = await getOntologyRelease(attempt.release.id);
      if (
        fresh.ontology.id !== attempt.ontologyId ||
        !matchesCapturedIdentity(fresh, attempt.release)
      ) {
        throw new Error('Recovery release identity does not match');
      }
      if (fresh.reviewTask) {
        const task = await getOntologyReleaseReview(fresh.id);
        if (!matchesPublicationReview(task, fresh)) {
          throw new Error('Recovery review identity does not match');
        }
        storeReceipt(null, attempt, attempt);
        if (
          allowSubmit &&
          owner.current === `${attempt.userId}:${attempt.ontologyId}`
        ) {
          navigate(
            getTaskDetailPath({
              id: task.task.id,
              taskId: task.taskId,
              type: TaskType.RequestApproval,
              about: task.release,
            })
          );
        }
      } else if (
        allowSubmit &&
        attempt.phase === 'failed' &&
        fresh.entityStatus === EntityStatus.Draft
      ) {
        await submitReview(attempt);
      }
    },
    [navigate, storeReceipt, submitReview]
  );
  const reconcile = useCallback(
    (attempt: PublicationReceipt, allowSubmit: boolean) => {
      switch (attempt.operation) {
        case 'activation':
          return reconcileActivation(attempt);
        case 'capture':
          return reconcileCapture(attempt);
        case 'review':
          return reconcileReview(attempt, allowSubmit);
      }
    },
    [reconcileActivation, reconcileCapture, reconcileReview]
  );
  useEffect(() => {
    const scope = { origin: window.location.origin, userId, ontologyId };
    const read = readPublicationReceipt(scope);
    setReceiptState({ owner: scopeKey, read });
    if (read.kind === 'ready' && read.value) {
      void reconcile(read.value, false).catch(() => undefined);
    }
  }, [ontologyId, userId, scopeKey, reconcile]);

  const recovery = receipt.kind === 'ready' ? receipt.value : null;
  const recoveryReady = receipt.kind === 'ready' && !receipt.value;
  const canWrite = [
    canEdit,
    current.kind === 'ready',
    recoveryReady,
    !isBusy,
  ].every(Boolean);
  const run = async (action: () => Promise<void>) => {
    if (busy.current?.owner === scopeKey) {
      return;
    }
    const startedFor = { owner: scopeKey };
    busy.current = startedFor;
    setBusyFor(startedFor);
    try {
      await action();
    } catch (error) {
      if (owner.current === startedFor.owner) {
        showErrorToast(
          isAxiosError(error) ? error : t('server.unexpected-error')
        );
      }
    } finally {
      await refresh();
      if (busy.current === startedFor) {
        busy.current = null;
      }
      setBusyFor((value) => (value === startedFor ? null : value));
    }
  };
  const captureCandidate = async (
    preview: OntologyState,
    metadata: OntologyReleaseMetadata,
    intent: 'capture' | 'review'
  ) => {
    const attempt: PublicationReceipt = {
      origin: window.location.origin,
      userId,
      ontologyId,
      state: { ...preview },
      operation: 'capture',
      phase: 'running',
      intent,
      metadata: { ...metadata },
      expectedVersion: metadata.versionBump
        ? nextPublicationVersion(
            latestVersioned.data?.semanticVersion,
            metadata.versionBump
          )
        : undefined,
    };
    storeReceipt(attempt, null, attempt);
    let captured: OntologyRelease;
    try {
      captured = await captureOntologyRelease(ontologyId, {
        expectedWorkingRevision: attempt.state.workingRevision,
        expectedActivationRevision: attempt.state.activationRevision,
        ...(metadata.versionBump
          ? { expectedLatestReleaseRevision: attempt.state.lastReleaseRevision }
          : {}),
        ...attempt.metadata,
      });
      if (!matchesCaptureMetadata(captured, attempt)) {
        throw new Error('Captured release does not match the attempt');
      }
    } catch (error) {
      storeReceipt(
        isDefinitiveWriteRejection(error)
          ? null
          : { ...attempt, phase: 'unknown' },
        attempt,
        attempt
      );

      throw error;
    }
    queryClient.setQueryData(
      [RELEASE_QUERY, ontologyId, captured.id, userId],
      captured
    );
    if (intent === 'capture') {
      storeReceipt(null, attempt, attempt);

      return;
    }
    const reviewAttempt: PublicationReceipt = {
      origin: attempt.origin,
      userId,
      ontologyId,
      state: attempt.state,
      operation: 'review',
      phase: 'failed',
      release: capturedIdentity(captured),
    };
    storeReceipt(reviewAttempt, attempt, attempt);
    await submitReview(reviewAttempt);
  };
  const canCapture = (preview: OntologyState) => {
    if (!canWrite || current.kind !== 'ready' || !working.isSuccess) {
      return false;
    }
    const available =
      latestVersioned.isSuccess &&
      !latestVersioned.isFetching &&
      !working.isFetching;

    return (
      available &&
      samePublicationState(preview, current.value.state) &&
      samePublicationState(preview, working.data.state)
    );
  };
  const capture = (
    preview: OntologyState,
    metadata: OntologyReleaseMetadata = {}
  ) => {
    if (!canCapture(preview)) {
      return Promise.resolve();
    }

    return run(() => captureCandidate(preview, metadata, 'capture'));
  };
  const captureAndRequestApproval = (
    preview: OntologyState,
    metadata: OntologyReleaseMetadata
  ) => {
    if (!canCapture(preview) || current.kind !== 'ready') {
      return Promise.resolve();
    }
    const { ontology } = current.value;
    const reusable = reusablePublicationCandidate(current.value);
    const effective = eligiblePublicationReviewers(ontology.reviewers ?? [], {
      ids: [userId],
      names: [currentUser?.name, reusable?.reviewAuthor ?? reusable?.sealedBy],
    });
    if (!effective.length || !isReviewableCandidate(current.value)) {
      return Promise.resolve();
    }

    return run(async () => {
      if (reusable) {
        const attempt: PublicationReceipt = {
          origin: window.location.origin,
          userId,
          ontologyId,
          state: { ...preview },
          operation: 'review',
          phase: 'failed',
          release: capturedIdentity(reusable),
        };
        storeReceipt(attempt, null, attempt);
        await submitReview(attempt);
      } else {
        await captureCandidate(preview, metadata, 'review');
      }
    });
  };
  const activate = (
    subject: { kind: 'current' | 'selected' } = { kind: 'selected' }
  ) => {
    const target = subject.kind === 'current' ? candidate : selected;
    if (!canWrite || !state.isSuccess || !target.isSuccess) {
      return Promise.resolve();
    }
    const canActivate =
      !state.isFetching &&
      !target.isFetching &&
      target.data.entityStatus === EntityStatus.Approved &&
      target.data.id !== activeReleaseId;
    if (!canActivate) {
      return Promise.resolve();
    }
    const attempt: PublicationReceipt = {
      origin: window.location.origin,
      userId,
      ontologyId,
      state: { ...state.data },
      operation: 'activation',
      phase: 'running',
      release: capturedIdentity(target.data),
    };

    return run(async () => {
      storeReceipt(attempt, null, attempt);
      try {
        const activated = await activateOntologyRelease(ontologyId, {
          releaseId: attempt.release.id,
          expectedActivationRevision: attempt.state.activationRevision,
        });
        if (
          activated.ontologyId !== ontologyId ||
          activated.activeReleaseId !== attempt.release.id
        ) {
          throw new Error('Activation response does not match');
        }
        storeReceipt(null, attempt, attempt);
      } catch (error) {
        storeReceipt(
          isDefinitiveWriteRejection(error)
            ? null
            : { ...attempt, phase: 'unknown' },
          attempt,
          attempt
        );

        throw error;
      }
    });
  };
  const retryRecovery = () =>
    run(async () => {
      const scope = { origin: window.location.origin, userId, ontologyId };
      const fresh = readPublicationReceipt(scope);
      setReceiptState({ owner: scopeKey, read: fresh });
      if (fresh.kind === 'ready' && fresh.value) {
        await reconcile(fresh.value, canEdit);
      }
    });
  const dismissActivationConflict = () => {
    if (!canEdit) {
      return Promise.resolve();
    }

    return run(async () => {
      const scope = { origin: window.location.origin, userId, ontologyId };
      const fresh = readPublicationReceipt(scope);
      if (
        fresh.kind !== 'ready' ||
        fresh.value?.operation !== 'activation' ||
        fresh.value.phase !== 'conflict'
      ) {
        return;
      }
      const latest = await getOntologyState(ontologyId);
      if (latest.ontologyId !== ontologyId) {
        throw new Error('Activation conflict owner does not match');
      }
      if (latest.activationRevision !== fresh.value.state.activationRevision) {
        storeReceipt(null, fresh.value, scope);
      }
    });
  };
  const settingsWereCommitted = (settings: ReviewSettings) => {
    if (owner.current !== scopeKey) {
      return false;
    }
    const fresh = queryClient.getQueryState<Ontology>([
      PROJECTION_QUERY,
      ontologyId,
      userId,
    ]);
    const available =
      fresh?.status === 'success' &&
      fresh.fetchStatus === 'idle' &&
      !fresh.isInvalidated;

    return available && matchesReviewSettings(fresh.data, ontologyId, settings);
  };
  const updateReviewSettings = async (
    settings: ReviewSettings
  ): Promise<SettingsOutcome> => {
    if (!canWrite || current.kind !== 'ready') {
      return { kind: 'unavailable' };
    }
    const { ontology } = current.value;
    if (
      !canEditPublicationSettings(current.value) ||
      !isValidReviewSettings(settings)
    ) {
      return { kind: 'unavailable' };
    }
    let outcome: SettingsOutcome = { kind: 'unavailable' };
    let uncertain = false;
    await run(async () => {
      try {
        await patchOntology(ontologyId, [
          { op: 'test', path: '/version', value: ontology.version },
          { op: 'add', path: '/reviewers', value: settings.reviewers },
          { op: 'add', path: '/approvalRule', value: settings.approvalRule },
        ]);
        outcome = { kind: 'saved' };
      } catch (error) {
        uncertain = !isDefinitiveWriteRejection(error);
        outcome = {
          kind:
            isAxiosError(error) && error.response?.status === 409
              ? 'conflict'
              : 'unavailable',
        };
      }
    });
    if (uncertain && settingsWereCommitted(settings)) {
      outcome = { kind: 'saved' };
    }

    return outcome;
  };

  return {
    state,
    activeReleaseId,
    working,
    selected,
    selectedId,
    releaseId,
    release: selected.data,
    current,
    candidate,
    review,
    projection,
    currentUser,
    latestVersioned,
    history,
    setSelectedId,
    isBusy,
    canWrite,
    receipt,
    recovery,
    refresh,
    capture,
    captureAndRequestApproval,
    activate,
    retryRecovery,
    dismissActivationConflict,
    updateReviewSettings,
  };
};
