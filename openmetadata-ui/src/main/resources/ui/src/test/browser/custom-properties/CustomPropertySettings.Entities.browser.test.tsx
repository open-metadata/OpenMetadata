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

import {
  describeCustomPropertySettings,
  PROPERTY_KINDS,
} from './customPropertySettings.contract';

/** Every other entity type the spec covers gets a String property. */
const STRING = PROPERTY_KINDS.filter(({ type }) => type === 'string');

for (const entity of [
  { path: 'containers', entityType: 'container' },
  { path: 'dashboards', entityType: 'dashboard' },
  { path: 'databases', entityType: 'database' },
  { path: 'databaseSchemas', entityType: 'databaseSchema' },
  { path: 'glossaryTerm', entityType: 'glossaryTerm' },
  { path: 'mlmodels', entityType: 'mlmodel' },
  { path: 'pipelines', entityType: 'pipeline' },
  { path: 'searchIndexes', entityType: 'searchIndex' },
  { path: 'storedProcedures', entityType: 'storedProcedure' },
  { path: 'topics', entityType: 'topic' },
  { path: 'apiCollections', entityType: 'apiCollection' },
  { path: 'apiEndpoints', entityType: 'apiEndpoint' },
  { path: 'dataProducts', entityType: 'dataProduct' },
  { path: 'domains', entityType: 'domain' },
  { path: 'dashboardDataModels', entityType: 'dashboardDataModel' },
  { path: 'metrics', entityType: 'metric' },
  { path: 'charts', entityType: 'chart' },
  { path: 'column', entityType: 'tableColumn' },
]) {
  describeCustomPropertySettings(entity, STRING);
}
