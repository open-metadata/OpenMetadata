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
import { Button, Checkbox, List, Modal, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { EntityDetailUnion } from 'Models';
import VirtualList from 'rc-virtual-list';
import {
  default as React,
  UIEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
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
import { getAssetsPageQuickFilters } from '../../../utils/AdvancedSearchUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityUtils';
import {
  getAggregations,
  getSelectedValuesFromQuickFilter,
} from '../../../utils/Explore.utils';
import { getCombinedQueryFilterObject } from '../../../utils/ExplorePage/ExplorePageUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AssetFilters from '../../AssetFilters/AssetFilters.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import TableDataCardV2 from '../../common/TableDataCardV2/TableDataCardV2';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import Loader from '../../Loader/Loader';
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
  const { t } = useTranslation();
  const ES_UPDATE_DELAY = 500;
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<SearchedDataProps['data']>([]);
  const [selectedItems, setSelectedItems] =
    useState<Map<string, EntityDetailUnion>>();
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchIndex>(
    type === AssetsOfEntity.GLOSSARY ? SearchIndex.DATA_ASSET : SearchIndex.ALL
  );
  const [activeEntity, setActiveEntity] = useState<Domain | DataProduct>();
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);
  const [aggregations, setAggregations] = useState<Aggregations>();
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([]);
  const [quickFilterQuery, setQuickFilterQuery] =
    useState<QueryFilterInterface>();
  const [updatedQueryFilter, setUpdatedQueryFilter] =
    useState<QueryFilterInterface>();

  const fetchEntities = useCallback(
    async ({
      searchText = '',
      page = 1,
      index = activeFilter,
      updatedQueryFilter,
    }) => {
      try {
        setIsLoading(true);
        const res = await searchQuery({
          pageNumber: page,
          pageSize: PAGE_SIZE_MEDIUM,
          searchIndex: index,
          query: searchText,
          queryFilter: updatedQueryFilter,
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
    if (type === AssetsOfEntity.DOMAIN) {
      const data = await getDomainByName(encodeURIComponent(entityFqn), '');
      setActiveEntity(data);
    } else if (type === AssetsOfEntity.DATA_PRODUCT) {
      const data = await getDataProductByName(
        encodeURIComponent(entityFqn),
        'domain,assets'
      );
      setActiveEntity(data);
    } else if (type === AssetsOfEntity.GLOSSARY) {
      const data = await getGlossaryTermByFQN(entityFqn, 'tags');
      setActiveEntity(data);
    }
  }, [type, entityFqn]);

  useEffect(() => {
    const dropdownItems = getAssetsPageQuickFilters(type);

    setSelectedQuickFilters(
      dropdownItems.map((item) => ({
        ...item,
        value: getSelectedValuesFromQuickFilter(item, dropdownItems),
      }))
    );
  }, [type]);

  useEffect(() => {
    if (open) {
      fetchEntities({
        index: activeFilter,
        searchText: search,
        updatedQueryFilter,
      });
    }
  }, [open, activeFilter, search, type, updatedQueryFilter]);

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
      if (!activeEntity) {
        return;
      }

      const entities = [...(selectedItems?.values() ?? [])].map((item) => {
        return getEntityReferenceFromEntity(item, item.entityType);
      });

      switch (type) {
        case AssetsOfEntity.DATA_PRODUCT:
          await addAssetsToDataProduct(
            getEncodedFqn(activeEntity.fullyQualifiedName ?? ''),
            entities
          );

          break;
        case AssetsOfEntity.GLOSSARY:
          await addAssetsToGlossaryTerm(activeEntity as GlossaryTerm, entities);

          break;
        case AssetsOfEntity.DOMAIN:
          await addAssetsToDomain(
            getEncodedFqn(activeEntity.fullyQualifiedName ?? ''),
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
          onSave?.();
        }, ES_UPDATE_DELAY);
      });
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsSaveLoading(false);
      onCancel();
    }
  };

  const onSaveAction = useCallback(() => {
    handleSave();
  }, [type, handleSave]);

  const mergeFilters = useCallback(() => {
    const res = getCombinedQueryFilterObject(
      queryFilter as QueryFilterInterface,
      quickFilterQuery as QueryFilterInterface
    );
    setUpdatedQueryFilter(res);
  }, [queryFilter, quickFilterQuery]);

  useEffect(() => {
    mergeFilters();
  }, [quickFilterQuery, queryFilter]);

  const onScroll: UIEventHandler<HTMLElement> = useCallback(
    (e) => {
      const scrollHeight =
        e.currentTarget.scrollHeight - e.currentTarget.scrollTop;

      if (
        scrollHeight > 499 &&
        scrollHeight < 501 &&
        items.length < totalCount
      ) {
        !isLoading &&
          fetchEntities({
            searchText: search,
            page: pageNumber + 1,
            index: activeFilter,
          });
      }
    },
    [
      pageNumber,
      activeFilter,
      search,
      totalCount,
      items,
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

  return (
    <Modal
      destroyOnClose
      className="asset-selection-modal"
      closable={false}
      closeIcon={null}
      data-testid="asset-selection-modal"
      footer={
        <div className="d-flex justify-between">
          <div>
            {selectedItems && selectedItems.size > 1 && (
              <Typography.Text>
                {selectedItems.size} {t('label.selected-lowercase')}
              </Typography.Text>
            )}
          </div>

          <div>
            <Button data-testid="cancel-btn" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="save-btn"
              disabled={isLoading}
              loading={isSaveLoading}
              type="primary"
              onClick={onSaveAction}>
              {t('label.save')}
            </Button>
          </div>
        </div>
      }
      open={open}
      style={{ top: 40 }}
      title={t('label.add-entity', { entity: t('label.asset-plural') })}
      width={675}
      onCancel={onCancel}>
      <Space className="w-full h-full" direction="vertical" size={16}>
        <Searchbar
          removeMargin
          showClearSearch
          placeholder={t('label.search-entity', {
            entity: t('label.asset-plural'),
          })}
          searchValue={search}
          onSearch={setSearch}
        />

        <div className="d-flex items-center">
          <AssetFilters
            aggregations={aggregations}
            filterData={selectedQuickFilters}
            quickFilterQuery={quickFilterQuery}
            type={type}
            onQuickFilterChange={(data) => setQuickFilterQuery(data)}
          />
        </div>

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
                {({ _source: item }) => (
                  <TableDataCardV2
                    openEntityInNewPage
                    showCheckboxes
                    checked={selectedItems?.has(item.id ?? '')}
                    className="border-none asset-selection-model-card cursor-pointer"
                    handleSummaryPanelDisplay={handleCardClick}
                    id={`tabledatacard-${item.id}`}
                    key={item.id}
                    showBody={false}
                    showName={false}
                    source={{ ...item, tags: [] }}
                  />
                )}
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
