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
  Dropdown,
  Menu,
  Segmented,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, noop } from 'lodash';
import {
  default as React,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as AllActivityIcon } from '../../../assets/svg/all-activity-v2.svg';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-check-circle-new.svg';
import { ReactComponent as TaskCloseIconBlue } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as FilterIcon } from '../../../assets/svg/ic-feeds-filter.svg';
import { ReactComponent as MentionIcon } from '../../../assets/svg/ic-mention.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as TaskIcon } from '../../../assets/svg/ic-task-new.svg';
import { ReactComponent as MyTaskIcon } from '../../../assets/svg/task.svg';

import { ReactComponent as AnnouncementsIcon } from '../../../assets/svg/announcements-v1.svg';
import { ReactComponent as NoConversationsIcon } from '../../../assets/svg/no-conversations.svg';
import { ReactComponent as TaskListIcon } from '../../../assets/svg/task-ic.svg';

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
  AnnoucementStatus,
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
import {
  ANNOUNCEMENT_ENTITIES,
  setSelectedAnnouncementStatus,
} from '../../../utils/AnnouncementsUtils';
import { getCountBadge, getFeedCounts } from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityUserLink,
} from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import { TaskTabNew } from '../../Entity/Task/TaskTab/TaskTabNew.component';
import AddAnnouncementModal from '../../Modals/AnnouncementModal/AddAnnouncementModal';
import '../../MyData/Widgets/FeedsWidget/feeds-widget.less';
import ActivityFeedListV1 from '../ActivityFeedList/ActivityFeedListV1.component';
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
  permissions,
  subTab,
  layoutType,
  feedCount,
}: ActivityFeedTabProps) => {
  const history = useHistory();
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
    useParams<{ tab: EntityTabs; subTab: ActivityFeedTabs }>();
  const [taskFilter, setTaskFilter] = useState<ThreadTaskStatus>(
    ThreadTaskStatus.Open
  );
  const [announcementFilter, setAnnouncementFilter] =
    useState<AnnoucementStatus>(AnnoucementStatus.Active);
  const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] =
    useState<boolean>(false);
  const handleCloseAnnouncementModal = useCallback(
    () => setIsAddAnnouncementOpen(false),
    []
  );
  const handleOpenAnnouncementModal = useCallback(
    () => setIsAddAnnouncementOpen(true),
    []
  );

  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [countData, setCountData] = useState<{
    loading: boolean;
    data: FeedCounts;
  }>({
    loading: false,
    data: FEED_COUNT_INITIAL_DATA,
  });
  const showAnnouncementsSubTab = ANNOUNCEMENT_ENTITIES.includes(entityType);
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
  const isAnnouncementActiveTab = useMemo(
    () => activeTab === ActivityFeedTabs.ANNOUNCEMENTS,
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
    history.push(
      entityUtilClassBase.getEntityLink(
        entityType,
        fqn,
        EntityTabs.ACTIVITY_FEED,
        subTab
      )
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
    } else if (activeTab === ActivityFeedTabs.ANNOUNCEMENTS) {
      return t('message.no-announcement-message');
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
            activeAnnouncementCount: res[0].activeAnnouncementCount ?? 0,
            inactiveAnnouncementCount: res[0].inactiveAnnouncementCount ?? 0,
            totalAnnouncementCount: res[0].totalAnnouncementCount ?? 0,
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

  const getThreadType = useCallback((activeTab) => {
    if (activeTab === ActivityFeedTabs.TASKS) {
      return ThreadType.Task;
    } else if (activeTab === ActivityFeedTabs.ALL) {
      return ThreadType.Conversation;
    } else if (activeTab === ActivityFeedTabs.ANNOUNCEMENTS) {
      return ThreadType.Announcement;
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

  const handleSaveAnnouncement = useCallback(() => {
    handleCloseAnnouncementModal();
    getFeedData(
      feedFilter,
      undefined,
      ThreadType.Announcement,
      entityType,
      fqn,
      undefined,
      undefined
    );
    fetchFeedsCount();
  }, [feedFilter, entityType, fqn, announcementFilter, fetchFeedsCount]);

  const handleFeedFetchFromFeedList = useCallback(
    (after?: string) => {
      setIsFirstLoad(false);
      getFeedData(feedFilter, after, threadType, entityType, fqn, taskFilter);
    },
    [threadType, feedFilter, entityType, fqn, taskFilter, getFeedData]
  );

  useEffect(() => {
    setSelectedAnnouncementStatus(AnnoucementStatus.Active);
    if (fqn && !isAnnouncementActiveTab) {
      getFeedData(
        feedFilter,
        undefined,
        threadType,
        entityType,
        fqn,
        taskFilter
      );
    } else {
      getFeedData(
        feedFilter,
        undefined,
        threadType,
        entityType,
        fqn,
        undefined,
        undefined
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
      setActiveThread(feed);
    },
    [setActiveThread, isTaskActiveTab, isMentionTabSelected]
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
  const handleUpdateAnnouncementFilter = (filter: AnnoucementStatus) => {
    setAnnouncementFilter(filter);
    setSelectedAnnouncementStatus(filter);
    getFeedData(
      feedFilter,
      undefined,
      threadType,
      entityType,
      fqn,
      undefined,
      undefined
    );
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
  const refetchAnnouncements = useCallback(() => {
    getFeedData(
      feedFilter,
      undefined,
      threadType,
      entityType,
      fqn,
      undefined,
      undefined
    );
    fetchFeedsCount();
  }, [
    feedFilter,
    threadType,
    entityType,
    fqn,
    announcementFilter,
    fetchFeedsCount,
  ]);

  const handleFilterClick = useCallback(
    (status) => {
      handleUpdateAnnouncementFilter(status);
      setActiveThread();
    },
    [handleUpdateAnnouncementFilter, setActiveThread]
  );

  const getSelectedKey = () => {
    if (activeTab === ActivityFeedTabs.ALL) {
      return ActivityFeedTabs.ALL;
    }
    if (activeTab === ActivityFeedTabs.ANNOUNCEMENTS) {
      return 'announcements';
    }

    return ActivityFeedTabs.TASKS;
  };

  const announcementFilterOptions = useMemo(
    () => [
      {
        key: AnnoucementStatus.Active,
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: announcementFilter === AnnoucementStatus.Active }
            )}
            data-testid="active-announcements">
            <div className="flex items-center space-x-2">
              {announcementFilter === AnnoucementStatus.Active ? (
                <TaskOpenIcon
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              ) : (
                <TaskIcon className="m-r-xs" {...ICON_DIMENSION_USER_PAGE} />
              )}
              <span
                className={classNames('task-tab-filter-item', {
                  selected: announcementFilter === AnnoucementStatus.Active,
                })}>
                {t('label.active')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: announcementFilter === AnnoucementStatus.Active,
              })}>
              <span className="task-count-text">
                {countData.data.activeAnnouncementCount}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleFilterClick(AnnoucementStatus.Active);
        },
      },
      {
        key: AnnoucementStatus.Inactive,
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: announcementFilter === AnnoucementStatus.Inactive }
            )}
            data-testid="inactive-announcements">
            <div className="flex items-center space-x-2">
              {announcementFilter === AnnoucementStatus.Inactive ? (
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
                  selected: announcementFilter === AnnoucementStatus.Inactive,
                })}>
                {t('label.inactive')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: announcementFilter === AnnoucementStatus.Inactive,
              })}>
              <span className="task-count-text">
                {countData.data.inactiveAnnouncementCount}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleFilterClick(AnnoucementStatus.Inactive);
        },
      },
    ],
    [announcementFilter, countData.data, handleFilterClick]
  );

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
            updateAnnouncementThreads={
              isAnnouncementActiveTab ? refetchAnnouncements : noop
            }
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

    if (isAnnouncementActiveTab) {
      return (
        <Typography.Text className="placeholder-text m-t-0">
          {t('message.no-announcements')}
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
                  <span>
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
            ...(showAnnouncementsSubTab
              ? [
                  {
                    label: (
                      <div
                        className="d-flex justify-between"
                        data-testid="announcement-sub-tab">
                        <Space align="center" size="small">
                          <AnnouncementsIcon
                            style={COMMON_ICON_STYLES}
                            {...ICON_DIMENSION}
                          />
                          <span>{t('label.announcement-plural')}</span>
                        </Space>

                        <span>
                          {!isUserEntity &&
                            getCountBadge(
                              countData.data.totalAnnouncementCount,
                              '',
                              activeTab === ActivityFeedTabs.ANNOUNCEMENTS
                            )}
                        </span>
                      </div>
                    ),
                    key: 'announcements',
                  },
                ]
              : []),
          ]}
          mode="inline"
          rootClassName="left-container"
          selectedKeys={[getSelectedKey()]}
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
        {isAnnouncementActiveTab && (
          <div className="d-flex gap-4 p-t-lg p-b-0 p-x-lg d-flex justify-between">
            <div className="d-flex gap-4">
              <Dropdown
                menu={{
                  items: announcementFilterOptions,
                  selectedKeys: [...announcementFilter],
                }}
                overlayClassName="task-tab-custom-dropdown"
                trigger={['click']}>
                <Button
                  className="feed-filter-icon"
                  data-testid="announcement-filter-icon"
                  icon={<FilterIcon height={16} />}
                />
              </Dropdown>
            </div>
            <Tooltip title={t('message.no-permission-to-view')}>
              <Button
                data-testid="add-announcement-btn"
                disabled={!permissions?.EditAll}
                type="primary"
                onClick={handleOpenAnnouncementModal}>
                {t('label.add')}
              </Button>
            </Tooltip>
          </div>
        )}
        {!isAnnouncementActiveTab ? (
          <ActivityFeedListV1New
            hidePopover
            activeFeedId={selectedThread?.id}
            componentsVisibility={componentsVisibility}
            emptyPlaceholderText={placeholderText}
            feedList={entityThread}
            handlePanelResize={handlePanelResize}
            isForFeedTab={isForFeedTab}
            isFullWidth={isFullWidth}
            isLoading={isFirstLoad && loading}
            selectedThread={selectedThread}
            showThread={false}
            onAfterClose={handleAfterTaskClose}
            onFeedClick={handleFeedClick}
          />
        ) : (
          <ActivityFeedListV1
            hidePopover
            activeFeedId={selectedThread?.id}
            componentsVisibility={componentsVisibility}
            emptyPlaceholderText={placeholderText}
            feedList={entityThread}
            isForFeedTab={isForFeedTab}
            isLoading={loading}
            permissions={permissions?.EditAll}
            selectedThread={selectedThread}
            showThread={false}
            updateAnnouncementThreads={
              isAnnouncementActiveTab ? refetchAnnouncements : noop
            }
            onFeedClick={handleFeedClick}
          />
        )}
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
      {isAddAnnouncementOpen && (
        <AddAnnouncementModal
          entityFQN={fqn || ''}
          entityType={entityType || ''}
          open={isAddAnnouncementOpen}
          onCancel={handleCloseAnnouncementModal}
          onSave={handleSaveAnnouncement}
        />
      )}
    </div>
  );
};
