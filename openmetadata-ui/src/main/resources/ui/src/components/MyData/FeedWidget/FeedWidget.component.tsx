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
import { ReactComponent as ActivityFeedIcon } from '../../../assets/svg/ic-activity-feed.svg';
import { ReactComponent as NoDataAssetsPlaceholder } from '../../../assets/svg/no-conversations.svg';
import { ROUTES } from '../../../constants/constants';
import { FEED_WIDGET_FILTER_OPTIONS } from '../../../constants/Widgets.constant';
import { SIZE } from '../../../enums/common.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getAllFeeds } from '../../../rest/feedsAPI';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedListV1New from '../../ActivityFeed/ActivityFeedList/ActivityFeedListV1New.component';
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
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [loading, setLoading] = useState(false);
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FeedFilter>(
    FeedFilter.ALL
  );

  const getFeeds = useCallback(async (filter: FeedFilter) => {
    try {
      setLoading(true);
      const { data } = await getAllFeeds(
        undefined,
        undefined,
        ThreadType.Conversation,
        filter,
        undefined,
        undefined,
        10
      );
      const { updatedFeedList } = getFeedListWithRelativeDays(data);
      setEntityThread(updatedFeedList);
    } catch (error) {
      showErrorToast(error as string);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFilterChange = useCallback(
    (key: string) => {
      setSelectedFilter(key as FeedFilter);
    },
    [setSelectedFilter]
  );

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  const handleUpdateEntityDetails = useCallback(() => {
    getAllFeeds();
  }, [getAllFeeds]);

  useEffect(() => {
    getFeeds(selectedFilter);
  }, [selectedFilter]);

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!loading) && entityThread?.length > 10,
    [entityThread, loading]
  );

  const emptyState = useMemo(() => {
    return (
      <WidgetEmptyState
        actionButtonLink={ROUTES.EXPLORE}
        actionButtonText={t('label.explore-assets')}
        description={t('message.activity-feed-no-data-placeholder')}
        icon={
          <NoDataAssetsPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />
        }
        title={t('label.no-recent-activity')}
      />
    );
  }, []);

  const showMoreCount = useMemo(() => {
    return entityThread.length > 0 ? entityThread.length.toString() : '';
  }, [entityThread]);

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
    <WidgetWrapper
      data-testid="feed-widget"
      dataLength={entityThread.length > 0 ? entityThread.length : 10}
      loading={loading}>
      <div className="feed-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<ActivityFeedIcon height={24} width={24} />}
          isEditView={isEditView}
          redirectUrlOnTitleClick={ROUTES.EXPLORE}
          selectedSortBy={selectedFilter}
          sortOptions={FEED_WIDGET_FILTER_OPTIONS}
          title={t('label.activity-feed')}
          widgetKey={widgetKey}
          widgetWidth={widgetData?.w}
          onSortChange={(key) => handleFilterChange(key)}
        />
        <div className="feed-content flex-1">
          {widgetBody}
          <WidgetFooter
            moreButtonLink={getUserPath(
              currentUser?.name ?? '',
              EntityTabs.ACTIVITY_FEED
            )}
            moreButtonText={t('label.view-more-count', {
              countValue: showMoreCount,
            })}
            showMoreButton={showWidgetFooterMoreButton}
          />
        </div>
      </div>
    </WidgetWrapper>
  );
};

export const MyFeedWidget = MyFeedWidgetInternal;
