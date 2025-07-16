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
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ActivityFeedIcon } from '../../../assets/svg/ic-activity-feed.svg';
import { ReactComponent as NoDataAssetsPlaceholder } from '../../../assets/svg/no-folder-data.svg';
import { ROUTES } from '../../../constants/constants';
import { FEED_WIDGET_FILTER_OPTIONS } from '../../../constants/Widgets.constant';
import { SIZE } from '../../../enums/common.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import ActivityFeedListV1New from '../../ActivityFeed/ActivityFeedList/ActivityFeedListV1New.component';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import WidgetEmptyState from '../Widgets/Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Widgets/Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Widgets/Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Widgets/Common/WidgetWrapper/WidgetWrapper';
import './feed-widget.less';

const MyFeedWidgetInternal = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FeedFilter>(
    FeedFilter.ALL
  );
  const {
    loading,
    entityThread: feedList,
    getFeedData,
  } = useActivityFeedProvider();

  useEffect(() => {
    if (feedList) {
      const { updatedFeedList } = getFeedListWithRelativeDays(feedList);
      setEntityThread(updatedFeedList.slice(0, 8)); // Limit to 8 items for widget
    }
  }, [feedList]);

  useEffect(() => {
    if (currentUser && getFeedData) {
      getFeedData(
        selectedFilter,
        undefined,
        ThreadType.Conversation,
        undefined,
        undefined,
        undefined,
        8
      );
    }
  }, [currentUser, getFeedData, selectedFilter]);

  const handleFilterChange = useCallback(({ key }: { key: string }) => {
    setSelectedFilter(key as FeedFilter);
  }, []);

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  const handleUpdateEntityDetails = useCallback(() => {
    if (getFeedData) {
      getFeedData();
    }
  }, [getFeedData]);

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );
  const emptyState = useMemo(() => {
    return (
      <WidgetEmptyState
        showActionButton
        actionButtonText={t('label.browse-assets')}
        description={t('message.no-activity-feed-description')}
        icon={
          <NoDataAssetsPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />
        }
        title={t('message.no-activity-feed-title')}
        onActionClick={() => navigate(ROUTES.EXPLORE)}
      />
    );
  }, []);

  const widgetBody = useMemo(() => {
    return (
      <>
        {isEmpty(entityThread) ? (
          emptyState
        ) : (
          <div className="entity-list-body">
            <div className="cards-scroll-container flex-1 overflow-y-auto">
              <ActivityFeedListV1New
                isFeedWidget
                emptyPlaceholderText={t('label.no-recent-activity')}
                feedList={entityThread}
                hidePopover={false}
                isLoading={loading}
                onAfterClose={handleCloseClick}
                onUpdateEntityDetails={handleUpdateEntityDetails}
              />
            </div>
          </div>
        )}
      </>
    );
  }, [
    emptyState,
    entityThread,
    loading,
    handleCloseClick,
    handleUpdateEntityDetails,
    currentUser,
  ]);

  return (
    <WidgetWrapper data-testid="feed-widget" loading={loading}>
      <div className="feed-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<ActivityFeedIcon />}
          isEditView={isEditView}
          selectedSortBy={selectedFilter}
          sortOptions={FEED_WIDGET_FILTER_OPTIONS}
          title={t('label.activity-feed')}
          widgetKey={widgetKey}
          widgetWidth={widgetData?.w}
          onSortChange={(key) => handleFilterChange({ key })}
        />
        <div className="feed-content flex-1">
          {widgetBody}
          <WidgetFooter
            moreButtonLink={getUserPath(
              currentUser?.name ?? '',
              EntityTabs.ACTIVITY_FEED
            )}
            moreButtonText={t('label.view-more-count', {
              count: entityThread.length,
            })}
            showMoreButton={Boolean(!loading)}
          />
        </div>
      </div>
    </WidgetWrapper>
  );
};

export const MyFeedWidget = MyFeedWidgetInternal;
