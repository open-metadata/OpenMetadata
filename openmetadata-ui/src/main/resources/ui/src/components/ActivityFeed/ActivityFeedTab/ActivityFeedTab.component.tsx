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
import { Menu, Skeleton, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { noop } from 'lodash';
import {
  default as React,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import { ReactComponent as AllActivityIcon } from '../../../assets/svg/all-activity-v2.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/ic-check.svg';
import { ReactComponent as MentionIcon } from '../../../assets/svg/ic-mentions.svg';
import { ReactComponent as TaskIcon } from '../../../assets/svg/ic-task.svg';
import { ReactComponent as TaskListIcon } from '../../../assets/svg/task-ic.svg';
import {
  COMMON_ICON_STYLES,
  ICON_DIMENSION,
  ROUTES,
} from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
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
import { FeedCounts } from '../../../interface/feed.interface';
import { getFeedCount } from '../../../rest/feedsAPI';
import {
  getCountBadge,
  getFeedCounts,
  Transi18next,
} from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityUserLink,
} from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import { TaskTab } from '../../Entity/Task/TaskTab/TaskTab.component';
import '../../MyData/Widgets/FeedsWidget/feeds-widget.less';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import ActivityFeedListV1 from '../ActivityFeedList/ActivityFeedListV1.component';
import FeedPanelBodyV1 from '../ActivityFeedPanel/FeedPanelBodyV1';
import FeedPanelHeader from '../ActivityFeedPanel/FeedPanelHeader';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-tab.less';
import {
  ActivityFeedTabProps,
  ActivityFeedTabs,
} from './ActivityFeedTab.interface';

const componentsVisibility = {
  showThreadIcon: false,
  showRepliesContainer: true,
};

export const ActivityFeedTab = ({
  fqn,
  owners = [],
  columns,
  entityType,
  refetchFeed,
  hasGlossaryReviewer,
  entityFeedTotalCount,
  isForFeedTab = true,
  onUpdateFeedCount,
  onUpdateEntityDetails,
}: ActivityFeedTabProps) => {
  const history = useHistory();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { isAdminUser } = useAuth();
  const initialRender = useRef(true);
  const [elementRef, isInView] = useElementInView({
    ...observerOptions,
    root: document.querySelector('#center-container'),
    rootMargin: '0px 0px 2px 0px',
  });
  const {
    tab = EntityTabs.ACTIVITY_FEED,
    subTab: activeTab = ActivityFeedTabs.ALL,
  } = useParams<{ tab: EntityTabs; subTab: ActivityFeedTabs }>();
  const [taskFilter, setTaskFilter] = useState<ThreadTaskStatus>(
    ThreadTaskStatus.Open
  );
  const [countData, setCountData] = useState<{
    loading: boolean;
    data: FeedCounts;
  }>({
    loading: false,
    data: FEED_COUNT_INITIAL_DATA,
  });

  const {
    postFeed,
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

  const getElementWithCountLoader = useCallback(
    (element: ReactNode) => {
      if (countData.loading) {
        return <Skeleton.Button active className="count-loader" size="small" />;
      }

      return element;
    },
    [countData.loading]
  );

  const handleTabChange = (subTab: string) => {
    history.push(
      entityUtilClassBase.getEntityLink(
        entityType,
        fqn,
        EntityTabs.ACTIVITY_FEED,
        subTab
      )
    );
    setActiveThread();
  };

  const placeholderText = useMemo(() => {
    if (activeTab === ActivityFeedTabs.ALL) {
      return (
        <Transi18next
          i18nKey="message.no-activity-feed"
          renderElement={<Link to={ROUTES.EXPLORE} />}
          values={{
            explored: t('message.have-not-explored-yet'),
          }}
        />
      );
    } else if (activeTab === ActivityFeedTabs.MENTIONS) {
      return t('message.no-mentions');
    } else {
      return t('message.no-open-tasks');
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

  const getThreadType = useCallback((activeTab) => {
    if (activeTab === ActivityFeedTabs.TASKS) {
      return ThreadType.Task;
    } else if (activeTab === ActivityFeedTabs.ALL) {
      return ThreadType.Conversation;
    } else {
      return;
    }
  }, []);

  const isActivityFeedTab = useMemo(
    () => tab === EntityTabs.ACTIVITY_FEED,
    [tab]
  );

  useEffect(() => {
    if (fqn && isActivityFeedTab) {
      fetchFeedsCount();
    }
  }, [fqn, isActivityFeedTab]);

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
      getFeedData(feedFilter, after, threadType, entityType, fqn, taskFilter);
    },
    [threadType, feedFilter, entityType, fqn, taskFilter, getFeedData]
  );

  const refetchFeedData = useCallback(() => {
    if (
      entityFeedTotalCount !== countData.data.totalCount &&
      isActivityFeedTab &&
      refetchFeed
    ) {
      getFeedData(
        feedFilter,
        undefined,
        threadType,
        entityType,
        fqn,
        taskFilter
      );
    }
  }, [
    fqn,
    taskFilter,
    feedFilter,
    threadType,
    entityType,
    refetchFeed,
    countData.data.totalCount,
    entityFeedTotalCount,
    isActivityFeedTab,
  ]);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;

      return;
    }
    refetchFeedData();
  }, [refetchFeedData]);

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

  const handleFeedClick = useCallback(
    (feed: Thread) => {
      setActiveThread(feed);
    },
    [setActiveThread]
  );

  useEffect(() => {
    if (fqn && isInView && entityPaging.after && !loading) {
      handleFeedFetchFromFeedList(entityPaging.after);
    }
  }, [entityPaging, loading, isInView, fqn]);

  const loader = useMemo(() => (loading ? <Loader /> : null), [loading]);

  const onSave = (message: string) => {
    postFeed(message, selectedThread?.id ?? '').catch(() => {
      // ignore since error is displayed in toast in the parent promise.
      // Added block for sonar code smell
    });
  };

  const handleUpdateTaskFilter = (filter: ThreadTaskStatus) => {
    setTaskFilter(filter);
    getFeedData(feedFilter, undefined, threadType, entityType, fqn, filter);
  };

  const handleAfterTaskClose = () => {
    handleFeedFetchFromFeedList();
    handleUpdateTaskFilter(ThreadTaskStatus.Closed);
  };

  return (
    <div className="activity-feed-tab">
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
                      countData.data.conversationCount,
                      '',
                      activeTab === ActivityFeedTabs.ALL
                    )}
                </span>
              </div>
            ),
            key: 'all',
          },
          ...(isUserEntity
            ? [
                {
                  label: (
                    <div className="d-flex justify-between">
                      <Space align="center" size="small">
                        <MentionIcon
                          style={COMMON_ICON_STYLES}
                          {...ICON_DIMENSION}
                        />
                        <span>{t('label.mention-plural')}</span>
                      </Space>

                      <span>
                        {getCountBadge(
                          countData.data.mentionCount,
                          '',
                          activeTab === ActivityFeedTabs.MENTIONS
                        )}
                      </span>
                    </div>
                  ),
                  key: 'mentions',
                },
              ]
            : []),
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
                    countData.data.openTaskCount,
                    '',
                    isTaskActiveTab
                  )}
                </span>
              </div>
            ),
            key: 'tasks',
          },
        ]}
        mode="inline"
        rootClassName="left-container"
        selectedKeys={[activeTab]}
        onClick={(info) => handleTabChange(info.key)}
      />

      <div className="center-container" id="center-container">
        {isTaskActiveTab && (
          <div className="d-flex gap-4 p-sm p-x-lg activity-feed-task">
            {getElementWithCountLoader(
              <Typography.Text
                className={classNames(
                  'cursor-pointer p-l-xss d-flex items-center',
                  {
                    'font-medium': taskFilter === ThreadTaskStatus.Open,
                  }
                )}
                data-testid="open-task"
                onClick={() => {
                  handleUpdateTaskFilter(ThreadTaskStatus.Open);
                  setActiveThread();
                }}>
                <TaskIcon className="m-r-xss" width={14} />{' '}
                {countData.data.openTaskCount} {t('label.open')}
              </Typography.Text>
            )}
            {getElementWithCountLoader(
              <Typography.Text
                className={classNames('cursor-pointer d-flex items-center', {
                  'font-medium': taskFilter === ThreadTaskStatus.Closed,
                })}
                data-testid="closed-task"
                onClick={() => {
                  handleUpdateTaskFilter(ThreadTaskStatus.Closed);
                  setActiveThread();
                }}>
                <CheckIcon className="m-r-xss" width={14} />{' '}
                {countData.data.closedTaskCount} {t('label.closed')}
              </Typography.Text>
            )}
          </div>
        )}
        <ActivityFeedListV1
          hidePopover
          activeFeedId={selectedThread?.id}
          componentsVisibility={componentsVisibility}
          emptyPlaceholderText={placeholderText}
          feedList={entityThread}
          isForFeedTab={isForFeedTab}
          isLoading={false}
          selectedThread={selectedThread}
          showThread={false}
          onFeedClick={handleFeedClick}
        />
        {loader}
        <div
          className="w-full"
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
          style={{ height: '2px' }}
        />
      </div>

      <div className="right-container">
        {loader}
        {selectedThread &&
          !loading &&
          (activeTab !== ActivityFeedTabs.TASKS ? (
            <div id="feed-panel">
              <div className="feed-explore-heading">
                <FeedPanelHeader
                  hideCloseIcon
                  className="p-x-md"
                  entityLink={selectedThread.about}
                  feed={selectedThread}
                  threadType={selectedThread?.type ?? ThreadType.Conversation}
                  onCancel={noop}
                />
              </div>

              <div className="m-md">
                <FeedPanelBodyV1
                  isOpenInDrawer
                  showThread
                  componentsVisibility={{
                    showThreadIcon: false,
                    showRepliesContainer: false,
                  }}
                  feed={selectedThread}
                  hidePopover={false}
                  isForFeedTab={isForFeedTab}
                />
                <ActivityFeedEditor
                  className="m-t-md feed-editor"
                  onSave={onSave}
                />
              </div>
            </div>
          ) : (
            <div id="task-panel">
              {entityType === EntityType.TABLE ? (
                <TaskTab
                  columns={columns}
                  entityType={EntityType.TABLE}
                  isForFeedTab={isForFeedTab}
                  owners={owners}
                  taskThread={selectedThread}
                  onAfterClose={handleAfterTaskClose}
                  onUpdateEntityDetails={onUpdateEntityDetails}
                />
              ) : (
                <TaskTab
                  entityType={isUserEntity ? entityTypeTask : entityType}
                  hasGlossaryReviewer={hasGlossaryReviewer}
                  isForFeedTab={isForFeedTab}
                  owners={owners}
                  taskThread={selectedThread}
                  onAfterClose={handleAfterTaskClose}
                  onUpdateEntityDetails={onUpdateEntityDetails}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
