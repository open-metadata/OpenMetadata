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

import type { ItemType } from 'antd/lib/menu/hooks/useItems';
import type { Operation } from 'fast-json-patch';
import { capitalize } from 'lodash';
import type { FC } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { GlobalSettingsMenuCategory } from '../constants/GlobalSettings.constants';
import {
  ResourceEntity,
  type OperationPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { ServiceCategoryPlural } from '../enums/service.enum';
import type { APICollection } from '../generated/entity/data/apiCollection';
import type { Database } from '../generated/entity/data/database';
import type { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import type { ServicesType } from '../interface/service.interface';
import type { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';
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
import { patchKnowledgePage } from '../rest/knowledgeCenterAPI';
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
import { ExtraDatabaseDropdownOptions } from './Database/DatabaseDropdownOptions';
import { ExtraDatabaseSchemaDropdownOptions } from './DatabaseSchemaDropdownOptions';
import { ExtraDatabaseServiceDropdownOptions } from './DatabaseServiceUtils';
import { getEntityByFqnUtil } from './EntityByFqnUtils';
import { getEntityDetailComponent as getLazyEntityDetailComponent } from './EntityDetailComponentUtils';
import { EntityTypeName } from './EntityNameUtils';
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
import Fqn from './Fqn';
import { getKnowledgePagePath } from './KnowledgePagePureUtils';
import {
  getApplicationDetailsPath,
  getBotsPath,
  getClassificationTagPath,
  getDataProductDetailsPath,
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
import { ExtraTableDropdownOptions } from './TableDropdownOptions';
import { getTestSuiteDetailsPath } from './TestSuiteUtils';
type PatchAPIFunction = (id: string, patch: Operation[]) => Promise<unknown>;

const SERVICE_ROUTE_CATEGORIES: Set<string> = new Set(
  Object.values(ServiceCategoryPlural)
);

// Index/entity types whose link is a standard entity-details path, mapped to the
// EntityType passed to getEntityDetailsPath.
const ENTITY_DETAILS_PATH_TYPE_MAP: Record<string, EntityType> = {
  [EntityType.TOPIC]: EntityType.TOPIC,
  [EntityType.DASHBOARD]: EntityType.DASHBOARD,
  [EntityType.CHART]: EntityType.CHART,
  [EntityType.PIPELINE]: EntityType.PIPELINE,
  [EntityType.DATABASE]: EntityType.DATABASE,
  [EntityType.DATABASE_SCHEMA]: EntityType.DATABASE_SCHEMA,
  [EntityType.MLMODEL]: EntityType.MLMODEL,
  [EntityType.CONTAINER]: EntityType.CONTAINER,
  [EntityType.DASHBOARD_DATA_MODEL]: EntityType.DASHBOARD_DATA_MODEL,
  [EntityType.STORED_PROCEDURE]: EntityType.STORED_PROCEDURE,
  [EntityType.SEARCH_INDEX]: EntityType.SEARCH_INDEX,
  [EntityType.API_COLLECTION]: EntityType.API_COLLECTION,
  [EntityType.API_ENDPOINT]: EntityType.API_ENDPOINT,
  [EntityType.METRIC]: EntityType.METRIC,
  [EntityType.DIRECTORY]: EntityType.DIRECTORY,
  [EntityType.FILE]: EntityType.FILE,
  [EntityType.SPREADSHEET]: EntityType.SPREADSHEET,
  [EntityType.WORKSHEET]: EntityType.WORKSHEET,
};

interface EntityLinkParams {
  indexType: string;
  fullyQualifiedName: string;
  tab?: string;
  subTab?: string;
  isExecutableTestSuite?: boolean;
  isObservabilityAlert?: boolean;
  serviceFqn?: string;
  serviceRouteCategory?: string;
}

const glossaryLinkHandler = ({
  fullyQualifiedName,
  tab,
  subTab,
}: EntityLinkParams) =>
  getGlossaryTermDetailsPath(fullyQualifiedName, tab, subTab);

const serviceLinkHandler = ({
  fullyQualifiedName,
  indexType,
}: EntityLinkParams) =>
  getServiceDetailsPath(fullyQualifiedName, `${indexType}s`);

// Index/entity types whose link needs a dedicated builder.
const ENTITY_LINK_HANDLERS: Record<
  string,
  (params: EntityLinkParams) => string
> = {
  [EntityType.GLOSSARY]: glossaryLinkHandler,
  [EntityType.GLOSSARY_TERM]: glossaryLinkHandler,
  [EntityType.DATABASE_SERVICE]: serviceLinkHandler,
  [EntityType.DASHBOARD_SERVICE]: serviceLinkHandler,
  [EntityType.MESSAGING_SERVICE]: serviceLinkHandler,
  [EntityType.PIPELINE_SERVICE]: serviceLinkHandler,
  [EntityType.MLMODEL_SERVICE]: serviceLinkHandler,
  [EntityType.METADATA_SERVICE]: serviceLinkHandler,
  [EntityType.STORAGE_SERVICE]: serviceLinkHandler,
  [EntityType.SEARCH_SERVICE]: serviceLinkHandler,
  [EntityType.API_SERVICE]: serviceLinkHandler,
  [EntityType.DRIVE_SERVICE]: serviceLinkHandler,
  [EntityType.SECURITY_SERVICE]: serviceLinkHandler,
  [EntityType.WEBHOOK]: ({ fullyQualifiedName }) =>
    getEditWebhookPath(fullyQualifiedName),
  [EntityType.TYPE]: ({ fullyQualifiedName }) =>
    getSettingPath(
      GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
      `${fullyQualifiedName}s`
    ),
  [EntityType.TAG]: ({ fullyQualifiedName, tab, subTab }) =>
    getClassificationTagPath(fullyQualifiedName, tab, subTab),
  [EntityType.CLASSIFICATION]: ({ fullyQualifiedName }) =>
    getTagsDetailsPath(fullyQualifiedName),
  [EntityType.TEST_CASE]: ({ fullyQualifiedName }) =>
    getTestCaseDetailPagePath(fullyQualifiedName),
  [EntityType.TEST_SUITE]: ({ fullyQualifiedName, isExecutableTestSuite }) =>
    getTestSuiteDetailsPath({ isExecutableTestSuite, fullyQualifiedName }),
  [EntityType.DOMAIN]: ({ fullyQualifiedName, tab, subTab }) =>
    getDomainDetailsPath(fullyQualifiedName, tab, subTab),
  [EntityType.DATA_PRODUCT]: ({ fullyQualifiedName, tab, subTab }) =>
    getDataProductDetailsPath(fullyQualifiedName, tab, subTab),
  [EntityType.APPLICATION]: ({ fullyQualifiedName }) =>
    getApplicationDetailsPath(fullyQualifiedName),
  [EntityType.USER]: ({ fullyQualifiedName, tab, subTab }) =>
    getUserPath(fullyQualifiedName, tab, subTab),
  [EntityType.TEAM]: ({ fullyQualifiedName }) =>
    getTeamsWithFqnPath(fullyQualifiedName),
  [EntityType.EVENT_SUBSCRIPTION]: ({
    fullyQualifiedName,
    isObservabilityAlert,
  }) =>
    isObservabilityAlert
      ? getObservabilityAlertDetailsPath(fullyQualifiedName)
      : getNotificationAlertDetailsPath(fullyQualifiedName),
  [EntityType.ROLE]: ({ fullyQualifiedName }) =>
    getRoleWithFqnPath(fullyQualifiedName),
  [EntityType.POLICY]: ({ fullyQualifiedName }) =>
    getPolicyWithFqnPath(fullyQualifiedName),
  [EntityType.PERSONA]: ({ fullyQualifiedName }) =>
    getPersonaDetailsPath(fullyQualifiedName),
  [EntityType.BOT]: ({ fullyQualifiedName }) => getBotsPath(fullyQualifiedName),
  [EntityType.KPI]: ({ fullyQualifiedName }) => getKpiPath(fullyQualifiedName),
  [EntityType.KNOWLEDGE_PAGE]: ({ fullyQualifiedName, tab, subTab }) =>
    getKnowledgePagePath(fullyQualifiedName, tab, subTab),
  // No standalone detail page for a pipeline: route to the owning service's agents
  // tab. Callers without service context (prepareFeedLink) and unrecognised
  // categories fall back to the table-details default.
  [EntityType.INGESTION_PIPELINE]: ({
    serviceFqn,
    serviceRouteCategory,
    fullyQualifiedName,
    tab,
    subTab,
  }) =>
    serviceFqn && serviceRouteCategory
      ? getServiceDetailsPath(
          serviceFqn,
          serviceRouteCategory,
          EntityTabs.AGENTS
        )
      : getEntityDetailsPath(EntityType.TABLE, fullyQualifiedName, tab, subTab),
};

const RESOURCE_ENTITY_BY_TYPE: Record<string, ResourceEntity> = {
  [EntityType.TABLE]: ResourceEntity.TABLE,
  [EntityType.TOPIC]: ResourceEntity.TOPIC,
  [EntityType.DASHBOARD]: ResourceEntity.DASHBOARD,
  [EntityType.CHART]: ResourceEntity.CHART,
  [EntityType.PIPELINE]: ResourceEntity.PIPELINE,
  [EntityType.MLMODEL]: ResourceEntity.ML_MODEL,
  [EntityType.CONTAINER]: ResourceEntity.CONTAINER,
  [EntityType.SEARCH_INDEX]: ResourceEntity.SEARCH_INDEX,
  [EntityType.DASHBOARD_DATA_MODEL]: ResourceEntity.DASHBOARD_DATA_MODEL,
  [EntityType.STORED_PROCEDURE]: ResourceEntity.STORED_PROCEDURE,
  [EntityType.DATABASE]: ResourceEntity.DATABASE,
  [EntityType.DATABASE_SCHEMA]: ResourceEntity.DATABASE_SCHEMA,
  [EntityType.GLOSSARY_TERM]: ResourceEntity.GLOSSARY_TERM,
  [EntityType.DATA_PRODUCT]: ResourceEntity.DATA_PRODUCT,
  [EntityType.API_COLLECTION]: ResourceEntity.API_COLLECTION,
  [EntityType.API_ENDPOINT]: ResourceEntity.API_ENDPOINT,
  [EntityType.METRIC]: ResourceEntity.METRIC,
  [EntityType.DIRECTORY]: ResourceEntity.DRIVE_SERVICE,
  [EntityType.FILE]: ResourceEntity.FILE,
  [EntityType.SPREADSHEET]: ResourceEntity.SPREADSHEET,
  [EntityType.WORKSHEET]: ResourceEntity.WORKSHEET,
  [EntityType.KNOWLEDGE_PAGE]: ResourceEntity.KNOWLEDGE_PAGE,
  'knowledge-center': ResourceEntity.KNOWLEDGE_PAGE,
};

// Number of leading FQN parts that make up the parent entity FQN for a given type;
// anything beyond that is the column FQN.
const FQN_PARENT_LEVEL_BY_TYPE: Record<string, number> = {
  [EntityType.TABLE]: 4,
  [EntityType.STORED_PROCEDURE]: 4,
  [EntityType.API_ENDPOINT]: 3,
  [EntityType.DATABASE_SCHEMA]: 3,
  [EntityType.DASHBOARD_DATA_MODEL]: 3,
  [EntityType.TOPIC]: 2,
  [EntityType.SEARCH_INDEX]: 2,
  [EntityType.METRIC]: 2,
  [EntityType.WORKSHEET]: 2,
  [EntityType.PIPELINE]: 2,
  [EntityType.DASHBOARD]: 2,
  [EntityType.MLMODEL]: 2,
  [EntityType.CHART]: 2,
  [EntityType.DATABASE]: 2,
};

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
    [EntityType.KNOWLEDGE_PAGE]: patchKnowledgePage,
  };

  private createNormalizedLookupMap<T extends Record<string, string>>(
    obj: T
  ): Map<string, string> {
    return new Map(
      Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value])
    );
  }

  /**
   * Plural route segment for a caller-supplied service category. Accepts the plural segment
   * (`databaseServices`) and the singular entity type (`databaseService`) — chat entity links
   * carry either — and returns undefined for anything that is not a service category.
   */
  private getServiceRouteCategory(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    if (SERVICE_ROUTE_CATEGORIES.has(value)) {
      return value;
    }

    // The value is model-authored, so it can be a prototype key ("constructor") whose lookup
    // returns a truthy non-category; validate the result rather than the input.
    const plural =
      ServiceCategoryPlural[value as keyof typeof ServiceCategoryPlural];

    return SERVICE_ROUTE_CATEGORIES.has(plural) ? plural : undefined;
  }

  public getEntityLink(
    indexType: string,
    fullyQualifiedName: string,
    tab?: string,
    subTab?: string,
    isExecutableTestSuite?: boolean,
    isObservabilityAlert?: boolean,
    serviceCategory?: string,
    serviceFqn?: string
  ) {
    const serviceRouteCategory = this.getServiceRouteCategory(serviceCategory);

    const detailsType = ENTITY_DETAILS_PATH_TYPE_MAP[indexType];

    if (detailsType) {
      return getEntityDetailsPath(detailsType, fullyQualifiedName, tab, subTab);
    }

    const handler = ENTITY_LINK_HANDLERS[indexType];

    if (handler) {
      return handler({
        indexType,
        fullyQualifiedName,
        tab,
        subTab,
        isExecutableTestSuite,
        isObservabilityAlert,
        serviceFqn,
        serviceRouteCategory,
      });
    }

    return getEntityDetailsPath(
      EntityType.TABLE,
      fullyQualifiedName,
      tab,
      subTab
    );
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
    // Entity detail pages are large route-level surfaces. Delegate to the lazy
    // registry so importing EntityUtilClassBase for links/patch APIs does not
    // pull every detail page into the startup bundle.
    return getLazyEntityDetailComponent(entityType);
  }

  public getResourceEntityFromEntityType(entityType: string): string {
    return RESOURCE_ENTITY_BY_TYPE[entityType] ?? ResourceEntity.TABLE;
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

    const parentLevel = FQN_PARENT_LEVEL_BY_TYPE[type];

    if (!parentLevel) {
      return { entityFqn: fqn, columnFqn: undefined };
    }

    const fqnParts = Fqn.split(fqn);

    if (fqnParts.length > parentLevel) {
      return {
        entityFqn: Fqn.build(...fqnParts.slice(0, parentLevel)),
        columnFqn: Fqn.build(...fqnParts.slice(parentLevel)),
      };
    }

    return { entityFqn: fqn, columnFqn: undefined };
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

  public getEntityTypes(): string[] {
    return Object.values(EntityType);
  }
}

const entityUtilClassBase = new EntityUtilClassBase();

export default entityUtilClassBase;

export { EntityUtilClassBase };
