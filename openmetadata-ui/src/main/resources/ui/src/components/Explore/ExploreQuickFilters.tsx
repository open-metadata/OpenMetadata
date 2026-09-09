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

import { FilterSelect } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, isEmpty, isEqual, uniqWith } from 'lodash';
import Qs from 'qs';
import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NULL_OPTION_KEY } from '../../constants/AdvancedSearch.constants';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../hooks/useSearchStore';
import type { QueryFilterInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import {
  getOptionsFromAggregationBucket,
  getQuickFilterLabelFormatter,
  getQuickFilterSourceFields,
} from '../../utils/AdvancedSearchPureUtils';
import { getServiceLogo } from '../../utils/EntityDisplayUtils';
import { EntityIconSize } from '../../utils/EntityIconUtils';
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
import searchClassBase from '../../utils/SearchClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { useAdvanceSearch } from './AdvanceSearchProvider/AdvanceSearchProvider.component';
import { ExploreQuickFiltersProps } from './ExploreQuickFilters.interface';

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
): ((value: string) => string) | undefined => {
  if (ENTITY_TYPE_FILTER_KEYS.has(key)) {
    return skipEntityTypeLabel ? undefined : formatEntityTypeLabel;
  }

  return getQuickFilterLabelFormatter(key);
};

const addOptionIcons = (
  key: string,
  opts: SearchDropdownOption[]
): SearchDropdownOption[] => {
  if (ENTITY_TYPE_FILTER_KEYS.has(key)) {
    return opts.map((opt) => ({
      ...opt,
      icon:
        searchClassBase.getEntityIconWithBg(
          getCanonicalEntityType(opt.key),
          EntityIconSize.Size14
        ) ?? undefined,
    }));
  }

  if (key === EntityFields.SERVICE_TYPE) {
    return opts.map((opt) => ({
      ...opt,
      icon:
        getServiceLogo(opt.key, 'tw:size-3.5 tw:object-contain') ?? undefined,
    }));
  }

  if (key === EntityFields.DOMAINS) {
    const domainIcon =
      searchClassBase.getEntityIconWithBg(
        EntityType.DOMAIN,
        EntityIconSize.Size14
      ) ?? undefined;

    return opts.map((opt) => ({ ...opt, icon: domainIcon }));
  }

  return opts;
};

const ExploreQuickFilters: FC<ExploreQuickFiltersProps> = ({
  fields,
  index,
  aggregations,
  independent = false,
  onFieldValueSelect,
  fieldsWithNullValues = [],
  defaultQueryFilter,
  optionPageSize,
  additionalActions,
  immediateApply = false,
  helperText,
  untitledDropdown = false,
}) => {
  const location = useCustomLocation();
  const [options, setOptions] = useState<SearchDropdownOption[]>();
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(false);
  const { t } = useTranslation();

  // Every dropdown writes into this one `options` state, so only the newest
  // fetch may write — otherwise a late response repaints the dropdown that
  // opened after it with the previous field's values.
  const optionsRequestIdRef = useRef(0);
  const startOptionsRequest = () => ++optionsRequestIdRef.current;
  const isLatestOptionsRequest = (requestId: number) =>
    requestId === optionsRequestIdRef.current;
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
    requestId: number,
    fieldSearchIndex?: SearchIndex,
    fieldSearchKey?: string,
    sourceFields?: string
  ) => {
    const staticOptions = getStaticOptions(key);
    if (staticOptions) {
      setOptions(addOptionIcons(key, staticOptions));

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
    const canUsePageAggregations = !hasSelectedFieldValues && !sourceFields;

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
        searchText,
        sourceFields
      );

      buckets =
        res.data.aggregations[`sterms#${searchKeyToUse}`]?.buckets ?? [];
    }

    if (!isLatestOptionsRequest(requestId)) {
      return;
    }

    setOptions(
      addOptionIcons(
        key,
        uniqWith(
          getOptionsFromAggregationBucket(
            buckets,
            getOptionLabelFormatter(key, untitledDropdown),
            sourceFields
          ),
          isEqual
        )
      )
    );
  };

  const getInitialOptions = async (
    key: string,
    fieldSearchIndex?: SearchIndex,
    fieldSearchKey?: string,
    sourceFields?: string
  ) => {
    const requestId = startOptionsRequest();
    const staticOptions = getStaticOptions(key);
    if (staticOptions) {
      setOptions(addOptionIcons(key, staticOptions));
      // Owns the newest request, so no in-flight fetch will clear the loader.
      setIsOptionsLoading(false);

      return;
    }

    setIsOptionsLoading(true);
    setOptions([]);
    try {
      await fetchDefaultOptions(
        index,
        key,
        requestId,
        fieldSearchIndex,
        fieldSearchKey,
        sourceFields
      );
    } catch (error) {
      if (isLatestOptionsRequest(requestId)) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (isLatestOptionsRequest(requestId)) {
        setIsOptionsLoading(false);
      }
    }
  };

  const getFilterOptions = async (
    value: string,
    key: string,
    fieldSearchIndex?: SearchIndex,
    fieldSearchKey?: string,
    sourceFields?: string
  ) => {
    const requestId = startOptionsRequest();
    const staticOptions = getStaticOptions(key);
    if (staticOptions) {
      const filteredOptions = value
        ? staticOptions.filter((option) =>
            option.label.toLowerCase().includes(value.toLowerCase())
          )
        : staticOptions;
      setOptions(addOptionIcons(key, filteredOptions));
      // Owns the newest request, so no in-flight fetch will clear the loader.
      setIsOptionsLoading(false);

      return;
    }

    setIsOptionsLoading(true);
    setOptions([]);
    try {
      if (!value) {
        getInitialOptions(key, fieldSearchIndex, fieldSearchKey, sourceFields);

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
        searchText,
        sourceFields
      );

      const buckets =
        res.data.aggregations[`sterms#${searchKeyToUse}`]?.buckets ?? [];

      if (!isLatestOptionsRequest(requestId)) {
        return;
      }

      setOptions(
        addOptionIcons(
          key,
          uniqWith(
            getOptionsFromAggregationBucket(
              buckets,
              getOptionLabelFormatter(key, untitledDropdown),
              sourceFields
            ),
            isEqual
          )
        )
      );
    } catch (error) {
      if (isLatestOptionsRequest(requestId)) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (isLatestOptionsRequest(requestId)) {
        setIsOptionsLoading(false);
      }
    }
  };

  // The legacy dropdowns debounced their own search input; FilterSelect
  // reports every keystroke, so debounce here before hitting aggregations.
  const getFilterOptionsRef = useRef(getFilterOptions);
  getFilterOptionsRef.current = getFilterOptions;
  const debouncedSearch = useMemo(
    () =>
      debounce(
        (
          value: string,
          key: string,
          fieldSearchIndex?: SearchIndex,
          fieldSearchKey?: string,
          sourceFields?: string
        ) =>
          getFilterOptionsRef.current(
            value,
            key,
            fieldSearchIndex,
            fieldSearchKey,
            sourceFields
          ),
        500
      ),
    []
  );

  return (
    <div className="explore-quick-filters-container tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      {fields.map((field) => {
        const hasNullOption = fieldsWithNullValues.includes(
          field.key as EntityFields
        );
        const dropdownOptions = field.options ?? options ?? [];
        const label = translateWithNestedKeys(
          field.label,
          field.labelKeyOptions
        );
        const selectedOptions = field.value ?? [];
        const nullOption = hasNullOption
          ? {
              value: NULL_OPTION_KEY,
              label: t('label.no-entity', { entity: label }),
            }
          : undefined;

        const handleChange = (values: string[]) => {
          // Keep the option objects (labels, counts) for the values that stay
          // selected; a value with no known option keeps its key as label.
          const knownOptions = new Map(
            [...selectedOptions, ...dropdownOptions].map((option) => [
              option.key,
              option,
            ])
          );
          onFieldValueSelect({
            ...field,
            value: values.map((value) => {
              if (value === NULL_OPTION_KEY && nullOption) {
                return { key: NULL_OPTION_KEY, label: nullOption.label };
              }

              return knownOptions.get(value) ?? { key: value, label: value };
            }),
          });
        };

        return (
          <FilterSelect
            commitMode={immediateApply ? 'immediate' : 'staged'}
            data-testid={`search-dropdown-${field.key}`}
            helperText={helperText}
            hideCounts={field.hideCounts ?? false}
            isLoading={isOptionsLoading}
            key={field.key}
            label={label}
            nullOption={nullOption}
            options={dropdownOptions.map((option) => ({
              value: option.key,
              label: option.label,
              textValue: option.label,
              count: option.count,
              icon: option.icon,
            }))}
            resolveMissingLabel={(value) =>
              selectedOptions.find((option) => option.key === value)?.label ??
              value
            }
            searchable={!(field.hideSearchBar ?? false)}
            selectedValues={selectedOptions.map((option) => option.key)}
            selectionMode={field.singleSelect ? 'single' : 'multiple'}
            showSelectAll={!field.singleSelect}
            triggerVariant="button"
            onChange={handleChange}
            onOpenChange={(open) => {
              if (open) {
                getInitialOptions(
                  field.key,
                  field.searchIndex,
                  field.searchKey,
                  getQuickFilterSourceFields(field)
                );
              }
            }}
            onSearch={(value) =>
              debouncedSearch(
                value,
                field.key,
                field.searchIndex,
                field.searchKey,
                getQuickFilterSourceFields(field)
              )
            }
          />
        );
      })}
      {additionalActions}
    </div>
  );
};

export default ExploreQuickFilters;
