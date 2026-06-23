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
import { isEmpty, isEqual, uniqWith } from 'lodash';
import Qs from 'qs';
import { FC, useCallback, useMemo, useState } from 'react';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../hooks/useSearchStore';
import { QueryFilterInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import { getOptionsFromAggregationBucket } from '../../utils/AdvancedSearchPureUtils';
import { getEntityNameLabel } from '../../utils/EntityNameUtils';
import {
  getCombinedQueryFilterObject,
  getQuickFilterWithDeletedFlag,
} from '../../utils/ExplorePage/ExplorePageUtils';
import {
  getAggregationOptions,
  getCanonicalEntityType,
  getExploreQueryFilterMust,
} from '../../utils/ExploreUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../utils/ToastUtils';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { useAdvanceSearch } from './AdvanceSearchProvider/AdvanceSearchProvider.component';
import { ExploreSearchIndex } from './ExplorePage.interface';
import { ExploreQuickFiltersProps } from './ExploreQuickFilters.interface';
import QuickFilterDropdown from './QuickFilterDropdown';

const ENTITY_TYPE_FILTER_KEYS: ReadonlySet<string> = new Set([
  EntityFields.ENTITY_TYPE,
  EntityFields.ENTITY_TYPE_KEYWORD,
]);

const formatEntityTypeLabel = (value: string): string =>
  getEntityNameLabel(getCanonicalEntityType(value));

// Human-readable entity-type labels are an Explore-page affordance. The
// Untitled-UI drawer dropdown (Add Assets) keys its options off the raw label,
// so keep raw entity-type values there to preserve its stable option ids.
const getOptionLabelFormatter = (
  key: string,
  skipEntityTypeLabel = false
): ((value: string) => string) | undefined =>
  ENTITY_TYPE_FILTER_KEYS.has(key) && !skipEntityTypeLabel
    ? formatEntityTypeLabel
    : undefined;

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
  immediateApply = false,
  helperText,
  untitledDropdown = false,
}) => {
  const location = useCustomLocation();
  const [options, setOptions] = useState<SearchDropdownOption[]>();
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(false);
  const { queryFilter } = useAdvanceSearch();
  const { isNLPActive } = useSearchStore();
  const getStaticOptions = useCallback(
    (key: string) => fields.find((item) => item.key === key)?.options,
    [fields]
  );

  const { showDeleted, searchText } = useMemo(() => {
    const parsed = Qs.parse(
      location.search.startsWith('?')
        ? location.search.substring(1)
        : location.search
    );

    return {
      showDeleted: parsed.showDeleted === 'true',
      searchText: (parsed.search as string) ?? '',
    };
  }, [location.search]);

  // Get first index for display in SearchDropdown (which expects single index)
  const displayIndex = useMemo(
    () => (Array.isArray(index) ? index[0] : index),
    [index]
  );

  const hasSelectedFieldValues = useMemo(
    () => fields.some((field) => !isEmpty(field.value)),
    [fields]
  );

  // Facet options exclude the facet's own field (but keep every other
  // constraint): unselecting Column must reveal the other asset types still
  // available in the current browse location, and selecting values must not
  // shrink the list to just the selection.
  const getFacetQueryFilter = useCallback(
    (key: string) => {
      const isEntityTypeKey = ENTITY_TYPE_FILTER_KEYS.has(key);
      const otherFieldsMust = getExploreQueryFilterMust(
        fields.filter(
          (field) =>
            !isEmpty(field.value) &&
            field.key !== key &&
            !(isEntityTypeKey && ENTITY_TYPE_FILTER_KEYS.has(field.key))
        )
      );
      const otherFieldsFilter = isEmpty(otherFieldsMust)
        ? ''
        : JSON.stringify({ query: { bool: { must: otherFieldsMust } } });

      return getCombinedQueryFilterObject(
        getQuickFilterWithDeletedFlag(
          otherFieldsFilter,
          showDeleted
        ) as QueryFilterInterface,
        queryFilter as unknown as QueryFilterInterface,
        defaultQueryFilter as unknown as QueryFilterInterface
      );
    },
    [fields, showDeleted, queryFilter, defaultQueryFilter]
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

    // The page aggregations already reflect the browse-path scope (performFetch
    // combines browseQueryFilter), so they are reusable whenever no dropdown
    // field has a value to exclude from its own facet — even when only the
    // browse filter is active. A per-facet fetch is only needed once a field
    // value must be excluded from its own aggregation.
    const canUsePageAggregations = !hasSelectedFieldValues;

    let buckets = canUsePageAggregations
      ? aggregations?.[key]?.buckets
      : undefined;
    if (!buckets) {
      const res = await getAggregationOptions(
        searchIndexToUse,
        searchKeyToUse,
        '',
        JSON.stringify(getFacetQueryFilter(key)),
        independent,
        showDeleted,
        optionPageSize,
        isNLPActive,
        searchText
      );

      buckets =
        res.data.aggregations[`sterms#${searchKeyToUse}`]?.buckets ?? [];
    }

    setOptions(
      uniqWith(
        getOptionsFromAggregationBucket(
          buckets,
          getOptionLabelFormatter(key, untitledDropdown)
        ),
        isEqual
      )
    );
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

      const res = await getAggregationOptions(
        searchIndexToUse,
        searchKeyToUse,
        value,
        JSON.stringify(getFacetQueryFilter(key)),
        independent,
        showDeleted,
        undefined,
        isNLPActive,
        searchText
      );

      const buckets =
        res.data.aggregations[`sterms#${searchKeyToUse}`]?.buckets ?? [];
      setOptions(
        uniqWith(
          getOptionsFromAggregationBucket(
            buckets,
            getOptionLabelFormatter(key, untitledDropdown)
          ),
          isEqual
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  return (
    <Space wrap className="explore-quick-filters-container" size={[8, 8]}>
      {fields.map((field) => {
        const hasNullOption = fieldsWithNullValues.includes(
          field.key as EntityFields
        );
        const dropdownOptions = field.options ?? options ?? [];

        return untitledDropdown ? (
          <QuickFilterDropdown
            hasNullOption={hasNullOption}
            hideCounts={field.hideCounts ?? false}
            hideSearchBar={field.hideSearchBar ?? false}
            independent={independent}
            isSuggestionsLoading={isOptionsLoading}
            key={field.key}
            label={translateWithNestedKeys(field.label, field.labelKeyOptions)}
            options={dropdownOptions}
            searchKey={field.key}
            selectedKeys={field.value ?? []}
            showSelectedCounts={showSelectedCounts}
            singleSelect={field.singleSelect}
            onChange={(updatedValues) =>
              onFieldValueSelect({ ...field, value: updatedValues })
            }
            onGetInitialOptions={(key) =>
              getInitialOptions(key, field.searchIndex, field.searchKey)
            }
            onSearch={(value, key) =>
              getFilterOptions(value, key, field.searchIndex, field.searchKey)
            }
          />
        ) : (
          <SearchDropdown
            highlight
            dropdownClassName={field.dropdownClassName}
            hasNullOption={hasNullOption}
            helperText={helperText}
            hideCounts={field.hideCounts ?? false}
            hideSearchBar={field.hideSearchBar ?? false}
            immediateApply={immediateApply}
            independent={independent}
            index={displayIndex as ExploreSearchIndex}
            isSuggestionsLoading={isOptionsLoading}
            key={field.key}
            label={translateWithNestedKeys(field.label, field.labelKeyOptions)}
            options={dropdownOptions}
            searchKey={field.key}
            selectedKeys={field.value ?? []}
            showSelectedCounts={showSelectedCounts}
            singleSelect={field.singleSelect}
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
