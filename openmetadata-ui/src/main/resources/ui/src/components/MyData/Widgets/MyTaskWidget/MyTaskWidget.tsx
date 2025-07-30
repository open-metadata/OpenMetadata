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

import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MyTaskNoDataIcon } from '../../../../assets/svg/add-placeholder.svg';
import { ReactComponent as MyTaskIcon } from '../../../../assets/svg/ic-my-task.svg';
import { MY_TASK_WIDGET_FILTER_OPTIONS } from '../../../../constants/Widgets.constant';
import { SIZE } from '../../../../enums/common.enum';
import { FeedFilter, MyTaskFilter } from '../../../../enums/mydata.enum';
import {
  ThreadTaskStatus,
  ThreadType,
} from '../../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import FeedPanelBodyV1New from '../../../ActivityFeed/ActivityFeedPanel/FeedPanelBodyV1New';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { withActivityFeed } from '../../../AppRouter/withActivityFeed';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './my-task-widget.less';

const MyTaskWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [selectedFilter, setSelectedFilter] = useState<MyTaskFilter>(
    MyTaskFilter.OWNER
  );

  const { loading, entityThread, getFeedData } = useActivityFeedProvider();

  const myTaskData = useMemo(() => {
    return currentLayout?.find((layout) => layout.i === widgetKey);
  }, [currentLayout, widgetKey]);

  const handleSortByClick = useCallback((key: MyTaskFilter) => {
    setSelectedFilter(key);
  }, []);

  useEffect(() => {
    getFeedData(
      selectedFilter as unknown as FeedFilter,
      undefined,
      ThreadType.Task,
      undefined,
      undefined,
      ThreadTaskStatus.Open
    );
  }, [getFeedData, selectedFilter]);

  const handleFeedFetchFromFeedList = useCallback(() => {
    getFeedData(
      selectedFilter as unknown as FeedFilter,
      undefined,
      ThreadType.Task,
      undefined,
      undefined,
      ThreadTaskStatus.Open
    );
  }, [getFeedData, selectedFilter]);

  const handleAfterTaskClose = () => {
    handleFeedFetchFromFeedList();
  };

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!loading) && entityThread?.length > 10,
    [entityThread, loading]
  );

  const widgetContent = (
    <div className="my-task-widget-container">
      {/* Widget Header */}
      <WidgetHeader
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<MyTaskIcon data-testid="task-icon" height={22} width={22} />}
        isEditView={isEditView}
        selectedSortBy={selectedFilter}
        sortOptions={MY_TASK_WIDGET_FILTER_OPTIONS}
        title={t('label.my-task-plural')}
        widgetKey={widgetKey}
        widgetWidth={myTaskData?.w}
        onSortChange={(key) => handleSortByClick(key as MyTaskFilter)}
      />

      {/* Widget Content */}
      <div className="widget-content flex-1">
        {isEmpty(entityThread) ? (
          <WidgetEmptyState
            dataTestId="my-task-empty-state"
            description={t('message.my-task-no-data-placeholder')}
            icon={
              <MyTaskNoDataIcon
                data-testid="my-task-no-data-icon"
                height={SIZE.LARGE}
                width={SIZE.LARGE}
              />
            }
            title={t('label.no-tasks-yet')}
          />
        ) : (
          <>
            <div className="entity-list-body">
              {entityThread.map((feed) => (
                <FeedPanelBodyV1New
                  isForFeedTab
                  isFullWidth
                  feed={feed}
                  hideCardBorder={false}
                  hidePopover={isEditView}
                  isOpenInDrawer={myTaskData?.w === 1}
                  key={feed.id}
                  showThread={false}
                  onAfterClose={handleAfterTaskClose}
                />
              ))}
            </div>

            {/* Widget Footer */}
            <WidgetFooter
              moreButtonLink={`users/${currentUser?.name}/task`}
              moreButtonText={t('label.view-more')}
              showMoreButton={showWidgetFooterMoreButton}
            />
          </>
        )}
      </div>
    </div>
  );

  return (
    <WidgetWrapper
      dataLength={entityThread.length > 0 ? entityThread.length : 10}
      loading={loading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export default withActivityFeed(MyTaskWidget);
