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

import { Divider, Space } from 'antd';
import { AxiosError } from 'axios';
import { SearchIndex } from 'enums/search.enum';
import { isEqual, isUndefined, uniqWith } from 'lodash';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAdvancedFieldDefaultOptions,
  getAdvancedFieldOptions,
  getTagSuggestions,
  getUserSuggestions,
} from 'rest/miscAPI';
import {
  MISC_FIELDS,
  OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY,
} from '../../constants/AdvancedSearch.constants';
import {
  getAdvancedField,
  getOptionsObject,
  getOptionTextFromKey,
} from '../../utils/AdvancedSearchUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { EntityUnion } from './explore.interface';
import { ExploreQuickFiltersProps } from './ExploreQuickFilters.interface';

const ExploreQuickFilters: FC<ExploreQuickFiltersProps> = ({
  fields,
  onAdvanceSearch,
  index,
  onFieldValueSelect,
}) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<SearchDropdownOption[]>();
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(false);

  const fetchDefaultOptions = async (
    index: SearchIndex | SearchIndex[],
    key: string
  ) => {
    const res = await getAdvancedFieldDefaultOptions(index, key);

    const buckets = res.data.aggregations[`sterms#${key}`].buckets;

    const optionsArray = buckets.map((option) => ({
      key: option.key,
      label: option.key,
    }));

    setOptions(uniqWith(optionsArray, isEqual));
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
      if (value) {
        const advancedField = getAdvancedField(key);
        if (!MISC_FIELDS.includes(key)) {
          const res = await getAdvancedFieldOptions(
            value,
            index,
            advancedField
          );

          const suggestOptions =
            res.data.suggest['metadata-suggest'][0].options ?? [];

          const formattedSuggestions = suggestOptions.map((op) => ({
            text: getOptionTextFromKey(index, op, key),
            source: op._source as EntityUnion,
          }));

          const optionsArray = getOptionsObject(key, formattedSuggestions);

          setOptions(uniqWith(optionsArray, isEqual));
        } else {
          if (key === 'tags.tagFQN') {
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
        }
      } else {
        getInitialOptions(key);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  return (
    <Space wrap className="explore-quick-filters-container" size={[16, 16]}>
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
      <Divider className="m-0" type="vertical" />
      <span
        className="tw-text-primary tw-self-center tw-cursor-pointer"
        data-testid="advance-search-button"
        onClick={onAdvanceSearch}>
        {t('label.advanced-entity', {
          entity: t('label.search'),
        })}
      </span>
    </Space>
  );
};

export default ExploreQuickFilters;
