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
  Badge,
  Button,
  Checkbox,
  Col,
  Menu,
  MenuProps,
  Popover,
  Row,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { find, isEmpty, isObject } from 'lodash';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  AssetsFilterOptions,
  ASSETS_INDEXES,
  ASSET_MENU_KEYS,
  ASSET_SUB_MENU_FILTER,
} from '../../../../constants/Assets.constants';
import { PAGE_SIZE } from '../../../../constants/constants';
import { GLOSSARIES_DOCS } from '../../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { searchData } from '../../../../rest/miscAPI';
import { getCountBadge } from '../../../../utils/CommonUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import NextPrevious from '../../../common/next-previous/NextPrevious';
import { PagingHandlerParams } from '../../../common/next-previous/NextPrevious.interface';
import PageLayoutV1 from '../../../containers/PageLayoutV1';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import {
  SearchedDataProps,
  SourceType,
} from '../../../searched-data/SearchedData.interface';

import { FilterOutlined } from '@ant-design/icons';
import { getEntityIcon } from '../../../../utils/TableUtils';
import ErrorPlaceHolder from '../../../common/error-with-placeholder/ErrorPlaceHolder';
import './assets-tabs.less';
import {
  AssetsOfEntity,
  AssetsTabsProps,
  AssetsViewType,
} from './AssetsTabs.interface';

export interface AssetsTabRef {
  refreshAssets: () => void;
  closeSummaryPanel: () => void;
}

const AssetsTabs = forwardRef(
  (
    {
      permissions,
      onAssetClick,
      isSummaryPanelOpen,
      onAddAsset,
      assetCount,
      queryFilter,
      type = AssetsOfEntity.GLOSSARY,
      viewType = AssetsViewType.PILLS,
      noDataPlaceholder,
    }: AssetsTabsProps,
    ref
  ) => {
    const popupRef = React.useRef<HTMLElement>(null);
    const [itemCount, setItemCount] = useState<Record<EntityType, number>>(
      {} as Record<EntityType, number>
    );
    const [activeFilter, setActiveFilter] = useState<SearchIndex[]>([]);
    const { fqn } = useParams<{ fqn: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<SearchedDataProps['data']>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedCard, setSelectedCard] = useState<SourceType>();
    const [visible, setVisible] = useState<boolean>(false);
    const [openKeys, setOpenKeys] = useState<EntityType[]>([]);
    const [isCountLoading, setIsCountLoading] = useState<boolean>(true);

    const queryParam = useMemo(() => {
      switch (type) {
        case AssetsOfEntity.DOMAIN:
          return `(domain.fullyQualifiedName:"${fqn}")`;

        case AssetsOfEntity.DATA_PRODUCT:
          return `(dataProducts.fullyQualifiedName:"${fqn}")`;

        case AssetsOfEntity.TEAM:
          return `(owner.fullyQualifiedName:"${fqn}")`;

        case AssetsOfEntity.MY_DATA:
        case AssetsOfEntity.FOLLOWING:
          return queryFilter ?? '';

        default:
          return `(tags.tagFQN:"${fqn}")`;
      }
    }, [type, fqn]);

    const fetchAssets = useCallback(
      async ({
        index = activeFilter,
        page = 1,
      }: {
        index?: SearchIndex[];
        page?: number;
      }) => {
        try {
          setIsLoading(true);
          const res = await searchData(
            '',
            page,
            PAGE_SIZE,
            queryParam,
            '',
            '',
            index
          );

          // Extract useful details from the Response
          const totalCount = res?.data?.hits?.total.value ?? 0;
          const hits = res?.data?.hits?.hits;

          // Find EntityType for selected searchIndex
          const entityType = AssetsFilterOptions.find((f) =>
            activeFilter.includes(f.value)
          )?.label;

          // Update states
          setTotal(totalCount);
          entityType &&
            setItemCount((prevCount) => ({
              ...prevCount,
              [entityType]: totalCount,
            }));
          setData(hits as SearchedDataProps['data']);

          // Select first card to show summary right panel
          hits[0] && setSelectedCard(hits[0]._source as SourceType);
        } catch (_) {
          // Nothing here
        } finally {
          setIsLoading(false);
        }
      },
      [activeFilter, currentPage]
    );
    const onOpenChange: MenuProps['onOpenChange'] = (keys) => {
      const latestOpenKey = keys.find(
        (key) => openKeys.indexOf(key as EntityType) === -1
      );
      if (ASSET_MENU_KEYS.indexOf(latestOpenKey as EntityType) === -1) {
        setOpenKeys(keys as EntityType[]);
      } else {
        setOpenKeys(latestOpenKey ? [latestOpenKey as EntityType] : []);
      }
    };

    const handleAssetButtonVisibleChange = (newVisible: boolean) =>
      setVisible(newVisible);

    const handleActiveFilter = (key: SearchIndex) => {
      if (activeFilter.includes(key)) {
        setActiveFilter((prev) => prev.filter((item) => item !== key));
      } else {
        setActiveFilter((prev) => [...prev, key]);
      }
    };

    const tabs = useMemo(() => {
      return AssetsFilterOptions.map((option) => {
        return {
          label: (
            <div className="d-flex justify-between">
              <Space align="center" size="small">
                {option.label}
              </Space>

              <span>
                {getCountBadge(
                  itemCount[option.key],
                  '',
                  activeFilter.includes(option.value)
                )}
              </span>
            </div>
          ),
          key: option.value,
          value: option.value,
        };
      });
    }, [activeFilter, itemCount]);

    const getAssetMenuCount = useCallback(
      (key: EntityType) =>
        ASSET_SUB_MENU_FILTER.find((item) => item.key === key)
          ?.children.map((item) => itemCount[item.value] ?? 0)
          ?.reduce((acc, cv) => acc + cv, 0),
      [itemCount]
    );

    const getOptions = useCallback(
      (
        option: {
          label: string;
          key: EntityType | SearchIndex;
          value?: EntityType;
        },
        isChildren?: boolean
      ) => {
        const assetCount = isChildren
          ? itemCount[option.value as EntityType]
          : getAssetMenuCount(option.key as EntityType);

        return {
          label: isChildren ? (
            <div className="w-full d-flex justify-between">
              <div className="w-full d-flex items-center justify-between p-r-xss">
                <span className="d-flex items-center">
                  <span className="m-r-xs w-4 d-flex">
                    {getEntityIcon(option.key)}
                  </span>

                  <Typography.Text
                    className="asset-sub-menu-title text-color-inherit"
                    ellipsis={{ tooltip: true }}>
                    {option.label}
                  </Typography.Text>
                </span>

                <span>
                  {getCountBadge(assetCount, 'asset-badge-container')}
                </span>
              </div>
              <Checkbox
                checked={activeFilter.includes(option.key as SearchIndex)}
                className="asset-sub-menu-checkbox"
              />
            </div>
          ) : (
            <div className="d-flex justify-between">
              <span>{option.label}</span>
              <span>{getCountBadge(assetCount, 'asset-badge-container')}</span>
            </div>
          ),
          key: option.key,
          value: option.key,
        };
      },
      [
        getEntityIcon,
        setCurrentPage,
        handleActiveFilter,
        setSelectedCard,
        activeFilter,
      ]
    );

    const subMenuItems = useMemo(() => {
      return ASSET_SUB_MENU_FILTER.map((option) => ({
        ...getOptions(option),
        children: option.children.map((item) => getOptions(item, true)),
      }));
    }, [itemCount, getOptions]);

    const searchIndexes = useMemo(() => {
      const indexesToFetch = [...ASSETS_INDEXES];
      if (type !== AssetsOfEntity.GLOSSARY) {
        indexesToFetch.push(SearchIndex.GLOSSARY);
      }

      return indexesToFetch;
    }, [type]);

    const fetchCountsByEntity = () => {
      Promise.all(
        searchIndexes.map((index) =>
          searchData('', 0, 0, queryParam, '', '', index)
        )
      )
        .then(
          ([
            tableResponse,
            topicResponse,
            dashboardResponse,
            pipelineResponse,
            mlmodelResponse,
            containerResponse,
            storedProcedureResponse,
            dashboardDataModelResponse,
            databaseResponse,
            databaseSchemaResponse,
            searchResponse,
            databaseServiceResponse,
            messagingServiceResponse,
            dashboardServiceResponse,
            mlmodelServiceResponse,
            pipelineServiceResponse,
            storageServiceResponse,
            searchServiceResponse,
            domainResponse,
            dataProductResponse,
            tagResponse,
            glossaryResponse,
          ]) => {
            const counts = {
              [EntityType.TABLE]: tableResponse.data.hits.total.value,
              [EntityType.TOPIC]: topicResponse.data.hits.total.value,
              [EntityType.DASHBOARD]: dashboardResponse.data.hits.total.value,
              [EntityType.PIPELINE]: pipelineResponse.data.hits.total.value,
              [EntityType.MLMODEL]: mlmodelResponse.data.hits.total.value,
              [EntityType.CONTAINER]: containerResponse.data.hits.total.value,
              [EntityType.STORED_PROCEDURE]:
                storedProcedureResponse.data.hits.total.value,
              [EntityType.DASHBOARD_DATA_MODEL]:
                dashboardDataModelResponse.data.hits.total.value,
              [EntityType.DATABASE]: databaseResponse.data.hits.total.value,
              [EntityType.DATABASE_SCHEMA]:
                databaseSchemaResponse.data.hits.total.value,
              [EntityType.SEARCH_INDEX]: searchResponse.data.hits.total.value,
              [EntityType.DATABASE_SERVICE]:
                databaseServiceResponse.data.hits.total.value,
              [EntityType.MESSAGING_SERVICE]:
                messagingServiceResponse.data.hits.total.value,
              [EntityType.DASHBOARD_SERVICE]:
                dashboardServiceResponse.data.hits.total.value,
              [EntityType.MLMODEL_SERVICE]:
                mlmodelServiceResponse.data.hits.total.value,
              [EntityType.PIPELINE_SERVICE]:
                pipelineServiceResponse.data.hits.total.value,
              [EntityType.STORAGE_SERVICE]:
                storageServiceResponse.data.hits.total.value,
              [EntityType.SEARCH_SERVICE]:
                searchServiceResponse.data.hits.total.value,
              [EntityType.DOMAIN]: domainResponse.data.hits.total.value,
              [EntityType.DATA_PRODUCT]:
                dataProductResponse.data.hits.total.value,
              [EntityType.TAG]: tagResponse.data.hits.total.value,
              [EntityType.GLOSSARY_TERM]:
                type !== AssetsOfEntity.GLOSSARY
                  ? glossaryResponse.data.hits.total.value
                  : 0,
            };

            setItemCount(counts as Record<EntityType, number>);

            if (viewType !== AssetsViewType.PILLS) {
              find(counts, (count, key) => {
                if (count > 0) {
                  const option = AssetsFilterOptions.find(
                    (el) => el.key === key
                  );
                  if (option) {
                    handleActiveFilter(option.value);
                  }

                  return true;
                }

                return false;
              });
            }
          }
        )
        .catch((err) => {
          showErrorToast(err);
        })
        .finally(() => setIsCountLoading(false));
    };

    useEffect(() => {
      fetchCountsByEntity();

      return () => {
        onAssetClick && onAssetClick(undefined);
      };
    }, []);

    const assetErrorPlaceHolder = useMemo(() => {
      if (!isEmpty(activeFilter)) {
        return (
          <ErrorPlaceHolder
            heading={t('label.asset')}
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        );
      } else if (noDataPlaceholder) {
        return (
          <ErrorPlaceHolder>
            {isObject(noDataPlaceholder) && (
              <Typography.Paragraph>
                {noDataPlaceholder.message}
              </Typography.Paragraph>
            )}
          </ErrorPlaceHolder>
        );
      } else {
        return (
          <ErrorPlaceHolder
            doc={GLOSSARIES_DOCS}
            heading={t('label.asset')}
            permission={permissions.Create}
            type={ERROR_PLACEHOLDER_TYPE.CREATE}
            onClick={onAddAsset}
          />
        );
      }
    }, [activeFilter, noDataPlaceholder, permissions, onAddAsset]);

    const assetListing = useMemo(
      () =>
        data.length ? (
          <div className="assets-data-container">
            {data.map(({ _source, _id = '' }, index) => (
              <ExploreSearchCard
                showEntityIcon
                className={classNames(
                  'm-b-sm cursor-pointer',
                  selectedCard?.id === _source.id ? 'highlight-card' : ''
                )}
                handleSummaryPanelDisplay={setSelectedCard}
                id={_id}
                key={index}
                showTags={false}
                source={_source}
              />
            ))}
            {total > PAGE_SIZE && data.length > 0 && (
              <NextPrevious
                isNumberBased
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
                paging={{ total }}
                pagingHandler={({ currentPage }: PagingHandlerParams) =>
                  setCurrentPage(currentPage)
                }
              />
            )}
          </div>
        ) : (
          <div className="m-t-xlg">{assetErrorPlaceHolder}</div>
        ),
      [
        data,
        total,
        currentPage,
        selectedCard,
        assetErrorPlaceHolder,
        setSelectedCard,
        setCurrentPage,
      ]
    );

    const assetsHeader = useMemo(() => {
      if (viewType === AssetsViewType.PILLS) {
        return (
          <div className="w-full d-flex justify-end">
            <Popover
              align={{ targetOffset: [0, 10] }}
              content={
                <Menu
                  multiple
                  items={subMenuItems}
                  mode="inline"
                  openKeys={openKeys}
                  rootClassName="asset-multi-menu-selector"
                  selectedKeys={activeFilter}
                  style={{ width: 256, height: 340 }}
                  onClick={(value) => {
                    setCurrentPage(1);
                    handleActiveFilter(value.key as SearchIndex);
                    setSelectedCard(undefined);
                  }}
                  onOpenChange={onOpenChange}
                />
              }
              getPopupContainer={(triggerNode: HTMLElement) =>
                popupRef.current ?? triggerNode
              }
              key="asset-options-popover"
              open={visible}
              overlayClassName="ant-popover-asset"
              placement="bottomRight"
              showArrow={false}
              trigger="click"
              onOpenChange={handleAssetButtonVisibleChange}>
              {Boolean(assetCount) && (
                <Badge count={activeFilter.length}>
                  <Button
                    ghost
                    icon={<FilterOutlined />}
                    ref={popupRef}
                    style={{ background: 'white' }}
                    type="primary">
                    {t('label.filter-plural')}
                  </Button>
                </Badge>
              )}
            </Popover>
          </div>
        );
      } else {
        return (
          <Menu
            className="p-t-sm"
            items={tabs}
            selectedKeys={activeFilter}
            onClick={(value) => {
              setCurrentPage(1);
              setActiveFilter([value.key as SearchIndex]);
              setSelectedCard(undefined);
            }}
          />
        );
      }
    }, [
      viewType,
      activeFilter,
      isLoading,
      data,
      openKeys,
      visible,
      currentPage,
      tabs,
      itemCount,
      onOpenChange,
      handleAssetButtonVisibleChange,
    ]);

    const layout = useMemo(() => {
      if (viewType === AssetsViewType.PILLS) {
        return (
          <>
            {assetsHeader}
            {assetListing}
          </>
        );
      } else {
        return (
          <PageLayoutV1 leftPanel={assetsHeader} pageTitle="">
            {assetListing}
          </PageLayoutV1>
        );
      }
    }, [viewType, assetsHeader, assetListing, selectedCard]);

    useEffect(() => {
      fetchAssets({
        index: isEmpty(activeFilter) ? [SearchIndex.ALL] : activeFilter,
        page: currentPage,
      });
    }, [activeFilter, currentPage]);

    useImperativeHandle(ref, () => ({
      refreshAssets() {
        fetchAssets({});
        fetchCountsByEntity();
      },
      closeSummaryPanel() {
        setSelectedCard(undefined);
      },
    }));

    useEffect(() => {
      if (onAssetClick) {
        onAssetClick(selectedCard ? { details: selectedCard } : undefined);
      }
    }, [selectedCard, onAssetClick]);

    useEffect(() => {
      if (!isSummaryPanelOpen) {
        setSelectedCard(undefined);
      }
    }, [isSummaryPanelOpen]);

    if (isLoading || isCountLoading) {
      return (
        <Row className="p-lg" gutter={[0, 16]}>
          <Col span={24}>
            <Skeleton />
          </Col>
          <Col span={24}>
            <Skeleton />
          </Col>
        </Row>
      );
    }

    return (
      <div
        className={classNames(
          'assets-tab-container',
          viewType === AssetsViewType.PILLS ? 'p-md' : ''
        )}
        data-testid="table-container">
        {layout}
      </div>
    );
  }
);

export default AssetsTabs;
