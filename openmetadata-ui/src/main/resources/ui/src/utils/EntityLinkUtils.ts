/*
 *  Copyright 2025 Collate.
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

import { isUndefined } from 'lodash';
import { Node } from 'reactflow';
import {
    PLACEHOLDER_ROUTE_ENTITY_TYPE,
    PLACEHOLDER_ROUTE_FQN,
    ROUTES
} from '../constants/constants';
import {
    EntityLineageNodeType,
    EntityTabs,
    EntityType
} from '../enums/entity.enum';
import { ServiceCategory, ServiceCategoryPlural } from '../enums/service.enum';
import {
    AlertType,
    EventSubscription
} from '../generated/events/eventSubscription';
import { SearchSourceAlias } from '../interface/search.interface';
import EntityLink from './EntityLink';
import { getKnowledgePagePath } from './KnowledgePageUtils';
import {
    getApplicationDetailsPath,
    getBotsPath,
    getClassificationTagPath,
    getDataProductDetailsPath,
    getDomainDetailsPath,
    getEntityDetailsPath,
    getGlossaryPath,
    getGlossaryTermDetailsPath,
    getKpiPath,
    getNotificationAlertDetailsPath,
    getObservabilityAlertDetailsPath,
    getPersonaDetailsPath,
    getPolicyWithFqnPath,
    getRoleWithFqnPath,
    getServiceDetailsPath,
    getTagsDetailsPath,
    getTeamsWithFqnPath,
    getTestCaseDetailPagePath
} from './RouterUtils';
import { getEncodedFqn } from './StringUtils';

export const ENTITY_LINK_SEPARATOR = '::';

export const getEntityFeedLink = (
  type?: string,
  fqn?: string,
  field?: string
): string => {
  if (isUndefined(type) || isUndefined(fqn)) {
    return '';
  }

  return `<#E${ENTITY_LINK_SEPARATOR}${type}${ENTITY_LINK_SEPARATOR}${fqn}${
    field ? `${ENTITY_LINK_SEPARATOR}${field}` : ''
  }>`;
};

/*
  params: userName - fullyQualifiedName
  return : <#E::user::userName>
*/
export const getEntityUserLink = (userName: string): string => {
  return `<#E${ENTITY_LINK_SEPARATOR}user${ENTITY_LINK_SEPARATOR}${userName}>`;
};

export const getEntityLinkFromType = (
  fullyQualifiedName: string,
  entityType: EntityType,
  entity?: SearchSourceAlias
) => {
  switch (entityType) {
    case EntityType.TABLE:
    case EntityType.TOPIC:
    case EntityType.DASHBOARD:
    case EntityType.CHART:
    case EntityType.PIPELINE:
    case EntityType.MLMODEL:
    case EntityType.CONTAINER:
    case EntityType.DATABASE:
    case EntityType.DATABASE_SCHEMA:
    case EntityType.DASHBOARD_DATA_MODEL:
    case EntityType.STORED_PROCEDURE:
    case EntityType.SEARCH_INDEX:
    case EntityType.API_COLLECTION:
    case EntityType.API_ENDPOINT:
    case EntityType.DIRECTORY:
    case EntityType.FILE:
    case EntityType.SPREADSHEET:
    case EntityType.WORKSHEET:
      return getEntityDetailsPath(entityType, fullyQualifiedName);
    case EntityType.METRIC:
      return getEntityDetailsPath(entityType, fullyQualifiedName);
    case EntityType.DATA_PRODUCT:
      return getDataProductDetailsPath(fullyQualifiedName);
    case EntityType.GLOSSARY:
    case EntityType.GLOSSARY_TERM:
      return getGlossaryTermDetailsPath(fullyQualifiedName);
    case EntityType.TAG:
      return getClassificationTagPath(fullyQualifiedName);
    case EntityType.CLASSIFICATION:
      return getTagsDetailsPath(fullyQualifiedName);

    case EntityType.DATABASE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.DATABASE_SERVICES
      );
    case EntityType.MESSAGING_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.MESSAGING_SERVICES
      );
    case EntityType.DASHBOARD_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.DASHBOARD_SERVICES
      );
    case EntityType.PIPELINE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.PIPELINE_SERVICES
      );
    case EntityType.MLMODEL_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.ML_MODEL_SERVICES
      );
    case EntityType.STORAGE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.STORAGE_SERVICES
      );
    case EntityType.SEARCH_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.SEARCH_SERVICES
      );
    case EntityType.METADATA_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.METADATA_SERVICES
      );
    case EntityType.API_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.API_SERVICES
      );
    case EntityType.DRIVE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.DRIVE_SERVICES
      );
    case EntityType.BOT:
      return getBotsPath(fullyQualifiedName);
    case EntityType.TEAM:
      return getTeamsWithFqnPath(fullyQualifiedName);
    case EntityType.APPLICATION:
      return getApplicationDetailsPath(fullyQualifiedName);
    case EntityType.TEST_CASE:
      return getTestCaseDetailPagePath(fullyQualifiedName);
    case EntityType.TEST_SUITE:
      return getEntityDetailsPath(
        EntityType.TABLE,
        fullyQualifiedName,
        EntityTabs.PROFILER
      );
    case EntityType.DOMAIN:
      return getDomainDetailsPath(fullyQualifiedName);
    case EntityType.EVENT_SUBSCRIPTION:
      return (entity as EventSubscription)?.alertType ===
        AlertType.Observability
        ? getObservabilityAlertDetailsPath(fullyQualifiedName)
        : getNotificationAlertDetailsPath(fullyQualifiedName);
    case EntityType.ROLE:
      return getRoleWithFqnPath(fullyQualifiedName);
    case EntityType.POLICY:
      return getPolicyWithFqnPath(fullyQualifiedName);
    case EntityType.PERSONA:
      return getPersonaDetailsPath(fullyQualifiedName);
    case EntityType.KPI:
      return getKpiPath(fullyQualifiedName);
    case EntityType.KNOWLEDGE_PAGE:
      return getKnowledgePagePath(fullyQualifiedName);
    default:
      return '';
  }
};

export const getColumnNameFromEntityLink = (entityLink: string) => {
  return EntityLink.getTableColumnName(entityLink);
};

export const getEntityImportPath = (entityType: EntityType, fqn: string) => {
  return ROUTES.ENTITY_IMPORT.replace(
    PLACEHOLDER_ROUTE_ENTITY_TYPE,
    entityType
  ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(fqn));
};

export const getEntityBulkEditPath = (entityType: EntityType, fqn: string) => {
  return ROUTES.BULK_EDIT_ENTITY_WITH_FQN.replace(
    PLACEHOLDER_ROUTE_ENTITY_TYPE,
    entityType
  ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(fqn));
};

/**
 * Updates the node type based on whether it's a source or target node
 * @param node - The node to update
 * @param sourceNodeId - ID of the source node
 * @param targetNodeId - ID of the target node
 * @returns The updated node with the correct type
 */
export const updateNodeType = (
  node: Node,
  sourceNodeId?: string,
  targetNodeId?: string
): Node => {
  if (node.id === sourceNodeId) {
    return {
      ...node,
      type: EntityLineageNodeType.INPUT,
    };
  }
  if (node.id === targetNodeId) {
    return {
      ...node,
      type: EntityLineageNodeType.OUTPUT,
    };
  }

  return node;
};

export const getGlossaryBreadcrumbPath = (
  fullyQualifiedName: string,
  glossaryFqn: string
) => {
  const fqnList = fullyQualifiedName ? fullyQualifiedName.split('.') : [];
  const tree = fqnList.slice(1, fqnList.length);

  return [
    {
      name: glossaryFqn,
      url: getGlossaryPath(glossaryFqn),
    },
    ...tree.map((fqn: string, index: number, source: string[]) => ({
      name: fqn,
      url: getGlossaryPath(
        `${glossaryFqn}.${source.slice(0, index + 1).join('.')}`
      ),
    })),
  ];
};

export const getServiceCategoryPath = (name: string, type?: string) => {
  return name
    ? getServiceDetailsPath(
        name,
        ServiceCategoryPlural[type as keyof typeof ServiceCategoryPlural]
      )
    : '';
};
