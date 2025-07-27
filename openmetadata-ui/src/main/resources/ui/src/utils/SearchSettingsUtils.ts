/*
 *  Copyright 2025 Collate.
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
import { DefaultOptionType } from 'antd/lib/select';
import { startCase } from 'lodash';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { UIPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import {
  BoostMode,
  Modifier,
  ScoreMode,
  SearchSettings,
} from '../generated/configuration/searchSettings';
import { SettingCategoryData } from '../pages/SearchSettingsPage/searchSettings.interface';
import globalSettingsClassBase from './GlobalSettingsClassBase';

/**
 * Get search setting categories based on permissions and admin status
 * @param permissions User permissions
 * @param isAdminUser Whether the user is an admin
 * @returns Array of setting category data or undefined if no categories are found
 */
export const getSearchSettingCategories = (
  permissions: UIPermission,
  isAdminUser: boolean
): SettingCategoryData[] | undefined => {
  const categoryItem = globalSettingsClassBase
    .getGlobalSettingsMenuWithPermission(permissions, isAdminUser)
    .find((item) => item.key === GlobalSettingsMenuCategory.PREFERENCES)
    ?.items?.find(
      (item) =>
        item.key ===
        `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}`
    );

  return categoryItem
    ? (categoryItem?.items?.filter(
        (item) => item.isProtected
      ) as SettingCategoryData[])
    : [];
};

/**
 * Get entity search configuration based on search settings and entity type
 * @param searchConfig Search settings configuration
 * @param entityType Entity type to search for
 * @returns Entity search configuration or null if no configuration is found
 */
export const getEntitySearchConfig = (
  searchConfig: SearchSettings | undefined,
  entityType: string
) => {
  if (!searchConfig?.assetTypeConfigurations || !entityType) {
    return null;
  }

  return searchConfig.assetTypeConfigurations.find(
    (config) => config.assetType === entityType
  );
};

export const boostModeOptions = Object.values(BoostMode).map((value) => ({
  label: startCase(value),
  value: value,
}));

export const scoreModeOptions = Object.values(ScoreMode).map((value) => ({
  label: startCase(value),
  value: value,
}));

export const modifierOptions = Object.values(Modifier).map((value) => ({
  label: value,
  value: value,
}));

/**
 * Filter function for select options based on input value
 * @param input Input string to filter by
 * @param option Option object containing value
 * @returns boolean indicating if option matches input
 */
export const getFilterOptions = (
  input: string,
  option: DefaultOptionType | undefined
): boolean => {
  return (option?.value?.toString().toLowerCase() ?? '').includes(
    input.toLowerCase()
  );
};
