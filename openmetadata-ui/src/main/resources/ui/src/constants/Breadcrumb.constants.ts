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
import { getDataInsightPathWithFqn } from '../utils/DataInsightUtils';
import i18n from '../utils/i18next/LocalUtil';
import { getPath, getSettingPath } from '../utils/RouterUtils';
import { ROUTES } from './constants';
import { GlobalSettingOptions } from './GlobalSettings.constants';

export const ADD_KPI_BREADCRUMB = [
  {
    name: i18n.t('label.data-insight'),
    url: getDataInsightPathWithFqn(),
  },
  {
    name: i18n.t('label.kpi-list'),
    url: ROUTES.KPI_LIST,
  },
  {
    name: i18n.t('label.add-new-entity', {
      entity: i18n.t('label.kpi-uppercase'),
    }),
    url: '',
    activeTitle: true,
  },
];

export const ADD_POLICY_PAGE_BREADCRUMB = [
  {
    name: i18n.t('label.setting-plural'),
    url: getSettingPath(),
  },
  {
    name: i18n.t('label.policy-plural'),
    url: getPath(GlobalSettingOptions.POLICIES),
  },
  {
    name: i18n.t('label.add-new-entity', { entity: i18n.t('label.policy') }),
    url: '',
  },
];

export const ADD_ROLE_PAGE_BREADCRUMB = [
  {
    name: i18n.t('label.setting-plural'),
    url: getSettingPath(),
  },
  {
    name: i18n.t('label.role-plural'),
    url: getPath(GlobalSettingOptions.ROLES),
  },
  {
    name: i18n.t('label.add-new-entity', { entity: i18n.t('label.role') }),
    url: '',
  },
];
