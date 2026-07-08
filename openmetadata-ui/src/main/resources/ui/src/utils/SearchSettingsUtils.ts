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
  AssetTypeConfiguration,
  BoostMode,
  Modifier,
  RankingStage,
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

const PRIMARY_NAME_FIELDS = ['name', 'displayName', 'fullyQualifiedName'];
const RANKING_FIELD_SUFFIXES = ['.keyword', '.ngram', '.compound'];

const normalizeRankingField = (field: string) => {
  for (const suffix of RANKING_FIELD_SUFFIXES) {
    if (field.endsWith(suffix)) {
      return field.slice(0, -suffix.length);
    }
  }

  return field;
};

const isPrimaryNameField = (field: string) =>
  PRIMARY_NAME_FIELDS.includes(normalizeRankingField(field));

const isDescriptionContextField = (field: string) => {
  const lowerField = field.toLowerCase();

  return (
    lowerField.includes('description') ||
    lowerField === 'querytext' ||
    lowerField === 'extractedtext'
  );
};

const withFallbackFields = (
  fields: Set<string>,
  fallbackFields: string[] = []
) => {
  const rankingFields = [...fields];

  return rankingFields.length > 0 ? rankingFields : fallbackFields;
};

const deriveExactNameFields = (
  configuredFields: string[],
  fallbackFields: string[]
) => {
  const fields = new Set<string>();

  ['displayName.keyword', 'name.keyword', 'fullyQualifiedName.keyword'].forEach(
    (field) => {
      if (configuredFields.includes(field)) {
        fields.add(field);
      }
    }
  );

  if (configuredFields.includes('displayName')) {
    fields.add('displayName.keyword');
  }
  if (configuredFields.includes('name')) {
    fields.add('name.keyword');
  }
  if (configuredFields.includes('fullyQualifiedName')) {
    fields.add('fullyQualifiedName');
  }

  return withFallbackFields(fields, fallbackFields);
};

const deriveCloseNameFields = (
  configuredFields: string[],
  fallbackFields: string[]
) => {
  const fields = new Set(
    configuredFields.filter(
      (field) =>
        isPrimaryNameField(field) &&
        !field.endsWith('.keyword') &&
        !field.endsWith('.ngram')
    )
  );

  return withFallbackFields(fields, fallbackFields);
};

const deriveDescriptionFields = (
  configuredFields: string[],
  fallbackFields: string[]
) => {
  const fields = new Set(configuredFields.filter(isDescriptionContextField));

  return withFallbackFields(fields, fallbackFields);
};

const deriveStructuralFields = (
  configuredFields: string[],
  fallbackFields: string[]
) => {
  const fields = new Set(
    configuredFields.filter(
      (field) =>
        !isPrimaryNameField(field) &&
        !isDescriptionContextField(field) &&
        !field.startsWith('extension.')
    )
  );

  return withFallbackFields(fields, fallbackFields);
};

const deriveRankingStageFields = (
  stage: RankingStage,
  configuredFields: string[]
) => {
  const fallbackFields = stage.fields ?? [];

  if (configuredFields.length === 0) {
    return fallbackFields;
  }

  const stageName = stage.name.toLowerCase();

  if (stageName.includes('exact')) {
    return deriveExactNameFields(configuredFields, fallbackFields);
  }
  if (stageName.includes('close') || stageName.includes('name')) {
    return deriveCloseNameFields(configuredFields, fallbackFields);
  }
  if (stageName.includes('description')) {
    return deriveDescriptionFields(configuredFields, fallbackFields);
  }

  return deriveStructuralFields(configuredFields, fallbackFields);
};

export const getEffectiveRankingConfiguration = (
  searchConfig: SearchSettings | undefined,
  assetConfig: AssetTypeConfiguration | null
) => {
  if (assetConfig?.ranking) {
    return assetConfig.ranking;
  }

  const defaultRanking = searchConfig?.defaultConfiguration?.ranking;

  if (!defaultRanking) {
    return undefined;
  }

  const configuredFields =
    assetConfig?.searchFields?.map((fieldBoost) => fieldBoost.field) ?? [];

  return {
    ...defaultRanking,
    signals: defaultRanking.signals
      ? {
          ...defaultRanking.signals,
          fields: defaultRanking.signals.fields
            ? [...defaultRanking.signals.fields]
            : undefined,
        }
      : undefined,
    stages: defaultRanking.stages?.map((stage) => ({
      ...stage,
      fields: deriveRankingStageFields(stage, configuredFields),
    })),
    stopWords: defaultRanking.stopWords
      ? [...defaultRanking.stopWords]
      : undefined,
    stopWordsByLanguage: defaultRanking.stopWordsByLanguage
      ? { ...defaultRanking.stopWordsByLanguage }
      : undefined,
  };
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
