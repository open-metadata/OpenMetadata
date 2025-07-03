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
  DownOutlined,
  DragOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Divider, Dropdown, Row, Typography } from 'antd';
import { get, isEmpty, isUndefined, orderBy, toLower } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as CuratedAssetsEmptyIcon } from '../../../../assets/svg/curated-assets-no-data-placeholder.svg';
import { ReactComponent as CuratedAssetsNoDataIcon } from '../../../../assets/svg/curated-assets-not-found-placeholder.svg';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as StarOutlinedIcon } from '../../../../assets/svg/star-outlined.svg';
import {
  ERROR_PLACEHOLDER_TYPE,
  SIZE,
  SORT_ORDER,
} from '../../../../enums/common.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import {
  SearchIndexSearchSourceMapping,
  SearchSourceAlias,
} from '../../../../interface/search.interface';
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
import {
  CURATED_ASSETS_MORE_MENU_ITEMS,
  CURATED_ASSETS_MORE_MENU_KEYS,
  CURATED_ASSETS_SORT_BY_KEYS,
  CURATED_ASSETS_SORT_BY_OPTIONS,
} from './CuratedAssetsWidget.constants';

const CuratedAssetsWidget = ({
  isEditView,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const [data, setData] = useState<
    Array<SearchIndexSearchSourceMapping[SearchIndex]>
  >([]);
  const [sortedData, setSortedData] = useState<
    Array<SearchIndexSearchSourceMapping[SearchIndex]>
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [createCuratedAssetsModalOpen, setCreateCuratedAssetsModalOpen] =
    useState<boolean>(false);
  const [viewMoreCount, setViewMoreCount] = useState<string>('');
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    CURATED_ASSETS_SORT_BY_KEYS.LATEST
  );
  const { config } = useAdvanceSearch();

  const curatedAssetsData = useMemo<WidgetConfig | null | undefined>(() => {
    return currentLayout?.find(
      (layout: WidgetConfig) => layout.i === widgetKey
    );
  }, [currentLayout, widgetKey]);

  const { config: curatedAssetsConfig } = curatedAssetsData || {};

  const queryFilter = useMemo(
    () => get(curatedAssetsConfig, 'queryFilter', '{}'),
    [curatedAssetsConfig]
  );

  const selectedResource = useMemo(
    () => get(curatedAssetsConfig, 'resources', []),
    [curatedAssetsConfig]
  );

  const title = useMemo(
    () => get(curatedAssetsConfig, 'title', ''),
    [curatedAssetsConfig]
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

        setData(source);
      } catch (error) {
        return;
      } finally {
        setIsLoading(false);
      }
    }
  }, [curatedAssetsConfig, selectedResource, queryFilter]);

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

  const handleSortData = useCallback(
    (
      data: Array<SearchIndexSearchSourceMapping[SearchIndex]>,
      sortBy: string
    ) => {
      let newSortedData = data;
      if (sortBy === CURATED_ASSETS_SORT_BY_KEYS.LATEST) {
        newSortedData = orderBy(data, ['updatedAt'], [SORT_ORDER.DESC]);
      } else if (sortBy === CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z) {
        newSortedData = orderBy(
          data,
          [(item) => toLower(getEntityName(item))],
          [SORT_ORDER.ASC]
        );
      } else if (sortBy === CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A) {
        newSortedData = orderBy(
          data,
          [(item) => toLower(getEntityName(item))],
          [SORT_ORDER.DESC]
        );
      }
      setSortedData(newSortedData);
    },
    []
  );

  const handleSortByClick = useCallback(
    (e: MenuInfo) => {
      if (!isEditView) {
        setSelectedSortBy(e.key);

        return;
      }

      if (handleLayoutUpdate) {
        const hasCurrentCuratedAssets = currentLayout?.find(
          (layout: WidgetConfig) => layout.i === widgetKey
        );

        const updatedLayout = hasCurrentCuratedAssets
          ? currentLayout?.map((layout: WidgetConfig) =>
              layout.i === widgetKey
                ? { ...layout, config: { ...layout.config, sortBy: e.key } }
                : layout
            )
          : [
              ...(currentLayout || []),
              {
                ...customizeMyDataPageClassBase.curatedAssetsWidgetDefaultValues,
                i: widgetKey,
                config: {
                  ...customizeMyDataPageClassBase
                    .curatedAssetsWidgetDefaultValues.config,
                  sortBy: e.key,
                },
              },
            ];

        handleLayoutUpdate(updatedLayout as Layout[]);
      }
    },
    [currentLayout, handleLayoutUpdate, widgetKey, isEditView]
  );

  const handleSizeChange = useCallback(
    (value: number) => {
      if (handleLayoutUpdate) {
        const hasCurrentCuratedAssets = currentLayout?.find(
          (layout: WidgetConfig) => layout.i === widgetKey
        );

        const updatedLayout = hasCurrentCuratedAssets
          ? currentLayout?.map((layout: WidgetConfig) =>
              layout.i === widgetKey
                ? { ...layout, config: { ...layout.config }, w: value }
                : layout
            )
          : [
              ...(currentLayout || []),
              {
                ...customizeMyDataPageClassBase.curatedAssetsWidgetDefaultValues,
                i: widgetKey,
                config: {
                  ...customizeMyDataPageClassBase
                    .curatedAssetsWidgetDefaultValues.config,
                },
                w: value,
              },
            ];

        handleLayoutUpdate(updatedLayout as Layout[]);
      }
    },
    [currentLayout, handleLayoutUpdate, widgetKey]
  );

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

  const handleMoreClick = (e: MenuInfo) => {
    if (e.key === CURATED_ASSETS_MORE_MENU_KEYS.REMOVE_WIDGET) {
      handleCloseClick();
    } else if (e.key === CURATED_ASSETS_MORE_MENU_KEYS.HALF_SIZE) {
      handleSizeChange(1);
    } else if (e.key === CURATED_ASSETS_MORE_MENU_KEYS.FULL_SIZE) {
      handleSizeChange(2);
    }
  };

  const queryURL = useMemo(
    () =>
      getExploreURLWithFilters({
        queryFilter,
        selectedResource,
        config,
      }),
    [queryFilter, config, selectedResource]
  );

  useEffect(() => {
    if (data.length > 0 && selectedSortBy) {
      handleSortData(data, selectedSortBy);
    }
  }, [data, handleSortData, selectedSortBy]);

  const header = useMemo(
    () => (
      <Row className="curated-assets-header" justify="space-between">
        <Col className="d-flex items-center h-full min-h-8">
          <div className="d-flex h-6 w-6 m-r-xs">
            {sourceIcon && title ? (
              sourceIcon
            ) : (
              <StarOutlinedIcon data-testid="star-outlined-icon" />
            )}
          </div>

          <Typography.Paragraph
            className="widget-title"
            ellipsis={{ tooltip: true }}
            style={{
              maxWidth: curatedAssetsData?.w === 1 ? '200px' : '525px',
            }}>
            {title || t('label.curated-asset-plural')}
          </Typography.Paragraph>
        </Col>

        <Col>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isEditView ? (
              <>
                <DragOutlined
                  className="drag-widget-icon cursor-pointer widget-header-options"
                  data-testid="drag-widget-button"
                  size={20}
                />
                <Button
                  className="widget-header-options"
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
                <Dropdown
                  className="widget-header-options"
                  data-testid="more-button"
                  menu={{
                    items: CURATED_ASSETS_MORE_MENU_ITEMS,
                    selectable: true,
                    multiple: false,
                    onClick: handleMoreClick,
                    className: 'widget-header-menu',
                  }}
                  placement="bottomLeft"
                  trigger={['click']}>
                  <Button
                    className=""
                    data-testid="more-button"
                    icon={
                      <MoreOutlined
                        data-testid="more-widget-button"
                        size={20}
                      />
                    }
                  />
                </Dropdown>
              </>
            ) : (
              <Dropdown
                className="widget-header-options"
                data-testid="sort-by-button"
                menu={{
                  items: CURATED_ASSETS_SORT_BY_OPTIONS,
                  selectable: true,
                  multiple: false,
                  activeKey: selectedSortBy,
                  onClick: handleSortByClick,
                  className: 'widget-header-menu',
                }}
                trigger={['click']}>
                <Button data-testid="filter-button">
                  {
                    CURATED_ASSETS_SORT_BY_OPTIONS.find(
                      (option) => option.key === selectedSortBy
                    )?.label
                  }
                  <DownOutlined />
                </Button>
              </Dropdown>
            )}
          </div>
        </Col>
      </Row>
    ),
    [isEditView, title, handleModalOpen, selectedSortBy, curatedAssetsData?.w]
  );

  const emptyState = useMemo(
    () => (
      <div className="flex-center h-full">
        <ErrorPlaceHolder
          className="border-none"
          icon={
            <CuratedAssetsEmptyIcon
              data-testid="curated-assets-empty-icon"
              height={SIZE.LARGE}
              width={SIZE.LARGE}
            />
          }
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph>
            {t('message.no-curated-assets')}
          </Typography.Paragraph>
          <Button
            data-testid="add-curated-asset-button"
            icon={<PlusOutlined data-testid="plus-icon" />}
            type="primary"
            onClick={handleModalOpen}>
            {t('label.create')}
          </Button>
        </ErrorPlaceHolder>
      </div>
    ),
    [t, handleModalOpen]
  );

  const noDataState = useMemo(
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
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph>
            {t('message.curated-assets-no-data-message')}
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      </div>
    ),
    [t]
  );

  const footer = useMemo(
    () => (
      <Row className="curated-assets-footer">
        <Divider className="mb-0 mt-0" />
        <Button
          className="text-primary hover:underline w-full  footer-view-more-button"
          href={queryURL}
          target="_blank"
          type="link">
          {t('label.view-more-count', {
            count: viewMoreCount as unknown as number,
          })}

          <ArrowRightOutlined data-testid="arrow-right-icon" />
        </Button>
      </Row>
    ),
    [t, viewMoreCount, queryURL]
  );

  const entityList = useMemo(
    () => (
      <div className="entity-list-body h-full w-full">
        {sortedData.length > 0
          ? sortedData.map((item) => {
              const title = getEntityName(item);
              const description = get(item, 'description');

              return (
                <div
                  className="right-panel-list-item  flex items-center w-full"
                  data-testid={`Curated Assets-${title}`}
                  key={item.id}>
                  <img
                    alt={get(item, 'service.displayName', '')}
                    className="entity-icon"
                    src={serviceUtilClassBase.getServiceTypeLogo(
                      item as unknown as SearchSourceAlias
                    )}
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
                          width: curatedAssetsData?.w === 1 ? '320px' : '760px',
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
          : noDataState}
      </div>
    ),
    [sortedData, noDataState, curatedAssetsData?.w]
  );

  return (
    <>
      <Card
        className="curated-assets-widget-container card-widget"
        data-testid="curated-assets-widget">
        <EntityListSkeleton
          dataLength={data.length !== 0 ? data.length : 5}
          loading={Boolean(isLoading)}
          skeletonContainerStyle={{ marginLeft: '20px', marginTop: '20px' }}>
          <>
            {header}
            {isEditView && isEmpty(data) && isEmpty(selectedResource)
              ? emptyState
              : entityList}
            {!isEmpty(data) && footer}
          </>
        </EntityListSkeleton>
      </Card>
      <CuratedAssetsModal
        curatedAssetsConfig={curatedAssetsConfig}
        isOpen={createCuratedAssetsModalOpen}
        onCancel={handleModalClose}
        onSave={handleSave}
      />
    </>
  );
};

export default CuratedAssetsWidget;
