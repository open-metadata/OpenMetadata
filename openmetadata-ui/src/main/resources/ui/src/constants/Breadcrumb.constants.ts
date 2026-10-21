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
import { getDataInsightPathWithFqn } from '../utils/DataInsightPureUtils';
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

// Functions, not constants: the settings route builders are mode-aware
// (ADR:2026-10-21-settings-pages-are-classic-only), so the URLs must be built
// at render time rather than frozen in the mode active at import time.
export const getAddPolicyPageBreadcrumb = () => [
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

export const getAddRolePageBreadcrumb = () => [
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
