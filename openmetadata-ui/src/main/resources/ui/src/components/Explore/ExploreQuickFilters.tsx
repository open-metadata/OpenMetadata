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
import { isEqual, isUndefined, toLower, uniqWith } from 'lodash';
import { Bucket } from 'Models';
import Qs from 'qs';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
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
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
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
  showSelectedCounts = false,
  optionPageSize,
  additionalActions,
}) => {
  const location = useCustomLocation();
  const [options, setOptions] = useState<SearchDropdownOption[]>();
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(false);
  const [tierOptions, setTierOptions] = useState<SearchDropdownOption[]>();
  const { queryFilter } = useAdvanceSearch();
  const getStaticOptions = useCallback(
    (key: string) => fields.find((item) => item.key === key)?.options,
    [fields]
  );

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

  // Get first index for display in SearchDropdown (which expects single index)
  const displayIndex = useMemo(
    () => (Array.isArray(index) ? index[0] : index),
    [index]
  );

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
    key: string,
    fieldSearchIndex?: SearchIndex,
    fieldSearchKey?: string
  ) => {
    const staticOptions = getStaticOptions(key);
    if (staticOptions) {
      setOptions(staticOptions);

      return;
    }

    // Use field-specific searchIndex if provided, otherwise use the default index
    const searchIndexToUse = fieldSearchIndex ?? index;
    // Use field-specific searchKey if provided, otherwise use the key
    const searchKeyToUse = fieldSearchKey ?? key;

    let buckets: Bucket[] = [];
    if (aggregations?.[key] && key !== TIER_FQN_KEY) {
      buckets = aggregations[key].buckets;
    } else {
      const [res, tierTags] = await Promise.all([
        getAggregationOptions(
          searchIndexToUse,
          searchKeyToUse,
          '',
          JSON.stringify(combinedQueryFilter),
          independent,
          showDeleted,
          optionPageSize
        ),
        key === TIER_FQN_KEY
          ? getTags({ parent: 'Tier', limit: 50 })
          : Promise.resolve(null),
      ]);

      buckets = res.data.aggregations[`sterms#${searchKeyToUse}`].buckets;

      if (key === TIER_FQN_KEY && tierTags) {
        const options = tierTags.data.map((option) => {
          const bucketItem = buckets.find(
            (item) => toLower(item.key) === toLower(option.fullyQualifiedName)
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

  const getInitialOptions = async (
    key: string,
    fieldSearchIndex?: SearchIndex,
    fieldSearchKey?: string
  ) => {
    const staticOptions = getStaticOptions(key);
    if (staticOptions) {
      setOptions(staticOptions);

      return;
    }

    setIsOptionsLoading(true);
    setOptions([]);
    try {
      await fetchDefaultOptions(index, key, fieldSearchIndex, fieldSearchKey);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const getFilterOptions = async (
    value: string,
    key: string,
    fieldSearchIndex?: SearchIndex,
    fieldSearchKey?: string
  ) => {
    const staticOptions = getStaticOptions(key);
    if (staticOptions) {
      const filteredOptions = value
        ? staticOptions.filter((option) =>
            option.label.toLowerCase().includes(value.toLowerCase())
          )
        : staticOptions;
      setOptions(filteredOptions);

      return;
    }

    setIsOptionsLoading(true);
    setOptions([]);
    try {
      if (!value) {
        getInitialOptions(key, fieldSearchIndex, fieldSearchKey);

        return;
      }

      const searchIndexToUse = fieldSearchIndex ?? index;
      const searchKeyToUse = fieldSearchKey ?? key;

      if (key !== TIER_FQN_KEY) {
        const res = await getAggregationOptions(
          searchIndexToUse,
          searchKeyToUse,
          value,
          JSON.stringify(combinedQueryFilter),
          independent,
          showDeleted
        );

        const buckets =
          res.data.aggregations[`sterms#${searchKeyToUse}`].buckets;
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
        const dropdownOptions = field.options ?? options ?? [];
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
            dropdownClassName={field.dropdownClassName}
            fixedOrderOptions={field.key === TIER_FQN_KEY}
            hasNullOption={hasNullOption}
            hideCounts={field.hideCounts ?? false}
            hideSearchBar={field.hideSearchBar ?? false}
            independent={independent}
            index={displayIndex as ExploreSearchIndex}
            isSuggestionsLoading={isOptionsLoading}
            key={field.key}
            label={translateWithNestedKeys(field.label, field.labelKeyOptions)}
            options={dropdownOptions}
            searchKey={field.key}
            selectedKeys={selectedKeys ?? []}
            showSelectedCounts={showSelectedCounts}
            triggerButtonSize="middle"
            onChange={(updatedValues) => {
              onFieldValueSelect({ ...field, value: updatedValues });
            }}
            onGetInitialOptions={(key) =>
              getInitialOptions(key, field.searchIndex, field.searchKey)
            }
            onSearch={(value, key) =>
              getFilterOptions(value, key, field.searchIndex, field.searchKey)
            }
          />
        );
      })}
      {additionalActions}
    </Space>
  );
};

export default ExploreQuickFilters;
