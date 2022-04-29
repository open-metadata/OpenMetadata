/*
 *  Copyright 2021 Collate
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

import { cloneDeep, isUndefined } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/services.const';
import {
  DashboardConnection,
  DashboardServiceType,
} from '../generated/entity/services/dashboardService';
import lookerConnection from '../jsons/connectionSchemas/connections/dashboard/lookerConnection.json';
import metabaseConnection from '../jsons/connectionSchemas/connections/dashboard/metabaseConnection.json';
import powerBIConnection from '../jsons/connectionSchemas/connections/dashboard/powerBIConnection.json';
import redashConnection from '../jsons/connectionSchemas/connections/dashboard/redashConnection.json';
import supersetConnection from '../jsons/connectionSchemas/connections/dashboard/supersetConnection.json';
import tableauConnection from '../jsons/connectionSchemas/connections/dashboard/tableauConnection.json';

export const getDashboardURL = (config: DashboardConnection['config']) => {
  let retVal: string | undefined;
  switch (config?.type) {
    case DashboardServiceType.PowerBI: {
      retVal = config.dashboardURL;

      break;
    }
    case DashboardServiceType.Redash: {
      retVal = config.redashURL;

      break;
    }
    case DashboardServiceType.Looker:
    case DashboardServiceType.Metabase:
    case DashboardServiceType.Superset:
    case DashboardServiceType.Tableau: {
      retVal = config.hostPort;

      break;
    }
  }

  return !isUndefined(retVal) ? retVal : '--';
};

export const getDashboardConfig = (config?: DashboardConnection['config']) => {
  let schema = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };
  switch (config?.type) {
    case DashboardServiceType.Looker: {
      schema = lookerConnection;

      break;
    }
    case DashboardServiceType.Metabase: {
      schema = metabaseConnection;

      break;
    }
    case DashboardServiceType.PowerBI: {
      schema = powerBIConnection;

      break;
    }
    case DashboardServiceType.Redash: {
      schema = redashConnection;

      break;
    }
    case DashboardServiceType.Superset: {
      schema = supersetConnection;

      break;
    }
    case DashboardServiceType.Tableau: {
      schema = tableauConnection;

      break;
    }
  }

  return cloneDeep({ schema, uiSchema });
};
