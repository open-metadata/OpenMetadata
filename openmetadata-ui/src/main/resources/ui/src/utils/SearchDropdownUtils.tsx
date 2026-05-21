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

import { Checkbox, MenuProps, Radio, Space, Typography } from 'antd';
import { isArray } from 'lodash';
import { Bucket } from 'Models';
import ProfilePicture from '../components/common/ProfilePicture/ProfilePicture';
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import {
  COMMON_DROPDOWN_ITEMS,
  DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS,
  GLOSSARY_ASSETS_DROPDOWN_ITEMS,
  LINEAGE_DROPDOWN_ITEMS,
  TAG_ASSETS_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';
import { NOT_INCLUDE_AGGREGATION_QUICK_FILTER } from '../constants/explore.constants';
import { EntityType } from '../enums/entity.enum';
import { getCountBadge } from '../utils/CommonUtils';
import searchClassBase from './SearchClassBase';

export const getDropDownItems = (index: string): ExploreQuickFilterField[] => {
  return searchClassBase.getDropDownItems(index);
};

export const getAssetsPageQuickFilters = (type?: AssetsOfEntity) => {
  switch (type) {
    case AssetsOfEntity.DOMAIN:
    case AssetsOfEntity.DATA_PRODUCT:
    case AssetsOfEntity.DATA_PRODUCT_INPUT_PORT:
    case AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT:
      return [...DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS];

    case AssetsOfEntity.GLOSSARY:
      return [...GLOSSARY_ASSETS_DROPDOWN_ITEMS];

    case AssetsOfEntity.TAG:
      return [...TAG_ASSETS_DROPDOWN_ITEMS];

    case AssetsOfEntity.LINEAGE:
      return [...LINEAGE_DROPDOWN_ITEMS];

    default:
      return [...COMMON_DROPDOWN_ITEMS];
  }
};

export const getSearchLabel = (itemLabel: string, searchKey: string) => {
  const regex = new RegExp(searchKey, 'gi');
  if (searchKey) {
    const result = itemLabel.replace(regex, (match) => `<mark>${match}</mark>`);

    return result;
  } else {
    return itemLabel;
  }
};

export const generateSearchDropdownLabel = (
  option: SearchDropdownOption,
  checked: boolean,
  searchKey: string,
  showProfilePicture: boolean,
  hideCounts = false,
  singleSelect = false
) => {
  const InputComponent = singleSelect ? Radio : Checkbox;

  return (
    <div className="d-flex justify-between">
      <Space align="start" className="m-x-sm" data-testid={option.key} size={8}>
        <InputComponent
          checked={checked}
          data-testid={`${option.key}-${singleSelect ? 'radio' : 'checkbox'}`}
          style={option.description ? { marginTop: 4 } : undefined}
        />
        {showProfilePicture && (
          <ProfilePicture
            displayName={option.label}
            name={option.label || ''}
            width="18"
          />
        )}
        <div>
          <Typography.Text
            ellipsis
            className="dropdown-option-label"
            title={option.label}>
            <span
              dangerouslySetInnerHTML={{
                __html: getSearchLabel(option.label, searchKey),
              }}
            />
          </Typography.Text>
          {option.description && (
            <Typography.Text
              className="text-xs d-block"
              data-testid={`${option.key}-description`}
              type="secondary">
              {option.description}
            </Typography.Text>
          )}
        </div>
      </Space>
      {!hideCounts && getCountBadge(option.count, 'm-r-sm', false)}
    </div>
  );
};

export const getSearchDropdownLabels = (
  optionsArray: SearchDropdownOption[],
  checked: boolean,
  searchKey = '',
  showProfilePicture = false,
  hideCounts = false,
  singleSelect = false
): MenuProps['items'] => {
  if (isArray(optionsArray)) {
    const sortedOptions = optionsArray.sort(
      (a, b) => (b.count ?? 0) - (a.count ?? 0)
    );

    return sortedOptions.map((option) => ({
      key: option.key,
      label: generateSearchDropdownLabel(
        option,
        checked,
        searchKey,
        showProfilePicture,
        hideCounts,
        singleSelect
      ),
    }));
  } else {
    return [];
  }
};

export const getSelectedOptionLabelString = (
  selectedOptions: SearchDropdownOption[],
  showAllOptions = false
) => {
  if (isArray(selectedOptions)) {
    const stringifiedOptions = selectedOptions.map((op) => op.label).join(', ');
    if (stringifiedOptions.length < 15 || showAllOptions) {
      return stringifiedOptions;
    } else {
      return `${stringifiedOptions.slice(0, 11)}...`;
    }
  } else {
    return '';
  }
};

export const getOptionsFromAggregationBucket = (buckets: Bucket[]) => {
  if (!buckets) {
    return [];
  }

  return buckets
    .filter(
      (item) =>
        !NOT_INCLUDE_AGGREGATION_QUICK_FILTER.includes(item.key as EntityType)
    )
    .map((option) => ({
      key: option.key,
      label: option.key,
      count: option.doc_count ?? 0,
    }));
};
