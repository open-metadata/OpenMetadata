/*
 *  Copyright 2022 Collate.
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
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as RecentlyViewedEmptyIcon } from '../../../assets/svg/recently-viewed-no-data-placeholder.svg';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import {
  getRecentlyViewedData,
  prepareLabel,
} from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityIcon, getEntityLink } from '../../../utils/TableUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntityListSkeleton from '../../Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import './recently-viewed.less';

const RecentlyViewed = ({
  isEditView,
  handleRemoveWidget,
  widgetKey,
}: WidgetCommonProps) => {
  const { t } = useTranslation();

  const [data, setData] = useState<Array<EntityReference>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const prepareData = () => {
    const recentlyViewedData = getRecentlyViewedData();
    if (recentlyViewedData.length) {
      setIsLoading(true);
      const formattedData = recentlyViewedData
        .map((item) => {
          return {
            serviceType: item.serviceType,
            name: item.displayName || prepareLabel(item.entityType, item.fqn),
            fullyQualifiedName: item.fqn,
            type: item.entityType,
          };
        })
        .filter((item) => item.name);
      setData(formattedData as unknown as EntityReference[]);
      setIsLoading(false);
    }
  };

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  useEffect(() => {
    prepareData();
  }, []);

  return (
    <Card
      className="recently-viewed-widget-container card-widget"
      data-testid="recently-viewed-container">
      <EntityListSkeleton
        dataLength={data.length !== 0 ? data.length : 5}
        loading={Boolean(isLoading)}>
        <>
          <Row justify="space-between">
            <Col>
              <Typography.Paragraph className="font-medium m-b-sm">
                {t('label.recent-views')}
              </Typography.Paragraph>
            </Col>
            {isEditView && (
              <Col>
                <Space>
                  <DragOutlined
                    className="drag-widget-icon cursor-pointer"
                    size={14}
                  />
                  <CloseOutlined size={14} onClick={handleCloseClick} />
                </Space>
              </Col>
            )}
          </Row>
          {isEmpty(data) ? (
            <div className="flex-center h-full">
              <ErrorPlaceHolder
                icon={
                  <RecentlyViewedEmptyIcon
                    height={SIZE.X_SMALL}
                    width={SIZE.X_SMALL}
                  />
                }
                type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                <Typography.Paragraph>
                  {t('message.no-recently-viewed-date')}
                </Typography.Paragraph>
              </ErrorPlaceHolder>
            </div>
          ) : (
            <div className="entity-list-body">
              {data.map((item) => {
                return (
                  <div
                    className="right-panel-list-item flex items-center justify-between"
                    data-testid={`Recently Viewed-${getEntityName(item)}`}
                    key={item.id}>
                    <div className=" flex items-center">
                      <Link
                        className=""
                        to={getEntityLink(
                          item.type || '',
                          item.fullyQualifiedName as string
                        )}>
                        <Button
                          className="entity-button flex-center p-0 m--ml-1"
                          icon={
                            <div className="entity-button-icon m-r-xs">
                              {getEntityIcon(item.type || '')}
                            </div>
                          }
                          title={getEntityName(
                            item as unknown as EntityReference
                          )}
                          type="text">
                          <Typography.Text
                            className="w-72 text-left text-xs"
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
          )}
        </>
      </EntityListSkeleton>
    </Card>
  );
};

export default RecentlyViewed;
