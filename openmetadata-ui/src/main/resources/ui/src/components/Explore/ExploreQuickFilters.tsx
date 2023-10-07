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

import { Space } from 'antd';
import { AxiosError } from 'axios';
import { isEqual, isString, isUndefined, uniqWith } from 'lodash';
import { Bucket } from 'Models';
import Qs from 'qs';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MISC_FIELDS,
  OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY,
} from '../../constants/AdvancedSearch.constants';
import { TIER_FQN_KEY } from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { QueryFilterInterface } from '../../pages/explore/ExplorePage.interface';
import { getAggregateFieldOptions } from '../../rest/miscAPI';
import { getTags } from '../../rest/tagAPI';
import { getOptionsFromAggregationBucket } from '../../utils/AdvancedSearchUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getCombinedQueryFilterObject } from '../../utils/ExplorePage/ExplorePageUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { useAdvanceSearch } from './AdvanceSearchProvider/AdvanceSearchProvider.component';
import { ExploreQuickFiltersProps } from './ExploreQuickFilters.interface';

const ExploreQuickFilters: FC<ExploreQuickFiltersProps> = ({
  fields,
  index,
  aggregations,
  onFieldValueSelect,
}) => {
  const location = useLocation();
  const [options, setOptions] = useState<SearchDropdownOption[]>();
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(false);
  const [tierOptions, setTierOptions] = useState<SearchDropdownOption[]>();
  const { queryFilter } = useAdvanceSearch();
  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substring(1)
          : location.search
      ),
    [location.search]
  );

  const getAdvancedSearchQuickFilters = useCallback(() => {
    if (!isString(parsedSearch.quickFilter)) {
      return undefined;
    } else {
      try {
        const parsedQueryFilter = JSON.parse(parsedSearch.quickFilter);

        return parsedQueryFilter;
      } catch {
        return undefined;
      }
    }
  }, [parsedSearch]);

  const updatedQuickFilters = getAdvancedSearchQuickFilters();
  const combinedQueryFilter = getCombinedQueryFilterObject(
    updatedQuickFilters as QueryFilterInterface,
    queryFilter as unknown as QueryFilterInterface
  );

  const fetchDefaultOptions = async (
    index: SearchIndex | SearchIndex[],
    key: string
  ) => {
    let buckets: Bucket[] = [];

    if (aggregations?.[key] && key !== TIER_FQN_KEY) {
      buckets = aggregations[key].buckets;
    } else {
      const [res, tierTags] = await Promise.all([
        getAggregateFieldOptions(
          index,
          key,
          '',
          JSON.stringify(combinedQueryFilter)
        ),
        key === TIER_FQN_KEY
          ? getTags({ parent: 'Tier' })
          : Promise.resolve(null),
      ]);

      buckets = res.data.aggregations[`sterms#${key}`].buckets;

      if (key === TIER_FQN_KEY && tierTags) {
        const options = tierTags.data.map((option) => {
          const bucketItem = buckets.find(
            (item) => item.key === option.fullyQualifiedName
          );

          return {
            key: option.fullyQualifiedName ?? '',
            label: getEntityName(option),
            count: bucketItem?.doc_count ?? 0,
          };
        });
        setTierOptions(uniqWith(options, isEqual));
        setOptions(uniqWith(options, isEqual));

        return;
      }
    }

    setOptions(uniqWith(getOptionsFromAggregationBucket(buckets), isEqual));
  };

  const getInitialOptions = async (key: string) => {
    setIsOptionsLoading(true);
    setOptions([]);
    try {
      if (key === MISC_FIELDS[0]) {
        await fetchDefaultOptions(
          [SearchIndex.USER, SearchIndex.TEAM],
          OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY
        );
      } else {
        await fetchDefaultOptions(index, key);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const getFilterOptions = async (value: string, key: string) => {
    setIsOptionsLoading(true);
    setOptions([]);
    try {
      if (!value) {
        getInitialOptions(key);

        return;
      }
      if (aggregations?.[key] && key !== TIER_FQN_KEY) {
        const res = await getAggregateFieldOptions(
          index,
          key,
          value,
          JSON.stringify(combinedQueryFilter)
        );

        const buckets = res.data.aggregations[`sterms#${key}`].buckets;
        setOptions(uniqWith(getOptionsFromAggregationBucket(buckets), isEqual));
      } else if (key === TIER_FQN_KEY) {
        const filteredOptions = tierOptions?.filter((option) => {
          return option.label.toLowerCase().includes(value.toLowerCase());
        });
        setOptions(filteredOptions);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  useEffect(() => {
    const tierField = fields.find((value) => value.key === TIER_FQN_KEY);
    if (tierField?.value?.length && isUndefined(tierOptions)) {
      fetchDefaultOptions(index, TIER_FQN_KEY);
    }
  }, [fields]);

  return (
    <Space wrap className="explore-quick-filters-container" size={[4, 0]}>
      {fields.map((field) => {
        const selectedKeys =
          field.key === TIER_FQN_KEY && options?.length
            ? field.value?.map((value) => {
                return (
                  options?.find((option) => option.key === value.key) ?? value
                );
              })
            : field.value;

        return (
          <SearchDropdown
            highlight
            fixedOrderOptions={field.key === TIER_FQN_KEY}
            isSuggestionsLoading={isOptionsLoading}
            key={field.key}
            label={field.label}
            options={options ?? []}
            searchKey={field.key}
            selectedKeys={selectedKeys ?? []}
            onChange={(updatedValues) => {
              onFieldValueSelect({ ...field, value: updatedValues });
            }}
            onGetInitialOptions={getInitialOptions}
            onSearch={getFilterOptions}
          />
        );
      })}
    </Space>
  );
};

export default ExploreQuickFilters;
