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
import { ServiceTypes } from 'Models';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { PipelineServiceType } from '../generated/entity/data/pipeline';
import { SearchServiceType } from '../generated/entity/data/searchIndex';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { customServiceComparator } from './StringsUtils';

class ServiceUtilClassBase {
  private static unSupportedServices: string[] = [
    StorageServiceType.Adls,
    DatabaseServiceType.QueryLog,
    DatabaseServiceType.Dbt,
  ];

  static filterUnsupportedServiceType = (types: string[]) => {
    return types.filter(
      (type) => !ServiceUtilClassBase.unSupportedServices.includes(type)
    );
  };

  static SupportedServiceTypes: Record<ServiceTypes, Array<string>> = {
    databaseServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(DatabaseServiceType) as string[]
    ).sort(customServiceComparator),
    messagingServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(MessagingServiceType) as string[]
    ).sort(customServiceComparator),
    dashboardServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(DashboardServiceType) as string[]
    ).sort(customServiceComparator),
    pipelineServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(PipelineServiceType) as string[]
    ).sort(customServiceComparator),
    mlmodelServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(MlModelServiceType) as string[]
    ).sort(customServiceComparator),
    metadataServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(MetadataServiceType) as string[]
    ).sort(customServiceComparator),
    storageServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(StorageServiceType) as string[]
    ).sort(customServiceComparator),
    searchServices: ServiceUtilClassBase.filterUnsupportedServiceType(
      Object.values(SearchServiceType) as string[]
    ).sort(customServiceComparator),
  };

  public static getSupportedServiceFromList = () => {
    return ServiceUtilClassBase.SupportedServiceTypes;
  };
}

export default ServiceUtilClassBase;
