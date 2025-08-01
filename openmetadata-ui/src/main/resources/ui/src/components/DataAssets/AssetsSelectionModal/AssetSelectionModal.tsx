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
import {
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Dropdown,
  List,
  Modal,
  Space,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { EntityDetailUnion } from 'Models';
import VirtualList from 'rc-virtual-list';
import {
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterIcon } from '../../../assets/svg/ic-feeds-filter.svg';
import {
  ES_UPDATE_DELAY,
  PAGE_SIZE_MEDIUM,
  SOCKET_EVENTS,
} from '../../../constants/constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { TabSpecificField } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import {
  BulkOperationResult,
  Status,
} from '../../../generated/type/bulkOperationResult';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { Aggregations } from '../../../interface/search.interface';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import {
  addAssetsToDataProduct,
  getDataProductByName,
} from '../../../rest/dataProductAPI';
import { addAssetsToDomain, getDomainByName } from '../../../rest/domainAPI';
import {
  addAssetsToGlossaryTerm,
  getGlossaryTermByFQN,
} from '../../../rest/glossaryAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { addAssetsToTags, getTagByFqn } from '../../../rest/tagAPI';
import { getAssetsPageQuickFilters } from '../../../utils/AdvancedSearchUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityUtils';
import { getCombinedQueryFilterObject } from '../../../utils/ExplorePage/ExplorePageUtils';
import {
  getAggregations,
  getQuickFilterQuery,
} from '../../../utils/ExploreUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Banner from '../../common/Banner/Banner';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import TableDataCardV2 from '../../common/TableDataCardV2/TableDataCardV2';
import {
  CSVExportJob,
  CSVExportResponse,
} from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import './asset-selection-model.style.less';
import { AssetSelectionModalProps } from './AssetSelectionModal.interface';

export const AssetSelectionModal = ({
  entityFqn,
  onCancel,
  onSave,
  open,
  type = AssetsOfEntity.GLOSSARY,
  queryFilter,
  emptyPlaceHolderText,
}: AssetSelectionModalProps) => {
  const { theme } = useApplicationStore();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<SearchedDataProps['data']>([]);
  const [failedStatus, setFailedStatus] = useState<BulkOperationResult>();
  const [exportJob, setExportJob] = useState<Partial<CSVExportJob>>();
  const [selectedItems, setSelectedItems] =
    useState<Map<string, EntityDetailUnion>>();
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchIndex>(
    type === AssetsOfEntity.GLOSSARY ? SearchIndex.DATA_ASSET : SearchIndex.ALL
  );
  const [activeEntity, setActiveEntity] = useState<
    Domain | DataProduct | Tag
  >();
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);
  const [assetJobResponse, setAssetJobResponse] = useState<CSVExportResponse>();
  const [aggregations, setAggregations] = useState<Aggregations>();
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([]);
  const [quickFilterQuery, setQuickFilterQuery] =
    useState<QueryFilterInterface>();
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const [filters, setFilters] = useState<ExploreQuickFilterField[]>([]);

  const { socket } = useWebSocketConnector();

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

  const fetchEntities = useCallback(
    async ({
      searchText = '',
      page = 1,
      index = activeFilter,
      updatedQueryFilter,
    }: {
      searchText?: string;
      page?: number;
      index?: SearchIndex;
      updatedQueryFilter?: Record<string, unknown>;
    }) => {
      try {
        setIsLoading(true);
        const res = await searchQuery({
          pageNumber: page,
          pageSize: PAGE_SIZE_MEDIUM,
          searchIndex: index,
          query: searchText,
          queryFilter: updatedQueryFilter,
          includeDeleted: false,
        });
        const hits = res.hits.hits as SearchedDataProps['data'];
        setTotalCount(res.hits.total.value ?? 0);
        setItems(page === 1 ? hits : (prevItems) => [...prevItems, ...hits]);
        setPageNumber(page);
        setAggregations(getAggregations(res?.aggregations));
      } catch (_) {
        // Nothing here
      } finally {
        setIsLoading(false);
      }
    },
    [setActiveFilter]
  );

  const fetchCurrentEntity = useCallback(async () => {
    let data: GlossaryTerm | Tag | Domain | DataProduct | undefined;

    switch (type) {
      case AssetsOfEntity.DOMAIN:
        data = await getDomainByName(entityFqn);

        break;

      case AssetsOfEntity.DATA_PRODUCT:
        data = await getDataProductByName(entityFqn, {
          fields: [TabSpecificField.DOMAINS, TabSpecificField.ASSETS],
        });

        break;

      case AssetsOfEntity.GLOSSARY:
        data = await getGlossaryTermByFQN(entityFqn, {
          fields: TabSpecificField.TAGS,
        });

        break;

      case AssetsOfEntity.TAG:
        data = await getTagByFqn(entityFqn);

        break;

      default:
        data = undefined;

        break;
    }

    setActiveEntity(data);
  }, [type, entityFqn]);

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
    if (open) {
      const combinedQueryFilter = getCombinedQueryFilterObject(
        queryFilter as unknown as QueryFilterInterface,
        quickFilterQuery as QueryFilterInterface
      );
      fetchEntities({
        index: activeFilter,
        searchText: search,
        updatedQueryFilter: combinedQueryFilter,
      });
    }
  }, [open, activeFilter, search, type, quickFilterQuery, queryFilter]);

  useEffect(() => {
    if (open) {
      fetchCurrentEntity();
    }
  }, [open, fetchCurrentEntity]);

  const handleCardClick = (
    details: SearchedDataProps['data'][number]['_source']
  ) => {
    const id = details.id;
    if (!id) {
      return;
    }
    if (selectedItems?.has(id ?? '')) {
      setSelectedItems((prevItems) => {
        const selectedItemMap = new Map();

        prevItems?.forEach(
          (item) => item.id !== id && selectedItemMap.set(item.id, item)
        );

        return selectedItemMap;
      });
    } else {
      setSelectedItems((prevItems) => {
        const selectedItemMap = new Map();

        prevItems?.forEach((item) => selectedItemMap.set(item.id, item));

        selectedItemMap.set(
          id,
          items.find(({ _source }) => _source.id === id)?._source
        );

        return selectedItemMap;
      });
    }
  };

  const handleSave = async () => {
    try {
      setIsSaveLoading(true);
      setFailedStatus(undefined);
      if (!activeEntity) {
        return;
      }

      const entities = [...(selectedItems?.values() ?? [])].map((item) => {
        return getEntityReferenceFromEntity(item, item.entityType);
      });

      let res;
      switch (type) {
        case AssetsOfEntity.DATA_PRODUCT:
          res = await addAssetsToDataProduct(
            activeEntity.fullyQualifiedName ?? '',
            entities
          );

          break;
        case AssetsOfEntity.GLOSSARY:
          res = await addAssetsToGlossaryTerm(
            activeEntity as GlossaryTerm,
            entities
          );

          break;

        case AssetsOfEntity.TAG:
          res = await addAssetsToTags(activeEntity.id ?? '', entities);

          break;
        case AssetsOfEntity.DOMAIN:
          res = await addAssetsToDomain(
            activeEntity.fullyQualifiedName ?? '',
            entities
          );

          break;
        default:
          // Handle other entity types here
          break;
      }

      // check if res has jobId property
      if (isUndefined((res as CSVExportResponse).jobId)) {
        if ((res as BulkOperationResult).status === Status.Success) {
          await new Promise((resolve) => {
            setTimeout(() => {
              resolve('');
              onSave?.();
            }, ES_UPDATE_DELAY);
          });
          onCancel();
        } else {
          setFailedStatus(res as BulkOperationResult);
        }
      } else {
        // handle websocket response
        setAssetJobResponse(res as CSVExportResponse);
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsSaveLoading(false);
    }
  };

  const onSaveAction = useCallback(() => {
    handleSave();
  }, [type, handleSave]);

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
      setSelectedQuickFilters((prevSelected) => [...prevSelected, ...newItems]);
    }
  }, [selectedFilter, selectedQuickFilters, filters]);

  const onScroll: UIEventHandler<HTMLElement> = useCallback(
    (e) => {
      const scrollHeight =
        e.currentTarget.scrollHeight - e.currentTarget.scrollTop;

      if (
        scrollHeight > 499 &&
        scrollHeight < 501 &&
        items.length < totalCount
      ) {
        const combinedQueryFilter = getCombinedQueryFilterObject(
          queryFilter as unknown as QueryFilterInterface,
          quickFilterQuery as QueryFilterInterface
        );

        !isLoading &&
          fetchEntities({
            searchText: search,
            page: pageNumber + 1,
            index: activeFilter,
            updatedQueryFilter: combinedQueryFilter,
          });
      }
    },
    [
      pageNumber,
      activeFilter,
      search,
      totalCount,
      items,
      quickFilterQuery,
      queryFilter,
      isLoading,
      fetchEntities,
    ]
  );

  const onSelectAll = (selectAll: boolean) => {
    setSelectedItems((prevItems) => {
      const selectedItemMap = new Map(prevItems ?? []);

      if (selectAll) {
        items.forEach(({ _source }) => {
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

  const getErrorStatusAndMessage = useCallback(
    (id: string) => {
      if (!failedStatus?.failedRequest) {
        return {
          isError: false,
          errorMessage: null,
        };
      }

      const matchingStatus = failedStatus.failedRequest.find(
        (status) => status.request.id === id
      );

      return {
        isError: !!matchingStatus,
        errorMessage: matchingStatus ? matchingStatus.message : null,
      };
    },
    [failedStatus]
  );

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

  const clearFilters = useCallback(() => {
    setQuickFilterQuery(undefined);
    setSelectedQuickFilters((pre) => {
      const data = pre.map((preField) => {
        return { ...preField, value: [] };
      });

      handleQuickFiltersChange(data);

      return data;
    });
  }, [setQuickFilterQuery, handleQuickFiltersChange, setSelectedQuickFilters]);

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.BULK_ASSETS_CHANNEL, (newActivity) => {
        if (newActivity) {
          const activity = JSON.parse(newActivity);
          if (activity.status === 'COMPLETED') {
            setAssetJobResponse(undefined);
            if (activity.result.status === 'success') {
              onSave?.();
              onCancel();
            } else {
              setFailedStatus(activity.result);
            }
          } else if (activity.status === 'FAILED') {
            setExportJob(activity);
            setAssetJobResponse(undefined);
          }
        }
      });
    }

    return () => {
      socket?.off(SOCKET_EVENTS.BULK_ASSETS_CHANNEL);
    };
  }, [socket]);

  return (
    <Modal
      centered
      destroyOnClose
      className="asset-selection-modal"
      closable={false}
      closeIcon={null}
      data-testid="asset-selection-modal"
      footer={
        <div className="d-flex justify-between">
          <div className="d-flex items-center gap-2">
            {selectedItems && selectedItems.size >= 1 && (
              <Typography.Text className="gap-2">
                <CheckOutlined className="text-success m-r-xs" />
                {selectedItems.size} {t('label.selected-lowercase')}
              </Typography.Text>
            )}
            {failedStatus?.failedRequest &&
              failedStatus.failedRequest.length > 0 && (
                <>
                  <Divider className="m-x-xss" type="vertical" />
                  <Typography.Text type="danger">
                    <CloseOutlined className="m-r-xs" />
                    {failedStatus.failedRequest.length} {t('label.error')}
                  </Typography.Text>
                </>
              )}
          </div>

          <div>
            <Button data-testid="cancel-btn" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="save-btn"
              disabled={!selectedItems?.size || isLoading}
              loading={isSaveLoading || !isUndefined(assetJobResponse)}
              type="primary"
              onClick={onSaveAction}>
              {t('label.save')}
            </Button>
          </div>
        </div>
      }
      open={open}
      title={t('label.add-entity', { entity: t('label.asset-plural') })}
      width={675}
      onCancel={onCancel}>
      <Space className="w-full h-full" direction="vertical" size={16}>
        {(assetJobResponse || exportJob?.error) && (
          <Banner
            className="border-radius"
            isLoading={isUndefined(exportJob?.error)}
            message={exportJob?.error ?? assetJobResponse?.message ?? ''}
            type={exportJob?.error ? 'error' : 'success'}
          />
        )}

        <div className="d-flex items-center gap-3">
          <Dropdown
            menu={{
              items: filterMenu,
              selectedKeys: selectedFilter,
            }}
            trigger={['click']}>
            <Button className="flex-center" icon={<FilterIcon height={16} />} />
          </Dropdown>
          <div className="flex-1">
            <Searchbar
              removeMargin
              showClearSearch
              placeholder={t('label.search-entity', {
                entity: t('label.asset-plural'),
              })}
              searchValue={search}
              onSearch={setSearch}
            />
          </div>
        </div>

        {selectedQuickFilters && selectedQuickFilters.length > 0 && (
          <div className="d-flex items-center">
            <div className="d-flex justify-between flex-1">
              <ExploreQuickFilters
                aggregations={aggregations}
                fields={selectedQuickFilters}
                index={SearchIndex.ALL}
                showDeleted={false}
                onFieldValueSelect={handleQuickFiltersValueSelect}
              />
              {quickFilterQuery && (
                <Typography.Text
                  className="p-r-xss text-primary self-center cursor-pointer"
                  onClick={clearFilters}>
                  {t('label.clear-entity', {
                    entity: '',
                  })}
                </Typography.Text>
              )}
            </div>
          </div>
        )}

        {failedStatus?.failedRequest && failedStatus.failedRequest.length > 0 && (
          <Alert
            closable
            className="w-full"
            description={
              <Typography.Text className="text-grey-muted">
                {t('message.validation-error-assets')}
              </Typography.Text>
            }
            message={
              <div className="d-flex items-center gap-3">
                <ExclamationCircleOutlined
                  style={{
                    color: theme.errorColor,
                    fontSize: '24px',
                  }}
                />
                <Typography.Text className="font-semibold text-sm">
                  {t('label.validation-error-plural')}
                </Typography.Text>
              </div>
            }
            type="error"
          />
        )}

        {items.length > 0 && (
          <div className="border p-xs">
            <Checkbox
              className="assets-checkbox p-x-sm"
              onChange={(e) => onSelectAll(e.target.checked)}>
              {t('label.select-field', {
                field: t('label.all'),
              })}
            </Checkbox>
            <List>
              <VirtualList
                data={items}
                height={500}
                itemKey="id"
                onScroll={onScroll}>
                {({ _source: item }) => {
                  const { isError, errorMessage } = getErrorStatusAndMessage(
                    item.id ?? ''
                  );

                  return (
                    <div
                      className={classNames({
                        'm-y-sm border-danger rounded-4': isError,
                      })}
                      key={item.id}>
                      <TableDataCardV2
                        openEntityInNewPage
                        showCheckboxes
                        checked={selectedItems?.has(item.id ?? '')}
                        className="border-none asset-selection-model-card cursor-pointer"
                        displayNameClassName="text-md"
                        handleSummaryPanelDisplay={handleCardClick}
                        id={`tabledatacard-${item.id}`}
                        key={item.id}
                        nameClassName="text-md"
                        showBody={false}
                        showName={false}
                        source={{ ...item, tags: [] }}
                      />
                      {isError && (
                        <>
                          <div className="p-x-sm">
                            <Divider className="m-t-0 m-y-sm " />
                          </div>
                          <div className="d-flex gap-3 p-x-sm p-b-sm">
                            <ExclamationCircleOutlined
                              style={{
                                color: theme.errorColor,
                                fontSize: '24px',
                              }}
                            />
                            <Typography.Text className="break-all">
                              {errorMessage}
                            </Typography.Text>
                          </div>
                        </>
                      )}
                    </div>
                  );
                }}
              </VirtualList>
            </List>
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <ErrorPlaceHolder>
            {emptyPlaceHolderText && (
              <Typography.Paragraph>
                {emptyPlaceHolderText}
              </Typography.Paragraph>
            )}
          </ErrorPlaceHolder>
        )}

        {isLoading && <Loader size="small" />}
      </Space>
    </Modal>
  );
};
