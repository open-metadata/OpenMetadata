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

import { PLACEHOLDER_ROUTE_FQN, ROUTES } from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { EntityType } from '../enums/entity.enum';
import globalSettingsClassBase from './GlobalSettingsClassBase';
import i18n from './i18next/LocalUtil';
import { getSettingPath } from './RouterUtils';
import { getEncodedFqn } from './StringUtils';

export interface SettingMenuItem {
  key: string;
  icon: SvgComponent;
  description: string;
  category?: string;
  label?: string;
  isBeta?: boolean;
  isProtected?: boolean;
  items?: SettingMenuItem[];
}

export const getGlobalSettingMenuItem = (
  args: SettingMenuItem
): SettingMenuItem => {
  return {
    ...args,
    items: args.items?.filter((item) => item.isProtected),
  };
};

const SETTING_OPTION_BY_ENTITY_TYPE: Partial<
  Record<EntityType, GlobalSettingOptions>
> = {
  [EntityType.TOPIC]: GlobalSettingOptions.TOPICS,
  [EntityType.DASHBOARD]: GlobalSettingOptions.DASHBOARDS,
  [EntityType.PIPELINE]: GlobalSettingOptions.PIPELINES,
  [EntityType.MLMODEL]: GlobalSettingOptions.MLMODELS,
  [EntityType.CONTAINER]: GlobalSettingOptions.CONTAINERS,
  [EntityType.DATABASE]: GlobalSettingOptions.DATABASES,
  [EntityType.DATABASE_SCHEMA]: GlobalSettingOptions.DATABASE_SCHEMA,
  [EntityType.GLOSSARY_TERM]: GlobalSettingOptions.GLOSSARY_TERM,
  [EntityType.CHART]: GlobalSettingOptions.CHARTS,
  [EntityType.DOMAIN]: GlobalSettingOptions.DOMAINS,
  [EntityType.STORED_PROCEDURE]: GlobalSettingOptions.STORED_PROCEDURES,
  [EntityType.SEARCH_INDEX]: GlobalSettingOptions.SEARCH_INDEXES,
  [EntityType.DASHBOARD_DATA_MODEL]: GlobalSettingOptions.DASHBOARD_DATA_MODEL,
  [EntityType.API_ENDPOINT]: GlobalSettingOptions.API_ENDPOINTS,
  [EntityType.API_COLLECTION]: GlobalSettingOptions.API_COLLECTIONS,
  [EntityType.DATA_PRODUCT]: GlobalSettingOptions.DATA_PRODUCT,
  [EntityType.METRIC]: GlobalSettingOptions.METRICS,
  [EntityType.DIRECTORY]: GlobalSettingOptions.DIRECTORIES,
  [EntityType.FILE]: GlobalSettingOptions.FILES,
  [EntityType.SPREADSHEET]: GlobalSettingOptions.SPREADSHEETS,
  [EntityType.WORKSHEET]: GlobalSettingOptions.WORKSHEETS,
};

export const getSettingOptionByEntityType = (entityType: EntityType) =>
  SETTING_OPTION_BY_ENTITY_TYPE[entityType] ?? GlobalSettingOptions.TABLES;

export const getCustomizePagePath = (personaFqn: string, pageFqn: string) => {
  const path = ROUTES.CUSTOMIZE_PAGE;

  return path
    .replaceAll(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(personaFqn))
    .replace(':pageFqn', pageFqn);
};

export const getSettingPageEntityBreadCrumb = (
  category: GlobalSettingsMenuCategory,
  entityName?: string,
  subCategory?: GlobalSettingOptions
) => {
  const categoryObject = globalSettingsClassBase.settingCategories[category];

  const subCategoryObject =
    globalSettingsClassBase.settingCategories[subCategory ?? ''];

  return [
    {
      name: i18n.t('label.setting-plural'),
      url: ROUTES.SETTINGS,
    },
    {
      name: categoryObject?.name ?? '',
      url: entityName ? getSettingPath(categoryObject.url) : '',
      activeTitle: !entityName,
    },
    ...(subCategory
      ? [
          {
            name: subCategoryObject?.name ?? '',
            url: entityName ? getSettingPath(subCategoryObject?.url ?? '') : '',
            activeTitle: !entityName,
          },
        ]
      : []),
    ...(entityName
      ? [
          {
            name: entityName,
            url: '',
            activeTitle: true,
          },
        ]
      : []),
  ];
};
