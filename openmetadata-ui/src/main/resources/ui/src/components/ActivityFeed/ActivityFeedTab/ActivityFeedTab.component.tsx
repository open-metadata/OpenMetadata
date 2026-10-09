/*
 *  Copyright 2023 Collate.
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
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Divider,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import {
  lazy,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as AllActivityIcon } from '../../../assets/svg/all-activity-v2.svg';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-check-circle-new.svg';
import { ReactComponent as TaskCloseIconBlue } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as FilterIcon } from '../../../assets/svg/ic-feeds-filter.svg';
import { ReactComponent as MentionIcon } from '../../../assets/svg/ic-mention.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as TaskIcon } from '../../../assets/svg/ic-task-new.svg';
import { ReactComponent as NoConversationsIcon } from '../../../assets/svg/no-conversations.svg';
import { ReactComponent as TaskListIcon } from '../../../assets/svg/task-ic.svg';
import { ReactComponent as MyTaskIcon } from '../../../assets/svg/task.svg';
import {
  COMMON_ICON_STYLES,
  DEFAULT_DOMAIN_VALUE,
  ICON_DIMENSION,
  ICON_DIMENSION_USER_PAGE,
} from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../generated/entity/feed/conversation';
import { ConversationFilterType } from '../../../generated/type/conversationFilterType';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useIsAiMode } from '../../../hooks/useAppMode';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useElementInView } from '../../../hooks/useElementInView';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { getEntityActivityByFqn } from '../../../rest/activityAPI';
import { listConversations } from '../../../rest/conversationsAPI';
import { getTaskCounts, Task, TaskStatusGroup } from '../../../rest/tasksAPI';
import { getCountBadge } from '../../../utils/EntityDisplayPureUtils';
import {
  getEntityFeedLink,
  getEntityUserLink,
} from '../../../utils/EntityPureUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getFeedTotalCount } from '../../../utils/FeedUtilsPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { useEntityFeedLink } from '../../activity-feed/ActivityFeed/useEntityFeedLink';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import '../../MyData/Widgets/FeedsWidget/feeds-widget.less';
import ActivityFeedListV1New from '../ActivityFeedList/ActivityFeedListV1New.component';
import TaskListV1 from '../ActivityFeedList/TaskListV1.component';
import FeedPanelBodyV1New from '../ActivityFeedPanel/FeedPanelBodyV1New';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-tab.less';
import {
  ActivityFeedLayoutType,
  ActivityFeedTabLeftPanelProps,
  ActivityFeedTabListProps,
  ActivityFeedTabProps,
  ActivityFeedTabRightPanelProps,
  ActivityFeedTabs,
  TaskFilterBarProps,
} from './ActivityFeedTab.interface';
const ActivityFeedEntityTab = withSuspenseFallback(
  lazy(() => import('../../activity-feed/ActivityFeed/ActivityFeedEntityTab'))
);
const TaskTabNew = withSuspenseFallback(
  lazy(() =>
    import('../../Entity/Task/TaskTab/TaskTabNew.component').then((m) => ({
      default: m.TaskTabNew,
    }))
  )
);

const componentsVisibility = {
  showThreadIcon: false,
  showRepliesContainer: true,
};

/**
 * The three task-count scopes: my own profile counts every task visible to me,
 * another user's profile counts what is assigned to them, and an entity page
 * counts what is about that entity.
 */
const getTaskCountParams = ({
  isUserEntity,
  isCurrentUserProfile,
  fqn,
  domain,
}: {
  isUserEntity: boolean;
  isCurrentUserProfile: boolean;
  fqn: string;
  domain?: string;
}) => {
  if (!isUserEntity) {
    return { aboutEntity: fqn, view: 'entity' as const, domain };
  }

  return isCurrentUserProfile
    ? { view: 'visible' as const, domain }
    : { assignee: fqn, domain };
};

/**
 * The badge counts the tab needs, all independent of each other: an entity page
 * counts its conversations and its activity stream, a user page counts the
 * conversations they own or follow plus the ones mentioning them.
 */
const startFeedCountRequests = ({
  isUserEntity,
  entityType,
  fqn,
  userId,
  domain,
}: {
  isUserEntity: boolean;
  entityType: EntityType;
  fqn: string;
  userId?: string;
  domain?: string;
}) => ({
  conversations: listConversations(
    isUserEntity
      ? {
          entityLink: getEntityUserLink(fqn),
          filterType: ConversationFilterType.OwnerOrFollows,
          userId,
          limit: 1,
        }
      : { entityLink: getEntityFeedLink(entityType, fqn), limit: 1 }
  ),
  mentions: isUserEntity
    ? listConversations({
        filterType: ConversationFilterType.Mentions,
        userId,
        limit: 1,
      })
    : undefined,
  activity: isUserEntity
    ? undefined
    : getEntityActivityByFqn(entityType, fqn, {
        days: 30,
        limit: 0,
        domain,
      }),
});

const ActivityFeedTabLeftPanel = ({
  activeTab,
  countData,
  isTaskActiveTab,
  isUserEntity,
  layoutType,
  taskFilter,
  onTabChange,
}: ActivityFeedTabLeftPanelProps) => {
  const { t } = useTranslation();

  if (layoutType !== ActivityFeedLayoutType.THREE_PANEL) {
    return null;
  }

  const items = [
    {
      key: ActivityFeedTabs.ALL,
      icon: AllActivityIcon,
      label: t('label.all'),
      countTestId: 'left-panel-all-count',
      count: isUserEntity
        ? null
        : getCountBadge(
            (countData?.conversationCount ?? 0) +
              (countData?.activityCount ?? 0),
            '',
            activeTab === ActivityFeedTabs.ALL,
            true
          ),
    },
    {
      key: ActivityFeedTabs.TASKS,
      icon: TaskListIcon,
      label: t('label.task-plural'),
      countTestId: 'left-panel-task-count',
      count: getCountBadge(
        taskFilter === TaskStatusGroup.Open
          ? countData?.openTaskCount
          : countData?.closedTaskCount,
        '',
        isTaskActiveTab,
        true
      ),
    },
  ];
  const selectedKey =
    activeTab === ActivityFeedTabs.ALL
      ? ActivityFeedTabs.ALL
      : ActivityFeedTabs.TASKS;

  return (
    <nav
      aria-label={t('label.activity-feed-plural')}
      className="left-container tw:bg-surface"
      data-testid="global-setting-left-panel">
      <ul className="tw:m-0 tw:list-none tw:p-0 tw:pt-2">
        {items.map(({ key, icon: Icon, label, countTestId, count }) => {
          const isSelected = key === selectedKey;

          return (
            <li className="tw:mt-0.5" key={key}>
              <button
                aria-current={isSelected ? 'page' : undefined}
                className={classNames(
                  'tw:relative tw:flex tw:h-10 tw:w-full tw:cursor-pointer tw:items-center tw:justify-between tw:overflow-hidden',
                  'tw:border-0 tw:px-4 tw:text-left tw:text-sm tw:transition-colors tw:hover:text-fg-brand-primary',
                  'tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2',
                  isSelected
                    ? [
                        // antd inline Menu's selected look: brand tint + 3px left bar.
                        'tw:bg-utility-brand-100 tw:font-semibold tw:text-fg-brand-primary tw:dark:bg-brand-primary',
                        'tw:after:absolute tw:after:inset-y-0 tw:after:left-0 tw:after:w-0.75 tw:after:bg-fg-brand-primary',
                      ]
                    : 'tw:bg-transparent tw:text-primary'
                )}
                data-testid={`activity-feed-left-panel-${key}`}
                type="button"
                onClick={() => onTabChange(key)}>
                <span className="tw:flex tw:items-center tw:gap-2">
                  <Icon style={COMMON_ICON_STYLES} {...ICON_DIMENSION} />
                  <span>{label}</span>
                </span>
                <span data-testid={countTestId}>{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const TaskFilterBar = ({
  countData,
  isMentionTabSelected,
  isVisible,
  taskFilter,
  taskFilterOptions,
  taskToggle,
}: TaskFilterBarProps) => {
  const { t } = useTranslation();

  if (!isVisible) {
    return null;
  }

  const filterLabel =
    taskFilter === TaskStatusGroup.Open
      ? `${t('label.open')} (${countData?.openTaskCount ?? 0})`
      : `${t('label.closed')} (${countData?.closedTaskCount ?? 0})`;

  return (
    <div className="d-flex gap-4 task-filter-container  justify-between items-center ">
      <Dropdown.Root>
        <Button
          color="secondary"
          data-testid="user-profile-page-task-filter-icon"
          iconLeading={<FilterIcon aria-hidden height={16} width={16} />}
          isDisabled={isMentionTabSelected}
          size="sm">
          {filterLabel}
        </Button>
        <Dropdown.Popover
          className="task-tab-custom-dropdown"
          placement="bottom start">
          <Dropdown.Menu
            selectedKeys={[taskFilter]}
            onAction={(key) =>
              taskFilterOptions.find((option) => option.key === key)?.onClick()
            }>
            {taskFilterOptions.map(({ key, label, textValue }) => (
              <Dropdown.Item
                unstyled
                className="task-tab-filter-menu-item tw:cursor-pointer tw:outline-focus-ring tw:data-focus-visible:outline-2 tw:data-focus-visible:-outline-offset-2 tw:data-hovered:bg-primary_hover"
                id={key}
                key={key}
                textValue={textValue}>
                {label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      {taskToggle}
    </div>
  );
};

/**
 * The Tasks sub-tab renders the task list; All and Mentions render conversations,
 * and only All also renders activity events. `isTaskListTab` is the single
 * predicate the parent uses for both this switch and which fetcher runs.
 */
const ActivityFeedTabList = ({
  activityEvents,
  emptyPlaceholderText,
  entityThread,
  isActivityLoading,
  isAllTab,
  isFirstLoad,
  isFullWidth,
  isTaskListTab,
  loading,
  selectedActivity,
  selectedTask,
  selectedThread,
  tasks,
  onActivityClick,
  onAfterClose,
  onFeedClick,
  onPanelResize,
  onTaskClick,
}: ActivityFeedTabListProps) => {
  // The list is emptied while a first-page fetch is in flight, so the loader has
  // to cover that window or the cleared list shows its empty placeholder.
  const isReplacingList = isFirstLoad && loading;

  if (isTaskListTab) {
    return (
      <TaskListV1
        activeFeedId={selectedTask?.id}
        emptyPlaceholderText={emptyPlaceholderText}
        handlePanelResize={onPanelResize}
        isFullWidth={isFullWidth}
        isLoading={isReplacingList}
        selectedTask={selectedTask}
        taskList={tasks}
        onAfterClose={onAfterClose}
        onTaskClick={onTaskClick}
      />
    );
  }

  return (
    <ActivityFeedListV1New
      hidePopover
      activeFeedId={selectedActivity?.id ?? selectedThread?.id}
      activityList={isAllTab ? activityEvents : undefined}
      componentsVisibility={componentsVisibility}
      emptyPlaceholderText={emptyPlaceholderText}
      feedList={entityThread}
      handlePanelResize={onPanelResize}
      isForFeedTab={false}
      isFullWidth={isFullWidth}
      isLoading={isReplacingList || (isAllTab && Boolean(isActivityLoading))}
      selectedActivity={selectedActivity}
      selectedThread={selectedThread}
      showThread={false}
      onActivityClick={onActivityClick}
      onAfterClose={onAfterClose}
      onFeedClick={onFeedClick}
    />
  );
};

const ActivityFeedTabRightPanel = ({
  content,
  hasSelection,
  isFullWidth,
  layoutType,
  loader,
  loading,
  placeholder,
}: ActivityFeedTabRightPanelProps) => {
  const isThreePanel = layoutType === ActivityFeedLayoutType.THREE_PANEL;

  return (
    <>
      {isThreePanel && <Divider color="primary" orientation="vertical" />}

      <div
        className={classNames('right-container', {
          'hide-panel': isFullWidth,
          'three-panel-layout': isThreePanel,
        })}>
        {loader}
        {hasSelection && !loading
          ? content
          : !loading && (
              <div className="p-x-md no-data-placeholder-container-right-panel d-flex justify-center items-center h-full">
                <ErrorPlaceHolderNew
                  icon={<NoConversationsIcon />}
                  type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                  <Typography
                    as="div"
                    className="placeholder-text tw:mb-4 tw:break-words">
                    {placeholder}
                  </Typography>
                </ErrorPlaceHolderNew>
              </div>
            )}
      </div>
    </>
  );
};

const ClassicActivityFeedTab = ({
  owners = [],
  columns,
  entityType,
  hasGlossaryReviewer,
  isForFeedTab = true,
  onUpdateFeedCount,
  onUpdateEntityDetails,
  subTab,
  layoutType,
  feedCount,
  urlFqn = '',
}: ActivityFeedTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { isAdminUser } = useAuth();
  const activeDomain = useDomainStore((state) => state.activeDomain);
  const { fqn: hookFqn } = useFqn();
  const fqn = hookFqn || urlFqn || '';
  const [elementRef, isInView] = useElementInView({
    ...observerOptions,
    root: document.querySelector('#center-container'),
    rootMargin: '0px 0px 2px 0px',
  });
  const { subTab: activeTab = subTab } = useRequiredParams<{
    tab: EntityTabs;
    subTab: ActivityFeedTabs;
  }>();
  const [taskFilter, setTaskFilter] = useState<TaskStatusGroup>(
    TaskStatusGroup.Open
  );
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [countData, setCountData] = useState<{
    loading: boolean;
    data: FeedCounts;
  }>({
    loading: false,
    data: FEED_COUNT_INITIAL_DATA,
  });
  const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);
  const processedRefreshKeyRef = useRef<number | undefined>(undefined);

  const {
    selectedThread,
    setActiveThread,
    entityThread,
    getFeedData,
    getTaskData,
    loading,
    entityPaging,
    tasks,
    selectedTask,
    setActiveTask,
    activityEvents,
    isActivityLoading,
    fetchEntityActivity,
    fetchUserActivity,
    userId,
    selectedActivity,
    setActiveActivity,
  } = useActivityFeedProvider();

  const isUserEntity = useMemo(
    () => entityType === EntityType.USER,
    [entityType]
  );

  const entityTypeTask = useMemo(
    () => (selectedTask?.about?.type as EntityType) ?? EntityType.TABLE,
    [selectedTask]
  );

  const isTaskActiveTab = useMemo(
    () => activeTab === ActivityFeedTabs.TASKS,
    [activeTab]
  );
  useEffect(() => {
    setIsFullWidth(false);
  }, [isTaskActiveTab]);
  const isMentionTabSelected = useMemo(
    () => activeTab === ActivityFeedTabs.MENTIONS,
    [activeTab]
  );

  // Only the Tasks sub-tab renders TaskListV1 off `tasks`; Mentions lists the
  // conversations that mention the user. Keeping the render branch and the fetch
  // branch on a single predicate is what stops them drifting apart again.
  const isAllTab = useMemo(
    () => activeTab === ActivityFeedTabs.ALL,
    [activeTab]
  );

  const handleTabChange = useCallback(
    (subTab: string) => {
      setIsFirstLoad(true);
      navigate(
        entityUtilClassBase.getEntityLink(
          entityType,
          fqn,
          EntityTabs.ACTIVITY_FEED,
          subTab
        ),
        { replace: true }
      );
      setActiveThread();
      setActiveTask();
      setIsFullWidth(false);
    },
    [entityType, fqn, navigate, setActiveThread, setActiveTask]
  );

  const placeholderText = useMemo(() => {
    if (isAllTab) {
      return (
        <div className="d-flex flex-col gap-4">
          <Typography className="placeholder-title">
            {t('message.no-activity-feed-title')}
          </Typography>
          <Typography className="placeholder-text">
            {t('message.no-activity-feed-description')}
          </Typography>
        </div>
      );
    } else if (activeTab === ActivityFeedTabs.MENTIONS) {
      return (
        <Typography className="placeholder-text">
          {t('message.no-mentions')}
        </Typography>
      );
    } else if (taskFilter === TaskStatusGroup.Closed) {
      return (
        <div className="d-flex flex-col gap-4">
          <Typography className="placeholder-title">
            {t('message.no-closed-tasks-title')}
          </Typography>
          <Typography className="placeholder-text">
            {t('message.no-closed-tasks-description')}
          </Typography>
        </div>
      );
    } else {
      return (
        <div className="d-flex flex-col gap-4">
          <Typography className="placeholder-title">
            {t('message.no-open-tasks-title')}
          </Typography>
          <Typography className="placeholder-text">
            {t('message.no-open-tasks-description')}
          </Typography>
        </div>
      );
    }
  }, [activeTab, isAllTab, taskFilter, t]);

  const handleFeedCount = useCallback(
    (data: FeedCounts) => {
      setCountData((prev) => ({ ...prev, data }));
      onUpdateFeedCount?.(data);
    },
    [onUpdateFeedCount]
  );

  const fetchFeedsCount = useCallback(async () => {
    setCountData((prev) => ({ ...prev, loading: true }));
    try {
      const domain =
        activeDomain !== DEFAULT_DOMAIN_VALUE ? activeDomain : undefined;
      const isCurrentUserProfile =
        isUserEntity &&
        Boolean(fqn) &&
        [currentUser?.name, currentUser?.fullyQualifiedName].includes(fqn);
      const taskCountParams = getTaskCountParams({
        isUserEntity,
        isCurrentUserProfile,
        fqn,
        domain,
      });
      const countRequests = startFeedCountRequests({
        isUserEntity,
        entityType,
        fqn,
        userId,
        domain,
      });
      const [taskCounts, conversations, mentions, activity] = await Promise.all(
        [
          getTaskCounts(taskCountParams),
          countRequests.conversations,
          countRequests.mentions,
          countRequests.activity,
        ]
      );
      const mentionCount = mentions?.paging.total ?? 0;
      const conversationCount = conversations.paging.total ?? 0;
      const activityCount = activity?.paging.total ?? 0;
      const totalTasksCount = taskCounts.total ?? 0;
      const openTaskCount = taskCounts.open ?? 0;

      handleFeedCount({
        conversationCount,
        activityCount,
        totalTasksCount,
        openTaskCount,
        closedTaskCount: taskCounts.completed ?? 0,
        totalCount: getFeedTotalCount({
          conversationCount,
          activityCount,
          openTaskCount,
        }),
        mentionCount,
      });
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
    }
    setCountData((prev) => ({ ...prev, loading: false }));
    // Depend on primitive currentUser fields, not the object identity, so an
    // unstable store reference cannot retrigger this effect every render.
  }, [
    activeDomain,
    fqn,
    entityType,
    isUserEntity,
    userId,
    currentUser?.name,
    currentUser?.fullyQualifiedName,
    handleFeedCount,
    t,
  ]);

  const feedFilter = useMemo(() => {
    const currentFilter =
      isAdminUser &&
      [currentUser?.name, currentUser?.fullyQualifiedName].includes(fqn) &&
      activeTab !== ActivityFeedTabs.TASKS
        ? FeedFilter.ALL
        : FeedFilter.OWNER_OR_FOLLOWS;
    const filter = isUserEntity ? currentFilter : undefined;

    return activeTab === ActivityFeedTabs.MENTIONS
      ? FeedFilter.MENTIONS
      : filter;
  }, [activeTab, isAdminUser, currentUser, fqn, isUserEntity]);

  const handleFeedFetchFromFeedList = useCallback(
    (after?: string) => {
      // Only a "load more" page keeps the current list on screen. A first-page
      // refetch replaces it, so the in-list loader has to be switched back ON —
      // once pagination has cleared this flag, `isFirstLoad && loading` is false
      // and the cleared list renders the empty placeholder next to the spinner.
      setIsFirstLoad(!after);
      if (isTaskActiveTab) {
        getTaskData(feedFilter, after, entityType, fqn, taskFilter);
      } else {
        getFeedData(feedFilter, after, entityType, fqn);
      }
    },
    [
      isTaskActiveTab,
      feedFilter,
      entityType,
      fqn,
      taskFilter,
      getFeedData,
      getTaskData,
    ]
  );

  useEffect(() => {
    if (fqn) {
      // Every dep here identifies a different query, so this is always a
      // first-page fetch that replaces the list — sub-tab (via feedFilter), task
      // filter, entity or domain. The loader has to be on for the window where
      // the provider has cleared the rows but the response has not landed.
      setIsFirstLoad(true);
      if (isTaskActiveTab) {
        getTaskData(feedFilter, undefined, entityType, fqn, taskFilter);
      } else {
        getFeedData(feedFilter, undefined, entityType, fqn);
      }
    }
  }, [
    feedFilter,
    fqn,
    activeDomain,
    entityType,
    taskFilter,
    getFeedData,
    getTaskData,
    isTaskActiveTab,
  ]);

  useEffect(() => {
    // Activity events only render on the ALL tab; skip the fetch on Tasks/Mentions.
    if (!isAllTab) {
      return;
    }
    if (fqn && entityType && !isUserEntity) {
      fetchEntityActivity(entityType, fqn, { days: 30, limit: 50 });
    } else if (isUserEntity && userId) {
      fetchUserActivity(userId, { days: 30, limit: 50 });
    }
  }, [
    fqn,
    entityType,
    isUserEntity,
    userId,
    isAllTab,
    fetchEntityActivity,
    fetchUserActivity,
  ]);

  useEffect(() => {
    const refreshKey = (location.state as { tasksRefreshKey?: number } | null)
      ?.tasksRefreshKey;
    if (
      refreshKey !== undefined &&
      refreshKey !== processedRefreshKeyRef.current &&
      fqn &&
      isTaskActiveTab
    ) {
      processedRefreshKeyRef.current = refreshKey;
      // Goes through handleFeedFetchFromFeedList rather than calling getTaskData
      // directly so this first-page refetch switches the in-list loader back on.
      // Without it, a notification click that arrives after the user has
      // paginated leaves isFirstLoad false while the provider empties the rows,
      // so the list renders its "no tasks" placeholder beside the spinner.
      handleFeedFetchFromFeedList();
      navigate('.', { replace: true, state: {} });
    }
  }, [
    fqn,
    handleFeedFetchFromFeedList,
    isTaskActiveTab,
    location.key,
    location.state,
    navigate,
  ]);

  useEffect(() => {
    if (feedCount) {
      setCountData((prev) => ({ ...prev, data: feedCount }));
    } else {
      fetchFeedsCount();
    }
  }, [feedCount, fetchFeedsCount]);

  const handleFeedClick = useCallback(
    (feed: Conversation) => {
      if (!feed && (isTaskActiveTab || isMentionTabSelected)) {
        setIsFullWidth(false);
      }
      if (selectedActivity || selectedThread?.id !== feed?.id) {
        setActiveActivity(undefined);
        setActiveThread(feed);
      }
    },
    [
      setActiveActivity,
      setActiveThread,
      isTaskActiveTab,
      isMentionTabSelected,
      selectedActivity,
      selectedThread,
    ]
  );

  const handleTaskClick = useCallback(
    (task: Task) => {
      if (!task && isTaskActiveTab) {
        setIsFullWidth(false);
      }
      if (selectedTask?.id !== task?.id) {
        setActiveTask(task);
      }
    },
    [setActiveTask, isTaskActiveTab, selectedTask]
  );

  const handleActivityClick = useCallback(
    (activity: ActivityEvent) => {
      if (selectedActivity?.id !== activity?.id) {
        setActiveActivity(activity);
        setActiveThread(undefined);
      }
    },
    [setActiveActivity, setActiveThread, selectedActivity]
  );

  useEffect(() => {
    if (fqn && isInView && entityPaging.after && !loading) {
      handleFeedFetchFromFeedList(entityPaging.after);
    }
  }, [entityPaging, loading, isInView, fqn, handleFeedFetchFromFeedList]);

  const loader = useMemo(
    () => (loading ? <Loader className="aspect-square" /> : null),
    [loading]
  );

  const hasRightPanelSelection = useMemo(
    () => Boolean(selectedThread || selectedTask || selectedActivity),
    [selectedThread, selectedTask, selectedActivity]
  );

  // The fetch effect above already refires on `taskFilter`; calling getTaskData
  // here as well fired two identical requests per filter click.
  const handleUpdateTaskFilter = useCallback((filter: TaskStatusGroup) => {
    setTaskFilter(filter);
  }, []);

  const handleAfterTaskClose = useCallback(() => {
    handleFeedFetchFromFeedList();
    fetchFeedsCount();
  }, [handleFeedFetchFromFeedList, fetchFeedsCount]);
  const taskFilterOptions = useMemo(
    () => [
      {
        key: TaskStatusGroup.Open,
        textValue: t('label.open'),
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: taskFilter === TaskStatusGroup.Open }
            )}
            data-testid="open-tasks">
            <div className="flex items-center space-x-2">
              {taskFilter === TaskStatusGroup.Open ? (
                <TaskOpenIcon
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              ) : (
                <TaskIcon className="m-r-xs" {...ICON_DIMENSION_USER_PAGE} />
              )}
              <span
                className={classNames('task-tab-filter-item', {
                  selected: taskFilter === TaskStatusGroup.Open,
                })}>
                {t('label.open')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: taskFilter === TaskStatusGroup.Open,
              })}>
              <span className="task-count-text">
                {countData?.data?.openTaskCount}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleUpdateTaskFilter(TaskStatusGroup.Open);
          setActiveTask();
        },
      },
      {
        key: TaskStatusGroup.Closed,
        textValue: t('label.closed'),
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: taskFilter === TaskStatusGroup.Closed }
            )}
            data-testid="closed-tasks">
            <div className="flex items-center space-x-2">
              {taskFilter === TaskStatusGroup.Closed ? (
                <TaskCloseIconBlue
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              ) : (
                <TaskCloseIcon
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              )}
              <span
                className={classNames('task-tab-filter-item', {
                  selected: taskFilter === TaskStatusGroup.Closed,
                })}>
                {t('label.closed')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: taskFilter === TaskStatusGroup.Closed,
              })}>
              <span className="task-count-text">
                {countData?.data?.closedTaskCount}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleUpdateTaskFilter(TaskStatusGroup.Closed);
          setActiveTask();
        },
      },
    ],
    [taskFilter, handleUpdateTaskFilter, setActiveTask, countData, t]
  );

  const TaskToggle = useCallback(() => {
    return (
      <ButtonGroup
        disallowEmptySelection
        selectedKeys={activeTab ? [activeTab] : []}
        size="sm"
        onSelectionChange={(keys) => {
          const [key] = keys;
          if (key) {
            handleTabChange(key as ActivityFeedTabs);
          }
        }}>
        <ButtonGroupItem
          data-testid="my-tasks-toggle"
          iconLeading={<MyTaskIcon aria-hidden {...ICON_DIMENSION_USER_PAGE} />}
          id={ActivityFeedTabs.TASKS}>
          {t('label.my-task-plural')}
        </ButtonGroupItem>
        <ButtonGroupItem
          data-testid="mentions-toggle"
          iconLeading={
            <MentionIcon aria-hidden {...ICON_DIMENSION_USER_PAGE} />
          }
          id={ActivityFeedTabs.MENTIONS}>
          {t('label.mention-plural')}
        </ButtonGroupItem>
      </ButtonGroup>
    );
  }, [t, activeTab, handleTabChange]);

  const handlePanelResize = useCallback((isFullWidth: boolean) => {
    setIsFullWidth(isFullWidth);
  }, []);

  // The infinite-scroll observer only belongs in the tree once the list the
  // active sub-tab renders has rows to page past — activity events count towards
  // that on the All tab, which is the only tab that renders them.
  const hasListRows = useMemo(() => {
    if (isTaskActiveTab) {
      return !isEmpty(tasks);
    }

    return isAllTab
      ? !isEmpty(activityEvents) || !isEmpty(entityThread)
      : !isEmpty(entityThread);
  }, [isTaskActiveTab, isAllTab, tasks, activityEvents, entityThread]);

  const getRightPanelContent = () => {
    if (isTaskActiveTab && selectedTask) {
      return (
        <div id="task-panel">
          {entityType === EntityType.TABLE ? (
            <TaskTabNew
              columns={columns}
              entityType={EntityType.TABLE}
              handlePanelResize={handlePanelResize}
              isForFeedTab={isForFeedTab}
              owners={owners}
              task={selectedTask}
              onAfterClose={handleAfterTaskClose}
              onUpdateEntityDetails={onUpdateEntityDetails}
            />
          ) : (
            <TaskTabNew
              entityType={isUserEntity ? entityTypeTask : entityType}
              handlePanelResize={handlePanelResize}
              hasGlossaryReviewer={hasGlossaryReviewer}
              isForFeedTab={isForFeedTab}
              owners={owners}
              task={selectedTask}
              onAfterClose={handleAfterTaskClose}
              onUpdateEntityDetails={onUpdateEntityDetails}
            />
          )}
        </div>
      );
    }

    if (selectedThread) {
      return (
        <div id="feed-panel">
          <FeedPanelBodyV1New
            isOpenInDrawer
            showActivityFeedEditor
            showThread
            feed={selectedThread}
            handlePanelResize={handlePanelResize}
            hidePopover={false}
            isFullWidth={isFullWidth}
            onAfterClose={handleAfterTaskClose}
            onUpdateEntityDetails={onUpdateEntityDetails}
          />
        </div>
      );
    }

    if (selectedActivity) {
      // Activities are read-only change events — no comment editor / replies.
      return (
        <div id="activity-panel">
          <FeedPanelBodyV1New
            isOpenInDrawer
            activity={selectedActivity}
            handlePanelResize={handlePanelResize}
            hidePopover={false}
            isFullWidth={isFullWidth}
            onAfterClose={handleAfterTaskClose}
            onUpdateEntityDetails={onUpdateEntityDetails}
          />
        </div>
      );
    }

    return null;
  };

  const getRightPanelPlaceholder = useMemo(() => {
    if (activeTab === ActivityFeedTabs.MENTIONS) {
      return (
        <Typography className="placeholder-text m-t-0">
          {t('message.no-mentions')}
        </Typography>
      );
    }

    return (
      <div className="d-flex flex-col gap-4">
        <Typography className="placeholder-title m-t-md">
          {t('message.no-conversations')}
        </Typography>
        <Typography className="placeholder-text">
          {t('message.no-conversations-description')}
        </Typography>
      </div>
    );
  }, [activeTab, t]);

  return (
    <div
      className={classNames('activity-feed-tab', {
        'two-panel-layout-container':
          layoutType === ActivityFeedLayoutType.TWO_PANEL,
      })}>
      <ActivityFeedTabLeftPanel
        activeTab={activeTab}
        countData={countData.data}
        isTaskActiveTab={isTaskActiveTab}
        isUserEntity={isUserEntity}
        layoutType={layoutType}
        taskFilter={taskFilter}
        onTabChange={handleTabChange}
      />
      <div
        className={classNames('center-container', {
          'full-width': isFullWidth,
          'three-panel-layout':
            layoutType === ActivityFeedLayoutType.THREE_PANEL,
        })}
        id="center-container">
        <TaskFilterBar
          countData={countData.data}
          isMentionTabSelected={isMentionTabSelected}
          isVisible={isTaskActiveTab || isMentionTabSelected}
          taskFilter={taskFilter}
          taskFilterOptions={taskFilterOptions}
          taskToggle={TaskToggle()}
        />
        <ActivityFeedTabList
          activityEvents={activityEvents}
          emptyPlaceholderText={placeholderText}
          entityThread={entityThread}
          isActivityLoading={isActivityLoading}
          isAllTab={isAllTab}
          isFirstLoad={isFirstLoad}
          isFullWidth={isFullWidth}
          isTaskListTab={isTaskActiveTab}
          loading={loading}
          selectedActivity={selectedActivity}
          selectedTask={selectedTask}
          selectedThread={selectedThread}
          tasks={tasks}
          onActivityClick={handleActivityClick}
          onAfterClose={handleAfterTaskClose}
          onFeedClick={handleFeedClick}
          onPanelResize={handlePanelResize}
          onTaskClick={handleTaskClick}
        />
        {!isFirstLoad && loader}
        {hasListRows && !loading && (
          <div
            className="w-full"
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}
            style={{ height: '2px' }}
          />
        )}
      </div>

      <ActivityFeedTabRightPanel
        content={getRightPanelContent()}
        hasSelection={hasRightPanelSelection}
        isFullWidth={isFullWidth}
        layoutType={layoutType}
        loader={loader}
        loading={loading}
        placeholder={getRightPanelPlaceholder}
      />
    </div>
  );
};

/**
 * An entity page's Activity Feeds & Tasks tab: in AI mode, where the new Inbox
 * lives, the Inbox's Activity and Tasks for the entity; the existing tab
 * otherwise, and always on a user's profile.
 */
export const ActivityFeedTab = (props: ActivityFeedTabProps) => {
  const isAiMode = useIsAiMode();
  const entityLink = useEntityFeedLink(props.entityType, props.urlFqn);

  return isAiMode && entityLink ? (
    <ActivityFeedEntityTab
      entityLink={entityLink}
      onFeedUpdate={props.onFeedUpdate}
      onUpdateEntityDetails={props.onUpdateEntityDetails}
    />
  ) : (
    <ClassicActivityFeedTab {...props} />
  );
};
