/*
 *  Copyright 2026 Collate.
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
import {
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { getSettingsPathWithFqn } from './RouterUtils';
import { getEncodedFqn } from './StringsUtils';

/** Primary list URL (main nav + in-app navigation). */
export const getWorkflowDefinitionsListPath = () => ROUTES.WORKFLOWS;

/** Builder/detail URL under `/workflows` (Collate-compatible). */
export const getWorkflowDefinitionDetailPath = (
  fqn: string,
  tab = 'workflow'
) =>
  ROUTES.WORKFLOWS_WITH_FQN_TAB.replace(
    PLACEHOLDER_ROUTE_FQN,
    getEncodedFqn(fqn)
  ).replace(PLACEHOLDER_ROUTE_TAB, tab);

/**
 * Settings URL for workflow builder (still served by SettingsRouter).
 * Prefer {@link getWorkflowDefinitionDetailPath} for new links.
 */
export const getWorkflowDefinitionSettingsDetailPath = (
  fqn: string,
  _tab?: string
) =>
  getSettingsPathWithFqn(
    GlobalSettingsMenuCategory.GOVERNANCE,
    GlobalSettingOptions.WORKFLOW_DEFINITIONS,
    getEncodedFqn(fqn)
  );
