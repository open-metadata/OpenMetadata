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

import { FilterOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Badge,
  Button,
  Checkbox,
  Col,
  Dropdown,
  Menu,
  MenuProps,
  notification,
  Popover,
  Row,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { t } from 'i18next';
import { isEmpty, isObject, isString, noop } from 'lodash';
import { EntityDetailUnion } from 'Models';
import Qs from 'qs';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/add-placeholder.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import {
  AssetsFilterOptions,
  ASSET_MENU_KEYS,
  ASSET_SUB_MENU_FILTER,
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
import { Aggregations } from '../../../../interface/search.interface';
import {
  getDataProductByName,
  patchDataProduct,
} from '../../../../rest/dataProductAPI';
import { getDomainByName } from '../../../../rest/domainAPI';
import {
  getGlossaryTermByFQN,
  removeAssetsFromGlossaryTerm,
} from '../../../../rest/glossaryAPI';
import { searchData } from '../../../../rest/miscAPI';
import { getAssetsPageQuickFilters } from '../../../../utils/AdvancedSearchUtils';
import { updateDomainAssets } from '../../../../utils/Assets/AssetsUtils';
import { getCountBadge, Transi18next } from '../../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../utils/EntityUtils';
import {
  getAggregations,
  getSelectedValuesFromQuickFilter,
} from '../../../../utils/Explore.utils';
import { getEntityTypeFromSearchIndex } from '../../../../utils/SearchUtils';
import {
  escapeESReservedCharacters,
  getDecodedFqn,
} from '../../../../utils/StringsUtils';
import { getEntityIcon } from '../../../../utils/TableUtils';
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
      assetCount,
      queryFilter,
      isEntityDeleted = false,
      type = AssetsOfEntity.GLOSSARY,
      noDataPlaceholder,
      entityFqn,
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

    const [selectedItems, setSelectedItems] =
      useState<Map<string, EntityDetailUnion>>();
    const [aggregations, setAggregations] = useState<Aggregations>();
    const [selectedQuickFilters, setSelectedQuickFilters] = useState<
      ExploreQuickFilterField[]
    >([] as ExploreQuickFilterField[]);

    const parsedQueryString = Qs.parse(
      location.search.startsWith('?')
        ? location.search.substr(1)
        : location.search
    );

    const searchQuery = isString(parsedQueryString.search)
      ? parsedQueryString.search
      : '';

    const [searchValue, setSearchValue] = useState(searchQuery);

    const queryParam = useMemo(() => {
      switch (type) {
        case AssetsOfEntity.DOMAIN:
          return `(domain.fullyQualifiedName:"${escapeESReservedCharacters(
            entityFqn
          )}") AND !(entityType:"dataProduct")`;

        case AssetsOfEntity.DATA_PRODUCT:
          return `(dataProducts.fullyQualifiedName:"${escapeESReservedCharacters(
            entityFqn
          )}")`;

        case AssetsOfEntity.TEAM:
          return `(owner.fullyQualifiedName:"${fqn}")`;

        case AssetsOfEntity.MY_DATA:
        case AssetsOfEntity.FOLLOWING:
          return queryFilter ?? '';

        default:
          return `(tags.tagFQN:"${escapeESReservedCharacters(entityFqn)}")`;
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
          const res = await searchData(
            searchValue,
            page,
            pageSize,
            queryParam,
            '',
            '',
            index
          );

          setAggregations(getAggregations(res?.data.aggregations));

          // Extract useful details from the Response
          const totalCount = res?.data?.hits?.total.value ?? 0;
          const hits = res?.data?.hits?.hits;

          // Find EntityType for selected searchIndex
          const entityType = AssetsFilterOptions.find((f) =>
            activeFilter.includes(f.value)
          )?.label;

          // Update states
          handlePagingChange({ total: totalCount });
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
      [activeFilter, currentPage, pageSize, searchValue]
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

    const handleActiveFilter = (key: SearchIndex) => {
      if (activeFilter.includes(key)) {
        setActiveFilter((prev) => prev.filter((item) => item !== key));
      } else {
        setActiveFilter((prev) => [...prev, key]);
      }
    };

    const fetchCurrentEntity = useCallback(async () => {
      let data;
      const fqn = encodeURIComponent(entityFqn ?? '');
      switch (type) {
        case AssetsOfEntity.DOMAIN:
          data = await getDomainByName(fqn, '');

          break;
        case AssetsOfEntity.DATA_PRODUCT:
          data = await getDataProductByName(fqn, 'domain,assets');

          break;
        case AssetsOfEntity.GLOSSARY:
          data = await getGlossaryTermByFQN(getDecodedFqn(fqn));

          break;
        default:
          break;
      }

      setActiveEntity(data);
    }, [type, entityFqn]);

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

    const items: ItemType[] = [
      {
        label: (
          <ManageButtonItemLabel
            description={t('message.delete-asset-from-entity-type', {
              entityType: t('label.glossary-term-lowercase'),
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
        handlePageChange,
        handleActiveFilter,
        setSelectedCard,
        activeFilter,
      ]
    );

    const onExploreCardDelete = useCallback((source: SourceType) => {
      setAssetToDelete(source);
      setShowDeleteModal(true);
    }, []);

    const filteredAssetMenus = useMemo(() => {
      switch (type) {
        case AssetsOfEntity.DOMAIN:
          return ASSET_SUB_MENU_FILTER.filter(
            (item) => item.key !== EntityType.DOMAIN
          );

        case AssetsOfEntity.GLOSSARY:
          return ASSET_SUB_MENU_FILTER.filter(
            (item) => item.key !== EntityType.GOVERN
          );

        default:
          return ASSET_SUB_MENU_FILTER;
      }
    }, [type]);

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

    const subMenuItems = useMemo(() => {
      return filteredAssetMenus.map((option) => ({
        ...getOptions(option),
        children: option.children.map((item) => getOptions(item, true)),
      }));
    }, [filteredAssetMenus, getOptions]);

    const fetchCountsByEntity = async () => {
      try {
        setIsCountLoading(true);
        const res = await searchData(
          '',
          0,
          0,
          queryParam,
          '',
          '',
          SearchIndex.ALL
        );

        const buckets = res.data.aggregations[`sterms#index_count`].buckets;
        const counts: Record<string, number> = {};
        buckets.forEach((item) => {
          if (item) {
            counts[
              getEntityTypeFromSearchIndex(item?.key) ?? EntityType.TABLE
            ] = item.doc_count;
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
      };
    }, []);

    useEffect(() => {
      if (entityFqn) {
        fetchCurrentEntity();
      }
    }, [entityFqn]);

    useEffect(() => {
      if (selectedItems) {
        hideNotification();
        if (selectedItems.size > 1) {
          openNotification();
        }
      }
    }, [selectedItems]);

    const assetErrorPlaceHolder = useMemo(() => {
      if (!isEmpty(activeFilter)) {
        return (
          <ErrorPlaceHolder
            heading={t('label.asset')}
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        );
      } else if (noDataPlaceholder || searchValue) {
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
              {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
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
            <Tooltip
              placement="top"
              title={
                isEntityDeleted
                  ? t('message.this-action-is-not-allowed-for-deleted-entities')
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

    const assetListing = useMemo(
      () =>
        data.length ? (
          <div className="assets-data-container p-t-sm">
            {data.map(({ _source, _id = '' }) => (
              <ExploreSearchCard
                showEntityIcon
                actionPopoverContent={
                  isRemovable && permissions.EditAll && !isEntityDeleted ? (
                    <Dropdown
                      align={{ targetOffset: [-12, 0] }}
                      dropdownRender={renderDropdownContainer}
                      menu={{ items }}
                      overlayClassName="manage-dropdown-list-container"
                      overlayStyle={{ width: '350px' }}
                      placement="bottomRight"
                      trigger={['click']}>
                      <Button
                        className={classNames('flex-center px-1.5')}
                        data-testid="manage-button"
                        title="Manage"
                        type="text">
                        <IconDropdown className="anticon self-center manage-dropdown-icon" />
                      </Button>
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
                showCheckboxes={!isEntityDeleted}
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
        isEntityDeleted,
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
        <Row align="middle" className="w-full p-l-sm" justify="space-between">
          <Col>
            {data.length > 0 && !isEntityDeleted && (
              <Checkbox
                className="assets-checkbox p-x-sm"
                onChange={(e) => onSelectAll(e.target.checked)}>
                {t('label.select-field', {
                  field: t('label.all'),
                })}
              </Checkbox>
            )}
          </Col>
          <Col>
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
                    handlePageChange(1);
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
          </Col>
        </Row>
      );
    }, [
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
      onSelectAll,
      isEntityDeleted,
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

        try {
          let updatedEntity;
          switch (type) {
            case AssetsOfEntity.DATA_PRODUCT:
              const updatedAssets = (
                (activeEntity as DataProduct)?.assets ?? []
              ).filter(
                (asset) => !assetsData.some((item) => item.id === asset.id)
              );

              updatedEntity = {
                ...activeEntity,
                assets: updatedAssets,
              };
              const jsonPatch = compare(activeEntity, updatedEntity);
              const res = await patchDataProduct(
                (activeEntity as DataProduct).id,
                jsonPatch
              );
              setActiveEntity(res);

              break;

            case AssetsOfEntity.GLOSSARY:
              const entities = [...(assetsData?.values() ?? [])].map((item) => {
                return getEntityReferenceFromEntity(
                  item,
                  (item as EntityDetailUnion).entityType
                );
              });
              await removeAssetsFromGlossaryTerm(
                activeEntity as GlossaryTerm,
                entities
              );

              break;

            case AssetsOfEntity.DOMAIN:
              const selectedItemMap = new Map();
              assetsData.forEach((item) => {
                selectedItemMap.set(item.id, item);
              });
              await updateDomainAssets(undefined, type, selectedItemMap);

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
          hideNotification();
          setSelectedItems(new Map()); // Reset selected items
        }
      },
      [type, activeEntity, entityFqn]
    );

    const openNotification = () => {
      notification.warning({
        key: 'asset-tab-notification-key',
        message: (
          <div className="d-flex justify-between">
            {selectedItems && selectedItems.size > 1 && (
              <Typography.Text>
                {selectedItems.size} {t('label.selected-lowercase')}
              </Typography.Text>
            )}
            <Button onClick={deleteSelectedItems}>{t('label.delete')}</Button>
          </div>
        ),
        placement: 'bottom',
        className: 'asset-tab-delete-notification',
        duration: 0,
      });
    };

    useEffect(() => {
      fetchAssets({
        index: isEmpty(activeFilter) ? [SearchIndex.ALL] : activeFilter,
        page: currentPage,
      });
    }, [activeFilter, currentPage, pageSize, searchValue]);

    useEffect(() => {
      const dropdownItems = getAssetsPageQuickFilters();

      setSelectedQuickFilters(
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

    useImperativeHandle(ref, () => ({
      refreshAssets() {
        fetchAssets({
          index: isEmpty(activeFilter) ? [SearchIndex.ALL] : activeFilter,
          page: currentPage,
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
      <div
        className={classNames('assets-tab-container p-md')}
        data-testid="table-container">
        <Row className="filters-row gap-2">
          <Col span={24}>
            <Searchbar
              removeMargin
              showClearSearch
              placeholder={t('label.search-entity', {
                entity: t('label.asset-plural'),
              })}
              searchValue={searchValue}
              onSearch={setSearchValue}
            />
          </Col>
          <Col className="searched-data-container" span={24}>
            <ExploreQuickFilters
              aggregations={aggregations}
              fields={selectedQuickFilters}
              index={SearchIndex.ALL}
              showDeleted={false}
              onFieldValueSelect={noop}
            />
          </Col>
        </Row>

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
          visible={showDeleteModal}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={() => onAssetRemove(assetToDelete ? [assetToDelete] : [])}
        />
      </div>
    );
  }
);

export default AssetsTabs;
