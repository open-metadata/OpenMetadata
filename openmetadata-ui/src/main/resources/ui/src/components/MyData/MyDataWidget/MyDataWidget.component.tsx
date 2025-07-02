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
  CloseOutlined,
  DragOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from '../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { SearchSourceAlias } from '../../../interface/search.interface';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
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

  return (
    <Card
      className="my-data-widget-container card-widget p-y-lg p-x-box"
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
              <Typography.Text className="text-lg font-semibold">
                {t('label.my-data')}
              </Typography.Text>
            </div>
            <Space>
              {isEditView && (
                <>
                  <DragOutlined
                    className="drag-widget-icon cursor-pointer p-xs border-radius-xs"
                    data-testid="drag-widget-button"
                    size={14}
                  />
                  <CloseOutlined
                    className="remove-widget-icon p-xs border-radius-xs"
                    data-testid="remove-widget-button"
                    size={14}
                    onClick={handleCloseClick}
                  />
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
                <Typography.Text className="text-xl font-semibold m-b-sm">
                  {t('message.curate-your-data-view')}
                </Typography.Text>
                <Typography.Text className="placeholder-text text-md font-regular">
                  {t('message.nothing-saved-here-yet')}
                </Typography.Text>
                <Typography.Text className="placeholder-text text-md font-regular">
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
            <div className="entity-list-body p-y-sm d-flex flex-col gap-3 flex-1 ">
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
                className="view-more-text text-sm font-regular m-b-sm cursor-pointer"
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
