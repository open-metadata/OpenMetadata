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
import { UIPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import {
  BoostMode,
  ScoreMode,
  SearchSettings,
} from '../generated/configuration/searchSettings';
import {
  MatchFields,
  SettingCategoryData,
} from '../pages/SearchSettingsPage/searchSettings.interface';
import globalSettingsClassBase from './GlobalSettingsClassBase';

export const getSearchSettingCategories = (
  permissions: UIPermission,
  isAdminUser: boolean
): SettingCategoryData[] | undefined => {
  let categoryItem = globalSettingsClassBase
    .getGlobalSettingsMenuWithPermission(permissions, isAdminUser)
    .find((item) => item.key === 'searchSettingCategories');

  if (categoryItem) {
    categoryItem = {
      ...categoryItem,
      items: categoryItem?.items?.filter(
        (item) => item.isProtected
      ) as SettingCategoryData[],
    };
  }

  return categoryItem?.items as SettingCategoryData[];
};

export const getEntitySearchConfig = (
  searchConfig: SearchSettings | undefined,
  entityType: string
) => {
  if (!searchConfig?.assetTypeConfigurations || !entityType) {
    return null;
  }

  return searchConfig.assetTypeConfigurations.find(
    (config) => config.assetType.toLowerCase() === entityType.toLowerCase()
  );
};

export const boostModeOptions = Object.values(BoostMode).map((value) => ({
  label: value,
  value: value,
}));

export const scoreModeOptions = Object.values(ScoreMode).map((value) => ({
  label: value,
  value: value,
}));

export const getSelectedMatchType = (
  fieldName: string,
  matchFields: MatchFields
) => {
  if (matchFields.mustMatch.includes(fieldName)) {
    return 'mustMatch';
  }
  if (matchFields.shouldMatch.includes(fieldName)) {
    return 'shouldMatch';
  }

  return 'mustNotMatch';
};
