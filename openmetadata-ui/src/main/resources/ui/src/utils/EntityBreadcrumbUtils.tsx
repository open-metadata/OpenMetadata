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

/**
 * Backward-compatible re-export barrel + getEntityBreadcrumbs dispatcher.
 *
 * Implementations split into:
 *   - EntityDataBreadcrumbUtils.ts    — table, chart, API, container/drive helpers
 *   - EntityServiceBreadcrumbUtils.ts — service-type breadcrumbs (12 service categories)
 *   - EntityGovernanceBreadcrumbUtils.ts — glossary, domain, test, KPI, role, bot, etc.
 *   - EntityBreadcrumbPureUtils.ts    — pure getEntityBreadcrumbs dispatcher
 */

// Re-export all for backward compatibility
export {
  getBreadCrumbForAPICollection,
  getBreadCrumbForAPIEndpoint,
  getBreadcrumbForChart,
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForEntityWithParent,
  getBreadcrumbForTable,
  getBreadcrumbsFromFqn,
} from './EntityDataBreadcrumbUtils';
export {
  getBreadcrumbForApplication,
  getBreadcrumbForBot,
  getBreadcrumbForClassification,
  getBreadcrumbForDataProduct,
  getBreadcrumbForDomain,
  getBreadcrumbForEventSubscription,
  getBreadcrumbForGlossaryOrTerm,
  getBreadcrumbForKnowledgePage,
  getBreadCrumbForKpi,
  getBreadcrumbForMetric,
  getBreadcrumbForPersona,
  getBreadcrumbForPolicy,
  getBreadcrumbForRole,
  getBreadcrumbForTag,
  getBreadcrumbForTeam,
  getBreadcrumbForTestCase,
  getBreadcrumbForTestSuite,
} from './EntityGovernanceBreadcrumbUtils';
export {
  getBreadcrumbForDatabase,
  getBreadcrumbForDatabaseSchema,
  getBreadcrumbForDatabaseService,
  getServiceCategoryBreadcrumb,
} from './EntityServiceBreadcrumbUtils';
