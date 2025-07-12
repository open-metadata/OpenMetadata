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
import { useCallback, useMemo } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as FollowingEmptyIcon } from '../../../assets/svg/no-notifications.svg';
import { ROUTES } from '../../../constants/constants';
import {
  WIDGETS_MORE_MENU_KEYS,
  WIDGETS_MORE_MENU_OPTIONS,
} from '../../../constants/Widgets.constant';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { SearchSourceAlias } from '../../../interface/search.interface';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import customizeMyDataPageClassBase from '../../../utils/CustomizeMyDataPageClassBase';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntityListSkeleton from '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import './following-widget.less';

export interface FollowingWidgetProps extends WidgetCommonProps {
  followedData: EntityReference[];
  isLoadingOwnedData: boolean;
}

function FollowingWidget({
  isEditView,
  followedData,
  isLoadingOwnedData,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: Readonly<FollowingWidgetProps>) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const navigate = useNavigate();

  const widgetIcon = useMemo(() => {
    return customizeMyDataPageClassBase.getWidgetIconFromKey(widgetKey);
  }, [widgetKey]);

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
      return searchClassBase.getEntityIcon(item.type ?? '');
    }
  };

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

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
      className="following-widget-container card-widget p-box"
      data-testid="following-widget"
      loading={isLoadingOwnedData}>
      <Row>
        <Col span={24}>
          <div className="d-flex items-center justify-between m-b-xs">
            <div className="d-flex items-center gap-3 flex-wrap">
              <Icon
                className="following-widget-icon display-xs"
                component={widgetIcon as SvgComponent}
              />
              <Typography.Text className="text-md font-semibold">
                {t('label.following-assets')}
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
        dataLength={followedData.length !== 0 ? followedData.length : 5}
        loading={Boolean(isLoadingOwnedData)}>
        {isEmpty(followedData) ? (
          <div className="flex-center h-full">
            <ErrorPlaceHolder
              className="border-none"
              icon={
                <FollowingEmptyIcon height={SIZE.LARGE} width={SIZE.LARGE} />
              }
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <div className="d-flex flex-col items-center">
                <Typography.Text className="text-md font-semibold m-b-sm">
                  {t('message.not-following-any-assets-yet')}
                </Typography.Text>
                <Typography.Paragraph className="placeholder-text text-sm font-regular">
                  {t('message.not-followed-anything')}
                </Typography.Paragraph>
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
            <div className="entity-list-body p-y-sm d-flex flex-col gap-3 flex-1 overflow-y-auto">
              {followedData.map((item) => {
                return (
                  <div
                    className="following-widget-list-item w-full p-sm border-radius-sm"
                    data-testid={`Following-${getEntityName(item)}`}
                    key={item.id}>
                    <div className="d-flex items-center">
                      <Link
                        className="item-link w-full"
                        to={entityUtilClassBase.getEntityLink(
                          item.type ?? '',
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
            <div className="d-flex items-center justify-center w-full">
              <Link
                className="view-more-text text-sm font-regular  cursor-pointer"
                data-testid="view-more-link"
                to={getUserPath(currentUser?.name ?? '', 'following')}>
                {t('label.view-more-capital')}{' '}
                <ArrowRightOutlined className="m-l-xss" />
              </Link>
            </div>
          </div>
        )}
      </EntityListSkeleton>
    </Card>
  );
}

export default FollowingWidget;
