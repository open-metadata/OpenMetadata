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

import i18next from 'i18next';
import { PLACEHOLDER_ROUTE_FQN, ROUTES } from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { EntityType } from '../enums/entity.enum';
import globalSettingsClassBase from './GlobalSettingsClassBase';
import { getSettingPath } from './RouterUtils';
import { getEncodedFqn } from './StringsUtils';

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

export const getSettingOptionByEntityType = (entityType: EntityType) => {
  switch (entityType) {
    case EntityType.TOPIC:
      return GlobalSettingOptions.TOPICS;
    case EntityType.DASHBOARD:
      return GlobalSettingOptions.DASHBOARDS;
    case EntityType.PIPELINE:
      return GlobalSettingOptions.PIPELINES;
    case EntityType.MLMODEL:
      return GlobalSettingOptions.MLMODELS;
    case EntityType.CONTAINER:
      return GlobalSettingOptions.CONTAINERS;
    case EntityType.DATABASE:
      return GlobalSettingOptions.DATABASES;
    case EntityType.DATABASE_SCHEMA:
      return GlobalSettingOptions.DATABASE_SCHEMA;
    case EntityType.GLOSSARY_TERM:
      return GlobalSettingOptions.GLOSSARY_TERM;
    case EntityType.CHART:
      return GlobalSettingOptions.CHARTS;
    case EntityType.DOMAIN:
      return GlobalSettingOptions.DOMAINS;
    case EntityType.STORED_PROCEDURE:
      return GlobalSettingOptions.STORED_PROCEDURES;
    case EntityType.SEARCH_INDEX:
      return GlobalSettingOptions.SEARCH_INDEXES;
    case EntityType.DASHBOARD_DATA_MODEL:
      return GlobalSettingOptions.DASHBOARD_DATA_MODEL;
    case EntityType.API_ENDPOINT:
      return GlobalSettingOptions.API_ENDPOINTS;
    case EntityType.API_COLLECTION:
      return GlobalSettingOptions.API_COLLECTIONS;
    case EntityType.DATA_PRODUCT:
      return GlobalSettingOptions.DATA_PRODUCT;
    case EntityType.METRIC:
      return GlobalSettingOptions.METRICS;
    case EntityType.DIRECTORY:
      return GlobalSettingOptions.DIRECTORIES;
    case EntityType.FILE:
      return GlobalSettingOptions.FILES;
    case EntityType.SPREADSHEET:
      return GlobalSettingOptions.SPREADSHEETS;
    case EntityType.WORKSHEET:
      return GlobalSettingOptions.WORKSHEETS;

    case EntityType.TABLE:
    default:
      return GlobalSettingOptions.TABLES;
  }
};

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
      name: i18next.t('label.setting-plural'),
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
