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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  getUserPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../rest/miscAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityIcon, getEntityLink } from '../../../utils/TableUtils';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { SourceType } from '../../searched-data/SearchedData.interface';
import EntityListSkeleton from '../../Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import './MyDataWidget.less';

const MyDataWidgetInternal = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SourceType[]>([]);
  const [totalOwnedAssetsCount, setTotalOwnedAssetsCount] = useState<number>(0);

  const fetchMyDataAssets = async () => {
    if (!isUndefined(currentUser)) {
      setIsLoading(true);
      try {
        const teamsIds = (currentUser.teams ?? []).map((team) => team.id);
        const mergedIds = [
          ...teamsIds.map((id) => `owner.id:${id}`),
          `owner.id:${currentUser.id}`,
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
        const totalOwnedAssets = res?.data?.hits?.total.value ?? 0;
        const ownedAssets = res?.data?.hits?.hits;

        setData(ownedAssets.map((hit) => hit._source).slice(0, 8));
        setTotalOwnedAssetsCount(totalOwnedAssets);
      } catch (err) {
        setData([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  useEffect(() => {
    fetchMyDataAssets();
  }, [currentUser]);

  return (
    <Card className="my-data-widget-container card-widget" loading={isLoading}>
      <Row>
        <Col span={24}>
          <div className="d-flex justify-between m-b-xs">
            <Typography.Text className="font-medium">
              {t('label.my-data')}
            </Typography.Text>
            <Space>
              {data.length ? (
                <Link
                  data-testid="view-all-link"
                  to={getUserPath(currentUser?.name ?? '', 'mydata')}>
                  <span className="text-grey-muted font-normal text-xs">
                    {t('label.view-all')}{' '}
                    <span data-testid="my-data-total-count">
                      {`(${totalOwnedAssetsCount})`}
                    </span>
                  </span>
                </Link>
              ) : null}
              {isEditView && (
                <>
                  <DragOutlined
                    className="drag-widget-icon cursor-pointer"
                    size={14}
                  />
                  <CloseOutlined size={14} onClick={handleCloseClick} />
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
            <span className="text-center">
              <Transi18next
                i18nKey="message.no-owned-data"
                renderElement={<Link to={ROUTES.EXPLORE} />}
              />
            </span>
          </div>
        ) : (
          <div className="entity-list-body">
            {data.map((item) => {
              return (
                <div
                  className="right-panel-list-item flex items-center justify-between"
                  data-testid={`Recently Viewed-${getEntityName(item)}`}
                  key={item.id}>
                  <div className="d-flex items-center">
                    <Link
                      className=""
                      to={getEntityLink(
                        item.entityType ?? '',
                        item.fullyQualifiedName as string
                      )}>
                      <Button
                        className="entity-button flex-center p-0 m--ml-1"
                        icon={
                          <div className="entity-button-icon m-r-xs">
                            {getEntityIcon(item.entityType ?? '')}
                          </div>
                        }
                        type="text">
                        <Typography.Text
                          className="text-left text-xs"
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
      </EntityListSkeleton>
    </Card>
  );
};

export const MyDataWidget = observer(MyDataWidgetInternal);
