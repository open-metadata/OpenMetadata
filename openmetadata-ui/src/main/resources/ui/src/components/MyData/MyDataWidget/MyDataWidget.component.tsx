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
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from '../../../constants/constants';
import {
  WIDGETS_MORE_MENU_KEYS,
  WIDGETS_MORE_MENU_OPTIONS,
} from '../../../constants/Widgets.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { SearchSourceAlias } from '../../../interface/search.interface';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../rest/miscAPI';
import customizeMyDataPageClassBase from '../../../utils/CustomizeMyDataPageClassBase';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntityListSkeleton from '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import './my-data-widget.less';

const MyDataWidgetInternal = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SourceType[]>([]);

  const widgetIcon = useMemo(() => {
    return customizeMyDataPageClassBase.getWidgetIconFromKey(widgetKey);
  }, [widgetKey]);

  const fetchMyDataAssets = async () => {
    if (!isUndefined(currentUser)) {
      setIsLoading(true);
      try {
        const teamsIds = (currentUser.teams ?? []).map((team) => team.id);
        const mergedIds = [
          ...teamsIds.map((id) => `owners.id:${id}`),
          `owners.id:${currentUser.id}`,
        ].join(' OR ');

        const queryFilter = `(${mergedIds})`;
        const res = await searchData(
          '',
          INITIAL_PAGING_VALUE,
          PAGE_SIZE,
          queryFilter,
          '',
          '',
          SearchIndex.ALL
        );

        // Extract useful details from the Response
        const ownedAssets = res?.data?.hits?.hits;

        setData(ownedAssets.map((hit) => hit._source).slice(0, 8));
      } catch {
        setData([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getEntityIcon = (item: any) => {
    if (item.serviceType) {
      return (
        <img
          alt={item.name}
          className="w-8 h-8"
          src={serviceUtilClassBase.getServiceTypeLogo(
            item.serviceType as unknown as SearchSourceAlias
          )}
        />
      );
    } else {
      return searchClassBase.getEntityIcon(item.entityType ?? '');
    }
  };

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  useEffect(() => {
    fetchMyDataAssets();
  }, [currentUser]);

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
      className="my-data-widget-container card-widget p-box"
      data-testid="my-data-widget"
      loading={isLoading}>
      <Row>
        <Col span={24}>
          <div className="d-flex items-center justify-between m-b-xs">
            <div className="d-flex items-center gap-3 flex-wrap">
              <Icon
                className="my-data-widget-icon display-xs"
                component={widgetIcon as SvgComponent}
              />
              <Typography.Text className="text-md font-semibold">
                {t('label.my-data')}
              </Typography.Text>
            </div>
            <Space>
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
        dataLength={data.length !== 0 ? data.length : 5}
        loading={Boolean(isLoading)}>
        {isEmpty(data) ? (
          <div className="flex-center h-full">
            <ErrorPlaceHolder
              className="border-none"
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <div className="d-flex flex-col items-center">
                <Typography.Text className="text-md font-semibold m-b-sm">
                  {t('message.curate-your-data-view')}
                </Typography.Text>
                <Typography.Text className="placeholder-text text-sm font-regular">
                  {t('message.nothing-saved-here-yet')}
                </Typography.Text>
                <Typography.Text className="placeholder-text text-sm font-regular">
                  {t('message.no-owned-data')}
                </Typography.Text>
                <Button
                  className="m-t-md"
                  type="primary"
                  onClick={() => {
                    navigate(ROUTES.EXPLORE);
                  }}>
                  {t('label.get-started')}
                </Button>
              </div>
            </ErrorPlaceHolder>
          </div>
        ) : (
          <div className="d-flex flex-col h-full">
            <div className="entity-list-body p-y-sm d-flex flex-col gap-3 flex-1 overflow-y-auto">
              {data.map((item) => {
                return (
                  <div
                    className="my-data-widget-list-item w-full p-sm border-radius-sm"
                    data-testid={`Recently Viewed-${getEntityName(item)}`}
                    key={item.id}>
                    <div className="d-flex items-center">
                      <Link
                        className="item-link w-full"
                        to={entityUtilClassBase.getEntityLink(
                          item.entityType ?? '',
                          item.fullyQualifiedName as string
                        )}>
                        <Button
                          className="entity-button flex-center gap-2 p-0"
                          icon={
                            <div className="entity-button-icon d-flex items-center justify-center">
                              {getEntityIcon(item)}
                            </div>
                          }
                          type="text">
                          <Typography.Text
                            className="text-left text-sm font-regular"
                            ellipsis={{ tooltip: true }}>
                            {getEntityName(item)}
                          </Typography.Text>
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="d-flex items-center justify-center w-full p-y-lg">
              <Link
                className="view-more-text text-sm font-regular m-b-lg cursor-pointer"
                data-testid="view-more-link"
                to={getUserPath(currentUser?.name ?? '', 'mydata')}>
                {t('label.view-more-capital')}{' '}
                <ArrowRightOutlined className="m-l-xss" />
              </Link>
            </div>
          </div>
        )}
      </EntityListSkeleton>
    </Card>
  );
};

export const MyDataWidget = MyDataWidgetInternal;
