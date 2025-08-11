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

import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { get, isEmpty } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as CuratedAssetsEmptyIcon } from '../../../../assets/svg/curated-assets-no-data-placeholder.svg';
import { ReactComponent as CuratedAssetsNoDataIcon } from '../../../../assets/svg/curated-assets-not-found-placeholder.svg';
import { ReactComponent as StarOutlinedIcon } from '../../../../assets/svg/star-outlined.svg';
import { CURATED_ASSETS_LIST } from '../../../../constants/AdvancedSearch.constants';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../../../constants/constants';
import {
  getSortField,
  getSortOrder,
} from '../../../../constants/Widgets.constant';
import { SIZE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
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
import { showErrorToast } from '../../../../utils/ToastUtils';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { useAdvanceSearch } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './curated-assets-widget.less';
import CuratedAssetsModal from './CuratedAssetsModal/CuratedAssetsModal';
import {
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
  const navigate = useNavigate();
  const [data, setData] = useState<
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

  const { config: curatedAssetsConfig, w: curatedAssetsWidth } =
    curatedAssetsData || {};

  const isFullSize = useMemo(
    () => curatedAssetsWidth === 2,
    [curatedAssetsWidth]
  );

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

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!isLoading) && data?.length > PAGE_SIZE_BASE,
    [data, isLoading]
  );

  const sourceIcon = searchClassBase.getEntityIcon(selectedResource?.[0] ?? '');

  // Helper function to expand 'all' selection to all individual entity types
  const getExpandedResourceList = useCallback((resources: Array<string>) => {
    if (resources.includes(EntityType.ALL)) {
      // Return all entity types except 'all' itself
      return CURATED_ASSETS_LIST.filter((type) => type !== EntityType.ALL);
    }

    return resources;
  }, []);

  const prepareData = useCallback(async () => {
    if (selectedResource?.[0]) {
      try {
        setIsLoading(true);
        const sortField = getSortField(selectedSortBy);
        const sortOrder = getSortOrder(selectedSortBy);

        // Expand 'all' selection to individual entity types for the API call
        const expandedResources = getExpandedResourceList(selectedResource);

        // Use SearchIndex.ALL when 'all' is selected, otherwise use the first selected resource
        const searchIndex = selectedResource.includes(EntityType.ALL)
          ? SearchIndex.ALL
          : (selectedResource[0] as SearchIndex);

        const res = await searchQuery({
          query: '',
          pageNumber: 1,
          pageSize: PAGE_SIZE_MEDIUM,
          searchIndex,
          includeDeleted: false,
          trackTotalHits: false,
          fetchSource: true,
          queryFilter: getModifiedQueryFilterWithSelectedAssets(
            JSON.parse(queryFilter),
            expandedResources
          ),
          sortField,
          sortOrder,
        });

        const source = res.hits.hits.map((hit) => hit._source);

        const totalResourceCounts = getTotalResourceCount(
          res.aggregations.entityType.buckets,
          expandedResources
        );

        const count = String(
          totalResourceCounts > PAGE_SIZE_BASE
            ? totalResourceCounts - PAGE_SIZE_BASE
            : ''
        );

        setViewMoreCount(count);

        setData(source);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    }
  }, [
    curatedAssetsConfig,
    selectedResource,
    queryFilter,
    selectedSortBy,
    getExpandedResourceList,
  ]);

  const handleTitleClick = useCallback(() => {
    navigate(ROUTES.EXPLORE);
  }, [navigate]);

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
  }, [
    createCuratedAssetsModalOpen,
    selectedResource,
    prepareData,
    selectedSortBy,
  ]);

  const queryURL = useMemo(
    () =>
      getExploreURLWithFilters({
        queryFilter,
        selectedResource,
        config,
      }),
    [queryFilter, config, selectedResource]
  );

  const noDataState = useMemo(
    () => (
      <WidgetEmptyState
        icon={
          <CuratedAssetsNoDataIcon
            data-testid="curated-assets-no-data-icon"
            height={SIZE.LARGE}
            width={SIZE.LARGE}
          />
        }
        title={t('message.curated-assets-no-data-message')}
      />
    ),
    [t]
  );

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        showActionButton
        actionButtonText={t('label.create')}
        description={t('message.no-curated-assets')}
        icon={
          <CuratedAssetsEmptyIcon
            data-testid="curated-assets-empty-icon"
            height={SIZE.LARGE}
            width={SIZE.LARGE}
          />
        }
        onActionClick={handleModalOpen}
      />
    ),
    [t, handleModalOpen]
  );

  const entityListLinkItem = useCallback(
    (item: SearchIndexSearchSourceMapping[SearchIndex]) => {
      const title = getEntityName(item);
      const description = get(item, 'description');

      return (
        <Link
          className="curated-assets-list-item-link"
          to={entityUtilClassBase.getEntityLink(
            item.type || '',
            item.fullyQualifiedName as string
          )}>
          <div
            className="curated-assets-list-item flex items-center w-full"
            data-testid={`Curated Assets-${title}`}>
            <img
              alt={get(item, 'service.displayName', '')}
              className="entity-icon"
              src={serviceUtilClassBase.getServiceTypeLogo(
                item as unknown as SearchSourceAlias
              )}
            />
            <div className="flex flex-col curated-assets-list-item-content">
              <Typography.Text
                className="entity-list-item-title"
                ellipsis={{ tooltip: true }}>
                {title}
              </Typography.Text>
              {description && (
                <RichTextEditorPreviewerV1
                  className="max-two-lines entity-list-item-description"
                  enableSeeMoreVariant={false}
                  markdown={description}
                  showReadMoreBtn={false}
                />
              )}
            </div>
          </div>
        </Link>
      );
    },
    []
  );

  const entityListData = useMemo(() => {
    return isFullSize ? (
      <Row className="curated-assets-grid">
        {data.map((item) => (
          <Col key={item.id} span={12}>
            {entityListLinkItem(item)}
          </Col>
        ))}
      </Row>
    ) : (
      data.map((item) => entityListLinkItem(item))
    );
  }, [data, isFullSize, entityListLinkItem]);

  const entityList = useMemo(
    () => (
      <div className="entity-list-body">
        {data.length > 0 ? entityListData : noDataState}
      </div>
    ),
    [data, noDataState, entityListData]
  );

  const widgetHeader = useMemo(
    () => (
      <WidgetHeader
        currentLayout={currentLayout}
        disableEdit={isEmpty(curatedAssetsConfig)}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={
          sourceIcon && title ? (
            sourceIcon
          ) : (
            <StarOutlinedIcon
              data-testid="star-outlined-icon"
              height={22}
              width={22}
            />
          )
        }
        isEditView={isEditView}
        selectedSortBy={selectedSortBy}
        sortOptions={CURATED_ASSETS_SORT_BY_OPTIONS}
        title={
          <Typography.Text
            className={
              isFullSize ? 'widget-title-full-size' : 'widget-title-half-size'
            }
            ellipsis={{ tooltip: true }}>
            {title || t('label.curated-asset-plural')}
          </Typography.Text>
        }
        widgetKey={widgetKey}
        widgetWidth={curatedAssetsWidth}
        onEditClick={handleModalOpen}
        onSortChange={(key: string) => handleSortByClick({ key } as MenuInfo)}
        onTitleClick={handleTitleClick}
      />
    ),
    [
      currentLayout,
      curatedAssetsConfig,
      handleLayoutUpdate,
      handleRemoveWidget,
      sourceIcon,
      title,
      isEditView,
      selectedSortBy,
      isFullSize,
      t,
      widgetKey,
      curatedAssetsWidth,
      handleModalOpen,
      handleSortByClick,
      handleTitleClick,
    ]
  );

  const widgetContent = (
    <div className="curated-assets-widget-container">
      <div className="widget-content flex-1">
        {isEditView && isEmpty(data) && isEmpty(selectedResource)
          ? emptyState
          : entityList}
      </div>

      <WidgetFooter
        moreButtonLink={queryURL}
        moreButtonText={t('label.view-more-count', {
          countValue: viewMoreCount,
        })}
        showMoreButton={showWidgetFooterMoreButton}
      />
    </div>
  );

  return (
    <>
      <WidgetWrapper
        dataTestId="KnowledgePanel.CuratedAssets"
        header={widgetHeader}
        loading={isLoading}>
        {widgetContent}
      </WidgetWrapper>
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
