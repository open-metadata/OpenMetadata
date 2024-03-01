/* eslint-disable no-case-declarations */
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

import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Col,
  Dropdown,
  MenuProps,
  notification,
  Row,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, isObject } from 'lodash';
import { EntityDetailUnion } from 'Models';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/add-placeholder.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/ic-feeds-filter.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import {
  AssetsFilterOptions,
  ASSET_MENU_KEYS,
} from '../../../../constants/Assets.constants';
import {
  DE_ACTIVE_COLOR,
  ES_UPDATE_DELAY,
} from '../../../../constants/constants';
import { GLOSSARIES_DOCS } from '../../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../generated/entity/domains/domain';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { useFqn } from '../../../../hooks/useFqn';
import { Aggregations } from '../../../../interface/search.interface';
import {
  getDataProductByName,
  removeAssetsFromDataProduct,
} from '../../../../rest/dataProductAPI';
import {
  getDomainByName,
  removeAssetsFromDomain,
} from '../../../../rest/domainAPI';
import {
  getGlossaryTermByFQN,
  removeAssetsFromGlossaryTerm,
} from '../../../../rest/glossaryAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getAssetsPageQuickFilters } from '../../../../utils/AdvancedSearchUtils';
import { Transi18next } from '../../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../utils/EntityUtils';
import {
  getAggregations,
  getQuickFilterQuery,
  getSelectedValuesFromQuickFilter,
} from '../../../../utils/Explore.utils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ManageButtonItemLabel } from '../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import { ExploreQuickFilterField } from '../../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../../Explore/ExploreQuickFilters';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import {
  SearchedDataProps,
  SourceType,
} from '../../../SearchedData/SearchedData.interface';
import './assets-tabs.less';
import { AssetsOfEntity, AssetsTabsProps } from './AssetsTabs.interface';

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
      onRemoveAsset,
      queryFilter,
      isEntityDeleted = false,
      type = AssetsOfEntity.GLOSSARY,
      noDataPlaceholder,
      entityFqn,
      assetCount,
    }: AssetsTabsProps,
    ref
  ) => {
    const [itemCount, setItemCount] = useState<Record<EntityType, number>>(
      {} as Record<EntityType, number>
    );
    const [assetRemoving, setAssetRemoving] = useState(false);

    const [activeFilter, _] = useState<SearchIndex[]>([]);
    const { fqn } = useFqn();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<SearchedDataProps['data']>([]);
    const [quickFilterQuery, setQuickFilterQuery] =
      useState<Record<string, unknown>>();
    const {
      currentPage,
      pageSize,
      paging,
      handlePageChange,
      handlePageSizeChange,
      handlePagingChange,
      showPagination,
    } = usePaging();

    const isRemovable = useMemo(
      () =>
        [
          AssetsOfEntity.DATA_PRODUCT,
          AssetsOfEntity.DOMAIN,
          AssetsOfEntity.GLOSSARY,
        ].includes(type),
      [type]
    );

    const [selectedCard, setSelectedCard] = useState<SourceType>();
    const [visible, setVisible] = useState<boolean>(false);
    const [openKeys, setOpenKeys] = useState<EntityType[]>([]);
    const [isCountLoading, setIsCountLoading] = useState<boolean>(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<SourceType>();
    const [activeEntity, setActiveEntity] = useState<
      Domain | DataProduct | GlossaryTerm
    >();

    const [selectedItems, setSelectedItems] = useState<
      Map<string, EntityDetailUnion>
    >(new Map());
    const [aggregations, setAggregations] = useState<Aggregations>();
    const [selectedFilter, setSelectedFilter] = useState<string[]>([]); // Contains menu selection
    const [selectedQuickFilters, setSelectedQuickFilters] = useState<
      ExploreQuickFilterField[]
    >([]);
    const [filters, setFilters] = useState<ExploreQuickFilterField[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const entityTypeString =
      type === AssetsOfEntity.GLOSSARY
        ? t('label.glossary-term-lowercase')
        : type === AssetsOfEntity.DOMAIN
        ? t('label.domain-lowercase')
        : t('label.data-product-lowercase');

    const handleMenuClick = ({ key }: { key: string }) => {
      setSelectedFilter((prevSelected) => [...prevSelected, key]);
    };

    const filterMenu: ItemType[] = useMemo(() => {
      return filters.map((filter) => ({
        key: filter.key,
        label: filter.label,
        onClick: handleMenuClick,
      }));
    }, [filters]);

    const queryParam = useMemo(() => {
      const encodedFqn = getEncodedFqn(escapeESReservedCharacters(entityFqn));
      switch (type) {
        case AssetsOfEntity.DOMAIN:
          return `(domain.fullyQualifiedName:"${encodedFqn}") AND !(entityType:"dataProduct")`;

        case AssetsOfEntity.DATA_PRODUCT:
          return `(dataProducts.fullyQualifiedName:"${encodedFqn}")`;

        case AssetsOfEntity.TEAM:
          return `(owner.fullyQualifiedName:"${escapeESReservedCharacters(
            fqn
          )}")`;

        case AssetsOfEntity.MY_DATA:
        case AssetsOfEntity.FOLLOWING:
          return queryFilter ?? '';

        default:
          return `(tags.tagFQN:"${encodedFqn}")`;
      }
    }, [type, fqn, entityFqn]);

    const fetchAssets = useCallback(
      async ({
        index = activeFilter,
        page = currentPage,
      }: {
        index?: SearchIndex[];
        page?: number;
      }) => {
        try {
          setIsLoading(true);
          const res = await searchQuery({
            pageNumber: page,
            pageSize: pageSize,
            searchIndex: index,
            query: `*${searchValue}*`,
            filters: queryParam,
            queryFilter: quickFilterQuery,
          });
          const hits = res.hits.hits as SearchedDataProps['data'];
          const totalCount = res?.hits?.total.value ?? 0;

          // Find EntityType for selected searchIndex
          const entityType = AssetsFilterOptions.find((f) =>
            activeFilter.includes(f.value)
          )?.label;

          entityType &&
            setItemCount((prevCount) => ({
              ...prevCount,
              [entityType]: totalCount,
            }));

          handlePagingChange({ total: res.hits.total.value ?? 0 });
          setData(hits);
          setAggregations(getAggregations(res?.aggregations));
          hits[0] && setSelectedCard(hits[0]._source);
        } catch (_) {
          // Nothing here
        } finally {
          setIsLoading(false);
        }
      },
      [
        activeFilter,
        currentPage,
        pageSize,
        searchValue,
        queryParam,
        quickFilterQuery,
      ]
    );

    const hideNotification = () => {
      notification.close('asset-tab-notification-key');
    };

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

    const fetchCurrentEntity = useCallback(async () => {
      let data;
      const fqn = entityFqn ?? '';
      switch (type) {
        case AssetsOfEntity.DOMAIN:
          data = await getDomainByName(fqn);

          break;
        case AssetsOfEntity.DATA_PRODUCT:
          data = await getDataProductByName(fqn, { fields: 'domain,assets' });

          break;
        case AssetsOfEntity.GLOSSARY:
          data = await getGlossaryTermByFQN(fqn);

          break;
        default:
          break;
      }

      setActiveEntity(data);
    }, [type, entityFqn]);

    const items: ItemType[] = [
      {
        label: (
          <ManageButtonItemLabel
            description={t('message.delete-asset-from-entity-type', {
              entityType: entityTypeString,
            })}
            icon={<DeleteIcon color={DE_ACTIVE_COLOR} width="18px" />}
            id="delete-button"
            name={t('label.delete')}
          />
        ),
        key: 'delete-button',
        onClick: () => {
          if (selectedCard) {
            onExploreCardDelete(selectedCard);
          }
        },
      },
    ];

    const onExploreCardDelete = useCallback((source: SourceType) => {
      setAssetToDelete(source);
      setShowDeleteModal(true);
    }, []);

    const handleCheckboxChange = (
      selected: boolean,
      source: EntityDetailUnion
    ) => {
      setSelectedItems((prevItems) => {
        const selectedItemMap = new Map(prevItems ?? []);
        if (selected && source.id) {
          selectedItemMap.set(source.id, source);
        } else if (source.id) {
          selectedItemMap.delete(source.id);
        }

        return selectedItemMap;
      });
    };

    const fetchCountsByEntity = async () => {
      try {
        setIsCountLoading(true);

        const res = await searchQuery({
          query: `*${searchValue}*`,
          pageNumber: 0,
          pageSize: 0,
          queryFilter: quickFilterQuery,
          searchIndex: SearchIndex.ALL,
          filters: queryParam,
        });

        const buckets = res.aggregations[`index_count`].buckets;
        const counts: Record<string, number> = {};
        buckets.forEach((item) => {
          if (item) {
            counts[item.key ?? ''] = item.doc_count;
          }
        });
        setItemCount(counts as Record<EntityType, number>);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsCountLoading(false);
      }
    };

    const deleteSelectedItems = useCallback(() => {
      if (selectedItems) {
        onAssetRemove(Array.from(selectedItems.values()));
      }
    }, [selectedItems]);

    useEffect(() => {
      fetchCountsByEntity();

      return () => {
        onAssetClick?.(undefined);
        hideNotification();
      };
    }, []);

    useEffect(() => {
      if (entityFqn) {
        fetchCurrentEntity();
      }
    }, [entityFqn]);

    const assetErrorPlaceHolder = useMemo(() => {
      if (!isEmpty(activeFilter)) {
        return (
          <ErrorPlaceHolder
            heading={t('label.asset')}
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        );
      } else if (
        isObject(noDataPlaceholder) ||
        searchValue ||
        !permissions.Create
      ) {
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
            icon={<AddPlaceHolderIcon className="h-32 w-32" />}
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography.Paragraph style={{ marginBottom: '0' }}>
              {noDataPlaceholder ??
                t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
                  entity: t('label.asset'),
                })}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Transi18next
                i18nKey="message.refer-to-our-doc"
                renderElement={
                  <a
                    href={GLOSSARIES_DOCS}
                    rel="noreferrer"
                    style={{ color: '#1890ff' }}
                    target="_blank"
                  />
                }
                values={{
                  doc: t('label.doc-plural-lowercase'),
                }}
              />
            </Typography.Paragraph>

            {permissions.Create && (
              <Tooltip
                placement="top"
                title={
                  isEntityDeleted
                    ? t(
                        'message.this-action-is-not-allowed-for-deleted-entities'
                      )
                    : t('label.add')
                }>
                <Button
                  ghost
                  data-testid="add-placeholder-button"
                  disabled={isEntityDeleted}
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={onAddAsset}>
                  {t('label.add')}
                </Button>
              </Tooltip>
            )}
          </ErrorPlaceHolder>
        );
      }
    }, [
      activeFilter,
      searchValue,
      noDataPlaceholder,
      permissions,
      onAddAsset,
      isEntityDeleted,
    ]);

    const renderDropdownContainer = useCallback((menus) => {
      return <div data-testid="manage-dropdown-list-container">{menus}</div>;
    }, []);

    const handleQuickFiltersChange = (data: ExploreQuickFilterField[]) => {
      const quickFilterQuery = getQuickFilterQuery(data);
      setQuickFilterQuery(quickFilterQuery);
    };

    const handleQuickFiltersValueSelect = useCallback(
      (field: ExploreQuickFilterField) => {
        setSelectedQuickFilters((pre) => {
          const data = pre.map((preField) => {
            if (preField.key === field.key) {
              return field;
            } else {
              return preField;
            }
          });

          handleQuickFiltersChange(data);

          return data;
        });
      },
      [setSelectedQuickFilters]
    );

    const assetListing = useMemo(
      () =>
        data.length ? (
          <div className="assets-data-container p-t-sm">
            {data.map(({ _source, _id = '' }) => (
              <ExploreSearchCard
                showEntityIcon
                actionPopoverContent={
                  isRemovable && permissions.EditAll ? (
                    <Dropdown
                      align={{ targetOffset: [-12, 0] }}
                      dropdownRender={renderDropdownContainer}
                      menu={{ items }}
                      overlayClassName="manage-dropdown-list-container"
                      overlayStyle={{ width: '350px' }}
                      placement="bottomRight"
                      trigger={['click']}>
                      <Tooltip
                        placement="topRight"
                        title={t('label.manage-entity', {
                          entity: t('label.asset'),
                        })}>
                        <Button
                          className={classNames('flex-center px-1.5')}
                          data-testid={`manage-button-${_source.fullyQualifiedName}`}
                          type="text">
                          <IconDropdown className="anticon self-center manage-dropdown-icon" />
                        </Button>
                      </Tooltip>
                    </Dropdown>
                  ) : null
                }
                checked={selectedItems?.has(_source.id ?? '')}
                className={classNames(
                  'm-b-sm cursor-pointer',
                  selectedCard?.id === _source.id ? 'highlight-card' : ''
                )}
                handleSummaryPanelDisplay={setSelectedCard}
                id={_id}
                key={'assets_' + _id}
                showCheckboxes={Boolean(activeEntity) && permissions.Create}
                showTags={false}
                source={_source}
                onCheckboxChange={(selected) =>
                  handleCheckboxChange(selected, _source)
                }
              />
            ))}
            {showPagination && (
              <NextPrevious
                isNumberBased
                currentPage={currentPage}
                pageSize={pageSize}
                paging={paging}
                pagingHandler={({ currentPage }: PagingHandlerParams) =>
                  handlePageChange(currentPage)
                }
                onShowSizeChange={handlePageSizeChange}
              />
            )}
          </div>
        ) : (
          <div className="m-t-xlg">{assetErrorPlaceHolder}</div>
        ),
      [
        type,
        data,
        activeEntity,
        permissions,
        paging,
        currentPage,
        selectedCard,
        assetErrorPlaceHolder,
        selectedItems,
        setSelectedCard,
        handlePageChange,
        showPagination,
        handlePageSizeChange,
        handleCheckboxChange,
      ]
    );

    const onSelectAll = (selectAll: boolean) => {
      setSelectedItems((prevItems) => {
        const selectedItemMap = new Map(prevItems ?? []);

        if (selectAll) {
          data.forEach(({ _source }) => {
            const id = _source.id;
            if (id) {
              selectedItemMap.set(id, _source);
            }
          });
        } else {
          // Clear selection
          selectedItemMap.clear();
        }

        return selectedItemMap;
      });
    };

    const assetsHeader = useMemo(() => {
      return (
        <div className="w-full d-flex justify-between items-center p-l-sm">
          {activeEntity && permissions.Create && data.length > 0 && (
            <Checkbox
              className="assets-checkbox p-x-sm"
              onChange={(e) => onSelectAll(e.target.checked)}>
              {t('label.select-field', {
                field: t('label.all'),
              })}
            </Checkbox>
          )}
        </div>
      );
    }, [
      activeFilter,
      activeEntity,
      isLoading,
      data,
      openKeys,
      visible,
      currentPage,
      itemCount,
      onOpenChange,
      handleAssetButtonVisibleChange,
      onSelectAll,
    ]);

    const layout = useMemo(() => {
      return (
        <>
          {assetsHeader}
          {assetListing}
        </>
      );
    }, [assetsHeader, assetListing, selectedCard]);

    const onAssetRemove = useCallback(
      async (assetsData: SourceType[]) => {
        if (!activeEntity) {
          return;
        }

        setAssetRemoving(true);

        try {
          const entities = [...(assetsData?.values() ?? [])].map((item) => {
            return getEntityReferenceFromEntity(
              item as EntityDetailUnion,
              (item as EntityDetailUnion).entityType
            );
          });

          switch (type) {
            case AssetsOfEntity.DATA_PRODUCT:
              await removeAssetsFromDataProduct(
                activeEntity.fullyQualifiedName ?? '',
                entities
              );

              break;

            case AssetsOfEntity.GLOSSARY:
              await removeAssetsFromGlossaryTerm(
                activeEntity as GlossaryTerm,
                entities
              );

              break;

            case AssetsOfEntity.DOMAIN:
              await removeAssetsFromDomain(
                activeEntity.fullyQualifiedName ?? '',
                entities
              );

              break;
            default:
              // Handle other entity types here
              break;
          }

          await new Promise((resolve) => {
            setTimeout(() => {
              resolve('');
            }, ES_UPDATE_DELAY);
          });
        } catch (err) {
          showErrorToast(err as AxiosError);
        } finally {
          setShowDeleteModal(false);
          onRemoveAsset?.();
          setAssetRemoving(false);
          hideNotification();
          setSelectedItems(new Map()); // Reset selected items
        }
      },
      [type, activeEntity, entityFqn]
    );

    const clearFilters = useCallback(() => {
      setQuickFilterQuery(undefined);
      setSelectedQuickFilters((pre) => {
        const data = pre.map((preField) => {
          return { ...preField, value: [] };
        });

        handleQuickFiltersChange(data);

        return data;
      });
    }, [
      setQuickFilterQuery,
      handleQuickFiltersChange,
      setSelectedQuickFilters,
    ]);

    useEffect(() => {
      fetchAssets({
        index: isEmpty(activeFilter) ? [SearchIndex.ALL] : activeFilter,
        page: currentPage,
      });
    }, [activeFilter, currentPage, pageSize, searchValue, quickFilterQuery]);

    useEffect(() => {
      const dropdownItems = getAssetsPageQuickFilters(type);

      setFilters(
        dropdownItems.map((item) => ({
          ...item,
          value: getSelectedValuesFromQuickFilter(
            item,
            dropdownItems,
            undefined // pass in state variable
          ),
        }))
      );
    }, [type]);

    useEffect(() => {
      const updatedQuickFilters = filters
        .filter((filter) => selectedFilter.includes(filter.key))
        .map((selectedFilterItem) => {
          const originalFilterItem = selectedQuickFilters?.find(
            (filter) => filter.key === selectedFilterItem.key
          );

          return originalFilterItem || selectedFilterItem;
        });

      const newItems = updatedQuickFilters.filter(
        (item) =>
          !selectedQuickFilters.some(
            (existingItem) => item.key === existingItem.key
          )
      );

      if (newItems.length > 0) {
        setSelectedQuickFilters((prevSelected) => [
          ...prevSelected,
          ...newItems,
        ]);
      }
    }, [selectedFilter, selectedQuickFilters, filters]);

    useImperativeHandle(ref, () => ({
      refreshAssets() {
        // Reset page to one and trigger fetchAssets
        handlePageChange(1);
        // If current page is already 1 it won't trigger fetchAset from useEffect
        // Hence need to manually trigger it for this case
        currentPage === 1 &&
          fetchAssets({
            index: isEmpty(activeFilter) ? [SearchIndex.ALL] : activeFilter,
            page: 1,
          });
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

    return (
      <>
        <div
          className={classNames('assets-tab-container p-md relative')}
          data-testid="table-container"
          id="asset-tab">
          {assetCount > 0 && (
            <Row className="filters-row gap-2 p-l-lg">
              <Col span={18}>
                <div className="d-flex items-center gap-3">
                  <Dropdown
                    menu={{
                      items: filterMenu,
                      selectedKeys: selectedFilter,
                    }}
                    trigger={['click']}>
                    <Button
                      className="flex-center"
                      icon={<FilterIcon height={16} />}
                    />
                  </Dropdown>
                  <div className="flex-1">
                    <Searchbar
                      removeMargin
                      showClearSearch
                      placeholder={t('label.search-entity', {
                        entity: t('label.asset-plural'),
                      })}
                      searchValue={searchValue}
                      onSearch={setSearchValue}
                    />
                  </div>
                </div>
              </Col>
              <Col className="searched-data-container m-b-xs" span={24}>
                <div className="d-flex justify-between">
                  <ExploreQuickFilters
                    aggregations={aggregations}
                    fields={selectedQuickFilters}
                    index={SearchIndex.ALL}
                    showDeleted={false}
                    onFieldValueSelect={handleQuickFiltersValueSelect}
                  />
                  {quickFilterQuery && (
                    <Typography.Text
                      className="text-primary self-center cursor-pointer"
                      onClick={clearFilters}>
                      {t('label.clear-entity', {
                        entity: '',
                      })}
                    </Typography.Text>
                  )}
                </div>
              </Col>
            </Row>
          )}

          {isLoading || isCountLoading ? (
            <Row className="p-lg" gutter={[0, 16]}>
              <Col span={24}>
                <Skeleton />
              </Col>
              <Col span={24}>
                <Skeleton />
              </Col>
            </Row>
          ) : (
            layout
          )}

          <ConfirmationModal
            bodyText={t('message.are-you-sure-action-property', {
              propertyName: getEntityName(assetToDelete),
              action: t('label.remove-lowercase'),
            })}
            cancelText={t('label.cancel')}
            confirmText={t('label.delete')}
            header={t('label.remove-entity', {
              entity: getEntityName(assetToDelete) + '?',
            })}
            isLoading={assetRemoving}
            visible={showDeleteModal}
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={() =>
              onAssetRemove(assetToDelete ? [assetToDelete] : [])
            }
          />
        </div>
        {!(isLoading || isCountLoading) && (
          <div
            className={classNames('asset-tab-delete-notification', {
              visible: selectedItems.size > 1,
            })}>
            <div className="d-flex items-center justify-between">
              <Typography.Text className="text-white">
                {selectedItems.size} {t('label.items-selected-lowercase')}
              </Typography.Text>
              <Button
                danger
                data-testid="delete-all-button"
                loading={assetRemoving}
                type="primary"
                onClick={deleteSelectedItems}>
                {t('label.delete')}
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }
);

export default AssetsTabs;
