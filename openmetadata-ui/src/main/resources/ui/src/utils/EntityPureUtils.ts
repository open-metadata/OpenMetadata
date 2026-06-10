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
import type { Node } from 'reactflow';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  ROUTES,
} from '../constants/constants';
import { EntityLineageNodeType, EntityType } from '../enums/entity.enum';
import type { ColumnJoins, JoinedWith } from '../generated/entity/data/table';
import EntityLink from './EntityLink';
import Fqn from './Fqn';
import { getEncodedFqn } from './StringUtils';

export enum DRAWER_NAVIGATION_OPTIONS {
  explore = 'Explore',
  lineage = 'Lineage',
}

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

export const checkIfJoinsAvailable = (
  columnName: string,
  joins: Array<ColumnJoins>
): boolean => {
  return (
    joins &&
    Boolean(joins.length) &&
    Boolean(joins.some((join) => join.columnName === columnName))
  );
};

/**
 * It takes a column name and a list of joins and returns the list of joinedWith for the column name
 * @param {string} columnName - The name of the column you want to get the frequently joined with
 * columns for.
 * @param joins - Array<ColumnJoins>
 * @returns An array of joinedWith objects
 */
export const getFrequentlyJoinedWithColumns = (
  columnName: string,
  joins: Array<ColumnJoins>
): Array<JoinedWith> => {
  return (
    (joins &&
      Boolean(joins.length) &&
      joins?.find((join) => join.columnName === columnName)?.joinedWith) ||
    []
  );
};

/**
 * Retrieves the column name from an entity link.
 * @param entityLink The entity link string.
 * @returns The column name extracted from the entity link.
 */
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

export const getBreadcrumbsFromFqn = (fqn: string, includeCurrent = false) => {
  const fqnList = Fqn.split(fqn);
  if (!includeCurrent) {
    fqnList.pop();
  }

  return [
    ...fqnList.map((fqn) => ({
      name: fqn,
      url: '',
    })),
  ];
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
