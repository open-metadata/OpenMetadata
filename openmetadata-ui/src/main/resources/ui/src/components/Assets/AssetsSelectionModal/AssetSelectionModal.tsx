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
import { Button, List, Modal, Radio, Space } from 'antd';
import Searchbar from 'components/common/searchbar/Searchbar';
import TableDataCardV2 from 'components/common/table-data-card-v2/TableDataCardV2';
import { EntityUnion } from 'components/Explore/explore.interface';
import Loader from 'components/Loader/Loader';
import { PAGE_SIZE_MEDIUM } from 'constants/constants';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { compare } from 'fast-json-patch';
import { cloneDeep, groupBy, map, startCase } from 'lodash';
import { EntityDetailUnion } from 'Models';
import VirtualList from 'rc-virtual-list';
import {
  default as React,
  UIEventHandler,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { searchQuery } from 'rest/searchAPI';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from 'utils/Assets/AssetsUtils';
import { getCountBadge } from 'utils/CommonUtils';
import { getQueryFilterToExcludeTerm } from 'utils/GlossaryUtils';
import {
  AssetFilterKeys,
  AssetSelectionModalProps,
} from './AssetSelectionModal.interface';

export const AssetSelectionModal = ({
  glossaryFQN,
  onCancel,
  onSave,
  open,
}: AssetSelectionModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<EntityDetailUnion[]>([]);
  const [itemCount, setItemCount] = useState<Record<AssetFilterKeys, number>>({
    all: 0,
    table: 0,
    pipeline: 0,
    mlmodel: 0,
    container: 0,
    topic: 0,
    dashboard: 0,
  });
  const [selectedItems, setSelectedItems] =
    useState<Map<string, EntityDetailUnion>>();
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AssetFilterKeys>('all');
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    if (open) {
      fetchEntities();
    }
  }, [open]);

  const fetchEntities = async (searchText = '', page = 1) => {
    try {
      setIsLoading(true);
      const res = await searchQuery({
        pageNumber: page,
        pageSize: PAGE_SIZE_MEDIUM,
        searchIndex: [
          SearchIndex.TABLE,
          SearchIndex.PIPELINE,
          SearchIndex.MLMODEL,
          SearchIndex.TOPIC,
          SearchIndex.DASHBOARD,
          SearchIndex.CONTAINER,
        ],
        query: searchText,
        queryFilter: getQueryFilterToExcludeTerm(glossaryFQN),
      });

      const groupedArray = groupBy(res.hits.hits, '_source.entityType');
      const isAppend = page !== 1;
      const tableCount = groupedArray[EntityType.TABLE]?.length ?? 0;
      const containerCount = groupedArray[EntityType.CONTAINER]?.length ?? 0;
      const pipelineCount = groupedArray[EntityType.PIPELINE]?.length ?? 0;
      const dashboardCount = groupedArray[EntityType.DASHBOARD]?.length ?? 0;
      const topicCount = groupedArray[EntityType.TOPIC]?.length ?? 0;
      const mlmodelCount = groupedArray[EntityType.MLMODEL]?.length ?? 0;

      setItemCount((prevCount) => ({
        ...prevCount,
        all: res.hits.total.value,
        ...(isAppend
          ? {
              table: prevCount.table + tableCount,
              pipeline: prevCount.pipeline + pipelineCount,
              mlmodel: prevCount.mlmodel + mlmodelCount,
              container: prevCount.container + containerCount,
              topic: prevCount.topic + topicCount,
              dashboard: prevCount.dashboard + dashboardCount,
            }
          : {
              table: tableCount,
              pipeline: pipelineCount,
              mlmodel: mlmodelCount,
              container: containerCount,
              topic: topicCount,
              dashboard: dashboardCount,
            }),
      }));
      setActiveFilter('all');
      setItems(
        page === 1
          ? res.hits.hits
          : (prevItems) => [...prevItems, ...res.hits.hits]
      );
      setPageNumber(page);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (details: EntityUnion) => {
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
          items.find(({ _source }) => _source.id === id)._source
        );

        return selectedItemMap;
      });
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    const entityDetails = [...(selectedItems?.values() ?? [])].map((item) =>
      getEntityAPIfromSource(item.entityType)(item.fullyQualifiedName, 'tags')
    );

    try {
      const entityDetailsResponse = await Promise.allSettled(entityDetails);
      const map = new Map();

      entityDetailsResponse.forEach((response) => {
        if (response.status === 'fulfilled') {
          const entity = response.value;

          entity && map.set(entity.fullyQualifiedName, entity.tags);
        }
      });
      const patchAPIPromises = [...(selectedItems?.values() ?? [])]
        .map((item) => {
          if (map.has(item.fullyQualifiedName)) {
            const jsonPatch = compare(
              { tags: map.get(item.fullyQualifiedName) },
              {
                tags: [
                  ...(item.tags ?? []),
                  {
                    tagFQN: glossaryFQN,
                    source: 'Glossary',
                    labelType: 'Manual',
                  },
                ],
              }
            );

            const api = getAPIfromSource(item.entityType);

            return api(item.id, jsonPatch);
          }

          return;
        })
        .filter(Boolean);

      await Promise.all(patchAPIPromises);
      onSave && onSave();
      onCancel();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onScroll: UIEventHandler<HTMLElement> = (e) => {
    if (e.currentTarget.scrollHeight - e.currentTarget.scrollTop === 500) {
      !isLoading && fetchEntities(search, pageNumber + 1);
    }
  };

  const filteredData = useMemo(() => {
    return activeFilter === 'all'
      ? cloneDeep(items)
      : items.filter((i) => i._source.entityType === activeFilter);
  }, [items, activeFilter]);

  return (
    <Modal
      destroyOnClose
      closable={false}
      closeIcon={null}
      footer={
        <>
          <Button onClick={onCancel}>{t('label.cancel')}</Button>
          <Button loading={isLoading} type="primary" onClick={handleSave}>
            {t('label.save')}
          </Button>
        </>
      }
      open={open}
      style={{ top: 40 }}
      title={t('label.add-entity', { entity: t('label.asset-plural') })}
      width={750}>
      <Space className="w-full h-full" direction="vertical" size={16}>
        <Searchbar
          removeMargin
          placeholder={t('label.search-entity', {
            entity: t('label.asset-plural'),
          })}
          searchValue={search}
          onSearch={(s) => {
            setSearch(s);
            fetchEntities(s);
          }}
        />
        <Radio.Group
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}>
          {map(
            itemCount,
            (value, key) =>
              value > 0 && (
                <Radio.Button key={key} value={key}>
                  {startCase(key)} {getCountBadge(value)}
                </Radio.Button>
              )
          )}
        </Radio.Group>
        <List loading={{ spinning: isLoading, indicator: <Loader /> }}>
          <VirtualList
            data={filteredData}
            height={500}
            itemKey="id"
            onScroll={onScroll}>
            {({ _index: index, _source: item }) => (
              <TableDataCardV2
                showCheckboxes
                checked={selectedItems?.has(item.id)}
                className="m-b-xs"
                handleSummaryPanelDisplay={handleCardClick}
                id={`tabledatacard-${item.id}`}
                key={item.id}
                searchIndex={index}
                source={{ ...item, tags: [] }}
              />
            )}
          </VirtualList>
        </List>
      </Space>
    </Modal>
  );
};
