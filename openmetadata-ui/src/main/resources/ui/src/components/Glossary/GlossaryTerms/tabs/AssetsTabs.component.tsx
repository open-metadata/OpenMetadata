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
  Box,
  Button,
  ButtonUtility,
  Checkbox,
  Dropdown,
  Grid,
  SkeletonParagraph,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isObject } from 'lodash';
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
import { ReactComponent as EmptyAssetIcon } from '../../../../assets/svg/action-icons/empty-asset.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/ic-feeds-filter.svg';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/ic-no-records.svg';
import { ES_UPDATE_DELAY } from '../../../../constants/constants';
import { AssetsOfEntity } from '../../../../enums/Assets.enum';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Tag } from '../../../../generated/entity/classification/tag';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../../generated/entity/data/metric';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../generated/entity/domains/domain';
import { Response as BulkResponse } from '../../../../generated/type/bulkOperationResult';
import { EntityReference } from '../../../../generated/type/entityReference';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { Aggregations } from '../../../../interface/search.interface';
import { QueryFilterInterface } from '../../../../pages/ExplorePage/ExplorePage.interface';
import { queryClient } from '../../../../queryClient';
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
import { getMetricByFqn } from '../../../../rest/metricsAPI';
import { removeMetricTabAssets } from '../../../../rest/metricTabsAPI';
import { domainAssetsCountQueryKey } from '../../../../rest/queries/domainQuery';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTagByFqn, removeAssetsFromTags } from '../../../../rest/tagAPI';
import { getAssetsPageQuickFilters } from '../../../../utils/AdvancedSearchPureUtils';
import { getEntityTypeString } from '../../../../utils/Assets/AssetsUtils';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { getDomainDryRunImpacts } from '../../../../utils/Domain/DomainDryRunUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import { getCombinedQueryFilterObject } from '../../../../utils/ExplorePage/ExplorePageUtils';
import {
  getAggregations,
  getQuickFilterQuery,
} from '../../../../utils/ExplorePureUtils';
import { translateWithNestedKeys } from '../../../../utils/i18next/LocalUtil';
import { getMetricAssetsQueryFilter } from '../../../../utils/MetricEntityUtils/MetricPureUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { getTermQuery } from '../../../../utils/SearchPureUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../utils/StringUtils';
import { getTagAssetsQueryFilter } from '../../../../utils/TagsPureUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import CreatePlaceholder from '../../../common/EmptyPlaceholder/CreatePlaceholder';
import {
  ManageMenu,
  ManageMenuItem,
} from '../../../common/EntityPageInfos/ManageButton/ManageMenu';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import { ManageButtonItemLabel } from '../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import DomainAssetDryRunModal from '../../../DataAssets/DomainAssetDryRunModal/DomainAssetDryRunModal.component';
import { ExploreQuickFilterField } from '../../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../../Explore/ExploreQuickFilters';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import {
  SearchedDataProps,
  SourceType,
} from '../../../SearchedData/SearchedData.interface';
import './assets-tabs.less';
import { AssetsTabsProps } from './AssetsTabs.interface';

type AssetsTabEntity = Domain | DataProduct | GlossaryTerm | Tag | Metric;

export interface AssetsTabRef {
  refreshAssets: () => void;
  closeSummaryPanel: () => void;
}

const checkDomainDryRunImpacts = async (
  activeEntity: AssetsTabEntity,
  entities: EntityReference[]
): Promise<BulkResponse[] | undefined> => {
  const dryRunResult = await removeAssetsFromDomain(
    activeEntity.fullyQualifiedName ?? '',
    entities,
    { dryRun: true }
  );
  const impacts = getDomainDryRunImpacts(dryRunResult);

  return impacts.length > 0 ? impacts : undefined;
};

const removePortsHandler =
  (
    portType:
      | AssetsOfEntity.DATA_PRODUCT_INPUT_PORT
      | AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT
  ) =>
  async (activeEntity: AssetsTabEntity, entities: EntityReference[]) => {
    await removePortsFromDataProduct(
      activeEntity.fullyQualifiedName ?? '',
      entities,
      portType
    );
  };

const removeAssetsHandlers: Partial<
  Record<
    AssetsOfEntity,
    (
      activeEntity: AssetsTabEntity,
      entities: EntityReference[]
    ) => Promise<void>
  >
> = {
  [AssetsOfEntity.DATA_PRODUCT]: async (activeEntity, entities) => {
    await removeAssetsFromDataProduct(
      activeEntity.fullyQualifiedName ?? '',
      entities
    );
  },
  [AssetsOfEntity.DATA_PRODUCT_INPUT_PORT]: removePortsHandler(
    AssetsOfEntity.DATA_PRODUCT_INPUT_PORT
  ),
  [AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT]: removePortsHandler(
    AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT
  ),
  [AssetsOfEntity.GLOSSARY]: async (activeEntity, entities) => {
    await removeAssetsFromGlossaryTerm(activeEntity as GlossaryTerm, entities);
  },
  [AssetsOfEntity.TAG]: async (activeEntity, entities) => {
    await removeAssetsFromTags(activeEntity.id ?? '', entities);
  },
  [AssetsOfEntity.METRIC]: async (activeEntity, entities) => {
    await removeMetricTabAssets(
      activeEntity.fullyQualifiedName ?? '',
      entities
    );
  },
  [AssetsOfEntity.DOMAIN]: async (activeEntity, entities) => {
    await removeAssetsFromDomain(
      activeEntity.fullyQualifiedName ?? '',
      entities
    );
    queryClient.invalidateQueries({
      queryKey: domainAssetsCountQueryKey,
    });
  },
};

const removeAssetsByType = async (
  type: AssetsOfEntity,
  activeEntity: AssetsTabEntity,
  entities: EntityReference[]
) => {
  await removeAssetsHandlers[type]?.(activeEntity, entities);
};

type AssetsQueryFilter = AssetsTabsProps['queryFilter'];

const getPortsQueryParam = (
  entityFqn: string | undefined,
  queryFilter: AssetsQueryFilter
) =>
  queryFilter ??
  getTermQuery({
    'dataProducts.fullyQualifiedName': entityFqn ?? '',
  });

const getFollowedTeamQueryParam = (
  _entityFqn: string | undefined,
  queryFilter: AssetsQueryFilter
) => queryFilter ?? undefined;

const queryParamBuilders: Partial<
  Record<
    AssetsOfEntity,
    (
      entityFqn: string | undefined,
      queryFilter: AssetsQueryFilter
    ) => AssetsQueryFilter | ReturnType<typeof getTermQuery>
  >
> = {
  [AssetsOfEntity.DOMAIN]: (entityFqn, queryFilter) =>
    queryFilter ??
    getTermQuery(
      { 'domains.fullyQualifiedName': entityFqn ?? '' },
      'must',
      undefined,
      {
        mustNotTerms: { entityType: 'dataProduct' },
      }
    ),
  [AssetsOfEntity.DATA_PRODUCT]: (entityFqn) =>
    getTermQuery({
      'dataProducts.fullyQualifiedName': entityFqn ?? '',
    }),
  // Use the provided queryFilter (which filters by specific port FQNs)
  // Fall back to default data product query if no filter provided
  [AssetsOfEntity.DATA_PRODUCT_INPUT_PORT]: getPortsQueryParam,
  [AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT]: getPortsQueryParam,
  [AssetsOfEntity.TEAM]: getFollowedTeamQueryParam,
  [AssetsOfEntity.MY_DATA]: getFollowedTeamQueryParam,
  [AssetsOfEntity.FOLLOWING]: getFollowedTeamQueryParam,
  [AssetsOfEntity.GLOSSARY]: (entityFqn) =>
    getTermQuery({ 'tags.tagFQN': entityFqn ?? '' }),
  [AssetsOfEntity.TAG]: (entityFqn) => getTagAssetsQueryFilter(entityFqn ?? ''),
  // Without the caller's filter of linked asset ids, match nothing rather than every asset.
  [AssetsOfEntity.METRIC]: (_entityFqn, queryFilter) =>
    queryFilter ?? getMetricAssetsQueryFilter([]),
};

interface AssetsFilterBarProps {
  type: AssetsOfEntity;
  totalAssetCount: number;
  filterMenu: { key: string; label: string }[];
  selectedFilter: string[];
  onFilterSelect: (key: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedQuickFilters: ExploreQuickFilterField[];
  aggregations: Aggregations | undefined;
  quickFilterQuery: QueryFilterInterface | undefined;
  onFieldValueSelect: (field: ExploreQuickFilterField) => void;
  onClearFilters: () => void;
}

const AssetsFilterBar = ({
  type,
  totalAssetCount,
  filterMenu,
  selectedFilter,
  onFilterSelect,
  searchValue,
  onSearchChange,
  selectedQuickFilters,
  aggregations,
  quickFilterQuery,
  onFieldValueSelect,
  onClearFilters,
}: AssetsFilterBarProps) => {
  const { t } = useTranslation();

  if (type !== AssetsOfEntity.MY_DATA && totalAssetCount <= 0) {
    return null;
  }

  return (
    <>
      <Grid.Item className="layout-column d-flex gap-3" span={24}>
        <Dropdown.Root>
          <ButtonUtility
            className="tw:size-9"
            color="secondary"
            data-testid="asset-filter-button"
            icon={FilterIcon}
            size="sm"
            tooltip={t('label.filter-plural')}
          />
          <Dropdown.Popover className="tw:w-auto" placement="bottom start">
            <Dropdown.Menu
              aria-label={t('label.filter-plural')}
              selectedKeys={selectedFilter}
              selectionMode="multiple"
              onAction={(key) => onFilterSelect(String(key))}>
              {filterMenu.map((item) => (
                <Dropdown.Item
                  shouldCloseOnSelect
                  id={item.key}
                  key={item.key}
                  label={item.label}
                />
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
        <div className="flex-1">
          <Searchbar
            removeMargin
            showClearSearch
            placeholder={t('label.search-entity', {
              entity: t('label.asset-plural'),
            })}
            searchValue={searchValue}
            onSearch={onSearchChange}
          />
        </div>
      </Grid.Item>
      {selectedFilter.length > 0 && (
        <Grid.Item className="layout-column searched-data-container" span={24}>
          <div className="d-flex justify-between">
            <ExploreQuickFilters
              aggregations={aggregations}
              fields={selectedQuickFilters}
              index={SearchIndex.ALL}
              showDeleted={false}
              onFieldValueSelect={onFieldValueSelect}
            />
            {quickFilterQuery && (
              <Typography
                className="text-primary self-center cursor-pointer"
                onClick={onClearFilters}>
                {t('label.clear-entity', {
                  entity: '',
                })}
              </Typography>
            )}
          </div>
        </Grid.Item>
      )}
    </>
  );
};

interface BulkDeleteNotificationProps {
  isLoading: boolean;
  hasEditAllPermission: boolean;
  totalAssetCount: number;
  selectedItemsCount: number;
  assetRemoving: boolean;
  onBulkDeleteClick: () => void;
}

const BulkDeleteNotification = ({
  isLoading,
  hasEditAllPermission,
  totalAssetCount,
  selectedItemsCount,
  assetRemoving,
  onBulkDeleteClick,
}: BulkDeleteNotificationProps) => {
  const { t } = useTranslation();

  if (isLoading || !hasEditAllPermission || totalAssetCount <= 0) {
    return null;
  }

  return (
    <div
      className={classNames('asset-tab-delete-notification', {
        visible: selectedItemsCount > 0,
      })}>
      <div className="d-flex items-center justify-between">
        <Typography className="text-white">
          {selectedItemsCount} {t('label.items-selected-lowercase')}
        </Typography>
        <Button
          showTextWhileLoading
          color="primary-destructive"
          data-testid="delete-all-button"
          isLoading={assetRemoving}
          onPress={onBulkDeleteClick}>
          {t('label.delete')}
        </Button>
      </div>
    </div>
  );
};

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
      addDisabledMessage,
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
          AssetsOfEntity.METRIC,
        ].includes(type),
      [type]
    );

    const [selectedCard, setSelectedCard] = useState<SourceType>();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<SourceType>();
    const [activeEntity, setActiveEntity] = useState<AssetsTabEntity>();

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
    const [removeDryRunWarnings, setRemoveDryRunWarnings] =
      useState<BulkResponse[]>();
    const [pendingRemoveEntities, setPendingRemoveEntities] =
      useState<EntityReference[]>();

    const entityTypeString = getEntityTypeString(type);

    // Consumer via prop. No `deleted` argument: `isEntityDeleted` is destructured but
    // never referenced anywhere in this file's permission logic (only listed, unused, in
    // a dependency array) — old expressions here read a bare permissions.EditAll with no
    // deleted gating, so getDerivedPermissionFlags defaults to its `deleted = false`.
    const { canEditAll } = useMemo(
      () => getDerivedPermissionFlags(permissions),
      [permissions]
    );

    const handleMenuClick = (key: string) => {
      setSelectedFilter((prevSelected) =>
        prevSelected.includes(key)
          ? prevSelected.filter((selectedKey) => selectedKey !== key)
          : [...prevSelected, key]
      );
    };

    const filterMenu = useMemo(
      () =>
        filters.map((filter) => ({
          key: filter.key,
          label: translateWithNestedKeys(filter.label, filter.labelKeyOptions),
        })),
      [filters]
    );

    const queryParam = useMemo(() => {
      const encodedFqn = getEncodedFqn(escapeESReservedCharacters(entityFqn));
      const builder = queryParamBuilders[type];

      return builder
        ? builder(entityFqn, queryFilter)
        : getTagAssetsQueryFilter(encodedFqn);
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

        case AssetsOfEntity.METRIC:
          data = await getMetricByFqn(fqn);

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
            <Typography>{baseMessage}</Typography>
            <Alert
              showIcon
              className="tw:mt-2"
              data-testid="output-port-removal-warning"
              title={
                assetsInOutputPorts.length === 1 && assetsToRemove.length === 1
                  ? t('message.remove-asset-will-also-remove-from-output-ports')
                  : t('message.remove-asset-output-port-warning')
              }
              variant="warning">
              {assetsInOutputPorts.length > 1 || assetsToRemove.length > 1 ? (
                <ul className="tw:mb-0 tw:list-disc tw:pl-4">
                  {assetsInOutputPorts.map((asset) => (
                    <li key={asset.id}>{getEntityName(asset)}</li>
                  ))}
                </ul>
              ) : undefined}
            </Alert>
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

    const getCardMenuItems = (source: SourceType): ManageMenuItem[] => [
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
        onClick: () => onExploreCardDelete(source),
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
        let dryRunImpactDetected = false;

        try {
          const entities = [...(assetsData?.values() ?? [])].map((item) => {
            return getEntityReferenceFromEntity(
              item as EntityDetailUnion,
              (item as EntityDetailUnion).entityType
            );
          });

          if (type === AssetsOfEntity.DOMAIN) {
            const impacts = await checkDomainDryRunImpacts(
              activeEntity,
              entities
            );
            if (impacts) {
              setRemoveDryRunWarnings(impacts);
              setPendingRemoveEntities(entities);
              dryRunImpactDetected = true;

              return;
            }
          }

          await removeAssetsByType(type, activeEntity, entities);

          await new Promise((resolve) => {
            setTimeout(() => {
              resolve('');
            }, ES_UPDATE_DELAY);
          });
        } catch (err) {
          showErrorToast(err as AxiosError);
        } finally {
          setShowDeleteModal(false);
          setShowBulkDeleteModal(false);
          setAssetRemoving(false);
          if (!dryRunImpactDetected) {
            onRemoveAsset?.();
            setSelectedItems(new Map()); // Reset selected items
            if (type === AssetsOfEntity.DATA_PRODUCT) {
              fetchOutputPorts();
            }
          }
        }
      },
      [type, activeEntity, entityFqn, fetchOutputPorts]
    );

    const confirmDomainAssetRemove = useCallback(async () => {
      if (!activeEntity || !pendingRemoveEntities) {
        return;
      }
      setAssetRemoving(true);
      try {
        await removeAssetsFromDomain(
          activeEntity.fullyQualifiedName ?? '',
          pendingRemoveEntities
        );
        queryClient.invalidateQueries({ queryKey: domainAssetsCountQueryKey });
        setRemoveDryRunWarnings(undefined);
        setPendingRemoveEntities(undefined);
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve('');
          }, ES_UPDATE_DELAY);
        });
        onRemoveAsset?.();
        setSelectedItems(new Map());
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setAssetRemoving(false);
      }
    }, [activeEntity, pendingRemoveEntities, onRemoveAsset]);

    const cancelDomainAssetRemove = useCallback(() => {
      setRemoveDryRunWarnings(undefined);
      setPendingRemoveEntities(undefined);
    }, []);

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
                <Typography as="p">
                  {t('label.no-matching-data-asset')}
                </Typography>
              </div>
            )}
            {isObject(noDataPlaceholder) && (
              <div className="gap-4">
                <Typography as="p">{noDataPlaceholder.message}</Typography>
              </div>
            )}
          </ErrorPlaceHolderNew>
        );
      } else {
        return (
          <CreatePlaceholder
            actions={
              permissions.Create && !addDisabledMessage
                ? [
                    {
                      key: 'add-asset',
                      id: 'data-assets-add-button',
                      label: t('label.add-entity', {
                        entity: t('label.asset'),
                      }),
                      color: 'primary',
                      onPress: onAddAsset,
                    },
                  ]
                : undefined
            }
            description={
              addDisabledMessage ??
              t('message.link-assets-description', {
                entity: getEntityTypeString(type),
              })
            }
            icon={<EmptyAssetIcon className="tw:text-utility-brand-600" />}
            title={t('label.no-assets-linked-yet')}
          />
        );
      }
    }, [
      searchValue,
      noDataPlaceholder,
      addDisabledMessage,
      permissions,
      onAddAsset,
      isEntityDeleted,
    ]);

    const handleQuickFiltersChange = useCallback(
      (data: ExploreQuickFilterField[]) => {
        setQuickFilterQuery(getQuickFilterQuery(data));
      },
      []
    );

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
      [handleQuickFiltersChange]
    );

    const assetListing = useMemo(
      () =>
        data.length ? (
          <div className="assets-data-container">
            {data.map(({ _source, _id = '', highlight }) => (
              <ExploreSearchCard
                showEntityIcon
                actionPopoverContent={
                  isRemovable && canEditAll ? (
                    <ManageMenu
                      data-testid={`manage-button-${_source.fullyQualifiedName}`}
                      items={getCardMenuItems(_source)}
                      label={t('label.manage-entity', {
                        entity: t('label.asset'),
                      })}
                    />
                  ) : null
                }
                checked={selectedItems?.has(_source.id ?? '')}
                className={classNames(
                  'cursor-pointer',
                  selectedCard?.id === _source.id ? 'highlight-card' : ''
                )}
                handleSummaryPanelDisplay={setSelectedCard}
                highlight={highlight}
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
          <div className="h-full tw:relative tw:min-h-90">
            {assetErrorPlaceHolder}
          </div>
        ),
      [
        type,
        data,
        activeEntity,
        permissions,
        canEditAll,
        paging,
        currentPage,
        selectedCard,
        assetErrorPlaceHolder,
        selectedItems,
        setSelectedCard,
        onExploreCardDelete,
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
              className="tw:px-2"
              data-testid="select-all-assets"
              label={t('label.select-field', {
                field: t('label.all'),
              })}
              onChange={onSelectAll}
            />
          </div>
        )
      );
    }, [activeEntity, isLoading, data, currentPage, onSelectAll]);

    const layout = useMemo(() => {
      return (
        <Grid.Item className="layout-column" span={24}>
          {assetsHeader}
          {assetListing}
        </Grid.Item>
      );
    }, [assetsHeader, assetListing, selectedCard]);

    const clearFilters = useCallback(() => {
      setQuickFilterQuery(undefined);
      setSelectedFilter([]);
      setSelectedQuickFilters([]);
    }, []);

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
      const retainedFilters = selectedQuickFilters.filter((field) =>
        selectedFilter.includes(field.key)
      );
      const newFilters = filters.filter(
        (filter) =>
          selectedFilter.includes(filter.key) &&
          !retainedFilters.some((field) => field.key === filter.key)
      );

      if (
        newFilters.length > 0 ||
        retainedFilters.length !== selectedQuickFilters.length
      ) {
        const updatedQuickFilters = [...retainedFilters, ...newFilters];
        setSelectedQuickFilters(updatedQuickFilters);

        const removedFilterHadValue = selectedQuickFilters.some(
          (field) =>
            !selectedFilter.includes(field.key) && !isEmpty(field.value)
        );
        if (removedFilterHadValue) {
          handleQuickFiltersChange(updatedQuickFilters);
        }
      }
    }, [
      selectedFilter,
      selectedQuickFilters,
      filters,
      handleQuickFiltersChange,
    ]);

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
          <Grid
            className={`layout-row layout-grid ${classNames(
              'filters-row gap-2 p-md',
              {
                'h-full': totalAssetCount === 0,
              }
            )}`}
            style={{ ...getLayoutGutter(0, 20) }}>
            <AssetsFilterBar
              aggregations={aggregations}
              filterMenu={filterMenu}
              quickFilterQuery={quickFilterQuery}
              searchValue={searchValue}
              selectedFilter={selectedFilter}
              selectedQuickFilters={selectedQuickFilters}
              totalAssetCount={totalAssetCount}
              type={type}
              onClearFilters={clearFilters}
              onFieldValueSelect={handleQuickFiltersValueSelect}
              onFilterSelect={handleMenuClick}
              onSearchChange={setSearchValue}
            />
            {isLoading ? (
              <Grid.Item
                className="layout-column border-default border-radius-sm p-lg"
                span={24}>
                <Box
                  inline
                  align="stretch"
                  className="layout-space w-full"
                  data-testid="loader"
                  direction="col"
                  gap={4}
                  itemClassName="layout-space-item">
                  <SkeletonParagraph animation={false} />
                  <SkeletonParagraph animation={false} />
                  <SkeletonParagraph animation={false} />
                </Box>
              </Grid.Item>
            ) : (
              layout
            )}
          </Grid>

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

          <DomainAssetDryRunModal
            confirmText={t('label.remove-anyway')}
            header={t('label.confirm-asset-remove')}
            isLoading={assetRemoving}
            visible={removeDryRunWarnings !== undefined}
            warnings={removeDryRunWarnings ?? []}
            warningsTestId="remove-dry-run-warnings"
            onCancel={cancelDomainAssetRemove}
            onConfirm={confirmDomainAssetRemove}
          />
        </div>
        <BulkDeleteNotification
          assetRemoving={assetRemoving}
          hasEditAllPermission={canEditAll}
          isLoading={isLoading}
          selectedItemsCount={selectedItems.size}
          totalAssetCount={totalAssetCount}
          onBulkDeleteClick={handleBulkDeleteClick}
        />
      </>
    );
  }
);

export default AssetsTabs;
