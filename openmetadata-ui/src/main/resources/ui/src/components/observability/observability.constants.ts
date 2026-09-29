/*
 *  Copyright 2026 Collate.
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
 * Canonical route constants for the app-mode Observability module. The module
 * owns the `/observability` URL namespace; each entry is referenced both by the
 * module's route table and by the pages that navigate/breadcrumb within it, so
 * the paths live in one leaf module to keep the import graph acyclic.
 */
export const OBSERVABILITY_ROUTES = {
  OBSERVABILITY: '/observability',
  OBSERVABILITY_DATA_QUALITY_BASE: '/observability/data-quality',
  OBSERVABILITY_DATA_QUALITY: '/observability/data-quality/:tab?',
  OBSERVABILITY_DATA_QUALITY_SUB_TAB:
    '/observability/data-quality/:tab/:subTab',
  OBSERVABILITY_PIPELINE: '/observability/pipeline',
  OBSERVABILITY_PIPELINE_DETAILS: '/observability/pipeline/:fqn',
  OBSERVABILITY_PIPELINE_DETAILS_WITH_TAB: '/observability/pipeline/:fqn/:tab',
  OBSERVABILITY_INCIDENT_MANAGER: '/observability/incident-manager',
  OBSERVABILITY_ALERTS: '/observability/alerts',
  OBSERVABILITY_ALERT_DETAILS: '/observability/alert/:fqn',
  OBSERVABILITY_ALERT_DETAILS_WITH_TAB: '/observability/alert/:fqn/:tab',
  OBSERVABILITY_TEST_LIBRARY: '/observability/test-library',
  OBSERVABILITY_TEST_SUITE_DETAILS: '/observability/test-suites/:fqn',
  OBSERVABILITY_TEST_CASE_DETAILS: '/observability/test-case/:fqn',
  OBSERVABILITY_TEST_CASE_DETAILS_WITH_TAB:
    '/observability/test-case/:fqn/:tab',
  OBSERVABILITY_TEST_CASE_VERSION:
    '/observability/test-case/:fqn/versions/:version',
  OBSERVABILITY_TEST_CASE_VERSION_WITH_TAB:
    '/observability/test-case/:fqn/versions/:version/:tab',
  OBSERVABILITY_TEST_CASE_DIMENSIONS:
    '/observability/test-case/:fqn/dimensions/:dimensionKey',
  OBSERVABILITY_TEST_CASE_DIMENSIONS_WITH_TAB:
    '/observability/test-case/:fqn/dimensions/:dimensionKey/:tab',
};

/**
 * React Query key for the app-shell observability alerts sidebar count badge.
 * The value must stay identical to the key the shell subscribes with, since
 * React Query matches keys structurally — creating or deleting an alert
 * invalidates this key to keep the badge in sync.
 */
export const OBSERVABILITY_ALERT_COUNT_QUERY_KEY = [
  'askCollate',
  'observability',
  'alerts',
  'count',
] as const;
