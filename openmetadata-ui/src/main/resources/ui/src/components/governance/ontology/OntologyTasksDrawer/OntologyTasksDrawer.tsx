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
  Avatar,
  Badge,
  Box,
  Button,
  ButtonUtility,
  Dialog,
  FeaturedIcon,
  Input,
  Modal,
  ModalOverlay,
  Tabs,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  ClipboardCheck,
  Inbox01,
  Search,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
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
import { Task, TaskType } from '../../../../generated/entity/tasks/task';
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
  getTaskById,
  resolveTask,
} from '../../../../rest/tasksAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { getOperationPermissions } from '../../../../utils/PermissionsUtils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoSearchResultsPlaceholder from '../../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import Loader from '../../../common/Loader/Loader';
import {
  buildResolveBody,
  getTaskResolveActions,
} from '../../../discovery/personal-space/InboxPage/taskResolve.utils';
import OntologyOpenReviewsBanner from '../OntologyReviewBanner/OntologyOpenReviewsBanner';
import OntologyReviewBanner from '../OntologyReviewBanner/OntologyReviewBanner';
import OntologyTaskDetail from './OntologyTaskDetail';
import { ONTOLOGY_REVIEW_QUEUES_QUERY_KEY } from './OntologyTasksDrawer.constants';
import {
  CURSOR_HISTORY_LIMIT,
  filterReviews,
  hasMorePages,
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
  | { kind: 'approve' | 'approve-and-publish' | 'publish' };
type Detail = {
  task: Task;
  review: OntologyReleaseReview;
  release: OntologyRelease;
};

// ADR:2026-10-29-studio-tasks-drawer-pages-25-rows-and-keeps-page-one-in-a-40-cursor-history
const PAGE_SIZE = 25;
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

/** A tab's open-review count; a missing total stays unknown rather than zero. */
const useQueueTotal = (queueKey: string[], view: 'assigned' | 'created') =>
  useQuery({
    queryKey: [...queueKey, view + '-total'],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      getOntologyReleaseReviews({ view, limit: 1 }, signal),
  }).data?.paging?.total;

/** Which reviews the banner shows: one ontology's single review, or a set of them. */
const getBannerKey = (
  ontologyId: string | undefined,
  bannerReview: OntologyReleaseReview | undefined,
  openReviews: OntologyReleaseReview[]
) =>
  ontologyId && openReviews.length <= 1
    ? bannerReview?.task.id
    : openReviews.map((review) => review.task.id).join();

const reviewsOf = (page?: { data: OntologyReleaseReview[] }) =>
  page?.data ?? [];

/** A transient state failure still allows a vote; a 404 means the ontology was archived. */
const isReviewUnvotable = (detailFailed: boolean, stateError: unknown) =>
  detailFailed ||
  (isAxiosError(stateError) && stateError.response?.status === 404);

const OntologyTasksDrawer = ({
  ontologyId,
  taskId,
  onTaskChange,
  children,
}: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queuesKey = [ONTOLOGY_REVIEW_QUEUES_QUERY_KEY];
  const combinedApproval = 'approve-and-publish';
  const currentUser = useApplicationStore((store) => store.currentUser);
  const account = currentUser?.id ?? '';
  const [listOpen, setListOpen] = useState(false);
  const isOpen = Boolean(taskId) || listOpen;
  const [view, setView] = useState<'assigned' | 'created'>('assigned');
  const [search, setSearch] = useState('');
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
  // A disabled trigger can't take focus; its Tooltip wrapper (tabIndex 0) can.
  const focusTrigger = () => {
    const button = taskButton.current;
    (button?.disabled ? button.parentElement : button)?.focus();
  };
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
      focusTrigger();
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
  const assignedTotal = useQueueTotal([...queuesKey, account], 'assigned');
  const createdTotal = useQueueTotal([...queuesKey, account], 'created');
  // The banner announces only reviews waiting on the viewer's vote.
  const openReviews = reviewsOf(pending.data);
  const openBannerReview = openReviews[0];
  const decided = useDecidedReview({
    account,
    ontologyId,
    enabled: [pending.isSuccess, !openBannerReview].every(Boolean),
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
  const isVoteBlocked = isReviewUnvotable(detail.isError, state.error);
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
    // Every open starts on the reviewer's own queue, unfiltered.
    setView('assigned');
    setSearch('');
    setQueueHistory({ key: '', cursors: [undefined] });
    onTaskChange(undefined);
    focusTrigger();
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

  const renderTasksAction = () => {
    // Unknown totals (loading/error) keep the trigger enabled.
    // Stays enabled while open so acting on the last task doesn't remount it mid-modal.
    const hasNoTasks =
      !isOpen &&
      [pendingTotal.data?.paging?.total, assignedTotal, createdTotal].every(
        (total) => total === 0
      );

    return (
      <Tooltip isDisabled={!hasNoTasks} title={t('label.no-tasks-right-now')}>
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
          isDisabled={hasNoTasks}
          ref={taskButton}
          size="sm"
          onPress={() => {
            setListOpen(true);
            void pendingTotal.refetch();
            void pending.refetch();
          }}>
          {t('label.task-plural')}
        </Button>
      </Tooltip>
    );
  };
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
    if (!ontologyId || openReviews.length > 1) {
      return renderOpenReviews();
    }

    return bannerReview && bannerRelease.data ? (
      <OntologyReviewBanner
        release={bannerRelease.data}
        review={bannerReview}
        viewerId={currentUser?.id}
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
  const renderTaskCard = (entry: OntologyReleaseReview) => {
    const isSelected = entry.task.id === taskId;
    const requester = getEntityName(entry.requester);

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
            : 'tw:border-transparent'
        )}
        color="tertiary"
        key={entry.task.id}
        onPress={() => onTaskChange(entry.task.id)}>
        <Box align="start" className="tw:min-w-0" gap={3}>
          <span className="tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-secondary tw:bg-surface">
            <CheckCircle className="tw:size-3.5 tw:text-fg-brand-primary" />
          </span>
          <Box className="tw:min-w-0" direction="col" gap={1}>
            <Typography size="text-sm" weight="medium">
              {entry.task.displayName ?? getEntityName(entry.ontology)}
            </Typography>
            <Box align="center" gap={2} wrap="wrap">
              <Typography
                className="tw:font-mono"
                color="secondary"
                size="text-xs">
                {entry.taskId ?? entry.task.id}
              </Typography>
              {requester && (
                <Box align="center" gap={1}>
                  <Avatar
                    initials={requester.slice(0, 2).toUpperCase()}
                    size="xxs"
                  />
                  <Typography color="secondary" size="text-xs">
                    {requester}
                  </Typography>
                </Box>
              )}
              <Badge color="gray" size="sm">
                {getEntityName(entry.ontology)}
              </Badge>
            </Box>
          </Box>
        </Box>
      </Button>
    );
  };
  const renderQueueList = () => {
    const entries = queue.data?.data ?? [];
    if (queue.isPending || queue.isError) {
      return null;
    }
    if (!entries.length) {
      return (
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
      );
    }
    const visible = filterReviews(entries, search);
    if (!visible.length) {
      return (
        <div className="tw:relative tw:min-h-60">
          <NoSearchResultsPlaceholder />
        </div>
      );
    }

    return (
      <>
        <Box
          align="center"
          className="tw:px-1"
          data-testid="ontology-tasks-group"
          gap={2}>
          <span
            aria-hidden
            className="tw:size-1.5 tw:rounded-full tw:bg-brand-solid"
          />
          <Typography
            className="tw:uppercase tw:tracking-wide"
            color="secondary"
            size="text-xs"
            weight="semibold">
            {t('label.pending-approval')}
          </Typography>
          <Typography color="secondary" size="text-xs">
            {search.trim()
              ? visible.length
              : queue.data?.paging?.total ?? visible.length}
          </Typography>
        </Box>
        {visible.map(renderTaskCard)}
      </>
    );
  };
  const renderQueue = () => (
    <Box direction="col" gap={3}>
      <Input
        aria-label={t('label.search-tasks')}
        autoComplete="off"
        data-testid="ontology-tasks-search"
        icon={Search}
        placeholder={t('label.search-tasks')}
        size="sm"
        value={search}
        onChange={setSearch}
      />
      {queue.isError && (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      )}
      {queue.isPending ? <Loader size="small" /> : null}
      {renderQueueList()}
      {hasMorePages(queue.data?.paging?.after, queueCursors.length)
        ? pageControls('queue')
        : null}
    </Box>
  );
  const renderSelected = () =>
    detail.isPending ? (
      <div className="tw:p-6">
        <Loader />
      </div>
    ) : (
      selected && (
        <OntologyTaskDetail
          activationError={
            writeError?.selection === selection &&
            writeError.kind === 'activation'
          }
          activationReady={activationReady}
          canPublish={canPublish && !isVoteBlocked}
          contentGeneration={currentGeneration}
          contentReady={contentReady}
          isPublished={state.data?.activeReleaseId === selected.release.id}
          isRequester={
            selected.review.requester?.id === currentUser?.id ||
            selected.task.ontologyReview?.author === currentUser?.name
          }
          isWriting={writing || isVoteBlocked || detail.isFetching}
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
          }}>
          <OntologyTaskThread
            events={events.data?.data ?? []}
            review={selected.review}
            task={selected.task}
            onCommentChanged={() => void detail.refetch()}
          />
          {hasMorePages(events.data?.paging?.after, eventCursors.length) && (
            <>
              <Typography color="secondary" size="text-sm">
                {t('message.ontology-review-event-window')}
              </Typography>
              {pageControls('events')}
            </>
          )}
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
            <Alert
              rightContent={
                <Button
                  color="secondary"
                  isDisabled={writing}
                  size="sm"
                  onPress={() => {
                    void refresh();
                  }}>
                  {t('label.retry')}
                </Button>
              }
              variant="error">
              {t('message.ontology-review-unavailable')}
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
                  <Tabs.Item
                    badge={assignedTotal}
                    id="assigned"
                    label={t('label.assigned-to-me')}
                  />
                  <Tabs.Item
                    badge={createdTotal}
                    id="created"
                    label={t('label.created-by-me')}
                  />
                </Tabs.List>
              </Box>
              {/* The detail sits inside the panel too: a Tabs control in it (the change filters) would
                  otherwise be collected into this dialog's own tab strip. */}
              <Tabs.Panel className="tw:flex tw:min-h-0 tw:flex-1" id={view}>
                <div
                  className="tw:w-105 tw:shrink-0 tw:overflow-y-auto tw:border-r tw:border-secondary tw:p-4"
                  data-testid="ontology-tasks-queue">
                  {renderQueue()}
                </div>
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
              </Tabs.Panel>
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
