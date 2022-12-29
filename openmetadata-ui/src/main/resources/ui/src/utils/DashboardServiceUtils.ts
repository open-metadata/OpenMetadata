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
import { COMMON_UI_SCHEMA } from '../constants/Services.constant';
import {
  DashboardConnection,
  DashboardServiceType,
} from '../generated/entity/services/dashboardService';
import customDashboardConnection from '../jsons/connectionSchemas/connections/dashboard/customDashboardConnection.json';
import domoDashboardConnection from '../jsons/connectionSchemas/connections/dashboard/domoDashboardConnection.json';
import lookerConnection from '../jsons/connectionSchemas/connections/dashboard/lookerConnection.json';
import metabaseConnection from '../jsons/connectionSchemas/connections/dashboard/metabaseConnection.json';
import modeConnection from '../jsons/connectionSchemas/connections/dashboard/modeConnection.json';
import powerBIConnection from '../jsons/connectionSchemas/connections/dashboard/powerBIConnection.json';
import quicksightConnection from '../jsons/connectionSchemas/connections/dashboard/quickSightConnection.json';
import redashConnection from '../jsons/connectionSchemas/connections/dashboard/redashConnection.json';
import supersetConnection from '../jsons/connectionSchemas/connections/dashboard/supersetConnection.json';
import tableauConnection from '../jsons/connectionSchemas/connections/dashboard/tableauConnection.json';

export const getDashboardURL = (config: DashboardConnection['config']) => {
  return !isUndefined(config) && !isEmpty(config.hostPort)
    ? config.hostPort
    : '--';
};

export const getDashboardConfig = (type: DashboardServiceType) => {
  let schema = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };
  switch (type) {
    case DashboardServiceType.Looker: {
      schema = lookerConnection;

      break;
    }
    case DashboardServiceType.Metabase: {
      schema = metabaseConnection;

      break;
    }
    case DashboardServiceType.Mode: {
      schema = modeConnection;

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
    case DashboardServiceType.DomoDashboard: {
      schema = domoDashboardConnection;

      break;
    }
    case DashboardServiceType.CustomDashboard: {
      schema = customDashboardConnection;

      break;
    }

    case DashboardServiceType.QuickSight: {
      schema = quicksightConnection;

      break;
    }
  }

  return cloneDeep({ schema, uiSchema });
};
