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
  SlideoutMenu,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  activateOntologyRelease,
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
import {
  buildResolveBody,
  getTaskResolveActions,
} from '../../../discovery/personal-space/InboxPage/taskResolve.utils';
import OntologyReviewBanner from '../OntologyReviewBanner/OntologyReviewBanner';
import OntologyTaskDetail from './OntologyTaskDetail';
import OntologyTaskThread from './OntologyTaskThread';

type Props = {
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

const OntologyTasksDrawer = ({ taskId, onTaskChange, children }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queuesKey = ['ontology-review-queues'];
  const combinedApproval = 'approve-and-publish';
  const currentUser = useApplicationStore((store) => store.currentUser);
  const account = currentUser?.id ?? '';
  const [listOpen, setListOpen] = useState(false);
  const isOpen = Boolean(taskId) || listOpen;
  const [view, setView] = useState<'assigned' | 'created'>('assigned');
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
    queryKey: [...queuesKey, account, 'pending'],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      getOntologyReleaseReviews({ view: 'pending', limit: 1 }, signal),
  });
  const created = useQuery({
    queryKey: [...queuesKey, account, 'created-banner'],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      getOntologyReleaseReviews({ view: 'created', limit: 1 }, signal),
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
        { view, limit: 25, after: queueCursors[queueCursors.length - 1] },
        signal
      ),
  });
  const bannerReview = pending.data?.data[0] ?? created.data?.data[0];
  const bannerRelease = useQuery({
    queryKey: ['ontology-review-banner', account, bannerReview?.release.id],
    gcTime: 0,
    retry: false,
    enabled: Boolean(bannerReview),
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
        { limit: 25, after: eventCursors[eventCursors.length - 1] },
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
              cursors: [...cursors, response.data?.paging?.after].slice(-40),
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
      color="secondary"
      data-testid="ontology-tasks-trigger"
      ref={taskButton}
      size="sm"
      onPress={() => {
        setListOpen(true);
        void pending.refetch();
        void created.refetch();
      }}>
      {t('label.task-plural')}
      <Badge color="error">
        {pending.isError
          ? t('label.unavailable')
          : pending.data?.paging?.total ?? t('label.unavailable')}
      </Badge>
    </Button>
  );
  const renderBanner = () =>
    bannerReview && bannerRelease.data ? (
      <OntologyReviewBanner
        release={bannerRelease.data}
        review={bannerReview}
        viewerId={currentUser?.id}
        viewerName={getEntityName(currentUser)}
        onOpenTask={onTaskChange}
      />
    ) : null;
  const renderQueue = () => (
    <Tabs
      selectedKey={view}
      onSelectionChange={(key) => {
        if (key === 'assigned' || key === 'created') {
          setView(key);
          setQueueHistory({ key: '', cursors: [undefined] });
        }
      }}>
      <Tabs.List aria-label={t('label.task-plural')}>
        <Tabs.Item id="assigned" label={t('label.assigned-to-me')} />
        <Tabs.Item id="created" label={t('label.created-by-me')} />
      </Tabs.List>
      <Tabs.Panel id={view}>
        <Box direction="col" gap={2}>
          {queue.isError && (
            <Alert variant="error">
              {t('message.ontology-review-unavailable')}
            </Alert>
          )}
          {queue.isPending ? (
            <Typography role="status">{t('label.loading')}</Typography>
          ) : (
            queue.data?.data.map((entry) => (
              <Button
                color="link-color"
                key={entry.task.id}
                onPress={() => onTaskChange(entry.task.id)}>
                {entry.taskId ?? entry.task.id} ·{' '}
                {getEntityName(entry.ontology)}
              </Button>
            ))
          )}
          {pageControls('queue')}
        </Box>
      </Tabs.Panel>
    </Tabs>
  );
  const renderSelected = () =>
    detail.isPending ? (
      <Typography role="status">{t('label.loading')}</Typography>
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
        {' '}
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
        {renderSelected()}
      </>
    );
  };
  const renderDrawer = () => {
    if (!isOpen) {
      return null;
    }

    return (
      <SlideoutMenu
        isDismissable
        isOpen
        aria-label={t('label.task-plural')}
        width="min(100vw, 56rem)"
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}>
        <SlideoutMenu.Header
          closeButtonTestId="ontology-tasks-close"
          onClose={close}>
          <Typography as="h2" size="text-lg" weight="semibold">
            {t('label.task-plural')}
          </Typography>
        </SlideoutMenu.Header>
        <SlideoutMenu.Content>
          {renderQueue()}
          {renderDetail()}
        </SlideoutMenu.Content>
      </SlideoutMenu>
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
