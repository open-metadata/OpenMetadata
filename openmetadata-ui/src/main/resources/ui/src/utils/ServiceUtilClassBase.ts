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

import { ObjectFieldTemplatePropertyType } from '@rjsf/utils';
import { get, isEmpty } from 'lodash';
import { ServiceTypes } from 'Models';
import GlossaryIcon from '../assets/svg/book.svg';
import ChartIcon from '../assets/svg/chart.svg';
import DataProductIcon from '../assets/svg/ic-data-product.svg';
import DatabaseIcon from '../assets/svg/ic-database.svg';
import DatabaseSchemaIcon from '../assets/svg/ic-schema.svg';
import MetricIcon from '../assets/svg/metric.svg';
import TagIcon from '../assets/svg/tag-grey.svg';
import AgentsStatusWidget from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget';
import PlatformInsightsWidget from '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget';
import TotalDataAssetsWidget from '../components/ServiceInsights/TotalDataAssetsWidget/TotalDataAssetsWidget';
import MetadataAgentsWidget from '../components/Settings/Services/Ingestion/MetadataAgentsWidget/MetadataAgentsWidget';
import { EntityType } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import {
  ApiServiceTypeSmallCaseType,
  DashboardServiceTypeSmallCaseType,
  DatabaseServiceTypeSmallCaseType,
  DriveServiceTypeSmallCaseType,
  MessagingServiceTypeSmallCaseType,
  MetadataServiceTypeSmallCaseType,
  MlModelServiceTypeSmallCaseType,
  PipelineServiceTypeSmallCaseType,
  SearchServiceTypeSmallCaseType,
  SecurityServiceTypeSmallCaseType,
  StorageServiceTypeSmallCaseType,
} from '../enums/service.enum';
import { DriveServiceType } from '../generated/api/services/createDriveService';
import {
  ConfigObject,
  WorkflowType,
} from '../generated/entity/automations/workflow';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { PipelineServiceType } from '../generated/entity/data/pipeline';
import { SearchServiceType } from '../generated/entity/data/searchIndex';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { APIServiceType } from '../generated/entity/services/apiService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { ServiceType } from '../generated/entity/services/serviceType';
import {
  ConfigData,
  ExtraInfoType,
  ServicesType,
} from '../interface/service.interface';
import { getAPIConfig } from './APIServiceUtils';
import { getDashboardConfig } from './DashboardServiceUtils';
import { getDatabaseConfig } from './DatabaseServiceUtils';
import { getDriveConfig } from './DriveServiceUtils';
import { getMessagingConfig } from './MessagingServiceUtils';
import { getMetadataConfig } from './MetadataServiceUtils';
import { getMlmodelConfig } from './MlmodelServiceUtils';
import { getPipelineConfig } from './PipelineServiceUtils';
import { getSearchServiceConfig } from './SearchServiceUtils';
import { getSecurityConfig } from './SecurityServiceUtils';
import { getServiceIcon } from './ServiceIconUtils';
import {
  getSearchIndexFromService,
  getTestConnectionName,
} from './ServiceUtils';
import { getStorageConfig } from './StorageServiceUtils';
import { customServiceComparator } from './StringsUtils';

class ServiceUtilClassBase {
  unSupportedServices: string[] = [
    StorageServiceType.Adls,
    DatabaseServiceType.QueryLog,
    DatabaseServiceType.Dbt,
    DatabaseServiceType.Synapse,
    MetadataServiceType.Alation,
    APIServiceType.Webhook,
    MlModelServiceType.VertexAI,
    PipelineServiceType.Matillion,
    PipelineServiceType.DataFactory,
    PipelineServiceType.Stitch,
    DashboardServiceType.PowerBIReportServer,
    DatabaseServiceType.Ssas,
    DashboardServiceType.ThoughtSpot,
    PipelineServiceType.Ssis,
    PipelineServiceType.Wherescape,
    SecurityServiceType.Ranger,
    DatabaseServiceType.Epic,
    PipelineServiceType.Snowplow,
    DriveServiceType.SharePoint,
    DatabaseServiceType.Informix,
    DatabaseServiceType.ServiceNow,
    DatabaseServiceType.Dremio,
    MetadataServiceType.Collibra,
    PipelineServiceType.Mulesoft,
    DatabaseServiceType.MicrosoftAccess,
    DashboardServiceType.SapS4Hana,
  ];

  DatabaseServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    DatabaseServiceTypeSmallCaseType
  >(DatabaseServiceType);

  MessagingServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    MessagingServiceTypeSmallCaseType
  >(MessagingServiceType);

  DashboardServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    DashboardServiceTypeSmallCaseType
  >(DashboardServiceType);

  PipelineServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    PipelineServiceTypeSmallCaseType
  >(PipelineServiceType);

  MlModelServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    MlModelServiceTypeSmallCaseType
  >(MlModelServiceType);

  MetadataServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    MetadataServiceTypeSmallCaseType
  >(MetadataServiceType);

  StorageServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    StorageServiceTypeSmallCaseType
  >(StorageServiceType);

  SearchServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    SearchServiceTypeSmallCaseType
  >(SearchServiceType);

  ApiServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    ApiServiceTypeSmallCaseType
  >(APIServiceType);

  SecurityServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    SecurityServiceTypeSmallCaseType
  >(SecurityServiceType);

  DriveServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    DriveServiceTypeSmallCaseType
  >(DriveServiceType);

  protected updateUnsupportedServices(types: string[]) {
    this.unSupportedServices = types;
  }

  filterUnsupportedServiceType(types: string[]) {
    return types.filter((type) => !this.unSupportedServices.includes(type));
  }

  private serviceDetails?: ServicesType;

  public setEditServiceDetails(serviceDetails?: ServicesType) {
    this.serviceDetails = serviceDetails;
  }

  public getEditServiceDetails() {
    return this.serviceDetails;
  }

  public getAddWorkflowData(
    connectionType: string,
    serviceType: ServiceType,
    serviceName?: string,
    configData?: ConfigData
  ) {
    return {
      name: getTestConnectionName(connectionType),
      workflowType: WorkflowType.TestConnection,
      request: {
        connection: { config: configData as ConfigObject },
        serviceType,
        connectionType,
        serviceName,
      },
    };
  }

  public getServiceConfigData(data: {
    serviceName: string;
    serviceType: string;
    description: string;
    userId: string;
    configData: ConfigData;
  }) {
    const { serviceName, serviceType, description, userId, configData } = data;

    return {
      name: serviceName,
      serviceType: serviceType,
      description: description,
      owners: [
        {
          id: userId,
          type: 'user',
        },
      ],
      connection: {
        config: configData,
      },
    };
  }

  public getServiceExtraInfo(_data?: ServicesType): ExtraInfoType | null {
    return null;
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
      apiServices: this.filterUnsupportedServiceType(
        Object.values(APIServiceType) as string[]
      ).sort(customServiceComparator),
      driveServices: this.filterUnsupportedServiceType(
        Object.values(DriveServiceType) as string[]
      ).sort(customServiceComparator),
      securityServices: this.filterUnsupportedServiceType(
        Object.values(SecurityServiceType) as string[]
      ).sort(customServiceComparator),
    };
  }

  public getEntityTypeFromServiceType(serviceType: string): EntityType {
    const serviceTypes = this.getSupportedServiceFromList();

    // Check which service category the serviceType belongs to
    if (serviceTypes.databaseServices.includes(serviceType)) {
      return EntityType.TABLE;
    }

    if (serviceTypes.messagingServices.includes(serviceType)) {
      return EntityType.TOPIC;
    }

    if (serviceTypes.dashboardServices.includes(serviceType)) {
      return EntityType.DASHBOARD;
    }

    if (serviceTypes.pipelineServices.includes(serviceType)) {
      return EntityType.PIPELINE;
    }

    if (serviceTypes.mlmodelServices.includes(serviceType)) {
      return EntityType.MLMODEL;
    }

    if (serviceTypes.storageServices.includes(serviceType)) {
      return EntityType.CONTAINER;
    }

    if (serviceTypes.searchServices.includes(serviceType)) {
      return EntityType.SEARCH_INDEX;
    }

    if (serviceTypes.apiServices.includes(serviceType)) {
      return EntityType.API_ENDPOINT;
    }

    if (serviceTypes.securityServices.includes(serviceType)) {
      return EntityType.TABLE; // Security services typically work with tables
    }

    if (serviceTypes.driveServices.includes(serviceType)) {
      return EntityType.DIRECTORY;
    }

    // Default fallback
    return EntityType.TABLE;
  }

  private getDefaultLogoForServiceType(type: string): string {
    const serviceTypes = this.getSupportedServiceFromList();

    if (serviceTypes.messagingServices.includes(type)) {
      return getServiceIcon('topicdefault');
    }
    if (serviceTypes.dashboardServices.includes(type)) {
      return getServiceIcon('dashboarddefault');
    }
    if (serviceTypes.pipelineServices.includes(type)) {
      return getServiceIcon('pipelinedefault');
    }
    if (serviceTypes.databaseServices.includes(type)) {
      return getServiceIcon('databasedefault');
    }
    if (serviceTypes.mlmodelServices.includes(type)) {
      return getServiceIcon('mlmodeldefault');
    }
    if (serviceTypes.storageServices.includes(type)) {
      return getServiceIcon('storagedefault');
    }
    if (serviceTypes.searchServices.includes(type)) {
      return getServiceIcon('searchdefault');
    }
    if (serviceTypes.securityServices.includes(type)) {
      return getServiceIcon('securitydefault');
    }
    if (serviceTypes.driveServices.includes(type)) {
      return getServiceIcon('drivedefault');
    }
    if (serviceTypes.apiServices.includes(type)) {
      return getServiceIcon('restservice');
    }

    return getServiceIcon('defaultservice');
  }

  public getServiceLogo(type: string) {
    return getServiceIcon(type) ?? this.getDefaultLogoForServiceType(type);
  }

  public getServiceTypeLogo(searchSource: {
    serviceType?: string;
    entityType?: string;
  }): string {
    const type = get(searchSource, 'serviceType', '');
    const entityType = get(searchSource, 'entityType', '');

    // Handle entities that don't have serviceType by using entity-specific icons
    if (isEmpty(type)) {
      switch (entityType) {
        case EntityType.TAG:
          return TagIcon;
        case EntityType.GLOSSARY_TERM:
          return GlossaryIcon;
        case EntityType.DATABASE:
          return DatabaseIcon;
        case EntityType.DATABASE_SCHEMA:
          return DatabaseSchemaIcon;
        case EntityType.METRIC:
          return MetricIcon;
        case EntityType.DATA_PRODUCT:
          return DataProductIcon;
        default:
          return this.getServiceLogo('');
      }
    }

    if (entityType === EntityType.CHART) {
      return ChartIcon;
    }

    return this.getServiceLogo(type);
  }

  public getDataAssetsService(serviceType: string): ExplorePageTabs {
    const database = this.DatabaseServiceTypeSmallCase;
    const messaging = this.MessagingServiceTypeSmallCase;
    const dashboard = this.DashboardServiceTypeSmallCase;
    const pipeline = this.PipelineServiceTypeSmallCase;
    const mlmodel = this.MlModelServiceTypeSmallCase;
    const storage = this.StorageServiceTypeSmallCase;
    const search = this.SearchServiceTypeSmallCase;
    const api = this.ApiServiceTypeSmallCase;
    const security = this.SecurityServiceTypeSmallCase;

    switch (true) {
      case Object.values(database).includes(
        serviceType as (typeof database)[keyof typeof database]
      ):
        return ExplorePageTabs.TABLES;
      case Object.values(messaging).includes(
        serviceType as (typeof messaging)[keyof typeof messaging]
      ):
        return ExplorePageTabs.TOPICS;
      case Object.values(dashboard).includes(
        serviceType as (typeof dashboard)[keyof typeof dashboard]
      ):
        return ExplorePageTabs.DASHBOARDS;
      case Object.values(mlmodel).includes(
        serviceType as (typeof mlmodel)[keyof typeof mlmodel]
      ):
        return ExplorePageTabs.MLMODELS;
      case Object.values(pipeline).includes(
        serviceType as (typeof pipeline)[keyof typeof pipeline]
      ):
        return ExplorePageTabs.PIPELINES;
      case Object.values(storage).includes(
        serviceType as (typeof storage)[keyof typeof storage]
      ):
        return ExplorePageTabs.CONTAINERS;
      case Object.values(search).includes(
        serviceType as (typeof search)[keyof typeof search]
      ):
        return ExplorePageTabs.SEARCH_INDEX;

      case Object.values(api).includes(
        serviceType as (typeof api)[keyof typeof api]
      ):
        return ExplorePageTabs.API_ENDPOINT;

      case Object.values(security).includes(
        serviceType as (typeof security)[keyof typeof security]
      ):
        return ExplorePageTabs.TABLES; // Security services don't have a specific tab, default to tables

      default:
        return ExplorePageTabs.TABLES;
    }
  }

  public getPipelineServiceConfig(type: PipelineServiceType) {
    return getPipelineConfig(type);
  }

  public getDatabaseServiceConfig(type: DatabaseServiceType) {
    return getDatabaseConfig(type);
  }

  public getDashboardServiceConfig(type: DashboardServiceType) {
    return getDashboardConfig(type);
  }

  public getMessagingServiceConfig(type: MessagingServiceType) {
    return getMessagingConfig(type);
  }

  public getMlModelServiceConfig(type: MlModelServiceType) {
    return getMlmodelConfig(type);
  }

  public getSearchServiceConfig(type: SearchServiceType) {
    return getSearchServiceConfig(type);
  }

  public getStorageServiceConfig(type: StorageServiceType) {
    return getStorageConfig(type);
  }

  public getMetadataServiceConfig(type: MetadataServiceType) {
    return getMetadataConfig(type);
  }

  public getAPIServiceConfig(type: APIServiceType) {
    return getAPIConfig(type);
  }

  public getSecurityServiceConfig(type: SecurityServiceType) {
    return getSecurityConfig(type);
  }
  public getDriveServiceConfig(type: DriveServiceType) {
    return getDriveConfig(type);
  }

  public getInsightsTabWidgets(_: ServiceTypes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const widgets: Record<string, React.ComponentType<any>> = {
      AgentsStatusWidget,
      PlatformInsightsWidget,
      TotalDataAssetsWidget,
    };

    return widgets;
  }

  public getExtraInfo(): Promise<void> {
    return Promise.resolve();
  }

  public getProperties(property: ObjectFieldTemplatePropertyType[]) {
    return {
      properties: property,
      additionalField: '',
      additionalFieldContent: null,
    };
  }

  public getEditConfigData(
    serviceData?: ServicesType,
    data?: ConfigData
  ): ServicesType {
    if (!serviceData || !data) {
      return serviceData as ServicesType;
    }
    const updatedData = { ...serviceData };
    if (updatedData.connection) {
      const connection = updatedData.connection as {
        config: Record<string, unknown>;
      };
      updatedData.connection = {
        ...connection,
        config: {
          ...connection.config,
          ...data,
        },
      } as typeof updatedData.connection;
    }

    return updatedData;
  }

  public getAgentsTabWidgets() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const widgets: Record<string, React.ComponentType<any>> = {
      MetadataAgentsWidget,
    };

    return widgets;
  }

  public getSearchIndexFromEntityType(entityType: EntityType | string) {
    return getSearchIndexFromService(entityType);
  }

  /**
   * @param originalEnum will take the enum that should be converted
   * @returns object with lowercase value
   */
  public convertEnumToLowerCase<T extends { [k: string]: string }, U>(
    originalEnum: T
  ): U {
    return Object.fromEntries(
      Object.entries(originalEnum).map(([key, value]) => [
        key,
        value.toLowerCase(),
      ])
    ) as unknown as U;
  }
}

const serviceUtilClassBase = new ServiceUtilClassBase();

export default serviceUtilClassBase;
export { ServiceUtilClassBase };
