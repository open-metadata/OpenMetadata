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
import Icon, {
  ArrowRightOutlined,
  DownOutlined,
  DragOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Dropdown, Row, Space, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import {
  WIDGETS_MORE_MENU_KEYS,
  WIDGETS_MORE_MENU_OPTIONS,
} from '../../../constants/Widgets.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import customizeMyDataPageClassBase from '../../../utils/CustomizeMyDataPageClassBase';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import ActivityFeedListV1New from '../../ActivityFeed/ActivityFeedList/ActivityFeedListV1New.component';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntityListSkeleton from '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
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

  // Fetch feed data when component mounts or filter changes
  useEffect(() => {
    if (currentUser && getFeedData) {
      getFeedData(
        selectedFilter, // filterType
        undefined, // after
        ThreadType.Conversation, // type
        undefined, // entityType
        undefined, // fqn
        undefined, // taskStatus
        8 // limit to 8 items for widget
      );
    }
  }, [currentUser, getFeedData, selectedFilter]);

  // Filter options for the dropdown
  const filterOptions = [
    {
      label: t('label.all-activity'),
      value: FeedFilter.ALL,
      key: FeedFilter.ALL,
    },
    {
      label: t('label.my-data'),
      value: FeedFilter.OWNER,
      key: FeedFilter.OWNER,
    },
    {
      label: t('label.following'),
      value: FeedFilter.FOLLOWS,
      key: FeedFilter.FOLLOWS,
    },
  ];

  const handleFilterChange = useCallback(({ key }: { key: string }) => {
    setSelectedFilter(key as FeedFilter);
  }, []);

  const widgetIcon = useMemo(() => {
    return customizeMyDataPageClassBase.getWidgetIconFromKey(widgetKey);
  }, [widgetKey]);

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  const handleUpdateEntityDetails = useCallback(() => {
    // Refresh feed data after update
    if (getFeedData) {
      getFeedData();
    }
  }, [getFeedData]);

  const handleSizeChange = useCallback(
    (value: number) => {
      if (handleLayoutUpdate) {
        const hasCurrentWidget = currentLayout?.find(
          (layout: WidgetConfig) => layout.i === widgetKey
        );

        const updatedLayout = hasCurrentWidget
          ? currentLayout?.map((layout: WidgetConfig) =>
              layout.i === widgetKey ? { ...layout, w: value } : layout
            )
          : [
              ...(currentLayout || []),
              {
                ...customizeMyDataPageClassBase.defaultLayout.find(
                  (layout: WidgetConfig) => layout.i === widgetKey
                ),
                i: widgetKey,
                w: value,
              },
            ];

        handleLayoutUpdate(updatedLayout as Layout[]);
      }
    },
    [currentLayout, handleLayoutUpdate, widgetKey]
  );

  const handleMoreClick = (e: MenuInfo) => {
    if (e.key === WIDGETS_MORE_MENU_KEYS.REMOVE_WIDGET) {
      handleCloseClick();
    } else if (e.key === WIDGETS_MORE_MENU_KEYS.HALF_SIZE) {
      handleSizeChange(1);
    } else if (e.key === WIDGETS_MORE_MENU_KEYS.FULL_SIZE) {
      handleSizeChange(2);
    }
  };

  return (
    <Card
      className="feed-widget-container card-widget p-box"
      data-testid="feed-widget"
      loading={loading}>
      <Row>
        <Col span={24}>
          <div className="d-flex items-center justify-between m-b-xs">
            <div className="d-flex items-center gap-3 flex-wrap">
              <Icon
                className="feed-widget-icon display-xs"
                component={widgetIcon as SvgComponent}
              />
              <Typography.Text className="text-md font-semibold">
                {t('label.activity-feed')}
              </Typography.Text>
            </div>
            <Space>
              {!isEditView && (
                <Dropdown
                  menu={{
                    items: filterOptions,
                    selectedKeys: [selectedFilter],
                    onClick: handleFilterChange,
                  }}
                  trigger={['click']}>
                  <Button
                    ghost
                    className="expand-btn"
                    data-testid="advanced-filter"
                    type="primary">
                    {selectedFilter === FeedFilter.ALL
                      ? t('label.all-activity')
                      : selectedFilter === FeedFilter.OWNER
                      ? t('label.my-data')
                      : t('label.following')}
                    <DownOutlined />
                  </Button>
                </Dropdown>
              )}
              {isEditView && (
                <>
                  <DragOutlined
                    className="drag-widget-icon cursor-pointer p-sm border-radius-xs"
                    data-testid="drag-widget-button"
                    size={20}
                  />
                  <Dropdown
                    className="widget-options"
                    data-testid="widget-options"
                    menu={{
                      items: WIDGETS_MORE_MENU_OPTIONS,
                      selectable: true,
                      multiple: false,
                      onClick: handleMoreClick,
                      className: 'widget-header-menu',
                    }}
                    placement="bottomLeft"
                    trigger={['click']}>
                    <Button
                      className="more-options-btn"
                      data-testid="more-options-btn"
                      icon={<MoreOutlined size={20} />}
                    />
                  </Dropdown>
                </>
              )}
            </Space>
          </div>
        </Col>
      </Row>
      <EntityListSkeleton
        dataLength={entityThread.length !== 0 ? entityThread.length : 5}
        loading={Boolean(loading)}>
        {isEmpty(entityThread) ? (
          <div className="flex-center h-full">
            <ErrorPlaceHolder
              className="border-none"
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <div className="d-flex flex-col items-center">
                <Typography.Text className="text-md font-semibold m-b-sm">
                  {t('message.no-activity-feed')}
                </Typography.Text>
                <Button
                  className="m-t-md"
                  type="primary"
                  onClick={() => {
                    navigate(ROUTES.EXPLORE);
                  }}>
                  {t('label.browse-assets')}
                </Button>
              </div>
            </ErrorPlaceHolder>
          </div>
        ) : (
          <div className="d-flex flex-col h-full">
            <div className="entity-list-body d-flex flex-col gap-3 flex-1 overflow-y-auto">
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
            <div className="d-flex items-center justify-center w-full p-y-lg">
              <Link
                className="view-more-text text-sm font-regular m-b-lg cursor-pointer"
                data-testid="view-more-link"
                to={getUserPath(currentUser?.name ?? '', 'activity_feed')}>
                {t('label.view-more-capital')}
                <ArrowRightOutlined className="m-l-xss" />
              </Link>
            </div>
          </div>
        )}
      </EntityListSkeleton>
    </Card>
  );
};

export const MyFeedWidget = MyFeedWidgetInternal;
