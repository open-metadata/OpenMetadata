/*
 *  Copyright 2021 Collate
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

import { Divider, Dropdown, Menu, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAdvancedFieldDefaultOptions,
  getAdvancedFieldOptions,
  getTagSuggestions,
  getUserSuggestions,
} from '../../axiosAPIs/miscAPI';
import { MISC_FIELDS } from '../../constants/AdvancedSearch.constants';
import {
  getAdvancedField,
  getDropDownItems,
  getFieldsWithDefaultFlags,
  getShouldShowCloseIcon,
} from '../../utils/AdvancedSearchUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import { showErrorToast } from '../../utils/ToastUtils';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import {
  ExploreQuickFiltersProps,
  FilterFieldsMenuItem,
} from './ExploreQuickFilters.interface';

const ExploreQuickFilters: FC<ExploreQuickFiltersProps> = ({
  fields,
  onFieldRemove,
  onClear,
  onAdvanceSearch,
  index,
  onClearSelection,
  onFieldValueSelect,
  onFieldSelect,
}) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<string[]>();
  const handleMenuItemClick = useCallback((menuInfo, label) => {
    onFieldSelect(menuInfo.key, label);
  }, []);

  const menuItems: FilterFieldsMenuItem[] = useMemo(() => {
    const dropdownItems = getDropDownItems(index);

    return getFieldsWithDefaultFlags(dropdownItems);
  }, [index]);

  const menu = useMemo(() => {
    return (
      <Menu
        items={menuItems.map((option) => ({
          ...option,
          disabled: Boolean(fields.find((f) => f.key === option.key)),
          onClick: (menuInfo) => handleMenuItemClick(menuInfo, option.label),
          'data-testid': 'dropdown-menu-item',
        }))}
      />
    );
  }, [onFieldSelect, fields, menuItems]);

  useEffect(() => {
    onClear();
    handleMenuItemClick(menuItems[0], menuItems[0].label);
    handleMenuItemClick(menuItems[1], menuItems[1].label);
  }, [menuItems]);

  const fetchOptions = (query: string, fieldKey: string) => {
    const advancedField = getAdvancedField(fieldKey);
    if (!MISC_FIELDS.includes(fieldKey)) {
      getAdvancedFieldOptions(query, index, advancedField)
        .then((res) => {
          const suggestOptions =
            res.data.suggest['metadata-suggest'][0].options ?? [];
          const uniqueOptions = [
            ...new Set(suggestOptions.map((op) => op.text)),
          ];
          setOptions(uniqueOptions);
        })
        .catch((err: AxiosError) => showErrorToast(err));
    } else {
      if (fieldKey === 'tags.tagFQN') {
        getTagSuggestions(query)
          .then((res) => {
            const suggestOptions =
              res.data.suggest['metadata-suggest'][0].options ?? [];
            const uniqueOptions = [
              ...new Set(
                suggestOptions
                  .filter((op) => !isUndefined(op._source.fullyQualifiedName))
                  .map((op) => op._source.fullyQualifiedName as string)
              ),
            ];
            setOptions(uniqueOptions);
          })
          .catch((err: AxiosError) => showErrorToast(err));
      } else {
        getUserSuggestions(query)
          .then((res) => {
            const suggestOptions =
              res.data.suggest['metadata-suggest'][0].options ?? [];
            const uniqueOptions = [
              ...new Set(suggestOptions.map((op) => op._source.name)),
            ];
            setOptions(uniqueOptions);
          })
          .catch((err: AxiosError) => showErrorToast(err));
      }
    }
  };

  const getFilterOptions = async (value: string, key: string) => {
    if (value) {
      fetchOptions(value, key);
    } else {
      const res = await getAdvancedFieldDefaultOptions(index, key);
      const buckets = res.data.aggregations[`sterms#${key}`].buckets;
      setOptions(buckets.map((option) => option.key));
    }
  };

  return (
    <Space wrap size={[16, 16]}>
      {fields.map((field) => {
        const showClearAllBtn = field.value && field.value.length > 1;

        return (
          <SearchDropdown
            key={field.key}
            label={field.label}
            options={options || []}
            searchKey={field.key}
            selectedKeys={field.value || []}
            showClearAllBtn={showClearAllBtn}
            showCloseIcon={getShouldShowCloseIcon(menuItems, field.key)}
            onChange={(updatedValues) => {
              onFieldValueSelect({ ...field, value: updatedValues });
            }}
            onClearSelection={onClearSelection}
            onRemove={onFieldRemove}
            onSearch={getFilterOptions}
          />
        );
      })}
      <Dropdown
        className="cursor-pointer"
        data-testid="quick-filter-dropdown"
        overlay={menu}
        trigger={['click']}>
        <Space size={4}>
          <Typography.Text>{t('label.more')}</Typography.Text>
          <DropDownIcon className="flex self-center" />
        </Space>
      </Dropdown>
      <Divider type="vertical" />
      <span
        className="tw-text-primary tw-self-center tw-cursor-pointer"
        data-testid="advance-search-button"
        onClick={onAdvanceSearch}>
        Advance Search
      </span>
    </Space>
  );
};

export default ExploreQuickFilters;
