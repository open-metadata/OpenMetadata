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
import { isEqual, isUndefined, uniqWith } from 'lodash';
import { Bucket } from 'Models';
import Qs from 'qs';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  MISC_FIELDS,
  OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY,
} from '../../constants/AdvancedSearch.constants';
import { TIER_FQN_KEY } from '../../constants/explore.constants';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { QueryFilterInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import { getTags } from '../../rest/tagAPI';
import { getOptionsFromAggregationBucket } from '../../utils/AdvancedSearchUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getCombinedQueryFilterObject,
  getQuickFilterWithDeletedFlag,
} from '../../utils/ExplorePage/ExplorePageUtils';
import { getAggregationOptions } from '../../utils/ExploreUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { useAdvanceSearch } from './AdvanceSearchProvider/AdvanceSearchProvider.component';
import { ExploreSearchIndex } from './ExplorePage.interface';
import { ExploreQuickFiltersProps } from './ExploreQuickFilters.interface';

const ExploreQuickFilters: FC<ExploreQuickFiltersProps> = ({
  fields,
  index,
  aggregations,
  independent = false,
  onFieldValueSelect,
  fieldsWithNullValues = [],
  defaultQueryFilter,
}) => {
  const location = useCustomLocation();
  const [options, setOptions] = useState<SearchDropdownOption[]>();
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(false);
  const [tierOptions, setTierOptions] = useState<SearchDropdownOption[]>();
  const { queryFilter } = useAdvanceSearch();

  const { showDeleted, quickFilter } = useMemo(() => {
    const parsed = Qs.parse(
      location.search.startsWith('?')
        ? location.search.substring(1)
        : location.search
    );

    return {
      showDeleted: parsed.showDeleted === 'true',
      quickFilter: parsed.quickFilter ?? '',
    };
  }, [location.search]);

  const getAdvancedSearchQuickFilters = useCallback(() => {
    return getQuickFilterWithDeletedFlag(quickFilter as string, showDeleted);
  }, [quickFilter, showDeleted]);

  const updatedQuickFilters = getAdvancedSearchQuickFilters();
  const combinedQueryFilter = getCombinedQueryFilterObject(
    updatedQuickFilters as QueryFilterInterface,
    queryFilter as unknown as QueryFilterInterface,
    defaultQueryFilter as unknown as QueryFilterInterface
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
        getAggregationOptions(
          index,
          key,
          '',
          JSON.stringify(combinedQueryFilter),
          independent
        ),
        key === TIER_FQN_KEY
          ? getTags({ parent: 'Tier', limit: 50 })
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
      if (key !== TIER_FQN_KEY) {
        const res = await getAggregationOptions(
          index,
          key,
          value,
          JSON.stringify(combinedQueryFilter),
          independent
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
    <Space wrap className="explore-quick-filters-container" size={[8, 0]}>
      {fields.map((field) => {
        const hasNullOption = fieldsWithNullValues.includes(
          field.key as EntityFields
        );
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
            hasNullOption={hasNullOption}
            independent={independent}
            index={index as ExploreSearchIndex}
            isSuggestionsLoading={isOptionsLoading}
            key={field.key}
            label={field.label}
            options={options ?? []}
            searchKey={field.key}
            selectedKeys={selectedKeys ?? []}
            triggerButtonSize="middle"
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
