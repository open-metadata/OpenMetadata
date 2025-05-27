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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Button, Space, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PAGE_SIZE_MEDIUM, ROUTES } from '../../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../../constants/entity.constants';
import { mockFeedData } from '../../../../constants/mockTourData.constants';
import { TAB_SUPPORTED_FILTER } from '../../../../constants/Widgets.constant';
import { useTourProvider } from '../../../../context/TourProvider/TourProvider';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { FeedFilter } from '../../../../enums/mydata.enum';
import {
  ThreadTaskStatus,
  ThreadType,
} from '../../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { FeedCounts } from '../../../../interface/feed.interface';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { getFeedCount } from '../../../../rest/feedsAPI';
import { getCountBadge, Transi18next } from '../../../../utils/CommonUtils';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import { getEntityUserLink } from '../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ActivityFeedListV1New from '../../../ActivityFeed/ActivityFeedList/ActivityFeedListV1New.component';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import '../../../ActivityFeed/ActivityFeedTab/activity-feed-tab.less';
import { ActivityFeedTabs } from '../../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import FeedsFilterPopover from '../../../common/FeedsFilterPopover/FeedsFilterPopover.component';

const FeedsWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isTourOpen } = useTourProvider();
  const { currentUser } = useApplicationStore();
  const [activeTab, setActiveTab] = useState<ActivityFeedTabs>(
    ActivityFeedTabs.ALL
  );
  const { loading, entityThread, entityPaging, getFeedData } =
    useActivityFeedProvider();
  const [count, setCount] = useState<FeedCounts>(FEED_COUNT_INITIAL_DATA);

  const [defaultFilter, setDefaultFilter] = useState<FeedFilter>(
    currentUser?.isAdmin ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS
  );

  useEffect(() => {
    if (activeTab === ActivityFeedTabs.ALL) {
      getFeedData(
        defaultFilter,
        undefined,
        ThreadType.Conversation,
        undefined,
        undefined,
        undefined,
        PAGE_SIZE_MEDIUM
      );
    } else if (activeTab === ActivityFeedTabs.MENTIONS) {
      getFeedData(FeedFilter.MENTIONS);
    } else if (activeTab === ActivityFeedTabs.TASKS) {
      getFeedData(
        defaultFilter,
        undefined,
        ThreadType.Task,
        undefined,
        undefined,
        ThreadTaskStatus.Open
      );
    }
  }, [activeTab, defaultFilter]);

  const mentionCountBadge = useMemo(
    () =>
      getCountBadge(
        count.mentionCount,
        '',
        activeTab === ActivityFeedTabs.MENTIONS
      ),
    [count.mentionCount, activeTab]
  );

  const taskCountBadge = useMemo(
    () =>
      getCountBadge(
        count.openTaskCount,
        '',
        activeTab === ActivityFeedTabs.TASKS
      ),
    [count.openTaskCount, activeTab]
  );

  const onTabChange = (key: string) => {
    if (key === ActivityFeedTabs.TASKS) {
      setDefaultFilter(FeedFilter.OWNER);
    } else if (key === ActivityFeedTabs.ALL) {
      setDefaultFilter(
        currentUser?.isAdmin ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS
      );
    }
    setActiveTab(key as ActivityFeedTabs);
  };

  const redirectToUserPage = useCallback(() => {
    navigate(
      entityUtilClassBase.getEntityLink(
        EntityType.USER,
        currentUser?.name as string,
        EntityTabs.ACTIVITY_FEED,
        activeTab
      )
    );
  }, [activeTab, currentUser]);

  const moreButton = useMemo(() => {
    if (!loading && entityPaging.after) {
      return (
        <div className="p-x-md p-b-md">
          <Button className="w-full" onClick={redirectToUserPage}>
            <Typography.Text className="text-primary">
              {t('label.more')}
            </Typography.Text>
          </Button>
        </div>
      );
    }

    return null;
  }, [loading, entityPaging, redirectToUserPage]);
  const onFilterUpdate = (filter: FeedFilter) => {
    setDefaultFilter(filter);
  };

  const fetchFeedsCount = async () => {
    try {
      const res = await getFeedCount(
        getEntityUserLink(currentUser?.name ?? '')
      );
      setCount((prev) => ({
        ...prev,
        openTaskCount: res?.[0]?.openTaskCount ?? 0,

        mentionCount: res?.[0]?.mentionCount ?? 0,
      }));
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
    }
  };

  useEffect(() => {
    setDefaultFilter(
      currentUser?.isAdmin ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS
    );
    fetchFeedsCount();
  }, [currentUser]);

  const threads = useMemo(() => {
    if (activeTab === 'tasks') {
      return entityThread.filter(
        (thread) => thread.task?.status === ThreadTaskStatus.Open
      );
    }

    return entityThread;
  }, [activeTab, entityThread]);

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  const emptyPlaceholderText = useMemo(
    () => (
      <Transi18next
        i18nKey="message.no-activity-feed"
        renderElement={<Link rel="noreferrer" to={ROUTES.EXPLORE} />}
        values={{
          explored: t('message.have-not-explored-yet'),
        }}
      />
    ),
    []
  );
  const handleFeedFetchFromFeedList = useCallback(() => {
    getFeedData(
      defaultFilter,
      undefined,
      ThreadType.Task,
      undefined,
      undefined,
      ThreadTaskStatus.Open
    );
  }, [defaultFilter, getFeedData]);
  const handleAfterTaskClose = () => {
    handleFeedFetchFromFeedList();
    fetchFeedsCount();
  };

  return (
    <div
      className="feeds-widget-container h-full"
      data-testid="activity-feed-widget">
      <Tabs
        destroyInactiveTabPane
        className="h-full d-flex"
        items={[
          {
            label: t('label.all'),
            key: ActivityFeedTabs.ALL,
            children: (
              <>
                <ActivityFeedListV1New
                  isForFeedTab
                  emptyPlaceholderText={emptyPlaceholderText}
                  feedList={isTourOpen ? mockFeedData : threads}
                  hidePopover={isEditView}
                  isLoading={loading && !isTourOpen}
                  showThread={false}
                />
                {moreButton}
              </>
            ),
          },
          {
            label: (
              <>
                {`@${t('label.mention-plural')}`}
                {mentionCountBadge}
              </>
            ),
            key: ActivityFeedTabs.MENTIONS,
            children: (
              <>
                <ActivityFeedListV1New
                  isForFeedTab
                  emptyPlaceholderText={
                    <Typography.Text className="placeholder-text">
                      {t('message.no-mentions')}
                    </Typography.Text>
                  }
                  feedList={threads}
                  hidePopover={isEditView}
                  isLoading={loading}
                  showThread={false}
                />
                {moreButton}
              </>
            ),
          },
          {
            label: (
              <>
                {`${t('label.task-plural')} `}
                {taskCountBadge}
              </>
            ),
            key: ActivityFeedTabs.TASKS,
            children: (
              <>
                <ActivityFeedListV1New
                  isForFeedTab
                  emptyPlaceholderText={
                    <div className="d-flex flex-col gap-4">
                      <Typography.Text className="placeholder-title">
                        {t('message.no-open-tasks-title')}
                      </Typography.Text>
                      <Typography.Text className="placeholder-text">
                        {t('message.no-open-tasks-description')}
                      </Typography.Text>
                    </div>
                  }
                  feedList={threads}
                  hidePopover={isEditView}
                  isLoading={loading}
                  showThread={false}
                  onAfterClose={handleAfterTaskClose}
                />
                {moreButton}
              </>
            ),
          },
        ]}
        tabBarExtraContent={
          <Space>
            {TAB_SUPPORTED_FILTER.includes(activeTab) && (
              <FeedsFilterPopover
                defaultFilter={defaultFilter}
                feedTab={activeTab}
                onUpdate={onFilterUpdate}
              />
            )}
            {isEditView && (
              <>
                <DragOutlined
                  className="drag-widget-icon cursor-pointer"
                  data-testid="drag-widget-button"
                  size={14}
                />
                <CloseOutlined
                  data-testid="remove-widget-button"
                  size={14}
                  onClick={handleCloseClick}
                />
              </>
            )}
          </Space>
        }
        onChange={onTabChange}
      />
    </div>
  );
};

export default FeedsWidget;
