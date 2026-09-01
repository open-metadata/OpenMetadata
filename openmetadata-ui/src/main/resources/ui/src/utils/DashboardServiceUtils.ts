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

import { loadConnectionSchema } from './loadConnectionSchema';
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import type {
  DashboardConnection} from '../generated/entity/services/dashboardService';
import {
  DashboardServiceType,
} from '../generated/entity/services/dashboardService';

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const dashboardSchemaLoaders: Partial<
  Record<DashboardServiceType, SchemaLoader>
> = {
  [DashboardServiceType.Looker]: () =>
    loadConnectionSchema('connections/dashboard/lookerConnection.json'),
  [DashboardServiceType.Metabase]: () =>
    loadConnectionSchema('connections/dashboard/metabaseConnection.json'),
  [DashboardServiceType.Mode]: () =>
    loadConnectionSchema('connections/dashboard/modeConnection.json'),
  [DashboardServiceType.PowerBI]: () =>
    loadConnectionSchema('connections/dashboard/powerBIConnection.json'),
  [DashboardServiceType.Redash]: () =>
    loadConnectionSchema('connections/dashboard/redashConnection.json'),
  [DashboardServiceType.Superset]: () =>
    loadConnectionSchema('connections/dashboard/supersetConnection.json'),
  [DashboardServiceType.Sigma]: () =>
    loadConnectionSchema('connections/dashboard/sigmaConnection.json'),
  [DashboardServiceType.Omni]: () =>
    loadConnectionSchema('connections/dashboard/omniConnection.json'),
  [DashboardServiceType.Tableau]: () =>
    loadConnectionSchema('connections/dashboard/tableauConnection.json'),
  [DashboardServiceType.DomoDashboard]: () =>
    loadConnectionSchema('connections/dashboard/domoDashboardConnection.json'),
  [DashboardServiceType.CustomDashboard]: () =>
    loadConnectionSchema('connections/dashboard/customDashboardConnection.json'),
  [DashboardServiceType.QuickSight]: () =>
    loadConnectionSchema('connections/dashboard/quickSightConnection.json'),
  [DashboardServiceType.QlikSense]: () =>
    loadConnectionSchema('connections/dashboard/qlikSenseConnection.json'),
  [DashboardServiceType.QlikCloud]: () =>
    loadConnectionSchema('connections/dashboard/qlikCloudConnection.json'),
  [DashboardServiceType.Lightdash]: () =>
    loadConnectionSchema('connections/dashboard/lightdashConnection.json'),
  [DashboardServiceType.MicroStrategy]: () =>
    loadConnectionSchema('connections/dashboard/microStrategyConnection.json'),
  [DashboardServiceType.Grafana]: () =>
    loadConnectionSchema('connections/dashboard/grafanaConnection.json'),
  [DashboardServiceType.Hex]: () =>
    loadConnectionSchema('connections/dashboard/hexConnection.json'),
  [DashboardServiceType.Ssrs]: () =>
    loadConnectionSchema('connections/dashboard/ssrsConnection.json'),
};

const resolveSchemaModule = (mod: SchemaModule): Record<string, unknown> => {
  const maybeDefault = (mod as { default?: Record<string, unknown> }).default;

  return maybeDefault ?? (mod as Record<string, unknown>);
};

export const getDashboardURL = (config: DashboardConnection['config']) => {
  return !isUndefined(config) && !isEmpty(config.hostPort)
    ? config.hostPort
    : '--';
};

export const getDashboardConfig = async (type: DashboardServiceType) => {
  const loader = dashboardSchemaLoaders[type];
  let schema: Record<string, unknown> = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  if (loader) {
    const mod = await loader();
    schema = resolveSchemaModule(mod);
  }

  return cloneDeep({ schema, uiSchema });
};
