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

import { Typography } from 'antd';
import { get, isEmpty, orderBy, toLower } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as TaskIcon } from '../../../../assets/svg/ic-task.svg';
import { ReactComponent as MyTaskNoDataIcon } from '../../../../assets/svg/my-task-no-data-placeholder.svg';
import { ROUTES } from '../../../../constants/constants';
import { SIZE, SORT_ORDER } from '../../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { FeedFilter } from '../../../../enums/mydata.enum';
import {
  ThreadTaskStatus,
  ThreadType,
} from '../../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../hooks/useFqn';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../../utils/EntityUtils';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTabs } from '../../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
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
  const { fqn } = useFqn();
  const { currentUser } = useApplicationStore();
  const [sortedData, setSortedData] = useState<any[]>([]);
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    MY_TASK_SORT_BY_KEYS.LATEST
  );

  const { loading, entityThread, entityPaging, getFeedData } =
    useActivityFeedProvider();

  const myTaskData = useMemo(() => {
    return currentLayout?.find((layout) => layout.i === widgetKey);
  }, [currentLayout, widgetKey]);

  const handleSortData = useCallback((data: any[], sortBy: string) => {
    let newSortedData = data;
    if (sortBy === MY_TASK_SORT_BY_KEYS.LATEST) {
      newSortedData = orderBy(data, ['updatedAt'], [SORT_ORDER.DESC]);
    } else if (sortBy === MY_TASK_SORT_BY_KEYS.A_TO_Z) {
      newSortedData = orderBy(
        data,
        [(item) => toLower(getEntityName(item))],
        [SORT_ORDER.ASC]
      );
    } else if (sortBy === MY_TASK_SORT_BY_KEYS.Z_TO_A) {
      newSortedData = orderBy(
        data,
        [(item) => toLower(getEntityName(item))],
        [SORT_ORDER.DESC]
      );
    }
    setSortedData(newSortedData);
  }, []);

  const handleSortByClick = useCallback((key: string) => {
    setSelectedSortBy(key);
  }, []);

  const redirectToUserPage = useCallback(() => {
    navigate(
      entityUtilClassBase.getEntityLink(
        EntityType.USER,
        currentUser?.name as string,
        EntityTabs.ACTIVITY_FEED,
        ActivityFeedTabs.TASKS
      )
    );
  }, [currentUser, navigate]);

  useEffect(() => {
    if (fqn) {
      getFeedData(
        currentUser?.isAdmin ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS,
        undefined,
        ThreadType.Task,
        undefined,
        fqn,
        ThreadTaskStatus.Open
      );
    }
  }, [getFeedData, currentUser?.isAdmin, fqn]);

  useEffect(() => {
    if (entityThread.length > 0 && selectedSortBy) {
      const tasks = entityThread.filter(
        (thread) => thread.task?.status === ThreadTaskStatus.Open
      );
      handleSortData(tasks, selectedSortBy);
    }
  }, [entityThread, handleSortData, selectedSortBy]);

  const entityList = useMemo(
    () => (
      <div className="entity-list-body h-full w-full">
        {sortedData.length > 0
          ? sortedData.map((item) => {
              const title = getEntityName(item);
              const description = get(item, 'description');

              return (
                <div
                  className="right-panel-list-item flex items-center w-full"
                  data-testid={`My Task-${title}`}
                  key={item.id}>
                  <TaskIcon
                    className="entity-icon"
                    data-testid="task-item-icon"
                  />
                  <div className="flex items-center">
                    <Link
                      className="flex items-center right-panel-list-item-link"
                      to={entityUtilClassBase.getEntityLink(
                        item.type || '',
                        item.fullyQualifiedName as string
                      )}>
                      <div
                        className="flex flex-col"
                        style={{
                          width: myTaskData?.w === 1 ? '320px' : '760px',
                        }}>
                        <Typography.Text
                          className="entity-list-item-title"
                          ellipsis={{ tooltip: true }}>
                          {title}
                        </Typography.Text>

                        {description && (
                          <Typography.Paragraph
                            className="entity-list-item-description"
                            ellipsis={{ rows: 2 }}>
                            {description}
                          </Typography.Paragraph>
                        )}
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })
          : null}
      </div>
    ),
    [sortedData, myTaskData?.w]
  );

  const widgetContent = (
    <>
      {/* Widget Header */}
      <WidgetHeader
        dataTestId="my-task-header"
        icon={<TaskIcon data-testid="task-icon" />}
        isEditView={isEditView}
        selectedSortBy={selectedSortBy}
        sortOptions={MY_TASK_SORT_BY_OPTIONS}
        title={t('label.my-task-plural')}
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
            onActionClick={() => navigate(ROUTES.EXPLORE)}
          />
        ) : (
          entityList
        )}
      </div>

      {/* Widget Footer */}
      <WidgetFooter
        dataTestId="my-task-footer"
        moreButtonText={t('label.view-more')}
        showMoreButton={Boolean(!loading && entityPaging.after)}
        onMoreClick={redirectToUserPage}
      />
    </>
  );

  return (
    <WidgetWrapper
      className="my-task-widget-wrapper"
      currentLayout={currentLayout}
      dataLength={sortedData.length || 5}
      dataTestId="my-task-widget-wrapper"
      handleLayoutUpdate={handleLayoutUpdate}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      loading={loading}
      widgetConfig={myTaskData}
      widgetKey={widgetKey}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export default MyTaskWidget;
