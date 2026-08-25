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
  ActivityFeedTabProps,
  ActivityFeedTabs,
} from './ActivityFeedTab.interface';
const TaskTabNew = withSuspenseFallback(
  lazy(() =>
    import('../../Entity/Task/TaskTab/TaskTabNew.component').then((m) => ({
      default: m.TaskTabNew,
    }))
  )
);

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
  useEffect(() => {
    setIsFirstLoad(true);
  }, [subTab]);

  const handleTabChange = (subTab: string) => {
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
  };

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
    [setCountData]
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
      const taskCountParams = isUserEntity
        ? isCurrentUserProfile
          ? { view: 'visible' as const, domain }
          : { assignee: fqn, domain }
        : { aboutEntity: fqn, view: 'entity' as const, domain };

      const taskCounts = await getTaskCounts(taskCountParams);
      const totalTasksCount = taskCounts.total ?? 0;
      const openTaskCount = taskCounts.open ?? 0;

      if (isUserEntity) {
        // Also get feed counts for conversations and mentions
        const res = await getFeedCount(getEntityUserLink(fqn));
        const { conversationCount, mentionCount } =
          aggregateFeedCountResponse(res);
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
    currentUser?.id,
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
      setIsFirstLoad(false);
      if (isTaskActiveTab) {
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
      isTaskActiveTab,
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
      if (isTaskActiveTab) {
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
    isTaskActiveTab,
  ]);

  useEffect(() => {
    // Activity events only render on the ALL tab; skip the fetch on Tasks/Mentions.
    if (isTaskActiveTab || isMentionTabSelected) {
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
    isTaskActiveTab,
    isMentionTabSelected,
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
      getTaskData(feedFilter, undefined, entityType, fqn, taskFilter);
      navigate('.', { replace: true, state: {} });
    }
  }, [
    entityType,
    feedFilter,
    fqn,
    getTaskData,
    isTaskActiveTab,
    location.key,
    location.state,
    navigate,
    taskFilter,
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
      if (!feed && (isTaskActiveTab || isMentionTabSelected)) {
        setIsFullWidth(false);
      }
      if (selectedThread?.id !== feed?.id) {
        setActiveThread(feed);
        // Clear any previously-selected activity so the right panel
        // shows the clicked conversation, not a stale activity.
        setActiveActivity(undefined);
      }
    },
    [
      setActiveThread,
      setActiveActivity,
      isTaskActiveTab,
      isMentionTabSelected,
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

  const handleUpdateTaskFilter = (filter: TaskStatusGroup) => {
    setTaskFilter(filter);
    getTaskData(feedFilter, undefined, entityType, fqn, filter);
  };

  const handleAfterTaskClose = () => {
    handleFeedFetchFromFeedList();
    fetchFeedsCount();
  };
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
    [taskFilter, handleUpdateTaskFilter, setActiveTask, countData]
  );

  const TaskToggle = useCallback(() => {
    return (
      <Segmented
        className="task-toggle"
        options={[
          {
            label: (
              <span className="toggle-item">
                <MyTaskIcon {...ICON_DIMENSION_USER_PAGE} />
                {t('label.my-task-plural')}
              </span>
            ),
            value: ActivityFeedTabs.TASKS,
          },
          {
            label: (
              <span className="toggle-item">
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
  }, [t, handleTabChange]);

  const handlePanelResize = (isFullWidth: boolean) => {
    setIsFullWidth(isFullWidth);
  };

  const getRightPanelContent = () => {
    if ((isTaskActiveTab || isMentionTabSelected) && selectedTask) {
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
  }, [activeTab, selectedThread]);

  return (
    <div
      className={classNames('activity-feed-tab', {
        'two-panel-layout-container':
          layoutType === ActivityFeedLayoutType.TWO_PANEL,
      })}>
      {layoutType === ActivityFeedLayoutType.THREE_PANEL && (
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
                        (countData?.data?.conversationCount ?? 0) +
                          (countData?.data?.activityCount ?? 0),
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
                    <TaskListIcon
                      style={COMMON_ICON_STYLES}
                      {...ICON_DIMENSION}
                    />
                    <span>{t('label.task-plural')}</span>
                  </Space>
                  <span data-testid="left-panel-task-count">
                    {getCountBadge(
                      taskFilter === TaskStatusGroup.Open
                        ? countData?.data?.openTaskCount
                        : countData?.data?.closedTaskCount,
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
          onClick={(info) => handleTabChange(info.key)}
        />
      )}
      <div
        className={classNames('center-container', {
          'full-width': isFullWidth,
          'three-panel-layout':
            layoutType === ActivityFeedLayoutType.THREE_PANEL,
        })}
        id="center-container">
        {(isTaskActiveTab || isMentionTabSelected) && (
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
                  <span
                    className="text-xs font-medium"
                    style={{ lineHeight: 1 }}>
                    {taskFilter === TaskStatusGroup.Open
                      ? `${t('label.open')} (${
                          countData?.data?.openTaskCount ?? 0
                        })`
                      : `${t('label.closed')} (${
                          countData?.data?.closedTaskCount ?? 0
                        })`}
                  </span>
                </Space>
              </Button>
            </Dropdown>
            {TaskToggle()}
          </div>
        )}
        {isTaskActiveTab || isMentionTabSelected ? (
          <TaskListV1
            activeFeedId={selectedTask?.id}
            emptyPlaceholderText={placeholderText}
            handlePanelResize={handlePanelResize}
            isFullWidth={isFullWidth}
            isLoading={isFirstLoad && loading}
            selectedTask={selectedTask}
            taskList={tasks}
            onAfterClose={handleAfterTaskClose}
            onTaskClick={handleTaskClick}
          />
        ) : (
          <ActivityFeedListV1New
            hidePopover
            activeFeedId={selectedThread?.id ?? selectedActivity?.id}
            activityList={activityEvents}
            emptyPlaceholderText={placeholderText}
            feedList={entityThread}
            handlePanelResize={handlePanelResize}
            isForFeedTab={false}
            isFullWidth={isFullWidth}
            isLoading={(isFirstLoad && loading) || (isActivityLoading ?? false)}
            selectedActivity={selectedActivity}
            selectedThread={selectedThread}
            showThread={false}
            onActivityClick={handleActivityClick}
            onAfterClose={handleAfterTaskClose}
            onFeedClick={handleFeedClick}
          />
        )}
        {!isFirstLoad && loader}
        {!isEmpty(
          isTaskActiveTab || isMentionTabSelected ? tasks : entityThread
        ) &&
          !loading && (
            <div
              className="w-full"
              data-testid="observer-element"
              id="observer-element"
              ref={elementRef as RefObject<HTMLDivElement>}
              style={{ height: '2px' }}
            />
          )}
      </div>

      {layoutType === ActivityFeedLayoutType.THREE_PANEL && (
        <Divider className="feed-divider h-100 m-0" type="vertical" />
      )}

      <div
        className={classNames('right-container', {
          'hide-panel': isFullWidth,
          'three-panel-layout':
            layoutType === ActivityFeedLayoutType.THREE_PANEL,
        })}>
        {loader}
        {(selectedThread || selectedTask || selectedActivity) && !loading
          ? getRightPanelContent()
          : !loading && (
              <div className="p-x-md no-data-placeholder-container-right-panel d-flex justify-center items-center h-full">
                <ErrorPlaceHolderNew
                  icon={<NoConversationsIcon />}
                  type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                  <Typography.Paragraph className="placeholder-text">
                    {getRightPanelPlaceholder}
                  </Typography.Paragraph>
                </ErrorPlaceHolderNew>
              </div>
            )}
      </div>
    </div>
  );
};
