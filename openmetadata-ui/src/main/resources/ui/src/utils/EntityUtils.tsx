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

// Re-exports from EntityNameUtils (backward compat)
// Re-export EntityLabel component as getEntityLabel (backward compat)
export { default as getEntityLabel } from '../components/Entity/EntityLabel/EntityLabel.component';
// Re-exports from EntityBreadcrumbUtils (backward compat)
export {
  getBreadCrumbForAPICollection,
  getBreadCrumbForAPIEndpoint,
  getBreadcrumbForChart,
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForEntityWithParent,
  getBreadCrumbForKpi,
  getBreadcrumbForTable,
  getBreadcrumbForTestCase,
  getBreadcrumbForTestSuite,
  getEntityBreadcrumbs,
  getEntityLinkFromType,
} from './EntityBreadcrumbUtils';
// Re-exports from EntityColumnUtils (backward compat)
export { getFrequentlyJoinedColumns } from './EntityColumnUtils';
export {
  EntityTypeName,
  getDomainDisplayName,
  getEntityName,
  getEntityNameLabel,
  getPluralizeEntityName,
} from './EntityNameUtils';
// Re-exports from EntityPureUtils (backward compat)
export {
  checkIfJoinsAvailable,
  columnSorter,
  DRAWER_NAVIGATION_OPTIONS,
  ENTITY_LINK_SEPARATOR,
  getBreadcrumbsFromFqn,
  getColumnNameFromEntityLink,
  getColumnSorter,
  getEntityBulkEditPath,
  getEntityFeedLink,
  getEntityImportPath,
  getEntityReferenceFromEntity,
  getEntityReferenceListFromEntities,
  getEntityTags,
  getEntityUserLink,
  getEntityVoteStatus,
  getFrequentlyJoinedWithColumns,
  hasCustomPropertiesTab,
  hasEditAccess,
  hasLineageTab,
  hasSchemaTab,
  highlightEntityNameAndDescription,
  highlightSearchText,
  searchInColumns,
  updateNodeType,
} from './EntityPureUtils';
// Re-exports from EntitySearchUtils (backward compat)
export { highlightSearchArrayElement } from './EntitySearchUtils';
