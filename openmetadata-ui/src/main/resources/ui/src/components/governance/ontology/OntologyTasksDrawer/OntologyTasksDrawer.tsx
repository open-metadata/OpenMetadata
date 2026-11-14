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
  Input,
  Modal,
  ModalOverlay,
  Tabs,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ClipboardCheck,
  Inbox01,
  Search,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import {
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  getOntology,
  getOntologyRelease,
  getOntologyReleaseReview,
  getOntologyReleaseReviews,
} from '../../../../rest/ontologyAPI';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoSearchResultsPlaceholder from '../../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import Loader from '../../../common/Loader/Loader';
import InboxTaskListItem from '../../../discovery/personal-space/InboxPage/components/InboxTaskListItem';
import TaskDetailPanel from '../../../discovery/personal-space/InboxPage/components/TaskDetailPanel';
import OntologyOpenReviewsBanner from '../OntologyReviewBanner/OntologyOpenReviewsBanner';
import OntologyReviewBanner from '../OntologyReviewBanner/OntologyReviewBanner';
import { ONTOLOGY_REVIEW_QUEUES_QUERY_KEY } from './OntologyTasksDrawer.constants';
import {
  CURSOR_HISTORY_LIMIT,
  filterReviews,
  hasMorePages,
} from './OntologyTasksDrawer.utils';

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

/**
 * The review's approval task as the Inbox list row reads it. The queue lists
 * reviews, not tasks, so the row is built from what the review carries rather
 * than fetching every task on the page; the detail pane loads the full task.
 */
export const reviewAsTask = (review: OntologyReleaseReview): Task =>
  ({
    id: review.task.id,
    name: review.task.name ?? review.taskId ?? review.task.id,
    displayName: review.task.displayName,
    taskId: review.taskId,
    type: TaskType.RequestApproval,
    category: TaskCategory.Approval,
    status: TaskStatus.Open,
    about: { ...review.release, type: 'ontologyRelease' },
    createdBy: review.requester,
  } as Task);

const OntologyTasksDrawer = ({
  ontologyId,
  taskId,
  onTaskChange,
  children,
}: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queuesKey = [ONTOLOGY_REVIEW_QUEUES_QUERY_KEY];
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
  const taskButton = useRef<HTMLButtonElement>(null);
  // A disabled trigger can't take focus; its Tooltip wrapper (tabIndex 0) can.
  const focusTrigger = () => {
    const button = taskButton.current;
    (button?.disabled ? button.parentElement : button)?.focus();
  };
  useEffect(() => {
    setQueueHistory({ key: '', cursors: [undefined] });
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

  const close = () => {
    setListOpen(false);
    // Every open starts on the reviewer's own queue, unfiltered.
    setView('assigned');
    setSearch('');
    setQueueHistory({ key: '', cursors: [undefined] });
    onTaskChange(undefined);
    focusTrigger();
  };
  // A vote or comment can move the task between queues and change the release's stage.
  const refreshQueues = () => {
    void queryClient.invalidateQueries({ queryKey: queuesKey });
    void queryClient.invalidateQueries({
      queryKey: ['ontology-review-state'],
    });
  };
  const queueControls = () => (
    <Box aria-label={t('label.task-plural')} gap={2}>
      <Button
        color="secondary"
        isDisabled={
          queue.isFetching ||
          queueCursors[queueCursors.length - 1] === undefined
        }
        size="sm"
        onPress={() =>
          setQueueHistory({ key: queueScope, cursors: [undefined] })
        }>
        {t('label.first')}
      </Button>
      <Button
        color="secondary"
        isDisabled={queue.isFetching || queueCursors.length === 1}
        size="sm"
        onPress={() =>
          setQueueHistory({
            key: queueScope,
            cursors: queueCursors.slice(0, -1),
          })
        }>
        {t('label.previous')}
      </Button>
      <Button
        color="secondary"
        isDisabled={
          queue.isFetching ||
          !queue.data?.data.length ||
          !queue.data?.paging?.after
        }
        size="sm"
        onPress={() =>
          setQueueHistory({
            key: queueScope,
            cursors: pushCursor(queueCursors, queue.data?.paging?.after),
          })
        }>
        {t('label.next')}
      </Button>
    </Box>
  );

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
    if ((key === 'assigned' || key === 'created') && key !== view) {
      setView(key);
      setQueueHistory({ key: '', cursors: [undefined] });
      // The open task belongs to the tab being left; the new tab opens its own first task.
      onTaskChange(undefined);
    }
  };
  const queueTasks = (queue.data?.data ?? []).map(reviewAsTask);
  // As in the Inbox, an open list with nothing selected shows its first task.
  const firstTaskId = queueTasks[0]?.id;
  useEffect(() => {
    if (isOpen && !taskId && firstTaskId && !queue.isFetching) {
      onTaskChange(firstTaskId);
    }
  }, [isOpen, taskId, firstTaskId, queue.isFetching, onTaskChange]);
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
        {visible.map((entry) => (
          <InboxTaskListItem
            isActive={entry.task.id === taskId}
            key={entry.task.id}
            task={reviewAsTask(entry)}
            onClick={(selected) => onTaskChange(selected.id)}
          />
        ))}
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
        ? queueControls()
        : null}
    </Box>
  );
  const renderDetail = () =>
    taskId ? (
      // The same task screen as the Inbox: it loads the full task and acts on it.
      <TaskDetailPanel
        fallbackTask={queueTasks.find((task) => task.id === taskId)}
        key={taskId}
        taskId={taskId}
        onCommentsChanged={refreshQueues}
        onResolved={refreshQueues}
        onTaskUpdated={refreshQueues}
      />
    ) : (
      <div className="tw:relative tw:h-full">
        <NoDataPlaceholder
          description={t('message.ontology-select-task-description')}
          title={t('message.ontology-select-task')}
        />
      </div>
    );
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
                <div className="tw:relative tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col">
                  {renderDetail()}
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
