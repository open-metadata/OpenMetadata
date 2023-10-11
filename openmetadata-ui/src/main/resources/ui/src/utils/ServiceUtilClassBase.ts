/*
 *  Copyright 2023 Collate.
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

import { cloneDeep } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/Services.constant';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { PipelineServiceType } from '../generated/entity/data/pipeline';
import { SearchServiceType } from '../generated/entity/data/searchIndex';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import customConnection from '../jsons/connectionSchemas/connections/storage/customStorageConnection.json';
import s3Connection from '../jsons/connectionSchemas/connections/storage/s3Connection.json';
import { customServiceComparator } from './StringsUtils';

class ServiceUtilClassBase {
  unSupportedServices: string[] = [
    StorageServiceType.Adls,
    DatabaseServiceType.QueryLog,
    DatabaseServiceType.Dbt,
  ];

  protected updateUnsupportedServices(types: string[]) {
    this.unSupportedServices = types;
  }

  filterUnsupportedServiceType(types: string[]) {
    return types.filter((type) => !this.unSupportedServices.includes(type));
  }

  public getSupportedServiceFromList() {
    return {
      databaseServices: this.filterUnsupportedServiceType(
        Object.values(DatabaseServiceType) as string[]
      ).sort(customServiceComparator),
      messagingServices: this.filterUnsupportedServiceType(
        Object.values(MessagingServiceType) as string[]
      ).sort(customServiceComparator),
      dashboardServices: this.filterUnsupportedServiceType(
        Object.values(DashboardServiceType) as string[]
      ).sort(customServiceComparator),
      pipelineServices: this.filterUnsupportedServiceType(
        Object.values(PipelineServiceType) as string[]
      ).sort(customServiceComparator),
      mlmodelServices: this.filterUnsupportedServiceType(
        Object.values(MlModelServiceType) as string[]
      ).sort(customServiceComparator),
      metadataServices: this.filterUnsupportedServiceType(
        Object.values(MetadataServiceType) as string[]
      ).sort(customServiceComparator),
      storageServices: this.filterUnsupportedServiceType(
        Object.values(StorageServiceType) as string[]
      ).sort(customServiceComparator),
      searchServices: this.filterUnsupportedServiceType(
        Object.values(SearchServiceType) as string[]
      ).sort(customServiceComparator),
    };
  }

  public getStorageServiceConfig(type: StorageServiceType) {
    let schema = {};
    const uiSchema = { ...COMMON_UI_SCHEMA };
    switch (type) {
      case StorageServiceType.S3: {
        schema = s3Connection;

        break;
      }
      case StorageServiceType.CustomStorage: {
        schema = customConnection;

        break;
      }
    }

    return cloneDeep({ schema, uiSchema });
  }
}

const serviceUtilClassBase = new ServiceUtilClassBase();

export default serviceUtilClassBase;
export { ServiceUtilClassBase };
