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
import { Button, Dropdown, Menu, Segmented, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AllActivityIcon from '../../../assets/svg/all-activity-v2.svg?react';
import TaskCloseIcon from '../../../assets/svg/ic-check-circle-new.svg?react';
import TaskCloseIconBlue from '../../../assets/svg/ic-close-task.svg?react';
import FilterIcon from '../../../assets/svg/ic-feeds-filter.svg?react';
import MentionIcon from '../../../assets/svg/ic-mention.svg?react';
import TaskOpenIcon from '../../../assets/svg/ic-open-task.svg?react';
import TaskIcon from '../../../assets/svg/ic-task-new.svg?react';
import NoConversationsIcon from '../../../assets/svg/no-conversations.svg?react';
import TaskListIcon from '../../../assets/svg/task-ic.svg?react';
import MyTaskIcon from '../../../assets/svg/task.svg?react';
import {
  COMMON_ICON_STYLES,
  ICON_DIMENSION,
  ICON_DIMENSION_USER_PAGE,
} from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useElementInView } from '../../../hooks/useElementInView';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { getFeedCount } from '../../../rest/feedsAPI';
import { getCountBadge, getFeedCounts } from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityUserLink,
} from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import { TaskTabNew } from '../../Entity/Task/TaskTab/TaskTabNew.component';
import '../../MyData/Widgets/FeedsWidget/feeds-widget.less';
import ActivityFeedListV1New from '../ActivityFeedList/ActivityFeedListV1New.component';
import FeedPanelBodyV1New from '../ActivityFeedPanel/FeedPanelBodyV1New';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-tab.less';
import {
  ActivityFeedLayoutType,
  ActivityFeedTabProps,
  ActivityFeedTabs,
} from './ActivityFeedTab.interface';

const componentsVisibility = {
  showThreadIcon: false,
  showRepliesContainer: true,
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
}: ActivityFeedTabProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { isAdminUser } = useAuth();
  const { fqn } = useFqn();
  const [elementRef, isInView] = useElementInView({
    ...observerOptions,
    root: document.querySelector('#center-container'),
    rootMargin: '0px 0px 2px 0px',
  });
  const { subTab: activeTab = subTab } =
    useRequiredParams<{ tab: EntityTabs; subTab: ActivityFeedTabs }>();
  const [taskFilter, setTaskFilter] = useState<ThreadTaskStatus>(
    ThreadTaskStatus.Open
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

  const {
    selectedThread,
    setActiveThread,
    entityThread,
    getFeedData,
    loading,
    entityPaging,
  } = useActivityFeedProvider();

  const isUserEntity = useMemo(
    () => entityType === EntityType.USER,
    [entityType]
  );

  const entityTypeTask = useMemo(
    () =>
      selectedThread?.about?.split(ENTITY_LINK_SEPARATOR)?.[1] as Exclude<
        EntityType,
        EntityType.TABLE
      >,
    [selectedThread]
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
  }, [activeTab]);

  const handleFeedCount = useCallback(
    (data: FeedCounts) => {
      setCountData((prev) => ({ ...prev, data }));
      onUpdateFeedCount?.(data);
    },
    [setCountData]
  );

  const fetchFeedsCount = async () => {
    setCountData((prev) => ({ ...prev, loading: true }));
    if (isUserEntity) {
      try {
        const res = await getFeedCount(getEntityUserLink(fqn));
        setCountData((prev) => ({
          ...prev,
          data: {
            conversationCount: res[0].conversationCount ?? 0,
            totalTasksCount: res[0].totalTaskCount,
            openTaskCount: res[0].openTaskCount ?? 0,
            closedTaskCount: res[0].closedTaskCount ?? 0,
            totalCount: res[0].conversationCount ?? 0 + res[0].totalTaskCount,
            mentionCount: res[0].mentionCount ?? 0,
          },
        }));
      } catch (err) {
        showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
      }
    } else {
      await getFeedCounts(entityType, fqn, handleFeedCount);
    }
    setCountData((prev) => ({ ...prev, loading: false }));
  };

  const getThreadType = useCallback((activeTab?: ActivityFeedTabs) => {
    if (activeTab === ActivityFeedTabs.TASKS) {
      return ThreadType.Task;
    } else if (activeTab === ActivityFeedTabs.ALL) {
      return ThreadType.Conversation;
    } else {
      return;
    }
  }, []);

  const { feedFilter, threadType } = useMemo(() => {
    const currentFilter =
      isAdminUser &&
      currentUser?.name === fqn &&
      activeTab !== ActivityFeedTabs.TASKS
        ? FeedFilter.ALL
        : FeedFilter.OWNER_OR_FOLLOWS;
    const filter = isUserEntity ? currentFilter : undefined;

    return {
      threadType: getThreadType(activeTab),
      feedFilter: activeTab === 'mentions' ? FeedFilter.MENTIONS : filter,
    };
  }, [activeTab, isUserEntity, currentUser]);

  const handleFeedFetchFromFeedList = useCallback(
    (after?: string) => {
      setIsFirstLoad(false);
      getFeedData(feedFilter, after, threadType, entityType, fqn, taskFilter);
    },
    [threadType, feedFilter, entityType, fqn, taskFilter, getFeedData]
  );

  useEffect(() => {
    if (fqn) {
      getFeedData(
        feedFilter,
        undefined,
        threadType,
        entityType,
        fqn,
        taskFilter
      );
    }
  }, [feedFilter, threadType, fqn]);

  useEffect(() => {
    if (feedCount) {
      setCountData((prev) => ({ ...prev, data: feedCount }));
    } else {
      fetchFeedsCount();
    }
  }, [feedCount]);

  const handleFeedClick = useCallback(
    (feed: Thread) => {
      if (!feed && (isTaskActiveTab || isMentionTabSelected)) {
        setIsFullWidth(false);
      }
      if (selectedThread?.id !== feed?.id) {
        setActiveThread(feed);
      }
    },
    [setActiveThread, isTaskActiveTab, isMentionTabSelected, selectedThread]
  );

  useEffect(() => {
    if (fqn && isInView && entityPaging.after && !loading) {
      handleFeedFetchFromFeedList(entityPaging.after);
    }
  }, [entityPaging, loading, isInView, fqn]);

  const loader = useMemo(
    () => (loading ? <Loader className="aspect-square" /> : null),
    [loading]
  );

  const handleUpdateTaskFilter = (filter: ThreadTaskStatus) => {
    setTaskFilter(filter);
    getFeedData(feedFilter, undefined, threadType, entityType, fqn, filter);
  };

  const handleAfterTaskClose = () => {
    handleFeedFetchFromFeedList();
    fetchFeedsCount();
  };
  const taskFilterOptions = useMemo(
    () => [
      {
        key: ThreadTaskStatus.Open,
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: taskFilter === ThreadTaskStatus.Open }
            )}
            data-testid="open-tasks">
            <div className="flex items-center space-x-2">
              {taskFilter === ThreadTaskStatus.Open ? (
                <TaskOpenIcon
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              ) : (
                <TaskIcon className="m-r-xs" {...ICON_DIMENSION_USER_PAGE} />
              )}
              <span
                className={classNames('task-tab-filter-item', {
                  selected: taskFilter === ThreadTaskStatus.Open,
                })}>
                {t('label.open')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: taskFilter === ThreadTaskStatus.Open,
              })}>
              <span className="task-count-text">
                {countData?.data?.openTaskCount}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleUpdateTaskFilter(ThreadTaskStatus.Open);
          setActiveThread();
        },
      },
      {
        key: ThreadTaskStatus.Closed,
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: taskFilter === ThreadTaskStatus.Closed }
            )}
            data-testid="closed-tasks">
            <div className="flex items-center space-x-2">
              {taskFilter === ThreadTaskStatus.Closed ? (
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
                  selected: taskFilter === ThreadTaskStatus.Closed,
                })}>
                {t('label.closed')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: taskFilter === ThreadTaskStatus.Closed,
              })}>
              <span className="task-count-text">
                {countData?.data?.closedTaskCount}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleUpdateTaskFilter(ThreadTaskStatus.Closed);
          setActiveThread();
        },
      },
    ],
    [taskFilter, handleUpdateTaskFilter, setActiveThread, countData]
  );

  const TaskToggle = useCallback(() => {
    return (
      <Segmented
        className="task-toggle"
        defaultValue={ActivityFeedTabs.TASKS}
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
        onChange={(value) => handleTabChange(value as ActivityFeedTabs)}
      />
    );
  }, [t, handleTabChange]);

  const handlePanelResize = (isFullWidth: boolean) => {
    setIsFullWidth(isFullWidth);
  };

  const getRightPanelContent = (selectedThread: Thread) => {
    if (
      activeTab !== ActivityFeedTabs.TASKS &&
      selectedThread?.type !== ThreadType.Task
    ) {
      return (
        <div id="feed-panel">
          <FeedPanelBodyV1New
            isOpenInDrawer
            showActivityFeedEditor
            showThread
            componentsVisibility={{
              showThreadIcon: true,
              showRepliesContainer: true,
            }}
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

    return (
      <div id="task-panel">
        {entityType === EntityType.TABLE ? (
          <TaskTabNew
            columns={columns}
            entityType={EntityType.TABLE}
            handlePanelResize={handlePanelResize}
            isForFeedTab={isForFeedTab}
            owners={owners}
            taskThread={selectedThread}
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
            taskThread={selectedThread}
            onAfterClose={handleAfterTaskClose}
            onUpdateEntityDetails={onUpdateEntityDetails}
          />
        )}
      </div>
    );
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
    <div className="activity-feed-tab">
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

                  <span>
                    {!isUserEntity &&
                      getCountBadge(
                        countData?.data?.conversationCount,
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
                      countData?.data?.openTaskCount,
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
                selectedKeys: [...taskFilter],
              }}
              overlayClassName="task-tab-custom-dropdown"
              trigger={['click']}>
              <Button
                className={classNames('feed-filter-icon', {
                  'cursor-pointer': !isMentionTabSelected,
                  disabled: isMentionTabSelected,
                })}
                data-testid="user-profile-page-task-filter-icon"
                icon={<FilterIcon height={16} />}
              />
            </Dropdown>
            {TaskToggle()}
          </div>
        )}
        <ActivityFeedListV1New
          hidePopover
          activeFeedId={selectedThread?.id}
          componentsVisibility={componentsVisibility}
          emptyPlaceholderText={placeholderText}
          feedList={entityThread}
          handlePanelResize={handlePanelResize}
          isForFeedTab={false}
          isFullWidth={isFullWidth}
          isLoading={isFirstLoad && loading}
          selectedThread={selectedThread}
          showThread={false}
          onAfterClose={handleAfterTaskClose}
          onFeedClick={handleFeedClick}
        />
        {!isFirstLoad && loader}
        {!isEmpty(entityThread) && !loading && (
          <div
            className="w-full"
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}
            style={{ height: '2px' }}
          />
        )}
      </div>

      <div
        className={classNames('right-container', {
          'hide-panel': isFullWidth,
          'three-panel-layout':
            layoutType === ActivityFeedLayoutType.THREE_PANEL,
        })}>
        {loader}
        {selectedThread && !loading
          ? getRightPanelContent(selectedThread)
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
