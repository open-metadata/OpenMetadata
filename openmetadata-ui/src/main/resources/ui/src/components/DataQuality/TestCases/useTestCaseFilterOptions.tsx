/*
 *  Copyright 2026 Collate.
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
import { Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { debounce, isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  TIER_CATEGORY,
} from '../../../constants/constants';
import { TEST_CASE_FILTERS } from '../../../constants/profiler.constant';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getTags } from '../../../rest/tagAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import tagClassBase from '../../../utils/TagClassBase';

export interface FetchedOption extends DefaultOptionType {
  /** Plain name kept alongside the rich antd JSX label for renderer reuse. */
  name?: string;
  subLabel?: string;
}

const optionLabel = (name: string, fqn?: string, testId?: string) => (
  <Space data-testid={testId ?? fqn} direction="vertical" size={0}>
    {fqn && (
      <Typography.Text className="text-xs text-grey-muted">
        {fqn}
      </Typography.Text>
    )}
    <Typography.Text className="text-sm">{name}</Typography.Text>
  </Space>
);

/**
 * Owns the async filter-OPTIONS cluster: the per-filter option lists, their
 * loading flag, every fetcher (tier/tag/search-backed table/service/data
 * product), the debounced search fetchers and the by-key lookup maps. The
 * shared {@link getInitialOptions} prefetcher is returned so both the filters
 * concern and the data concern can drive it.
 */
export const useTestCaseFilterOptions = () => {
  const [tableOptions, setTableOptions] = useState<FetchedOption[]>([]);
  const [tagOptions, setTagOptions] = useState<FetchedOption[]>([]);
  const [tierOptions, setTierOptions] = useState<FetchedOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<FetchedOption[]>([]);
  const [dataProductOptions, setDataProductOptions] = useState<FetchedOption[]>(
    []
  );
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);

  const fetchTierOptions = async () => {
    try {
      setIsOptionsLoading(true);
      const { data } = await getTags({
        parent: 'Tier',
        limit: PAGE_SIZE_LARGE,
      });
      setTierOptions(
        data.map((hit) => ({
          label: optionLabel(getEntityName(hit), hit.fullyQualifiedName),
          name: getEntityName(hit),
          subLabel: hit.fullyQualifiedName,
          value: hit.fullyQualifiedName,
        }))
      );
    } catch {
      setTierOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchTagOptions = async (search?: string) => {
    setIsOptionsLoading(true);
    try {
      const { data } = await tagClassBase.getTags(search ?? '', 1);
      setTagOptions(
        data
          .filter(
            ({ data: { classification } }) =>
              classification?.name !== TIER_CATEGORY
          )
          .map(({ label, value }) => ({
            label: optionLabel(label, value, value),
            name: label,
            subLabel: value,
            value,
          }))
      );
    } catch {
      setTagOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchSearchOptions = async (
    searchIndex: SearchIndex,
    setter: (options: FetchedOption[]) => void,
    valueKey: 'name' | 'fullyQualifiedName',
    query: string
  ) => {
    setIsOptionsLoading(true);
    try {
      const response = await searchQuery({
        query,
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex,
        fetchSource: true,
        includeFields: ['name', 'fullyQualifiedName', 'displayName'],
      });
      setter(
        response.hits.hits.map((hit) => ({
          label: optionLabel(
            getEntityName(hit._source),
            hit._source.fullyQualifiedName,
            valueKey === 'name'
              ? hit._source.name
              : hit._source.fullyQualifiedName
          ),
          name: getEntityName(hit._source),
          subLabel: hit._source.fullyQualifiedName,
          value: hit._source[valueKey] ?? hit._source.name,
        }))
      );
    } catch {
      setter([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchTableData = (search = WILD_CARD_CHAR) =>
    fetchSearchOptions(
      SearchIndex.TABLE,
      setTableOptions,
      'fullyQualifiedName',
      `*${search}*`
    );

  const fetchServiceOptions = (search = WILD_CARD_CHAR) =>
    fetchSearchOptions(
      SearchIndex.DATABASE_SERVICE,
      setServiceOptions,
      'name',
      `*${search}*`
    );

  const fetchDataProductOptions = (search = WILD_CARD_CHAR) =>
    fetchSearchOptions(
      SearchIndex.DATA_PRODUCT,
      setDataProductOptions,
      'fullyQualifiedName',
      search === WILD_CARD_CHAR ? search : `*${search}*`
    );

  const getInitialOptions = (key: string, isLengthCheck = false) => {
    switch (key) {
      case TEST_CASE_FILTERS.tier:
        (isEmpty(tierOptions) || !isLengthCheck) && fetchTierOptions();

        break;
      case TEST_CASE_FILTERS.table:
        (isEmpty(tableOptions) || !isLengthCheck) && fetchTableData();

        break;
      case TEST_CASE_FILTERS.tags:
        (isEmpty(tagOptions) || !isLengthCheck) && fetchTagOptions();

        break;
      case TEST_CASE_FILTERS.service:
        (isEmpty(serviceOptions) || !isLengthCheck) && fetchServiceOptions();

        break;
      case TEST_CASE_FILTERS.dataProduct:
        (isEmpty(dataProductOptions) || !isLengthCheck) &&
          fetchDataProductOptions();

        break;
      default:
        break;
    }
  };

  const debounceFetchTableData = useCallback(
    debounce(fetchTableData, 1000),
    []
  );
  const debounceFetchTagOptions = useCallback(
    debounce(fetchTagOptions, 1000),
    []
  );
  const debounceFetchServiceOptions = useCallback(
    debounce(fetchServiceOptions, 1000),
    []
  );
  const debounceFetchDataProductOptions = useCallback(
    debounce(fetchDataProductOptions, 1000),
    []
  );

  const asyncOptionsByKey = useMemo<Record<string, FetchedOption[]>>(
    () => ({
      [TEST_CASE_FILTERS.table]: tableOptions,
      [TEST_CASE_FILTERS.tags]: tagOptions,
      [TEST_CASE_FILTERS.tier]: tierOptions,
      [TEST_CASE_FILTERS.service]: serviceOptions,
      [TEST_CASE_FILTERS.dataProduct]: dataProductOptions,
    }),
    [tableOptions, tagOptions, tierOptions, serviceOptions, dataProductOptions]
  );

  const onSearchByKey: Record<string, (search: string) => void> = {
    [TEST_CASE_FILTERS.table]: debounceFetchTableData,
    [TEST_CASE_FILTERS.tags]: debounceFetchTagOptions,
    [TEST_CASE_FILTERS.service]: debounceFetchServiceOptions,
    [TEST_CASE_FILTERS.dataProduct]: debounceFetchDataProductOptions,
  };

  return {
    tableOptions,
    tagOptions,
    tierOptions,
    serviceOptions,
    dataProductOptions,
    isOptionsLoading,
    fetchTierOptions,
    fetchTagOptions,
    fetchSearchOptions,
    fetchTableData,
    fetchServiceOptions,
    fetchDataProductOptions,
    getInitialOptions,
    debounceFetchTableData,
    debounceFetchTagOptions,
    debounceFetchServiceOptions,
    debounceFetchDataProductOptions,
    asyncOptionsByKey,
    onSearchByKey,
  };
};
