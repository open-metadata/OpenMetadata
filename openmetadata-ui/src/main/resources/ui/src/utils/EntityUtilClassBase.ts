/*
 *  Copyright 2024 Collate.
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

import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { Operation } from 'fast-json-patch';
import { capitalize } from 'lodash';
import { FC } from 'react';
import { NavigateFunction } from 'react-router-dom';
import DataProductsPage from '../components/DataProducts/DataProductsPage/DataProductsPage.component';
import { GlobalSettingsMenuCategory } from '../constants/GlobalSettings.constants';
import {
  OperationPermission,
  ResourceEntity,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { APICollection } from '../generated/entity/data/apiCollection';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { ServicesType } from '../interface/service.interface';
import APICollectionPage from '../pages/APICollectionPage/APICollectionPage';
import APIEndpointPage from '../pages/APIEndpointPage/APIEndpointPage';
import ChartDetailsPage from '../pages/ChartDetailsPage/ChartDetailsPage.component';
import ContainerPage from '../pages/ContainerPage/ContainerPage';
import DashboardDetailsPage from '../pages/DashboardDetailsPage/DashboardDetailsPage.component';
import DatabaseDetailsPage from '../pages/DatabaseDetailsPage/DatabaseDetailsPage';
import DatabaseSchemaPageComponent from '../pages/DatabaseSchemaPage/DatabaseSchemaPage.component';
import DataModelsPage from '../pages/DataModelPage/DataModelPage.component';
import DirectoryDetailsPage from '../pages/DirectoryDetailsPage/DirectoryDetailsPage';
import { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';
import FileDetailsPage from '../pages/FileDetailsPage/FileDetailsPage';
import MetricDetailsPage from '../pages/MetricsPage/MetricDetailsPage/MetricDetailsPage';
import MlModelPage from '../pages/MlModelPage/MlModelPage.component';
import PipelineDetailsPage from '../pages/PipelineDetails/PipelineDetailsPage.component';
import SearchIndexDetailsPage from '../pages/SearchIndexDetailsPage/SearchIndexDetailsPage';
import SpreadsheetDetailsPage from '../pages/SpreadsheetDetailsPage/SpreadsheetDetailsPage';
import StoredProcedurePage from '../pages/StoredProcedure/StoredProcedurePage';
import TableDetailsPageV1 from '../pages/TableDetailsPageV1/TableDetailsPageV1';
import TopicDetailsPage from '../pages/TopicDetails/TopicDetailsPage.component';
import WorksheetDetailsPage from '../pages/WorksheetDetailsPage/WorksheetDetailsPage';
import { patchApiCollection } from '../rest/apiCollectionsAPI';
import { patchApiEndPoint } from '../rest/apiEndpointsAPI';
import { patchApplication } from '../rest/applicationAPI';
import { patchChartDetails } from '../rest/chartsAPI';
import { patchDashboardDetails } from '../rest/dashboardAPI';
import {
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../rest/databaseAPI';
import { patchDataModelDetails } from '../rest/dataModelsAPI';
import { patchDataProduct } from '../rest/dataProductAPI';
import { patchDomains } from '../rest/domainAPI';
import { patchDriveAssetDetails } from '../rest/driveAPI';
import { patchGlossaries, patchGlossaryTerm } from '../rest/glossaryAPI';
import { patchKPI } from '../rest/KpiAPI';
import { patchMetric } from '../rest/metricsAPI';
import { patchMlModelDetails } from '../rest/mlModelAPI';
import { patchPipelineDetails } from '../rest/pipelineAPI';
import { patchQueries } from '../rest/queryAPI';
import { patchPolicy, patchRole } from '../rest/rolesAPIV1';
import { patchSearchIndexDetails } from '../rest/SearchIndexAPI';
import { patchService } from '../rest/serviceAPI';
import { patchContainerDetails } from '../rest/storageAPI';
import { patchStoredProceduresDetails } from '../rest/storedProceduresAPI';
import { patchTableDetails } from '../rest/tableAPI';
import { patchClassification, patchTag } from '../rest/tagAPI';
import { patchTeamDetail } from '../rest/teamsAPI';
import { patchTopicDetails } from '../rest/topicsAPI';
import { ExtraDatabaseDropdownOptions } from './Database/Database.util';
import { ExtraDatabaseSchemaDropdownOptions } from './DatabaseSchemaDetailsUtils';
import { ExtraDatabaseServiceDropdownOptions } from './DatabaseServiceUtils';
import { getEntityByFqnUtil } from './EntityByFqnUtils';
import { EntityTypeName } from './EntityUtils';
import Fqn from './Fqn';
import {
  FormattedAPIServiceType,
  FormattedDashboardServiceType,
  FormattedDatabaseServiceType,
  FormattedDriveServiceType,
  FormattedMessagingServiceType,
  FormattedMetadataServiceType,
  FormattedMlModelServiceType,
  FormattedPipelineServiceType,
  FormattedSearchServiceType,
  FormattedStorageServiceType,
} from './EntityUtils.interface';
import {
  getApplicationDetailsPath,
  getBotsPath,
  getClassificationTagPath,
  getDomainDetailsPath,
  getEditWebhookPath,
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
  getKpiPath,
  getNotificationAlertDetailsPath,
  getObservabilityAlertDetailsPath,
  getPersonaDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getServiceDetailsPath,
  getSettingPath,
  getTagsDetailsPath,
  getTeamsWithFqnPath,
  getTestCaseDetailPagePath,
  getUserPath,
} from './RouterUtils';
import { ExtraTableDropdownOptions } from './TableUtils';
import { getTestSuiteDetailsPath } from './TestSuiteUtils';

type PatchAPIFunction = (id: string, patch: Operation[]) => Promise<any>;

class EntityUtilClassBase {
  serviceTypeLookupMap: Map<string, string>;

  constructor() {
    this.serviceTypeLookupMap = this.createNormalizedLookupMap({
      ...FormattedMlModelServiceType,
      ...FormattedMetadataServiceType,
      ...FormattedPipelineServiceType,
      ...FormattedSearchServiceType,
      ...FormattedDatabaseServiceType,
      ...FormattedDashboardServiceType,
      ...FormattedMessagingServiceType,
      ...FormattedAPIServiceType,
      ...FormattedStorageServiceType,
      ...FormattedDriveServiceType,
    });
  }

  protected ENTITY_PATCH_API_MAP: Partial<
    Record<EntityType, PatchAPIFunction>
  > = {
    [EntityType.TABLE]: patchTableDetails,
    [EntityType.DASHBOARD]: patchDashboardDetails,
    [EntityType.TOPIC]: patchTopicDetails,
    [EntityType.PIPELINE]: patchPipelineDetails,
    [EntityType.MLMODEL]: patchMlModelDetails,
    [EntityType.CHART]: patchChartDetails,
    [EntityType.API_COLLECTION]: patchApiCollection,
    [EntityType.API_ENDPOINT]: patchApiEndPoint,
    [EntityType.DATABASE]: patchDatabaseDetails,
    [EntityType.DATABASE_SCHEMA]: patchDatabaseSchemaDetails,
    [EntityType.STORED_PROCEDURE]: patchStoredProceduresDetails,
    [EntityType.CONTAINER]: patchContainerDetails,
    [EntityType.DASHBOARD_DATA_MODEL]: patchDataModelDetails,
    [EntityType.SEARCH_INDEX]: patchSearchIndexDetails,
    [EntityType.DATA_PRODUCT]: patchDataProduct,
    [EntityType.METRIC]: patchMetric,
    [EntityType.GLOSSARY]: patchGlossaries,
    [EntityType.GLOSSARY_TERM]: patchGlossaryTerm,
    [EntityType.DOMAIN]: patchDomains,
    [EntityType.TAG]: patchTag,
    [EntityType.DIRECTORY]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.DIRECTORY),
    [EntityType.FILE]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.FILE),
    [EntityType.SPREADSHEET]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.SPREADSHEET),
    [EntityType.WORKSHEET]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.WORKSHEET),
    [EntityType.DATABASE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('databaseServices', id, patch),
    [EntityType.DASHBOARD_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('dashboardServices', id, patch),
    [EntityType.MESSAGING_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('messagingServices', id, patch),
    [EntityType.PIPELINE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('pipelineServices', id, patch),
    [EntityType.MLMODEL_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('mlmodelServices', id, patch),
    [EntityType.METADATA_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('metadataServices', id, patch),
    [EntityType.STORAGE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('storageServices', id, patch),
    [EntityType.SEARCH_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('searchServices', id, patch),
    [EntityType.API_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('apiServices', id, patch),
    [EntityType.SECURITY_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('securityServices', id, patch),
    [EntityType.DRIVE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('driveServices', id, patch),
    [EntityType.KPI]: patchKPI,
    [EntityType.APPLICATION]: patchApplication,
    [EntityType.QUERY]: patchQueries,
    [EntityType.ROLE]: (id: string, patch: Operation[]) => patchRole(patch, id),
    [EntityType.POLICY]: (id: string, patch: Operation[]) =>
      patchPolicy(patch, id),
    [EntityType.CLASSIFICATION]: patchClassification,
    [EntityType.TEAM]: patchTeamDetail,
  };

  private createNormalizedLookupMap<T extends Record<string, string>>(
    obj: T
  ): Map<string, string> {
    return new Map(
      Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value])
    );
  }

  public getEntityLink(
    indexType: string,
    fullyQualifiedName: string,
    tab?: string,
    subTab?: string,
    isExecutableTestSuite?: boolean,
    isObservabilityAlert?: boolean
  ) {
    switch (indexType) {
      case SearchIndex.TOPIC:
      case EntityType.TOPIC:
        return getEntityDetailsPath(
          EntityType.TOPIC,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.DASHBOARD:
      case EntityType.DASHBOARD:
        return getEntityDetailsPath(
          EntityType.DASHBOARD,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.CHART:
        return getEntityDetailsPath(
          EntityType.CHART,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.PIPELINE:
      case EntityType.PIPELINE:
        return getEntityDetailsPath(
          EntityType.PIPELINE,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.DATABASE:
        return getEntityDetailsPath(
          EntityType.DATABASE,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.DATABASE_SCHEMA:
        return getEntityDetailsPath(
          EntityType.DATABASE_SCHEMA,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.GLOSSARY:
      case SearchIndex.GLOSSARY:
      case EntityType.GLOSSARY_TERM:
      case SearchIndex.GLOSSARY_TERM:
        return getGlossaryTermDetailsPath(fullyQualifiedName, tab, subTab);

      case EntityType.DATABASE_SERVICE:
      case EntityType.DASHBOARD_SERVICE:
      case EntityType.MESSAGING_SERVICE:
      case EntityType.PIPELINE_SERVICE:
      case EntityType.MLMODEL_SERVICE:
      case EntityType.METADATA_SERVICE:
      case EntityType.STORAGE_SERVICE:
      case EntityType.SEARCH_SERVICE:
      case EntityType.API_SERVICE:
        return getServiceDetailsPath(fullyQualifiedName, `${indexType}s`);

      case EntityType.WEBHOOK:
        return getEditWebhookPath(fullyQualifiedName);

      case EntityType.TYPE:
        return getSettingPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
          `${fullyQualifiedName}s`
        );

      case EntityType.MLMODEL:
      case SearchIndex.MLMODEL:
        return getEntityDetailsPath(
          EntityType.MLMODEL,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.CONTAINER:
      case SearchIndex.CONTAINER:
        return getEntityDetailsPath(
          EntityType.CONTAINER,
          fullyQualifiedName,
          tab,
          subTab
        );
      case SearchIndex.TAG:
      case EntityType.TAG:
        return getClassificationTagPath(fullyQualifiedName, tab, subTab);
      case EntityType.CLASSIFICATION:
        return getTagsDetailsPath(fullyQualifiedName);

      case SearchIndex.DASHBOARD_DATA_MODEL:
      case EntityType.DASHBOARD_DATA_MODEL:
        return getEntityDetailsPath(
          EntityType.DASHBOARD_DATA_MODEL,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.STORED_PROCEDURE:
      case EntityType.STORED_PROCEDURE:
        return getEntityDetailsPath(
          EntityType.STORED_PROCEDURE,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.TEST_CASE:
        return getTestCaseDetailPagePath(fullyQualifiedName);

      case EntityType.TEST_SUITE:
        return getTestSuiteDetailsPath({
          isExecutableTestSuite,
          fullyQualifiedName,
        });

      case EntityType.SEARCH_INDEX:
      case SearchIndex.SEARCH_INDEX:
        return getEntityDetailsPath(
          EntityType.SEARCH_INDEX,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.DOMAIN:
      case SearchIndex.DOMAIN:
        return getDomainDetailsPath(fullyQualifiedName, tab, subTab);

      case EntityType.DATA_PRODUCT:
      case SearchIndex.DATA_PRODUCT:
        return getEntityDetailsPath(
          EntityType.DATA_PRODUCT,
          fullyQualifiedName,
          tab,
          subTab
        );
      case EntityType.APPLICATION:
        return getApplicationDetailsPath(fullyQualifiedName);

      case EntityType.USER:
      case SearchIndex.USER:
        return getUserPath(fullyQualifiedName, tab, subTab);

      case EntityType.TEAM:
      case SearchIndex.TEAM:
        return getTeamsWithFqnPath(fullyQualifiedName);

      case EntityType.EVENT_SUBSCRIPTION:
        return isObservabilityAlert
          ? getObservabilityAlertDetailsPath(fullyQualifiedName)
          : getNotificationAlertDetailsPath(fullyQualifiedName);

      case EntityType.ROLE:
        return getRoleWithFqnPath(fullyQualifiedName);

      case EntityType.POLICY:
        return getPolicyWithFqnPath(fullyQualifiedName);

      case EntityType.PERSONA:
        return getPersonaDetailsPath(fullyQualifiedName);

      case SearchIndex.API_COLLECTION_INDEX:
      case EntityType.API_COLLECTION:
        return getEntityDetailsPath(
          EntityType.API_COLLECTION,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.API_ENDPOINT_INDEX:
      case EntityType.API_ENDPOINT:
        return getEntityDetailsPath(
          EntityType.API_ENDPOINT,
          fullyQualifiedName,
          tab,
          subTab
        );
      case SearchIndex.METRIC_SEARCH_INDEX:
      case EntityType.METRIC:
        return getEntityDetailsPath(
          EntityType.METRIC,
          fullyQualifiedName,
          tab,
          subTab
        );
      case EntityType.DIRECTORY:
        return getEntityDetailsPath(
          EntityType.DIRECTORY,
          fullyQualifiedName,
          tab,
          subTab
        );
      case EntityType.FILE:
        return getEntityDetailsPath(
          EntityType.FILE,
          fullyQualifiedName,
          tab,
          subTab
        );
      case EntityType.SPREADSHEET:
        return getEntityDetailsPath(
          EntityType.SPREADSHEET,
          fullyQualifiedName,
          tab,
          subTab
        );
      case EntityType.WORKSHEET:
        return getEntityDetailsPath(
          EntityType.WORKSHEET,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.BOT:
        return getBotsPath(fullyQualifiedName);

      case EntityType.KPI:
        return getKpiPath(fullyQualifiedName);

      case SearchIndex.TABLE:
      case EntityType.TABLE:
      default:
        return getEntityDetailsPath(
          EntityType.TABLE,
          fullyQualifiedName,
          tab,
          subTab
        );
    }
  }

  public getEntityPatchAPI(entityType: EntityType): PatchAPIFunction {
    if (!entityType) {
      throw new Error('Entity type is required');
    }

    const api = this.ENTITY_PATCH_API_MAP[entityType];

    if (!api) {
      throw new Error(`No patch API available for entity type: ${entityType}`);
    }

    return api;
  }
  public getEntityByFqn(entityType: string, fqn: string, fields?: string) {
    return getEntityByFqnUtil(entityType, fqn, fields);
  }

  public getEntityDetailComponent(entityType: string): FC | null {
    switch (entityType) {
      case EntityType.DATABASE:
        return DatabaseDetailsPage;
      case EntityType.DATABASE_SCHEMA:
        return DatabaseSchemaPageComponent;
      case EntityType.PIPELINE:
        return PipelineDetailsPage;
      case EntityType.TOPIC:
        return TopicDetailsPage;
      case EntityType.DASHBOARD:
        return DashboardDetailsPage;
      case EntityType.CHART:
        return ChartDetailsPage;
      case EntityType.STORED_PROCEDURE:
        return StoredProcedurePage;
      case EntityType.DASHBOARD_DATA_MODEL:
        return DataModelsPage;
      case EntityType.MLMODEL:
        return MlModelPage;
      case EntityType.CONTAINER:
        return ContainerPage;
      case EntityType.SEARCH_INDEX:
        return SearchIndexDetailsPage;
      case EntityType.DATA_PRODUCT:
        return DataProductsPage;
      case EntityType.TABLE:
        return TableDetailsPageV1;
      case EntityType.API_COLLECTION:
        return APICollectionPage;
      case EntityType.API_ENDPOINT:
        return APIEndpointPage;
      case EntityType.METRIC:
        return MetricDetailsPage;
      case EntityType.DIRECTORY:
        return DirectoryDetailsPage;
      case EntityType.FILE:
        return FileDetailsPage;
      case EntityType.SPREADSHEET:
        return SpreadsheetDetailsPage;
      case EntityType.WORKSHEET:
        return WorksheetDetailsPage;

      default:
        return null;
    }
  }

  public getResourceEntityFromEntityType(entityType: string): string {
    switch (entityType) {
      case EntityType.TABLE: {
        return ResourceEntity.TABLE;
      }
      case EntityType.TOPIC: {
        return ResourceEntity.TOPIC;
      }
      case EntityType.DASHBOARD: {
        return ResourceEntity.DASHBOARD;
      }
      case EntityType.CHART: {
        return ResourceEntity.CHART;
      }
      case EntityType.PIPELINE: {
        return ResourceEntity.PIPELINE;
      }
      case EntityType.MLMODEL: {
        return ResourceEntity.ML_MODEL;
      }
      case EntityType.CONTAINER: {
        return ResourceEntity.CONTAINER;
      }
      case EntityType.SEARCH_INDEX: {
        return ResourceEntity.SEARCH_INDEX;
      }
      case EntityType.DASHBOARD_DATA_MODEL: {
        return ResourceEntity.DASHBOARD_DATA_MODEL;
      }
      case EntityType.STORED_PROCEDURE: {
        return ResourceEntity.STORED_PROCEDURE;
      }
      case EntityType.DATABASE: {
        return ResourceEntity.DATABASE;
      }
      case EntityType.DATABASE_SCHEMA: {
        return ResourceEntity.DATABASE_SCHEMA;
      }
      case EntityType.GLOSSARY_TERM: {
        return ResourceEntity.GLOSSARY_TERM;
      }
      case EntityType.DATA_PRODUCT: {
        return ResourceEntity.DATA_PRODUCT;
      }
      case EntityType.API_COLLECTION: {
        return ResourceEntity.API_COLLECTION;
      }
      case EntityType.API_ENDPOINT: {
        return ResourceEntity.API_ENDPOINT;
      }
      case EntityType.METRIC: {
        return ResourceEntity.METRIC;
      }
      case EntityType.DIRECTORY: {
        return ResourceEntity.DRIVE_SERVICE;
      }
      case EntityType.FILE: {
        return ResourceEntity.FILE;
      }
      case EntityType.SPREADSHEET: {
        return ResourceEntity.SPREADSHEET;
      }
      case EntityType.WORKSHEET: {
        return ResourceEntity.WORKSHEET;
      }

      default: {
        return ResourceEntity.TABLE;
      }
    }
  }

  public getEntityFloatingButton(_: EntityType): FC | null {
    return null;
  }

  public getFqnParts(
    fqn: string,
    type?: string
  ): { entityFqn: string; columnFqn?: string } {
    if (!type) {
      return { entityFqn: fqn, columnFqn: undefined };
    }
    const fqnParts = Fqn.split(fqn);
    let entityFqn = fqn;
    let columnFqn;

    switch (type) {
      case EntityType.TABLE:
        // Service.Database.Schema.Table
        if (fqnParts.length > 4) {
          entityFqn = Fqn.build(...fqnParts.slice(0, 4));
          columnFqn = Fqn.build(...fqnParts.slice(4));
        }
        break;

      case EntityType.API_ENDPOINT:
        // Service.ApiCollection.Endpoint
        if (fqnParts.length > 3) {
          entityFqn = Fqn.build(...fqnParts.slice(0, 3));
          columnFqn = Fqn.build(...fqnParts.slice(3));
        }
        break;

      case EntityType.TOPIC:
      case EntityType.SEARCH_INDEX:
      case EntityType.METRIC:
      case EntityType.CONTAINER:
      case EntityType.DIRECTORY:
      case EntityType.WORKSHEET:
      case EntityType.FILE:
      case EntityType.PIPELINE:
      case EntityType.DASHBOARD:
      case EntityType.MLMODEL:
      case EntityType.CHART:

        // Service.Topic
        if (fqnParts.length > 2) {
          entityFqn = Fqn.build(...fqnParts.slice(0, 2));
          columnFqn = Fqn.build(...fqnParts.slice(2));
        }
        break;

      case EntityType.DASHBOARD_DATA_MODEL:
        // Service.Dashboard.DataModel
        if (fqnParts.length > 3) {
          entityFqn = Fqn.build(...fqnParts.slice(0, 3));
          columnFqn = Fqn.build(...fqnParts.slice(3));
        }
        break;

      default:
        // Default behavior if needed, or just return as is
        break;
    }

    return { entityFqn, columnFqn };
  }

  public getManageExtraOptions(
    _entityType: EntityType,
    _fqn: string,
    _permission: OperationPermission,
    _entityDetails:
      | VersionData
      | ServicesType
      | Database
      | DatabaseSchema
      | APICollection,
    navigate: NavigateFunction
  ): ItemType[] {
    const isEntityDeleted = _entityDetails?.deleted ?? false;
    switch (_entityType) {
      case EntityType.TABLE:
        return [
          ...ExtraTableDropdownOptions(
            _fqn,
            _permission,
            isEntityDeleted,
            navigate
          ),
        ];
      case EntityType.DATABASE:
        return [
          ...ExtraDatabaseDropdownOptions(
            _fqn,
            _permission,
            isEntityDeleted,
            navigate
          ),
        ];
      case EntityType.DATABASE_SCHEMA:
        return [
          ...ExtraDatabaseSchemaDropdownOptions(
            _fqn,
            _permission,
            isEntityDeleted,
            navigate
          ),
        ];
      case EntityType.DATABASE_SERVICE:
        return [
          ...ExtraDatabaseServiceDropdownOptions(
            _fqn,
            _permission,
            isEntityDeleted,
            navigate
          ),
        ];
      default:
        return [];
    }
  }

  public getServiceTypeLookupMap(): Map<string, string> {
    return this.serviceTypeLookupMap;
  }

  public getEntityTypeLookupMap(): Map<string, string> {
    return this.createNormalizedLookupMap(EntityTypeName);
  }

  public getFormattedEntityType(entityType: string): string {
    const normalizedKey = entityType?.toLowerCase();

    return (
      this.getEntityTypeLookupMap().get(normalizedKey) || capitalize(entityType)
    );
  }

  public getFormattedServiceType(serviceType: string): string {
    const normalizedKey = serviceType.toLowerCase();

    return (
      this.getServiceTypeLookupMap().get(normalizedKey) ??
      this.getEntityTypeLookupMap().get(normalizedKey) ??
      serviceType
    );
  }

  public shouldShowEntityStatus(_entityType: string): boolean {
    return false;
  }
}

const entityUtilClassBase = new EntityUtilClassBase();

export default entityUtilClassBase;

export { EntityUtilClassBase };
