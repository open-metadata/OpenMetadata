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
import { getPath, getSettingPath } from '../utils/RouterUtils';
import { ROUTES } from './constants';
import { GlobalSettingOptions } from './GlobalSettings.constants';

export const ADD_KPI_BREADCRUMB = [
  {
    name: 'label.data-insight',
    url: getDataInsightPathWithFqn(),
  },
  {
    name: 'label.kpi-list',
    url: ROUTES.KPI_LIST,
  },
  {
    name: 'label.add-new-entity',
    nameData: { entity: 'label.kpi-uppercase' },
    url: '',
    activeTitle: true,
  },
];

export const ADD_POLICY_PAGE_BREADCRUMB = [
  {
    name: 'label.setting-plural',
    url: getSettingPath(),
  },
  {
    name: 'label.policy-plural',
    url: getPath(GlobalSettingOptions.POLICIES),
  },
  {
    name: 'label.add-new-entity',
    nameData: { entity: 'label.policy' },
    url: '',
  },
];

export const ADD_ROLE_PAGE_BREADCRUMB = [
  {
    name: 'label.setting-plural',
    url: getSettingPath(),
  },
  {
    name: 'label.role-plural',
    url: getPath(GlobalSettingOptions.ROLES),
  },
  {
    name: 'label.add-new-entity',
    nameData: { entity: 'label.role' },
    url: '',
  },
];
