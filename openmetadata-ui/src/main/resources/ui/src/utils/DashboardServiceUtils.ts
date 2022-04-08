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
import { ConfigFormFields } from 'Models';
// import { LookerConnection } from '../generated/entity/services/connections/dashboard/lookerConnection';
// import { MetabaseConnection } from '../generated/entity/services/connections/dashboard/metabaseConnection';
// import { PowerBIConnection } from '../generated/entity/services/connections/dashboard/powerBIConnection';
// import { RedashConnection } from '../generated/entity/services/connections/dashboard/redashConnection';
// import { SupersetConnection } from '../generated/entity/services/connections/dashboard/supersetConnection';
// import { TableauConnection } from '../generated/entity/services/connections/dashboard/tableauConnection';
import {
  DashboardConnection,
  DashboardServiceType,
} from '../generated/entity/services/dashboardService';
import { lookerConfig } from '../jsons/services/dashboard/lookerConfig';
import { metabaseConfig } from '../jsons/services/dashboard/metabaseConfig';
import { powerBIConfig } from '../jsons/services/dashboard/powerBIConfig';
import { redashConfig } from '../jsons/services/dashboard/redashConfig';
import { supersetConfig } from '../jsons/services/dashboard/supersetConfig';
import { tableauConfig } from '../jsons/services/dashboard/tableauConfig';

export const getDashboardURL = (config: DashboardConnection['config']) => {
  let retVal: string | undefined;
  switch (config?.type) {
    case DashboardServiceType.Looker: {
      retVal = config.url;

      break;
    }
    case DashboardServiceType.Metabase: {
      retVal = config.hostPort;

      break;
    }
    case DashboardServiceType.PowerBI: {
      retVal = config.dashboardURL;

      break;
    }
    case DashboardServiceType.Redash: {
      retVal = config.redashURL;

      break;
    }
    case DashboardServiceType.Superset: {
      retVal = config.supersetURL;

      break;
    }
    case DashboardServiceType.Tableau: {
      retVal = config.siteURL;

      break;
    }
  }

  return !isUndefined(retVal) ? retVal : '--';
};

export const getDashboardConfig = (config?: DashboardConnection['config']) => {
  let retVal: Array<ConfigFormFields> = [];
  switch (config?.type) {
    case DashboardServiceType.Looker: {
      retVal = lookerConfig;

      break;
    }
    case DashboardServiceType.Metabase: {
      retVal = metabaseConfig;

      break;
    }
    case DashboardServiceType.PowerBI: {
      retVal = powerBIConfig;

      break;
    }
    case DashboardServiceType.Redash: {
      retVal = redashConfig;

      break;
    }
    case DashboardServiceType.Superset: {
      retVal = supersetConfig;

      break;
    }
    case DashboardServiceType.Tableau: {
      retVal = tableauConfig;

      break;
    }
  }
  if (config) {
    for (const k of retVal) {
      const data = config[k.key as keyof DashboardConnection['config']];
      if (data) {
        k.value = data;
      }
    }
  }

  return cloneDeep(retVal);
};
