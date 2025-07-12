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

import { isEmpty, orderBy, toLower } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TaskIcon } from '../../../../assets/svg/ic-task.svg';
import { ReactComponent as MyTaskNoDataIcon } from '../../../../assets/svg/my-task-no-data-placeholder.svg';
import { SIZE, SORT_ORDER } from '../../../../enums/common.enum';
import { FeedFilter } from '../../../../enums/mydata.enum';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import FeedPanelBodyV1New from '../../../ActivityFeed/ActivityFeedPanel/FeedPanelBodyV1New';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './my-task-widget.less';
import {
  MY_TASK_SORT_BY_KEYS,
  MY_TASK_SORT_BY_OPTIONS,
} from './MyTaskWidget.constants';

const MyTaskWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const [sortedData, setSortedData] = useState<Thread[]>([]);
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    MY_TASK_SORT_BY_KEYS.LATEST
  );

  const { loading, entityThread, getFeedData } = useActivityFeedProvider();

  const myTaskData = useMemo(() => {
    return currentLayout?.find((layout) => layout.i === widgetKey);
  }, [currentLayout, widgetKey]);

  const handleSortData = useCallback((data: Thread[], sortBy: string) => {
    let newSortedData = data;
    if (sortBy === MY_TASK_SORT_BY_KEYS.LATEST) {
      newSortedData = orderBy(data, ['updatedAt'], [SORT_ORDER.DESC]);
    } else if (sortBy === MY_TASK_SORT_BY_KEYS.A_TO_Z) {
      newSortedData = orderBy(
        data,
        [(item) => toLower(item?.feedInfo?.fieldName)],
        [SORT_ORDER.ASC]
      );
    } else if (sortBy === MY_TASK_SORT_BY_KEYS.Z_TO_A) {
      newSortedData = orderBy(
        data,
        [(item) => toLower(item?.feedInfo?.fieldName)],
        [SORT_ORDER.DESC]
      );
    }
    setSortedData(newSortedData);
  }, []);

  const handleSortByClick = useCallback((key: string) => {
    setSelectedSortBy(key);
  }, []);

  useEffect(() => {
    getFeedData(
      FeedFilter.OWNER,
      undefined,
      ThreadType.Task,
      undefined,
      undefined,
      ThreadTaskStatus.Open
    );
  }, [getFeedData]);

  useEffect(() => {
    if (entityThread.length > 0 && selectedSortBy) {
      const tasks = entityThread.filter(
        (thread) => thread.task?.status === ThreadTaskStatus.Open
      );
      handleSortData(tasks, selectedSortBy);
    }
  }, [entityThread, handleSortData, selectedSortBy]);

  const handleFeedFetchFromFeedList = useCallback(() => {
    getFeedData(
      FeedFilter.OWNER,
      undefined,
      ThreadType.Task,
      undefined,
      undefined,
      ThreadTaskStatus.Open
    );
  }, [getFeedData]);

  const handleAfterTaskClose = () => {
    handleFeedFetchFromFeedList();
  };

  const widgetContent = (
    <div className="my-task-widget-container">
      {/* Widget Header */}
      <WidgetHeader
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<TaskIcon data-testid="task-icon" />}
        isEditView={isEditView}
        selectedSortBy={selectedSortBy}
        sortOptions={MY_TASK_SORT_BY_OPTIONS}
        title={t('label.my-task-plural')}
        widgetKey={widgetKey}
        widgetWidth={myTaskData?.w}
        onSortChange={handleSortByClick}
      />

      {/* Widget Content */}
      <div className="widget-content flex-1">
        {isEmpty(sortedData) ? (
          <WidgetEmptyState
            showActionButton
            actionButtonText={t('label.view-all-task-plural')}
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
            onActionClick={() => navigate(`users/${currentUser?.name}/task`)}
          />
        ) : (
          <>
            <div className="entity-list-body">
              {sortedData.map((feed) => (
                <FeedPanelBodyV1New
                  isForFeedTab
                  isFullWidth
                  feed={feed}
                  hideCardBorder={false}
                  hidePopover={isEditView}
                  isOpenInDrawer={myTaskData?.w === 1 ? true : false}
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
              showMoreButton={Boolean(!loading)}
            />
          </>
        )}
      </div>
    </div>
  );

  return (
    <WidgetWrapper dataLength={sortedData.length || 5} loading={loading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export default MyTaskWidget;
