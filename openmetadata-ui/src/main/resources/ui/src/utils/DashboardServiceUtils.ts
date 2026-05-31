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

import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import {
  DashboardConnection,
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
    import(
      '../jsons/connectionSchemas/connections/dashboard/lookerConnection.json'
    ),
  [DashboardServiceType.Metabase]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/metabaseConnection.json'
    ),
  [DashboardServiceType.Mode]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/modeConnection.json'
    ),
  [DashboardServiceType.PowerBI]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/powerBIConnection.json'
    ),
  [DashboardServiceType.Redash]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/redashConnection.json'
    ),
  [DashboardServiceType.Superset]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/supersetConnection.json'
    ),
  [DashboardServiceType.Sigma]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/sigmaConnection.json'
    ),
  [DashboardServiceType.Tableau]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/tableauConnection.json'
    ),
  [DashboardServiceType.DomoDashboard]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/domoDashboardConnection.json'
    ),
  [DashboardServiceType.CustomDashboard]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/customDashboardConnection.json'
    ),
  [DashboardServiceType.QuickSight]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/quickSightConnection.json'
    ),
  [DashboardServiceType.QlikSense]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/qlikSenseConnection.json'
    ),
  [DashboardServiceType.QlikCloud]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/qlikCloudConnection.json'
    ),
  [DashboardServiceType.Lightdash]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/lightdashConnection.json'
    ),
  [DashboardServiceType.MicroStrategy]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/microStrategyConnection.json'
    ),
  [DashboardServiceType.Grafana]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/grafanaConnection.json'
    ),
  [DashboardServiceType.Hex]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/hexConnection.json'
    ),
  [DashboardServiceType.Ssrs]: () =>
    import(
      '../jsons/connectionSchemas/connections/dashboard/ssrsConnection.json'
    ),
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
