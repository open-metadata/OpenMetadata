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
  Alert,
  Badge,
  Box,
  Button,
  ButtonUtility,
  Dialog,
  FeaturedIcon,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ClipboardCheck,
  Inbox01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import {
  EntityStatus,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import {
  EntityStatus as ReleaseStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import {
  Task,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  activateOntologyRelease,
  getOntology,
  getOntologyRelease,
  getOntologyReleaseEvents,
  getOntologyReleaseReview,
  getOntologyReleaseReviews,
  getOntologyState,
} from '../../../../rest/ontologyAPI';
import { getEntityPermissionById } from '../../../../rest/permissionAPI';
import {
  addTaskComment,
  closeTask,
  getTaskById,
  resolveTask,
} from '../../../../rest/tasksAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { getOperationPermissions } from '../../../../utils/PermissionsUtils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import {
  buildResolveBody,
  getTaskResolveActions,
} from '../../../discovery/personal-space/InboxPage/taskResolve.utils';
import OntologyOpenReviewsBanner from '../OntologyReviewBanner/OntologyOpenReviewsBanner';
import OntologyReviewBanner from '../OntologyReviewBanner/OntologyReviewBanner';
import OntologyTaskDetail from './OntologyTaskDetail';
import {
  getOpenReviews,
  invalidatePublicationReads,
} from './OntologyTasksDrawer.utils';
import OntologyTaskThread from './OntologyTaskThread';

type Props = {
  /** The ontology in view; its latest decided review is announced to the requester. */
  readonly ontologyId?: string;
  readonly taskId?: string;
  readonly onTaskChange: (taskId?: string) => void;
  readonly children: (parts: {
    tasksAction: ReactNode;
    banner: ReactNode;
  }) => ReactNode;
};
type ReviewWrite =
  | { kind: 'comment'; message: string }
  | { kind: 'reject'; reason: string }
  | { kind: 'approve' | 'approve-and-publish' | 'publish' | 'withdraw' };
type Detail = {
  task: Task;
  review: OntologyReleaseReview;
  release: OntologyRelease;
};

// ADR:2026-10-29-studio-tasks-drawer-pages-25-rows-and-keeps-page-one-in-a-40-cursor-history
const PAGE_SIZE = 25;
const CURSOR_HISTORY_LIMIT = 40;
const BANNER_LIMIT = 100;

// The trim keeps page 1 first, so Previous can still walk back to it.
const pushCursor = (cursors: (string | undefined)[], after?: string) => {
  const [first, ...rest] = [...cursors, after];

  return [first, ...rest.slice(1 - CURSOR_HISTORY_LIMIT)];
};

const DECIDED_STAGES: string[] = [Stage.Approved, Stage.ChangesRequested];

/**
 * The latest decided review of the ontology in view, when the caller asked for
 * it, so the author sees the outcome without opening the Inbox.
 */
const useDecidedReview = ({
  account,
  ontologyId,
  enabled,
  queuesKey,
}: {
  account: string;
  ontologyId?: string;
  enabled: boolean;
  queuesKey: string[];
}) => {
  const query = useQuery({
    queryKey: [...queuesKey, account, 'decided', ontologyId],
    gcTime: 0,
    retry: false,
    enabled: enabled && Boolean(ontologyId),
    queryFn: async ({ signal }) => {
      const ontology = await getOntology(
        ontologyId ?? '',
        'publicationStatus',
        signal
      );
      const latest = ontology.publicationStatus?.latest;
      if (!latest || !DECIDED_STAGES.includes(latest.stage)) {
        return null;
      }
      const review = await getOntologyReleaseReview(latest.releaseId, signal);

      return review.requester?.id === account ? review : null;
    },
  });

  return query.data ?? undefined;
};

/** Which review the banner shows: one ontology's, or the open set on All ontologies. */
const getBannerKey = (
  ontologyId: string | undefined,
  bannerReview: OntologyReleaseReview | undefined,
  openReviews: OntologyReleaseReview[]
) =>
  ontologyId
    ? bannerReview?.task.id
    : openReviews.map((review) => review.task.id).join();

const OntologyTasksDrawer = ({
  ontologyId,
  taskId,
  onTaskChange,
  children,
}: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queuesKey = ['ontology-review-queues'];
  const combinedApproval = 'approve-and-publish';
  const currentUser = useApplicationStore((store) => store.currentUser);
  const account = currentUser?.id ?? '';
  const [listOpen, setListOpen] = useState(false);
  const isOpen = Boolean(taskId) || listOpen;
  const [view, setView] = useState<'assigned' | 'created'>('assigned');
  // The review the user hid; a different review shows the banner again.
  const [dismissedBanner, setDismissedBanner] = useState<string>();
  const [queueHistory, setQueueHistory] = useState<{
    key: string;
    cursors: (string | undefined)[];
  }>({ key: '', cursors: [undefined] });
  const queueScope = account + ':' + view;
  const queueCursors =
    queueHistory.key === queueScope ? queueHistory.cursors : [undefined];
  const [eventHistory, setEventHistory] = useState<{
    key: string;
    cursors: (string | undefined)[];
  }>({ key: '', cursors: [undefined] });
  const selection = account + ':' + (taskId ?? '') + ':' + isOpen;
  const eventCursors =
    eventHistory.key === selection ? eventHistory.cursors : [undefined];
  const [readCycle, setReadCycle] = useState(0);
  const identity = selection + ':' + readCycle;
  const generation = useRef({ identity, value: 0 });
  if (generation.current.identity !== identity) {
    generation.current = { identity, value: generation.current.value + 1 };
  }
  const currentGeneration = generation.current.value;
  const [readyGeneration, setReadyGeneration] = useState<number>();
  const admission = useRef(false);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<{
    selection: string;
    kind: 'uncertain' | 'activation';
  }>();
  const [permissionSelection, setPermissionSelection] = useState<string>();
  const taskButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setQueueHistory({ key: '', cursors: [undefined] });
    setEventHistory({ key: '', cursors: [undefined] });
  }, [account, taskId]);
  useEffect(() => {
    setPermissionSelection(undefined);
    setWriteError(undefined);
  }, [account]);
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      taskButton.current?.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);
  const pending = useQuery({
    queryKey: [...queuesKey, account, 'pending', ontologyId],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      getOntologyReleaseReviews(
        { view: 'pending', ontologyId, limit: BANNER_LIMIT },
        signal
      ),
  });
  const pendingTotal = useQuery({
    queryKey: [...queuesKey, account, 'pending-total'],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      getOntologyReleaseReviews({ view: 'pending', limit: 1 }, signal),
  });
  const created = useQuery({
    queryKey: [...queuesKey, account, 'created-banner', ontologyId],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      getOntologyReleaseReviews(
        { view: 'created', ontologyId, limit: BANNER_LIMIT },
        signal
      ),
  });
  const queue = useQuery({
    queryKey: [
      ...queuesKey,
      account,
      view,
      queueCursors[queueCursors.length - 1],
    ],
    gcTime: 0,
    retry: false,
    enabled: isOpen,
    queryFn: ({ signal }) =>
      getOntologyReleaseReviews(
        {
          view,
          limit: PAGE_SIZE,
          after: queueCursors[queueCursors.length - 1],
        },
        signal
      ),
  });
  const openReviews = getOpenReviews(pending.data?.data, created.data?.data);
  const openBannerReview = openReviews[0];
  const decided = useDecidedReview({
    account,
    ontologyId,
    enabled: [pending.isSuccess, created.isSuccess, !openBannerReview].every(
      Boolean
    ),
    queuesKey,
  });
  const bannerReview = openBannerReview ?? decided;
  const bannerRelease = useQuery({
    queryKey: ['ontology-review-banner', account, bannerReview?.release.id],
    gcTime: 0,
    retry: false,
    enabled: Boolean(bannerReview) && Boolean(ontologyId),
    queryFn: ({ signal }) =>
      getOntologyRelease(bannerReview?.release.id ?? '', signal),
  });
  const detailKey = ['ontology-review-task', account, taskId, isOpen];
  const detail = useQuery({
    queryKey: detailKey,
    gcTime: 0,
    retry: false,
    enabled: [isOpen, Boolean(taskId)].every(Boolean),
    queryFn: async ({ signal }): Promise<Detail> => {
      const { data: task } = await getTaskById(taskId ?? '', {
        fields: 'about,comments',
      });
      const target = task.ontologyReview;
      if (!target || !task.about) {
        throw new Error('Missing ontology review target');
      }
      const validTask = [
        !signal.aborted,
        task.id === taskId,
        task.type === TaskType.RequestApproval,
        task.about.type === 'ontologyRelease',
        target.entityId === task.about.id,
      ].every(Boolean);
      if (!validTask) {
        throw new Error('Invalid ontology review task');
      }
      const [review, release] = await Promise.all([
        getOntologyReleaseReview(target.entityId, signal),
        getOntologyRelease(target.entityId, signal),
      ]);
      const validIdentity = [
        !signal.aborted,
        review.task.id === taskId,
        review.release.id === release.id,
        release.id === task.about.id,
        review.ontology.id === release.ontology.id,
        target.ontologyId === release.ontology.id,
      ].every(Boolean);
      if (!validIdentity) {
        throw new Error('Mismatched ontology review identity');
      }

      return { task, review, release };
    },
  });
  const selected = detail.data;
  const ownerId = selected?.review.ontology.id ?? '';
  const state = useQuery({
    queryKey: ['ontology-review-state', account, ownerId],
    gcTime: 0,
    retry: false,
    enabled: [isOpen, Boolean(ownerId)].every(Boolean),
    queryFn: ({ signal }) => getOntologyState(ownerId, signal),
  });
  const permission = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ownerId },
    {
      enabled: [isOpen, Boolean(ownerId)].every(Boolean),
      deleted: selected?.release.ontology.deleted,
    }
  );
  const refreshPermission = permission.refresh;
  useEffect(() => {
    let current = true;
    if (ownerId && isOpen) {
      refreshPermission()
        .then(() => {
          if (current) {
            setPermissionSelection(selection);
          }
        })
        .catch(() => {
          if (current) {
            setPermissionSelection(undefined);
          }
        });
    }

    return () => {
      current = false;
    };
  }, [ownerId, isOpen, selection, refreshPermission]);
  const events = useQuery({
    queryKey: [
      'ontology-review-events',
      account,
      selected?.release.id,
      eventCursors[eventCursors.length - 1],
    ],
    gcTime: 0,
    retry: false,
    enabled: [isOpen, Boolean(selected)].every(Boolean),
    queryFn: ({ signal }) =>
      getOntologyReleaseEvents(
        selected?.release.id ?? '',
        { limit: PAGE_SIZE, after: eventCursors[eventCursors.length - 1] },
        signal
      ),
  });
  const canPublish = [
    permissionSelection === selection,
    permission.canEditAll,
    !permission.error,
    !permission.isLoading,
  ].every(Boolean);
  const activationReady = [
    state.isSuccess,
    !state.isFetching,
    state.data?.ontologyId === ownerId,
  ].every(Boolean);
  const onContentReadyChange = useCallback(
    (ready: boolean) => {
      if (generation.current.value === currentGeneration) {
        setReadyGeneration(ready ? currentGeneration : undefined);
      }
    },
    [currentGeneration]
  );
  const contentReady = [
    readyGeneration === currentGeneration,
    !detail.isFetching,
    !detail.isError,
  ].every(Boolean);

  const close = () => {
    generation.current = { identity: '', value: generation.current.value + 1 };
    setReadyGeneration(undefined);
    setListOpen(false);
    onTaskChange(undefined);
    taskButton.current?.focus();
  };
  const refresh = async () => {
    setReadyGeneration(undefined);
    setReadCycle((cycle) => cycle + 1);
    await Promise.allSettled([
      detail.refetch(),
      state.refetch(),
      events.refetch(),
      permission.refresh(),
    ]);
  };
  const writeAllowed = (write: ReviewWrite, current: Detail) => {
    switch (write.kind) {
      case 'comment':
        return Boolean(write.message.trim());
      case 'publish':
        return [
          canPublish,
          activationReady,
          current.review.status === EntityStatus.Approved,
        ].every(Boolean);
      case 'reject':
        return [
          contentReady,
          current.review.callerCanVote,
          Boolean(write.reason.trim()),
        ].every(Boolean);
      case 'approve':
        return contentReady && current.review.callerCanVote;
      case 'withdraw':
        return current.task.status === TaskStatus.Open;
      case combinedApproval:
        return [
          contentReady,
          current.review.callerCanVote,
          current.review.callerCompletesRule,
          canPublish,
          activationReady,
        ].every(Boolean);
    }
  };
  const announce = (kind: ReviewWrite['kind'], current: Detail) => {
    const version = 'v' + (current.release.semanticVersion ?? '');
    const messages: Partial<Record<ReviewWrite['kind'], string>> = {
      // Under an all-reviewers rule one approval may leave others pending.
      approve: current.review.callerCompletesRule
        ? t('message.ontology-task-approved', { version })
        : t('message.vote-recorded-waiting-for-other-approvers'),
      [combinedApproval]: t('message.ontology-task-approved-published', {
        version,
        ontology: getEntityName(current.review.ontology),
      }),
      withdraw: t('message.ontology-publication-withdrawn', { version }),
    };
    const message = messages[kind];
    if (message) {
      showSuccessToast(message);
    }
  };
  const submit = async (write: ReviewWrite): Promise<boolean> => {
    if (
      !selected ||
      [admission.current, detail.isFetching, detail.isError].some(Boolean)
    ) {
      return false;
    }
    if (!writeAllowed(write, selected)) {
      return false;
    }
    const captured = selected;
    const capturedGeneration = currentGeneration;
    const capturedSelection = selection;
    const revision = state.data?.activationRevision;
    admission.current = true;
    setWriting(true);
    const phase: { value: 'write' | 'activation' } = { value: 'write' };
    const saveCurrent = (value: Detail) => {
      if (generation.current.value === capturedGeneration) {
        queryClient.setQueryData<Detail>(detailKey, value);
      }
    };
    const activate = async (activationRevision: number) => {
      phase.value = 'activation';
      await activateOntologyRelease(captured.review.ontology.id, {
        releaseId: captured.release.id,
        expectedActivationRevision: activationRevision,
      });
    };
    const publishApproved = async () => {
      phase.value = 'activation';
      const [freshState, freshPermission] = await Promise.all([
        getOntologyState(captured.review.ontology.id),
        getEntityPermissionById(
          ResourceEntity.ONTOLOGY,
          captured.review.ontology.id
        ),
      ]);
      const permitted = getDerivedPermissionFlags(
        getOperationPermissions(freshPermission),
        Boolean(captured.release.ontology.deleted)
      ).canEditAll;
      if (freshState.ontologyId !== captured.review.ontology.id || !permitted) {
        throw new Error('Publication permission unavailable');
      }
      await activate(freshState.activationRevision);
    };
    const resolveVote = async () => {
      const kind = write.kind === 'reject' ? 'reject' : 'approve';
      const action = getTaskResolveActions(captured.task, {
        approve: t('label.approve'),
        reject: t('label.reject'),
      }).find((candidate) => candidate.kind === kind);
      if (!action) {
        throw new Error('Review transition unavailable');
      }
      const task = await resolveTask(
        captured.task.id,
        buildResolveBody(
          action,
          captured.task,
          write.kind === 'reject' ? { comment: write.reason } : undefined
        )
      );
      let status = captured.review.status;
      if (write.kind === 'reject') {
        status = EntityStatus.Rejected;
      } else if (captured.review.callerCompletesRule) {
        status = EntityStatus.Approved;
      }
      saveCurrent({
        ...captured,
        task,
        review: {
          ...captured.review,
          callerCanVote: false,
          callerCompletesRule: false,
          status,
        },
        release: {
          ...captured.release,
          entityStatus:
            status === EntityStatus.Approved
              ? ReleaseStatus.Approved
              : captured.release.entityStatus,
        },
      });
      if (write.kind === combinedApproval && revision !== undefined) {
        await activate(revision);
      }
    };
    let succeeded = false;
    try {
      switch (write.kind) {
        case 'comment':
          saveCurrent({
            ...captured,
            task: await addTaskComment(captured.task.id, write.message),
          });

          break;
        case 'publish':
          await publishApproved();

          break;
        case 'withdraw':
          await closeTask(captured.task.id);
          await invalidatePublicationReads(queryClient);

          break;
        default:
          await resolveVote();
      }
      succeeded = true;
      announce(write.kind, captured);
      setWriteError((previous) =>
        previous?.selection === capturedSelection ? undefined : previous
      );
    } catch {
      setWriteError({
        selection: capturedSelection,
        kind: phase.value === 'activation' ? 'activation' : 'uncertain',
      });
    } finally {
      const reads: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: queuesKey }),
        queryClient.invalidateQueries({ queryKey: ['ontology-review-state'] }),
        queryClient.invalidateQueries({
          queryKey: ['ontology-review-task', account, captured.task.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['ontology-review-events', account, captured.release.id],
        }),
      ];
      if (generation.current.value === capturedGeneration) {
        setReadyGeneration(undefined);
        setReadCycle((cycle) => cycle + 1);
      }
      await Promise.allSettled(reads);
      admission.current = false;
      setWriting(false);
    }

    return succeeded;
  };
  const pageControls = (kind: 'queue' | 'events') => {
    const response = kind === 'queue' ? queue : events;
    const cursors = kind === 'queue' ? queueCursors : eventCursors;
    const key = kind === 'queue' ? queueScope : selection;
    const setHistory = kind === 'queue' ? setQueueHistory : setEventHistory;

    return (
      <Box
        aria-label={t(
          kind === 'queue' ? 'label.task-plural' : 'label.event-plural'
        )}
        gap={2}>
        <Button
          color="secondary"
          isDisabled={
            response.isFetching || cursors[cursors.length - 1] === undefined
          }
          size="sm"
          onPress={() => setHistory({ key, cursors: [undefined] })}>
          {t('label.first')}
        </Button>
        <Button
          color="secondary"
          isDisabled={response.isFetching || cursors.length === 1}
          size="sm"
          onPress={() => setHistory({ key, cursors: cursors.slice(0, -1) })}>
          {t('label.previous')}
        </Button>
        <Button
          color="secondary"
          isDisabled={
            response.isFetching ||
            !response.data?.data.length ||
            !response.data?.paging?.after
          }
          size="sm"
          onPress={() =>
            setHistory({
              key,
              cursors: pushCursor(cursors, response.data?.paging?.after),
            })
          }>
          {t('label.next')}
        </Button>
      </Box>
    );
  };

  const renderTasksAction = () => (
    <Button
      aria-haspopup="dialog"
      className="tw:shrink-0 tw:whitespace-nowrap"
      color="secondary"
      data-testid="ontology-tasks-trigger"
      iconLeading={ClipboardCheck}
      iconTrailing={
        <Badge color="brand" size="sm" type="pill-color">
          {pendingTotal.isError
            ? t('label.unavailable')
            : pendingTotal.data?.paging?.total ?? t('label.unavailable')}
        </Badge>
      }
      ref={taskButton}
      size="sm"
      onPress={() => {
        setListOpen(true);
        void pendingTotal.refetch();
        void pending.refetch();
        void created.refetch();
      }}>
      {t('label.task-plural')}
    </Button>
  );
  const bannerKey = getBannerKey(ontologyId, bannerReview, openReviews);
  const dismissBanner = () => setDismissedBanner(bannerKey);
  const renderOpenReviews = () => (
    <OntologyOpenReviewsBanner
      reviews={openReviews}
      onDismiss={dismissBanner}
      onOpenList={() => setListOpen(true)}
      onOpenTask={onTaskChange}
    />
  );
  const renderBanner = () => {
    if (!bannerKey || dismissedBanner === bannerKey) {
      return null;
    }
    if (!ontologyId) {
      return renderOpenReviews();
    }

    return bannerReview && bannerRelease.data ? (
      <OntologyReviewBanner
        release={bannerRelease.data}
        review={bannerReview}
        viewerId={currentUser?.id}
        viewerName={getEntityName(currentUser)}
        onDismiss={dismissBanner}
        onOpenTask={onTaskChange}
      />
    ) : null;
  };
  const changeView = (key: Key) => {
    if (key === 'assigned' || key === 'created') {
      setView(key);
      setQueueHistory({ key: '', cursors: [undefined] });
    }
  };
  const renderQueue = () => (
    <Box direction="col" gap={2}>
      {queue.isError && (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      )}
      {queue.isPending ? (
        <Typography role="status">{t('label.loading')}</Typography>
      ) : null}
      {!queue.isPending && !queue.isError && !queue.data?.data.length ? (
        <div
          className="tw:relative tw:min-h-60"
          data-testid="ontology-tasks-empty">
          <NoDataPlaceholder
            description={t(
              view === 'assigned'
                ? 'message.ontology-tasks-assigned-empty'
                : 'message.ontology-tasks-created-empty'
            )}
            title={t('message.ontology-no-tasks-yet')}
          />
        </div>
      ) : null}
      {queue.isPending
        ? null
        : queue.data?.data.map((entry) => {
            const isSelected = entry.task.id === taskId;

            return (
              <Button
                noTextPadding
                aria-current={isSelected || undefined}
                aria-label={`${entry.taskId ?? entry.task.id} · ${
                  entry.task.displayName ?? getEntityName(entry.ontology)
                }`}
                className={classNames(
                  'tw:w-full tw:justify-start tw:rounded-xl tw:border tw:p-3 tw:text-left',
                  isSelected
                    ? 'tw:border-brand tw:bg-brand-primary_alt'
                    : 'tw:border-secondary'
                )}
                color="tertiary"
                key={entry.task.id}
                onPress={() => onTaskChange(entry.task.id)}>
                <Box className="tw:min-w-0" direction="col" gap={1}>
                  <Typography ellipsis size="text-sm" weight="semibold">
                    {entry.task.displayName ?? getEntityName(entry.ontology)}
                  </Typography>
                  <Box align="center" gap={2} wrap="wrap">
                    <Typography
                      className="tw:font-mono"
                      color="secondary"
                      size="text-xs">
                      {entry.taskId ?? entry.task.id}
                    </Typography>
                    <Badge color="gray" size="sm" type="pill-color">
                      {getEntityName(entry.ontology)}
                    </Badge>
                  </Box>
                </Box>
              </Button>
            );
          })}
      {/* An empty first page has nothing to page through. */}
      {queue.data?.data.length || queueCursors.length > 1
        ? pageControls('queue')
        : null}
    </Box>
  );
  const renderSelected = () =>
    detail.isPending ? (
      <div className="tw:p-6">
        <Typography role="status">{t('label.loading')}</Typography>
      </div>
    ) : (
      selected && (
        <OntologyTaskDetail
          activationError={
            writeError?.selection === selection &&
            writeError.kind === 'activation'
          }
          activationReady={activationReady}
          canPublish={canPublish && !detail.isError}
          contentGeneration={currentGeneration}
          contentReady={contentReady}
          isPublished={state.data?.activeReleaseId === selected.release.id}
          isRequester={
            selected.review.requester?.id === currentUser?.id ||
            selected.task.ontologyReview?.author === currentUser?.name
          }
          isWriting={writing || detail.isError || detail.isFetching}
          key={selection}
          release={selected.release}
          review={selected.review}
          task={selected.task}
          onApprove={() => {
            void submit({ kind: 'approve' });
          }}
          onApproveAndPublish={() => {
            void submit({ kind: combinedApproval });
          }}
          onComment={(message) => submit({ kind: 'comment', message })}
          onContentReadyChange={onContentReadyChange}
          onPublish={() => {
            void submit({ kind: 'publish' });
          }}
          onReject={(reason) => {
            void submit({ kind: 'reject', reason });
          }}
          onWithdraw={() => {
            void submit({ kind: 'withdraw' });
          }}>
          <OntologyTaskThread
            events={events.data?.data ?? []}
            review={selected.review}
            task={selected.task}
          />
          <Typography color="secondary" size="text-sm">
            {t('message.ontology-review-event-window')}
          </Typography>
          {pageControls('events')}
        </OntologyTaskDetail>
      )
    );
  const renderDetail = () => {
    if (!taskId) {
      return null;
    }

    return (
      <>
        <div className="tw:flex tw:flex-col tw:gap-2 tw:px-6 tw:pt-4 tw:empty:hidden">
          {(detail.isError || state.isError || events.isError) && (
            <Alert variant="error">
              <Box direction="col" gap={2}>
                {t('message.ontology-review-unavailable')}
                <Button
                  color="secondary"
                  isDisabled={writing}
                  onPress={() => {
                    void refresh();
                  }}>
                  {t('label.retry')}
                </Button>
              </Box>
            </Alert>
          )}
          {writeError?.selection === selection &&
            writeError.kind === 'uncertain' && (
              <Alert variant="warning">
                {t('message.ontology-review-write-uncertain')}
              </Alert>
            )}
        </div>
        {renderSelected()}
      </>
    );
  };
  const renderDrawer = () => {
    if (!isOpen) {
      return null;
    }

    return (
      <ModalOverlay
        isDismissable
        isOpen
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}>
        <Modal>
          <Dialog
            aria-label={t('label.task-plural')}
            dividers="scroll"
            showCloseButton={false}
            width={1325}
            onClose={close}>
            <Tabs
              className="tw:flex tw:h-[min(52rem,90vh)] tw:w-full tw:flex-col"
              data-testid="ontology-tasks-dialog"
              selectedKey={view}
              onSelectionChange={changeView}>
              <Box
                className="tw:shrink-0 tw:bg-secondary_alt tw:px-6 tw:pt-5"
                direction="col"
                gap={3}>
                <Box align="center" gap={3}>
                  <FeaturedIcon
                    color="brand"
                    icon={Inbox01}
                    size="lg"
                    theme="dark"
                  />
                  <Box className="tw:min-w-0 tw:flex-1" direction="col">
                    <Typography
                      as="h2"
                      className="not-prose tw:m-0"
                      size="text-lg"
                      weight="semibold">
                      {t('label.task-plural')}
                    </Typography>
                    <Typography color="secondary" size="text-sm">
                      {t('message.ontology-tasks-description')}
                    </Typography>
                  </Box>
                  <ButtonUtility
                    data-testid="ontology-tasks-close"
                    icon={XClose}
                    size="lg"
                    tooltip={t('label.close')}
                    onClick={close}
                  />
                </Box>
                <Tabs.List aria-label={t('label.task-plural')} type="underline">
                  <Tabs.Item id="assigned" label={t('label.assigned-to-me')} />
                  <Tabs.Item id="created" label={t('label.created-by-me')} />
                </Tabs.List>
              </Box>
              <Box className="tw:min-h-0 tw:flex-1">
                <Tabs.Panel
                  className="tw:w-105 tw:shrink-0 tw:overflow-y-auto tw:border-r tw:border-secondary tw:p-4"
                  id={view}>
                  {renderQueue()}
                </Tabs.Panel>
                <div className="tw:min-w-0 tw:flex-1 tw:overflow-y-auto">
                  {taskId ? (
                    renderDetail()
                  ) : (
                    <div className="tw:relative tw:h-full">
                      <NoDataPlaceholder
                        description={t(
                          'message.ontology-select-task-description'
                        )}
                        title={t('message.ontology-select-task')}
                      />
                    </div>
                  )}
                </div>
              </Box>
            </Tabs>
          </Dialog>
        </Modal>
      </ModalOverlay>
    );
  };

  return (
    <>
      {children({ tasksAction: renderTasksAction(), banner: renderBanner() })}
      {renderDrawer()}
    </>
  );
};

export default OntologyTasksDrawer;
