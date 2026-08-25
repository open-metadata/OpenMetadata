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
  Divider,
  Dropdown,
  Menu,
  Segmented,
  Space,
  Typography,
} from 'antd';
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
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useElementInView } from '../../../hooks/useElementInView';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { getFeedCount } from '../../../rest/feedsAPI';
import { getTaskCounts, Task, TaskStatusGroup } from '../../../rest/tasksAPI';
import { getCountBadge } from '../../../utils/EntityDisplayPureUtils';
import { getEntityUserLink } from '../../../utils/EntityPureUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  aggregateFeedCountResponse,
  getFeedCounts,
  getFeedTotalCount,
} from '../../../utils/FeedUtilsPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
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
const TaskTabNew = withSuspenseFallback(
  lazy(() =>
    import('../../Entity/Task/TaskTab/TaskTabNew.component').then((m) => ({
      default: m.TaskTabNew,
    }))
  )
);

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

  return (
    <Menu
      className="custom-menu p-t-sm"
      data-testid="global-setting-left-panel"
      items={[
        {
          label: (
            <div className="d-flex justify-between">
              <Space align="center" size="small">
                <AllActivityIcon
                  style={COMMON_ICON_STYLES}
                  {...ICON_DIMENSION}
                />
                <span>{t('label.all')}</span>
              </Space>

              <span data-testid="left-panel-all-count">
                {!isUserEntity &&
                  getCountBadge(
                    (countData?.conversationCount ?? 0) +
                      (countData?.activityCount ?? 0),
                    '',
                    activeTab === ActivityFeedTabs.ALL
                  )}
              </span>
            </div>
          ),
          key: ActivityFeedTabs.ALL,
        },
        {
          label: (
            <div className="d-flex justify-between">
              <Space align="center" size="small">
                <TaskListIcon style={COMMON_ICON_STYLES} {...ICON_DIMENSION} />
                <span>{t('label.task-plural')}</span>
              </Space>
              <span data-testid="left-panel-task-count">
                {getCountBadge(
                  taskFilter === TaskStatusGroup.Open
                    ? countData?.openTaskCount
                    : countData?.closedTaskCount,
                  '',
                  isTaskActiveTab
                )}
              </span>
            </div>
          ),
          key: ActivityFeedTabs.TASKS,
        },
      ]}
      mode="inline"
      rootClassName="left-container"
      selectedKeys={[
        activeTab === ActivityFeedTabs.ALL
          ? ActivityFeedTabs.ALL
          : ActivityFeedTabs.TASKS,
      ]}
      onClick={(info) => onTabChange(info.key)}
    />
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
      <Dropdown
        disabled={isMentionTabSelected}
        menu={{
          items: taskFilterOptions,
          selectedKeys: [taskFilter],
        }}
        overlayClassName="task-tab-custom-dropdown"
        trigger={['click']}>
        <Button
          className={classNames('feed-filter-icon', {
            'cursor-pointer': !isMentionTabSelected,
            disabled: isMentionTabSelected,
          })}
          data-testid="user-profile-page-task-filter-icon">
          <Space align="center" size={4}>
            <FilterIcon height={16} style={{ verticalAlign: 'middle' }} />
            <span className="text-xs font-medium" style={{ lineHeight: 1 }}>
              {filterLabel}
            </span>
          </Space>
        </Button>
      </Dropdown>
      {taskToggle}
    </div>
  );
};

/**
 * Both sub-tabs of the Tasks pane render the task list; only the All tab renders
 * conversations and activity events. `isTaskListTab` is the single predicate the
 * parent uses for both this switch and which fetcher runs.
 */
const ActivityFeedTabList = ({
  activityEvents,
  emptyPlaceholderText,
  entityThread,
  isActivityLoading,
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
      activeFeedId={selectedThread?.id ?? selectedActivity?.id}
      activityList={activityEvents}
      emptyPlaceholderText={emptyPlaceholderText}
      feedList={entityThread}
      handlePanelResize={onPanelResize}
      isForFeedTab={false}
      isFullWidth={isFullWidth}
      isLoading={isReplacingList || Boolean(isActivityLoading)}
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
      {isThreePanel && (
        <Divider className="feed-divider h-100 m-0" type="vertical" />
      )}

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
                  <Typography.Paragraph className="placeholder-text">
                    {placeholder}
                  </Typography.Paragraph>
                </ErrorPlaceHolderNew>
              </div>
            )}
      </div>
    </>
  );
};

export const ActivityFeedTab = ({
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

  // Both sub-tabs of the Tasks pane render TaskListV1 off `tasks`, so both have
  // to fetch through getTaskData. Keeping the render branch and the fetch branch
  // on a single predicate is what stops them drifting apart again.
  const isTaskListTab = useMemo(
    () => isTaskActiveTab || isMentionTabSelected,
    [isTaskActiveTab, isMentionTabSelected]
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
    if (activeTab === ActivityFeedTabs.ALL) {
      return (
        <div className="d-flex flex-col gap-4">
          <Typography.Text className="placeholder-title">
            {t('message.no-activity-feed-title')}
          </Typography.Text>
          <Typography.Text className="placeholder-text">
            {t('message.no-activity-feed-description')}
          </Typography.Text>
        </div>
      );
    } else if (activeTab === ActivityFeedTabs.MENTIONS) {
      return (
        <Typography.Text className="placeholder-text">
          {t('message.no-mentions')}
        </Typography.Text>
      );
    } else if (taskFilter === TaskStatusGroup.Closed) {
      return (
        <div className="d-flex flex-col gap-4">
          <Typography.Text className="placeholder-title">
            {t('message.no-closed-tasks-title')}
          </Typography.Text>
          <Typography.Text className="placeholder-text">
            {t('message.no-closed-tasks-description')}
          </Typography.Text>
        </div>
      );
    } else {
      return (
        <div className="d-flex flex-col gap-4">
          <Typography.Text className="placeholder-title">
            {t('message.no-open-tasks-title')}
          </Typography.Text>
          <Typography.Text className="placeholder-text">
            {t('message.no-open-tasks-description')}
          </Typography.Text>
        </div>
      );
    }
  }, [activeTab, taskFilter, t]);

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

      // The task counts and the user's conversation counts are different
      // endpoints with no data dependency, so issue them together.
      const [taskCounts, userFeedCountRes] = await Promise.all([
        getTaskCounts(taskCountParams),
        isUserEntity ? getFeedCount(getEntityUserLink(fqn)) : undefined,
      ]);
      const totalTasksCount = taskCounts.total ?? 0;
      const openTaskCount = taskCounts.open ?? 0;

      if (isUserEntity) {
        const { conversationCount, mentionCount } =
          aggregateFeedCountResponse(userFeedCountRes);
        // The user profile has no entity-scoped activity stream, so the "All"
        // badge that would consume this is gated behind `!isUserEntity` below.
        const activityCount = 0;
        setCountData((prev) => ({
          ...prev,
          data: {
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
          },
        }));
      } else {
        // For non-user entities, get conversation counts and combine with task counts
        await getFeedCounts(entityType, fqn, domain, (feedData) => {
          handleFeedCount({
            ...feedData,
            totalTasksCount,
            openTaskCount,
            closedTaskCount: taskCounts.completed ?? 0,
            // getFeedCounts derives its own total from a differently-scoped
            // task query; recompute so it agrees with the counts we just set.
            totalCount: getFeedTotalCount({
              conversationCount: feedData.conversationCount,
              activityCount: feedData.activityCount,
              openTaskCount,
            }),
          });
        });
      }
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
    currentUser?.name,
    currentUser?.fullyQualifiedName,
    handleFeedCount,
    t,
  ]);

  const { feedFilter, feedThreadType } = useMemo(() => {
    const currentFilter =
      isAdminUser &&
      [currentUser?.name, currentUser?.fullyQualifiedName].includes(fqn) &&
      activeTab !== ActivityFeedTabs.TASKS
        ? FeedFilter.ALL
        : FeedFilter.OWNER_OR_FOLLOWS;
    const filter = isUserEntity ? currentFilter : undefined;

    return {
      feedThreadType:
        activeTab === ActivityFeedTabs.ALL
          ? ThreadType.Conversation
          : undefined,
      feedFilter:
        activeTab === ActivityFeedTabs.MENTIONS ? FeedFilter.MENTIONS : filter,
    };
  }, [activeTab, isAdminUser, currentUser, fqn, isUserEntity]);

  const handleFeedFetchFromFeedList = useCallback(
    (after?: string) => {
      // Only a "load more" page keeps the current list on screen. A first-page
      // refetch replaces it, so the in-list loader has to be switched back ON —
      // once pagination has cleared this flag, `isFirstLoad && loading` is false
      // and the cleared list renders the empty placeholder next to the spinner.
      setIsFirstLoad(!after);
      if (isTaskListTab) {
        getTaskData(feedFilter, after, entityType, fqn, taskFilter);
      } else {
        getFeedData(
          feedFilter,
          after,
          feedThreadType,
          entityType,
          fqn,
          taskFilter
        );
      }
    },
    [
      isTaskListTab,
      feedFilter,
      entityType,
      fqn,
      taskFilter,
      getFeedData,
      getTaskData,
      feedThreadType,
    ]
  );

  useEffect(() => {
    if (fqn) {
      // Every dep here identifies a different query, so this is always a
      // first-page fetch that replaces the list — sub-tab (via feedFilter), task
      // filter, entity or domain. The loader has to be on for the window where
      // the provider has cleared the rows but the response has not landed.
      setIsFirstLoad(true);
      if (isTaskListTab) {
        getTaskData(feedFilter, undefined, entityType, fqn, taskFilter);
      } else {
        getFeedData(
          feedFilter,
          undefined,
          feedThreadType,
          entityType,
          fqn,
          taskFilter
        );
      }
    }
  }, [
    feedFilter,
    feedThreadType,
    fqn,
    activeDomain,
    entityType,
    taskFilter,
    getFeedData,
    getTaskData,
    isTaskListTab,
  ]);

  useEffect(() => {
    // Activity events only render on the ALL tab; skip the fetch on Tasks/Mentions.
    if (isTaskListTab) {
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
    isTaskListTab,
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
    (feed: Thread) => {
      if (!feed && isTaskListTab) {
        setIsFullWidth(false);
      }
      if (selectedThread?.id !== feed?.id) {
        setActiveThread(feed);
        // Clear any previously-selected activity so the right panel
        // shows the clicked conversation, not a stale activity.
        setActiveActivity(undefined);
      }
    },
    [setActiveThread, setActiveActivity, isTaskListTab, selectedThread]
  );

  const handleTaskClick = useCallback(
    (task: Task) => {
      if (!task && isTaskListTab) {
        setIsFullWidth(false);
      }
      if (selectedTask?.id !== task?.id) {
        setActiveTask(task);
      }
    },
    [setActiveTask, isTaskListTab, selectedTask]
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
      <Segmented
        className="task-toggle"
        options={[
          {
            label: (
              <span className="toggle-item" data-testid="my-tasks-toggle">
                <MyTaskIcon {...ICON_DIMENSION_USER_PAGE} />
                {t('label.my-task-plural')}
              </span>
            ),
            value: ActivityFeedTabs.TASKS,
          },
          {
            label: (
              <span className="toggle-item" data-testid="mentions-toggle">
                <MentionIcon {...ICON_DIMENSION_USER_PAGE} />
                {t('label.mention-plural')}
              </span>
            ),
            value: ActivityFeedTabs.MENTIONS,
          },
        ]}
        value={activeTab}
        onChange={(value) => handleTabChange(value as ActivityFeedTabs)}
      />
    );
  }, [t, activeTab, handleTabChange]);

  const handlePanelResize = useCallback((isFullWidth: boolean) => {
    setIsFullWidth(isFullWidth);
  }, []);

  const getRightPanelContent = () => {
    if (isTaskListTab && selectedTask) {
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
        <Typography.Text className="placeholder-text m-t-0">
          {t('message.no-mentions')}
        </Typography.Text>
      );
    }

    return (
      <div className="d-flex flex-col gap-4">
        <Typography.Text className="placeholder-title m-t-md">
          {t('message.no-conversations')}
        </Typography.Text>
        <Typography.Text className="placeholder-text">
          {t('message.no-conversations-description')}
        </Typography.Text>
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
          isVisible={isTaskListTab}
          taskFilter={taskFilter}
          taskFilterOptions={taskFilterOptions}
          taskToggle={TaskToggle()}
        />
        <ActivityFeedTabList
          activityEvents={activityEvents}
          emptyPlaceholderText={placeholderText}
          entityThread={entityThread}
          isActivityLoading={isActivityLoading}
          isFirstLoad={isFirstLoad}
          isFullWidth={isFullWidth}
          isTaskListTab={isTaskListTab}
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
        {!isEmpty(isTaskListTab ? tasks : entityThread) && !loading && (
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
