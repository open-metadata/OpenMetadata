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

import {
  ArrowRightOutlined,
  DragOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  List,
  Popover,
  Row,
  Tooltip,
  Typography,
} from 'antd';
import { get, isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as CuratedAssetsEmptyIcon } from '../../../../assets/svg/curated-assets-no-data-placeholder.svg';
import { ReactComponent as CuratedAssetsNoDataIcon } from '../../../../assets/svg/curated-assets-not-found-placeholder.svg';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { EntityReference } from '../../../../generated/type/entityReference';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import {
  getExploreURLWithFilters,
  getModifiedQueryFilterWithSelectedAssets,
  getTotalResourceCount,
} from '../../../../utils/CuratedAssetsUtils';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../../utils/EntityUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntityListSkeleton from '../../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import { useAdvanceSearch } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import './curated-assets-widget.less';
import CuratedAssetsModal from './CuratedAssetsModal/CuratedAssetsModal';

const CuratedAssetsWidget = ({
  isEditView,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const [data, setData] = useState<Array<EntityReference>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [createCuratedAssetsModalOpen, setCreateCuratedAssetsModalOpen] =
    useState<boolean>(false);
  const [viewMoreCount, setViewMoreCount] = useState<string>('');
  const { config } = useAdvanceSearch();

  const curatedAssetsData = useMemo(() => {
    let curatedAssetsConfig = null;

    currentLayout?.forEach((layout: WidgetConfig) => {
      if (layout.i === widgetKey) {
        curatedAssetsConfig = layout.config;
      }
    });

    return curatedAssetsConfig;
  }, [currentLayout, widgetKey]);

  const queryFilter = useMemo(
    () =>
      get(
        curatedAssetsData,
        'sourceConfig.config.appConfig.resources.queryFilter',
        '{}'
      ),
    [curatedAssetsData]
  );

  const selectedResource = useMemo(
    () =>
      get(
        curatedAssetsData,
        'sourceConfig.config.appConfig.resources.type',
        []
      ),
    [curatedAssetsData]
  );

  const title = useMemo(
    () => get(curatedAssetsData, 'title', ''),
    [curatedAssetsData]
  );

  const sourceIcon = searchClassBase.getEntityIcon(selectedResource?.[0] ?? '');

  const prepareData = useCallback(async () => {
    if (selectedResource?.[0]) {
      try {
        setIsLoading(true);
        const res = await searchQuery({
          query: '',
          pageNumber: 1,
          pageSize: 10,
          searchIndex: selectedResource[0] as SearchIndex,
          includeDeleted: false,
          trackTotalHits: false,
          fetchSource: true,
          queryFilter: getModifiedQueryFilterWithSelectedAssets(
            JSON.parse(queryFilter),
            selectedResource
          ),
        });

        const source = res.hits.hits.map((hit) => hit._source);

        const totalResourceCounts = getTotalResourceCount(
          res.aggregations.entityType.buckets,
          selectedResource
        );

        const count = String(
          totalResourceCounts > 10 ? totalResourceCounts - 10 : ''
        );

        setViewMoreCount(count);

        setData(source as unknown as EntityReference[]);
      } catch (error) {
        return;
      } finally {
        setIsLoading(false);
      }
    }
  }, [curatedAssetsData, selectedResource, queryFilter]);

  const handleCloseClick = useCallback(() => {
    if (!isUndefined(handleRemoveWidget)) {
      handleRemoveWidget(widgetKey);
    }
  }, [handleRemoveWidget, widgetKey]);

  const handleSave = (value: WidgetConfig['config']) => {
    const hasCurrentCuratedAssets = currentLayout?.find(
      (layout: WidgetConfig) => layout.i === widgetKey
    );

    const updatedLayout = hasCurrentCuratedAssets
      ? currentLayout?.map((layout: WidgetConfig) =>
          layout.i === widgetKey ? { ...layout, config: value } : layout
        )
      : [
          ...(currentLayout || []),
          {
            ...customizeMyDataPageClassBase.curatedAssetsWidgetDefaultValues,
            i: widgetKey,
            config: value,
          },
        ];

    // Update layout if handleLayoutUpdate is provided
    handleLayoutUpdate && handleLayoutUpdate(updatedLayout as Layout[]);

    setCreateCuratedAssetsModalOpen(false);
  };

  const handleModalClose = useCallback(() => {
    setCreateCuratedAssetsModalOpen(false);
    setData([]);
  }, []);

  const handleModalOpen = useCallback(() => {
    setCreateCuratedAssetsModalOpen(true);
  }, []);

  // Effect to fetch data when modal is closed and resources are selected
  useEffect(() => {
    if (!createCuratedAssetsModalOpen && !isEmpty(selectedResource)) {
      prepareData();
    }
  }, [createCuratedAssetsModalOpen, selectedResource, prepareData]);

  const menuItems = useMemo(
    () => [
      {
        key: 'remove-widget',
        label: 'Remove Widget',
        onClick: () => {
          handleCloseClick();
        },
      },
    ],
    [handleCloseClick]
  );

  const queryURL = useMemo(
    () =>
      getExploreURLWithFilters({
        queryFilter,
        selectedResource,
        config,
      }),
    [queryFilter, config, selectedResource]
  );

  const menuItemsList = useMemo(
    () => (
      <List
        dataSource={menuItems}
        renderItem={(item) => (
          <List.Item>
            <Typography.Text className="cursor-pointer" onClick={item.onClick}>
              {item.label}
            </Typography.Text>
          </List.Item>
        )}
      />
    ),
    []
  );

  const renderHeader = useMemo(
    () => (
      <Row className="curated-assets-header" justify="space-between">
        <Col className="d-flex items-center h-full min-h-8">
          {sourceIcon && title && (
            <div className="d-flex h-6 w-6 m-r-sm">{sourceIcon}</div>
          )}
          <Typography.Paragraph className="widget-title">
            {title || t('label.curated-asset-plural')}
          </Typography.Paragraph>
        </Col>
        {isEditView && (
          <Col>
            <div style={{ display: 'flex', gap: '8px' }}>
              <DragOutlined
                className="drag-widget-icon cursor-pointer widget-header-icon"
                data-testid="drag-widget-button"
                size={20}
              />
              <Button
                disabled={isEmpty(selectedResource)}
                icon={
                  <EditIcon
                    data-testid="edit-widget-button"
                    height={20}
                    width={20}
                  />
                }
                onClick={handleModalOpen}
              />
              <Popover
                destroyTooltipOnHide
                content={menuItemsList}
                placement="bottomRight"
                showArrow={false}
                trigger="click"
              >
                <Tooltip title={t('label.more')}>
                  <Button
                    className="widget-header-icon"
                    data-testid="filter-button"
                    icon={
                      <MoreOutlined
                        data-testid="more-widget-button"
                        size={20}
                      />
                    }
                  />
                </Tooltip>
              </Popover>
            </div>
          </Col>
        )}
      </Row>
    ),
    [isEditView, title, menuItemsList, handleModalOpen]
  );

  const renderEmptyState = useMemo(
    () => (
      <div className="flex-center h-full">
        <ErrorPlaceHolder
          className="border-none"
          icon={
            <CuratedAssetsEmptyIcon
              data-testid="curated-assets-empty-icon"
              height={SIZE.X_SMALL}
              width={SIZE.X_SMALL}
            />
          }
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}
        >
          <Typography.Paragraph>
            {t('message.no-curated-assets')}
          </Typography.Paragraph>
          <Button
            data-testid="add-curated-asset-button"
            icon={<PlusOutlined data-testid="plus-icon" />}
            type="primary"
            onClick={handleModalOpen}
          >
            {t('label.create')}
          </Button>
        </ErrorPlaceHolder>
      </div>
    ),
    [t, handleModalOpen]
  );

  const renderNoDataState = useMemo(
    () => (
      <div className="flex-center h-full">
        <ErrorPlaceHolder
          className="border-none"
          icon={
            <CuratedAssetsNoDataIcon
              data-testid="curated-assets-no-data-icon"
              height={SIZE.LARGE}
              width={SIZE.LARGE}
            />
          }
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}
        >
          <Typography.Paragraph>
            {t('message.curated-assets-no-data-message')}
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      </div>
    ),
    [t]
  );

  const renderFooter = useMemo(() => {
    return (
      <Row className="curated-assets-footer">
        <Divider className="mb-0 mt-0" />
        <Button
          className="text-primary hover:underline w-full  footer-view-more-button"
          href={queryURL}
          type="link"
        >
          {t('label.view-more-count', {
            count: viewMoreCount as unknown as number,
          })}

          <ArrowRightOutlined data-testid="arrow-right-icon" />
        </Button>
      </Row>
    );
  }, [t, handleModalOpen, viewMoreCount, queryURL]);

  const renderEntityList = useMemo(
    () => (
      <div className="entity-list-body no-scrollbar">
        {data.length > 0
          ? data.map((item) => (
              <div
                className="right-panel-list-item flex items-center justify-between"
                data-testid={`Recently Viewed-${getEntityName(item)}`}
                key={item.id}
              >
                <div className="flex items-center">
                  <Link
                    to={entityUtilClassBase.getEntityLink(
                      item.type || '',
                      item.fullyQualifiedName as string
                    )}
                  >
                    <Button
                      className="entity-button flex-center p-0 m--ml-1"
                      icon={
                        <img
                          alt={get(item, 'service.displayName', '')}
                          className="entity-icon"
                          src={serviceUtilClassBase.getServiceTypeLogo(
                            item as unknown as SearchSourceAlias
                          )}
                        />
                      }
                      title={getEntityName(item as unknown as EntityReference)}
                      type="text"
                    >
                      <div className="flex flex-col">
                        <Typography.Text
                          className="w-72 text-left text-sm"
                          ellipsis={{ tooltip: true }}
                        >
                          {get(item, 'service.displayName', '')}
                        </Typography.Text>
                        <Typography.Text
                          className="w-72 text-left text-sm"
                          ellipsis={{ tooltip: true }}
                        >
                          {getEntityName(item)}
                        </Typography.Text>
                      </div>
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          : renderNoDataState}
      </div>
    ),
    [data]
  );

  return (
    <>
      <Card
        className="curated-assets-widget-container card-widget"
        data-testid="curated-assets-widget"
      >
        <EntityListSkeleton
          dataLength={data.length !== 0 ? data.length : 5}
          loading={Boolean(isLoading)}
        >
          <>
            {renderHeader}
            {isEmpty(data) && isEmpty(selectedResource)
              ? renderEmptyState
              : renderEntityList}
            {!isEmpty(data) && renderFooter}
          </>
        </EntityListSkeleton>
      </Card>
      <CuratedAssetsModal
        curatedAssetsData={curatedAssetsData}
        isEditView={isEditView}
        isOpen={createCuratedAssetsModalOpen}
        onCancel={handleModalClose}
        onSave={handleSave}
      />
    </>
  );
};

export default CuratedAssetsWidget;
