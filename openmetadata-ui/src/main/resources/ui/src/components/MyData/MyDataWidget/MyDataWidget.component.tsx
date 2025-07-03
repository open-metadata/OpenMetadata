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
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as MyDataEmptyIcon } from '../../../assets/svg/my-data-no-data-placeholder.svg';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from '../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../rest/miscAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntityListSkeleton from '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import './my-data-widget.less';

const MyDataWidgetInternal = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SourceType[]>([]);
  const [totalOwnedAssetsCount, setTotalOwnedAssetsCount] = useState<number>(0);

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
        const totalOwnedAssets = res?.data?.hits?.total.value ?? 0;
        const ownedAssets = res?.data?.hits?.hits;

        setData(ownedAssets.map((hit) => hit._source).slice(0, 8));
        setTotalOwnedAssetsCount(totalOwnedAssets);
      } catch {
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
    <Card
      className="my-data-widget-container card-widget"
      data-testid="my-data-widget"
      loading={isLoading}>
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
                    data-testid="drag-widget-button"
                    size={14}
                  />
                  <CloseOutlined
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
              icon={
                <MyDataEmptyIcon height={SIZE.X_SMALL} width={SIZE.X_SMALL} />
              }
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <Typography.Paragraph
                className="tw-max-w-md"
                style={{ marginBottom: '0' }}>
                <Transi18next
                  i18nKey="message.no-owned-data"
                  renderElement={<Link to={ROUTES.EXPLORE} />}
                />
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
                  <div className="d-flex items-center">
                    <Link
                      to={entityUtilClassBase.getEntityLink(
                        item.entityType ?? '',
                        item.fullyQualifiedName as string
                      )}>
                      <Button
                        className="entity-button flex-center p-0 m--ml-1"
                        icon={
                          <div className="entity-button-icon m-r-xs">
                            {searchClassBase.getEntityIcon(
                              item.entityType ?? ''
                            )}
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

export const MyDataWidget = MyDataWidgetInternal;
