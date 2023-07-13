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
import { SearchIndex } from 'enums/search.enum';
import { isEqual, isUndefined, uniqWith } from 'lodash';
import { Bucket } from 'Models';
import React, { FC, useState } from 'react';
import {
  getAdvancedFieldDefaultOptions,
  getAdvancedFieldOptions,
  getTagSuggestions,
  getUserSuggestions,
} from 'rest/miscAPI';
import { getTags } from 'rest/tagAPI';
import {
  MISC_FIELDS,
  OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY,
} from '../../constants/AdvancedSearch.constants';
import {
  getAdvancedField,
  getOptionsFromAggregationBucket,
  getOptionTextFromKey,
} from '../../utils/AdvancedSearchUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { ExploreQuickFiltersProps } from './ExploreQuickFilters.interface';

const ExploreQuickFilters: FC<ExploreQuickFiltersProps> = ({
  fields,
  index,
  aggregations,
  onFieldValueSelect,
}) => {
  const [options, setOptions] = useState<SearchDropdownOption[]>();
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(false);
  const [tierOptions, setTierOptions] = useState<SearchDropdownOption[]>();

  const fetchDefaultOptions = async (
    index: SearchIndex | SearchIndex[],
    key: string
  ) => {
    let buckets: Bucket[] = [];

    if (aggregations?.[key] && key !== 'tier.tagFQN') {
      buckets = aggregations[key].buckets;
    } else {
      const [res, tierTags] = await Promise.all([
        getAdvancedFieldDefaultOptions(index, key),
        key === 'tier.tagFQN'
          ? getTags({ parent: 'Tier' })
          : Promise.resolve(null),
      ]);

      buckets = res.data.aggregations[`sterms#${key}`].buckets;

      if (key === 'tier.tagFQN' && tierTags) {
        const options = tierTags.data.map((option) => {
          const bucketItem = buckets.find(
            (item) => item.key === option.fullyQualifiedName
          );

          return {
            key: option.fullyQualifiedName ?? '',
            label: option.name,
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
      if (aggregations?.[key] && key !== 'tier.tagFQN') {
        const defaultOptions = getOptionsFromAggregationBucket(
          aggregations[key].buckets
        );
        const filteredOptions = defaultOptions.filter((option) => {
          return option.label.toLowerCase().includes(value.toLowerCase());
        });
        setOptions(filteredOptions);
      } else if (key === 'tier.tagFQN') {
        const filteredOptions = tierOptions?.filter((option) => {
          return option.label.toLowerCase().includes(value.toLowerCase());
        });
        setOptions(filteredOptions);
      } else if (!MISC_FIELDS.includes(key)) {
        const advancedField = getAdvancedField(key);
        const res = await getAdvancedFieldOptions(value, index, advancedField);

        const suggestOptions =
          res.data.suggest['metadata-suggest'][0].options ?? [];

        const formattedSuggestions = suggestOptions.map((option) => {
          const optionsText = getOptionTextFromKey(index, option, key);

          return {
            key: optionsText,
            label: optionsText,
          };
        });

        setOptions(uniqWith(formattedSuggestions, isEqual));
      } else if (key === 'tags.tagFQN') {
        const res = await getTagSuggestions(value);

        const suggestOptions =
          res.data.suggest['metadata-suggest'][0].options ?? [];

        const formattedSuggestions = suggestOptions
          .filter((op) => !isUndefined(op._source.fullyQualifiedName))
          .map((op) => op._source.fullyQualifiedName as string);

        const optionsArray = formattedSuggestions.map((op) => ({
          key: op,
          label: op,
        }));

        setOptions(uniqWith(optionsArray, isEqual));
      } else {
        const res = await getUserSuggestions(value);

        const suggestOptions =
          res.data.suggest['metadata-suggest'][0].options ?? [];

        const formattedSuggestions = suggestOptions.map((op) => ({
          key: op._source.displayName ?? op._source.name,
          label: op._source.displayName ?? op._source.name,
        }));

        setOptions(uniqWith(formattedSuggestions, isEqual));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  return (
    <Space wrap className="explore-quick-filters-container" size={[4, 0]}>
      {fields.map((field) => (
        <SearchDropdown
          highlight
          isSuggestionsLoading={isOptionsLoading}
          key={field.key}
          label={field.label}
          options={options || []}
          searchKey={field.key}
          selectedKeys={field.value || []}
          onChange={(updatedValues) => {
            onFieldValueSelect({ ...field, value: updatedValues });
          }}
          onGetInitialOptions={getInitialOptions}
          onSearch={getFilterOptions}
        />
      ))}
    </Space>
  );
};

export default ExploreQuickFilters;
