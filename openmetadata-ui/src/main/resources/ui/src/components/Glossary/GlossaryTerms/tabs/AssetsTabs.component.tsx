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
  Alert,
  Button,
  Checkbox,
  Col,
  Dropdown,
  MenuProps,
  notification,
  Row,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isObject } from 'lodash';
import { EntityDetailUnion } from 'Models';
import {
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../../../assets/svg/folder-empty.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/ic-feeds-filter.svg';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/ic-no-records.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { ASSET_MENU_KEYS } from '../../../../constants/Assets.constants';
import { ES_UPDATE_DELAY } from '../../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Tag } from '../../../../generated/entity/classification/tag';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../generated/entity/domains/domain';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { Aggregations } from '../../../../interface/search.interface';
import { QueryFilterInterface } from '../../../../pages/ExplorePage/ExplorePage.interface';
import {
  getDataProductByName,
  getDataProductOutputPorts,
  removeAssetsFromDataProduct,
  removePortsFromDataProduct,
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
import { getTagByFqn, removeAssetsFromTags } from '../../../../rest/tagAPI';
import { getAssetsPageQuickFilters } from '../../../../utils/AdvancedSearchUtils';
import { getEntityTypeString } from '../../../../utils/Assets/AssetsUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../utils/EntityUtils';
import { getCombinedQueryFilterObject } from '../../../../utils/ExplorePage/ExplorePageUtils';
import {
  getAggregations,
  getQuickFilterQuery,
} from '../../../../utils/ExploreUtils';
import { translateWithNestedKeys } from '../../../../utils/i18next/LocalUtil';
import { getTermQuery } from '../../../../utils/SearchUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../utils/StringsUtils';
import { getTagAssetsQueryFilter } from '../../../../utils/TagsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
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
      preloadedData,
      skipSearch = false,
    }: AssetsTabsProps,
    ref
  ) => {
    const [assetRemoving, setAssetRemoving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<SearchedDataProps['data']>([]);
    const [quickFilterQuery, setQuickFilterQuery] =
      useState<QueryFilterInterface>();
    const { t } = useTranslation();
    const [totalAssetCount, setTotalAssetCount] = useState<number>(
      assetCount ?? 0
    );

    const {
      currentPage,
      pageSize,
      paging,
      handlePageChange,
      handlePageSizeChange,
      handlePagingChange,
    } = usePaging();

    const isRemovable = useMemo(
      () =>
        [
          AssetsOfEntity.DATA_PRODUCT,
          AssetsOfEntity.DATA_PRODUCT_INPUT_PORT,
          AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT,
          AssetsOfEntity.DOMAIN,
          AssetsOfEntity.GLOSSARY,
          AssetsOfEntity.TAG,
        ].includes(type),
      [type]
    );

    const [selectedCard, setSelectedCard] = useState<SourceType>();
    const [visible, setVisible] = useState<boolean>(false);
    const [openKeys, setOpenKeys] = useState<EntityType[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<SourceType>();
    const [activeEntity, setActiveEntity] = useState<
      Domain | DataProduct | GlossaryTerm | Tag
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
    const [outputPortsFqns, setOutputPortsFqns] = useState<Set<string>>(
      new Set()
    );
    const [confirmationBodyText, setConfirmationBodyText] =
      useState<ReactNode>('');
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

    const entityTypeString = getEntityTypeString(type);

    const handleMenuClick = ({ key }: { key: string }) => {
      setSelectedFilter((prevSelected) => [...prevSelected, key]);
    };

    const filterMenu: ItemType[] = useMemo(() => {
      return filters.map((filter) => ({
        key: filter.key,
        label: translateWithNestedKeys(filter.label, filter.labelKeyOptions),
        onClick: handleMenuClick,
      }));
    }, [filters]);

    const queryParam = useMemo(() => {
      const encodedFqn = getEncodedFqn(escapeESReservedCharacters(entityFqn));
      switch (type) {
        case AssetsOfEntity.DOMAIN:
          return (
            queryFilter ??
            getTermQuery(
              { 'domains.fullyQualifiedName': entityFqn ?? '' },
              'must',
              undefined,
              {
                mustNotTerms: { entityType: 'dataProduct' },
              }
            )
          );
        case AssetsOfEntity.DATA_PRODUCT:
          return getTermQuery({
            'dataProducts.fullyQualifiedName': entityFqn ?? '',
          });

        case AssetsOfEntity.DATA_PRODUCT_INPUT_PORT:
        case AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT:
          // Use the provided queryFilter (which filters by specific port FQNs)
          // Fall back to default data product query if no filter provided
          return (
            queryFilter ??
            getTermQuery({
              'dataProducts.fullyQualifiedName': entityFqn ?? '',
            })
          );

        case AssetsOfEntity.TEAM:
        case AssetsOfEntity.MY_DATA:
        case AssetsOfEntity.FOLLOWING:
          return queryFilter ?? undefined;

        case AssetsOfEntity.GLOSSARY:
          return getTermQuery({ 'tags.tagFQN': entityFqn ?? '' });

        case AssetsOfEntity.TAG:
          return getTagAssetsQueryFilter(entityFqn ?? '');

        default:
          return getTagAssetsQueryFilter(encodedFqn);
      }
    }, [type, entityFqn, queryFilter]);

    const fetchAssets = useCallback(
      async ({
        index = [SearchIndex.ALL],
        page = currentPage,
        queryFilter,
      }: {
        index?: SearchIndex[];
        page?: number;
        queryFilter?: QueryFilterInterface;
      }) => {
        if (skipSearch && preloadedData) {
          setData(preloadedData);
          handlePagingChange({ total: assetCount ?? preloadedData.length });
          setIsLoading(false);
          if (preloadedData[0]) {
            setSelectedCard(preloadedData[0]._source);
          } else {
            setSelectedCard(undefined);
          }

          return;
        }

        try {
          setIsLoading(true);

          // Merge queryParam (entity-specific filter) with queryFilter (quick filters)
          // If no quickFilter, just use the entity filter (queryParam)
          const finalQueryFilter = queryFilter
            ? getCombinedQueryFilterObject(
                queryParam as unknown as QueryFilterInterface,
                queryFilter
              )
            : queryParam;

          const res = await searchQuery({
            pageNumber: page,
            pageSize: pageSize,
            searchIndex: index,
            query: `*${searchValue}*`,
            queryFilter: finalQueryFilter as Record<string, unknown>,
          });
          const hits = res.hits.hits as SearchedDataProps['data'];
          handlePagingChange({ total: res.hits.total.value ?? 0 });
          setData(hits);
          setAggregations(getAggregations(res?.aggregations));
          if (assetCount === undefined) {
            setTotalAssetCount(res.hits.total.value ?? 0);
          }
          if (hits[0]) {
            setSelectedCard(hits[0]._source);
          } else {
            setSelectedCard(undefined);
          }
        } catch {
          // Nothing here
        } finally {
          setIsLoading(false);
        }
      },
      [
        currentPage,
        pageSize,
        searchValue,
        queryParam,
        assetCount,
        skipSearch,
        preloadedData,
      ]
    );

    const hideNotification = () => {
      notification.close('asset-tab-notification-key');
    };

    const onOpenChange: MenuProps['onOpenChange'] = (keys) => {
      const latestOpenKey = keys.find(
        (key) => !openKeys.includes(key as EntityType)
      );
      if (ASSET_MENU_KEYS.includes(latestOpenKey as EntityType)) {
        setOpenKeys(latestOpenKey ? [latestOpenKey as EntityType] : []);
      } else {
        setOpenKeys(keys as EntityType[]);
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
        case AssetsOfEntity.DATA_PRODUCT_INPUT_PORT:
        case AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT:
          data = await getDataProductByName(fqn, {
            fields: [TabSpecificField.DOMAINS, TabSpecificField.ASSETS],
          });

          break;
        case AssetsOfEntity.GLOSSARY:
          data = await getGlossaryTermByFQN(fqn);

          break;

        case AssetsOfEntity.TAG:
          data = await getTagByFqn(fqn);

          break;
        default:
          break;
      }

      setActiveEntity(data);
    }, [type, entityFqn]);

    const fetchOutputPorts = useCallback(async () => {
      // Clear stale state first to prevent false positives when switching data products
      setOutputPortsFqns(new Set());

      if (type !== AssetsOfEntity.DATA_PRODUCT || !entityFqn) {
        return;
      }
      try {
        const response = await getDataProductOutputPorts(entityFqn, {
          limit: 1000,
        });
        const fqnSet = new Set<string>();
        response.data.forEach((port) => {
          if (port.fullyQualifiedName) {
            fqnSet.add(port.fullyQualifiedName as string);
          }
        });
        setOutputPortsFqns(fqnSet);
      } catch {
        // Silently fail - warning will just not show (state already cleared)
      }
    }, [type, entityFqn]);

    const getAssetsInOutputPorts = useCallback(
      (assets: SourceType[]): SourceType[] => {
        if (
          type !== AssetsOfEntity.DATA_PRODUCT ||
          outputPortsFqns.size === 0
        ) {
          return [];
        }

        return assets.filter(
          (asset) =>
            asset.fullyQualifiedName &&
            outputPortsFqns.has(asset.fullyQualifiedName)
        );
      },
      [type, outputPortsFqns]
    );

    const getRemovalWarningContent = useCallback(
      (assetsToRemove: SourceType[]): ReactNode => {
        const assetsInOutputPorts = getAssetsInOutputPorts(assetsToRemove);

        const baseMessage =
          assetsToRemove.length === 1
            ? t('message.are-you-sure-action-property', {
                propertyName: getEntityName(assetsToRemove[0]),
                action: t('label.remove-lowercase'),
              })
            : t('message.are-you-sure-action-property', {
                propertyName: `${assetsToRemove.length} ${t(
                  'label.asset-plural-lowercase'
                )}`,
                action: t('label.remove-lowercase'),
              });

        if (assetsInOutputPorts.length === 0) {
          return baseMessage;
        }

        return (
          <>
            <Typography.Text>{baseMessage}</Typography.Text>
            <Alert
              showIcon
              className="m-t-sm"
              description={
                assetsInOutputPorts.length > 1 || assetsToRemove.length > 1 ? (
                  <ul className="m-b-0 p-l-md">
                    {assetsInOutputPorts.map((asset) => (
                      <li key={asset.id}>{getEntityName(asset)}</li>
                    ))}
                  </ul>
                ) : undefined
              }
              message={
                assetsInOutputPorts.length === 1 && assetsToRemove.length === 1
                  ? t('message.remove-asset-will-also-remove-from-output-ports')
                  : t('message.remove-asset-output-port-warning')
              }
              type="warning"
            />
          </>
        );
      },
      [getAssetsInOutputPorts, t]
    );

    const onExploreCardDelete = useCallback(
      (source: SourceType) => {
        setAssetToDelete(source);
        setConfirmationBodyText(getRemovalWarningContent([source]));
        setShowDeleteModal(true);
      },
      [getRemovalWarningContent]
    );

    const items: ItemType[] = [
      {
        label: (
          <ManageButtonItemLabel
            description={t('message.delete-asset-from-entity-type', {
              entityType: entityTypeString,
            })}
            icon={DeleteIcon}
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

            case AssetsOfEntity.DATA_PRODUCT_INPUT_PORT:
            case AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT:
              await removePortsFromDataProduct(
                activeEntity.fullyQualifiedName ?? '',
                entities,
                type
              );

              break;

            case AssetsOfEntity.GLOSSARY:
              await removeAssetsFromGlossaryTerm(
                activeEntity as GlossaryTerm,
                entities
              );

              break;

            case AssetsOfEntity.TAG:
              await removeAssetsFromTags(activeEntity.id ?? '', entities);

              break;

            case AssetsOfEntity.DOMAIN:
              await removeAssetsFromDomain(
                activeEntity.fullyQualifiedName ?? '',
                entities
              );

              break;
            default:
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
          if (type === AssetsOfEntity.DATA_PRODUCT) {
            fetchOutputPorts();
          }
        }
      },
      [type, activeEntity, entityFqn, fetchOutputPorts]
    );

    const deleteSelectedItems = useCallback(() => {
      if (selectedItems) {
        onAssetRemove(Array.from(selectedItems.values()));
      }
    }, [selectedItems]);

    const handleBulkDeleteClick = useCallback(() => {
      const assetsToDelete = Array.from(
        selectedItems.values()
      ) as unknown as SourceType[];
      const assetsInOutputPorts = getAssetsInOutputPorts(assetsToDelete);

      if (assetsInOutputPorts.length > 0) {
        setConfirmationBodyText(getRemovalWarningContent(assetsToDelete));
        setShowBulkDeleteModal(true);
      } else {
        deleteSelectedItems();
      }
    }, [
      selectedItems,
      getAssetsInOutputPorts,
      getRemovalWarningContent,
      deleteSelectedItems,
    ]);

    const confirmBulkDelete = useCallback(() => {
      setShowBulkDeleteModal(false);
      deleteSelectedItems();
    }, [deleteSelectedItems]);

    useEffect(() => {
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

    useEffect(() => {
      fetchOutputPorts();
    }, [fetchOutputPorts]);

    const assetErrorPlaceHolder = useMemo(() => {
      if (isObject(noDataPlaceholder) || searchValue) {
        return (
          <ErrorPlaceHolderNew
            className="p-lg "
            icon={
              <AddPlaceHolderIcon
                className="text-grey-14"
                height={140}
                width={140}
              />
            }>
            {searchValue && type !== AssetsOfEntity.MY_DATA && (
              <div className="gap-4">
                <Typography.Paragraph>
                  {t('label.no-matching-data-asset')}
                </Typography.Paragraph>
              </div>
            )}
            {isObject(noDataPlaceholder) && (
              <div className="gap-4">
                <Typography.Paragraph>
                  {noDataPlaceholder.message}
                </Typography.Paragraph>
              </div>
            )}
          </ErrorPlaceHolderNew>
        );
      } else {
        return (
          <ErrorPlaceHolder
            buttonId="data-assets-add-button"
            buttonTitle={t('label.add-entity', { entity: t('label.asset') })}
            className="border-none"
            heading={t('message.no-data-message', {
              entity: t('label.data-asset-lowercase-plural'),
            })}
            icon={<FolderEmptyIcon />}
            permission={permissions.Create}
            type={ERROR_PLACEHOLDER_TYPE.MUI_CREATE}
            onClick={onAddAsset}
          />
        );
      }
    }, [
      searchValue,
      noDataPlaceholder,
      permissions,
      onAddAsset,
      isEntityDeleted,
    ]);

    const renderDropdownContainer = useCallback((menus: ReactNode) => {
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
          <div className="assets-data-container">
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
                  'cursor-pointer',
                  selectedCard?.id === _source.id ? 'highlight-card' : ''
                )}
                handleSummaryPanelDisplay={setSelectedCard}
                id={_id}
                key={'assets_' + _id}
                searchValue={searchValue}
                showCheckboxes={Boolean(activeEntity) && permissions.Create}
                showTags={false}
                source={_source}
                onCheckboxChange={(selected) =>
                  handleCheckboxChange(selected, _source)
                }
              />
            ))}
            <NextPrevious
              isNumberBased
              currentPage={currentPage}
              isLoading={isLoading}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={({ currentPage }: PagingHandlerParams) =>
                handlePageChange(currentPage)
              }
              onShowSizeChange={handlePageSizeChange}
            />
          </div>
        ) : (
          <div className="h-full">{assetErrorPlaceHolder}</div>
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
        handlePageSizeChange,
        handleCheckboxChange,
      ]
    );

    const onSelectAll = (selectAll: boolean) => {
      setSelectedItems((prevItems) => {
        const selectedItemMap = new Map(prevItems ?? []);

        if (selectAll) {
          for (const { _source } of data) {
            const id = _source.id;
            if (id) {
              selectedItemMap.set(id, _source);
            }
          }
        } else {
          // Clear selection
          selectedItemMap.clear();
        }

        return selectedItemMap;
      });
    };

    const assetsHeader = useMemo(() => {
      return (
        activeEntity &&
        permissions.Create &&
        data.length > 0 && (
          <div className="w-full d-flex justify-between items-center m-b-sm">
            <Checkbox
              className="assets-checkbox p-x-sm"
              onChange={(e) => onSelectAll(e.target.checked)}>
              {t('label.select-field', {
                field: t('label.all'),
              })}
            </Checkbox>
          </div>
        )
      );
    }, [
      activeEntity,
      isLoading,
      data,
      openKeys,
      visible,
      currentPage,
      onOpenChange,
      handleAssetButtonVisibleChange,
      onSelectAll,
    ]);

    const layout = useMemo(() => {
      return (
        <Col span={24}>
          {assetsHeader}
          {assetListing}
        </Col>
      );
    }, [assetsHeader, assetListing, selectedCard]);

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
        index: [SearchIndex.ALL],
        page: currentPage,
        queryFilter: quickFilterQuery,
      });
    }, [fetchAssets, currentPage, quickFilterQuery]);

    useEffect(() => {
      const dropdownItems = getAssetsPageQuickFilters(type);
      setFilters(
        dropdownItems.map((item) => ({
          ...item,
          value: [],
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

        // If current page is already 1 it won't trigger fetchAssets from useEffect
        // Hence need to manually trigger it for this case
        if (currentPage === 1) {
          fetchAssets({
            index: [SearchIndex.ALL],
            page: 1,
            queryFilter: quickFilterQuery,
          });
        }
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

    useEffect(() => {
      if (assetCount !== undefined) {
        setTotalAssetCount(assetCount);
      }
    }, [assetCount]);

    return (
      <>
        <div
          className={classNames(
            'assets-tab-container relative bg-white border-radius-card h-full'
          )}
          data-testid="table-container"
          id="asset-tab">
          <Row
            className={classNames('filters-row gap-2 p-md', {
              'h-full': totalAssetCount === 0,
            })}
            gutter={[0, 20]}>
            {(type === AssetsOfEntity.MY_DATA || totalAssetCount > 0) && (
              <>
                <Col className="d-flex gap-3" span={24}>
                  <Dropdown
                    menu={{
                      items: filterMenu,
                      selectedKeys: selectedFilter,
                    }}
                    trigger={['click']}>
                    <Button
                      className={classNames('feed-filter-icon')}
                      data-testid="asset-filter-button"
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
                </Col>
                {selectedFilter.length > 0 && (
                  <Col className="searched-data-container" span={24}>
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
                )}
              </>
            )}
            {isLoading ? (
              <Col className="border-default border-radius-sm p-lg" span={24}>
                <Space
                  className="w-full"
                  data-testid="loader"
                  direction="vertical"
                  size={16}>
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                </Space>
              </Col>
            ) : (
              layout
            )}
          </Row>

          <ConfirmationModal
            bodyText={confirmationBodyText}
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

          <ConfirmationModal
            bodyText={confirmationBodyText}
            cancelText={t('label.cancel')}
            confirmText={t('label.delete')}
            header={t('label.remove-entity', {
              entity: `${selectedItems.size} ${t(
                'label.asset-plural-lowercase'
              )}?`,
            })}
            isLoading={assetRemoving}
            visible={showBulkDeleteModal}
            onCancel={() => setShowBulkDeleteModal(false)}
            onConfirm={confirmBulkDelete}
          />
        </div>
        {!isLoading && permissions?.EditAll && totalAssetCount > 0 && (
          <div
            className={classNames('asset-tab-delete-notification', {
              visible: selectedItems.size > 0,
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
                onClick={handleBulkDeleteClick}>
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
