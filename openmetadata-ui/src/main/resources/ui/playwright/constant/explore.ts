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
export const EXPECTED_BUCKETS = [
  'table',
  'glossaryTerm',
  'databaseSchema',
  'chart',
  'storedProcedure',
  'database',
  'pipeline',
  'dashboard',
  'container',
  'tag',
  'dashboardDataModel',
  'apiEndpoint',
  'topic',
  'apiCollection',
  'searchIndex',
  'mlmodel',
];

export const DATA_ASSETS = [
  { name: 'Table', filter: 'table' },
  { name: 'Database', filter: 'database' },
  { name: 'Database Schema', filter: 'databaseSchema' },
  { name: 'Dashboard', filter: 'dashboard' },
  { name: 'Dashboard Data Model', filter: 'dashboardDataModel' },
  { name: 'Pipeline', filter: 'pipeline' },
  { name: 'Topic', filter: 'topic' },
  { name: 'ML Model', filter: 'mlmodel' },
  { name: 'Container', filter: 'container' },
  { name: 'Search Index', filter: 'searchIndex' },
  { name: 'API Endpoint', filter: 'apiEndpoint' },
  { name: 'API Collection', filter: 'apiCollection' },
  { name: 'Stored Procedure', filter: 'storedProcedure' },
  { name: 'Glossary Term', filter: 'glossaryTerm' },
  { name: 'Tags', filter: 'tag' },
  { name: 'Metrics', filter: 'metric' },
];
