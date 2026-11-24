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
import { http, HttpResponse } from 'msw';
import { EMPTY_LIST, worker } from '../msw';

/**
 * A minimal service › database › schema chain the entity pages can load by
 * FQN. Only fields the pages read are set.
 */
const ref = (id: string, type: string, name: string, fqn = name) => ({
  id,
  type,
  name,
  fullyQualifiedName: fqn,
});

export const DB_SERVICE = {
  ...ref('00000000-0000-4000-8000-0000000000a1', 'databaseService', 'pw_mysql'),
  serviceType: 'Mysql',
  connection: { config: {} },
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};

export const DATABASE = {
  ...ref(
    '00000000-0000-4000-8000-0000000000a2',
    'database',
    'pw_db',
    'pw_mysql.pw_db'
  ),
  service: ref(DB_SERVICE.id, 'databaseService', DB_SERVICE.name),
  serviceType: 'Mysql',
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};

export const SCHEMA = {
  ...ref(
    '00000000-0000-4000-8000-0000000000a3',
    'databaseSchema',
    'pw_schema',
    'pw_mysql.pw_db.pw_schema'
  ),
  service: DATABASE.service,
  database: ref(
    DATABASE.id,
    'database',
    DATABASE.name,
    DATABASE.fullyQualifiedName
  ),
  serviceType: 'Mysql',
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};

const service = (
  id: string,
  type: string,
  name: string,
  serviceType: string
) => ({
  ...ref(id, type, name),
  serviceType,
  connection: { config: {} },
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
});

export const DASHBOARD_SERVICE = service(
  '00000000-0000-4000-8000-0000000000b1',
  'dashboardService',
  'pw_looker',
  'Looker'
);

export const DRIVE_SERVICE = service(
  '00000000-0000-4000-8000-0000000000b2',
  'driveService',
  'pw_gdrive',
  'GoogleDrive'
);

export const API_SERVICE = service(
  '00000000-0000-4000-8000-0000000000b3',
  'apiService',
  'pw_rest',
  'Rest'
);

export const API_COLLECTION = {
  ...ref(
    '00000000-0000-4000-8000-0000000000b4',
    'apiCollection',
    'pw_collection',
    'pw_rest.pw_collection'
  ),
  service: ref(API_SERVICE.id, 'apiService', API_SERVICE.name),
  serviceType: 'Rest',
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};

/** Serves GET {base}/name/:fqn for each entity. */
export const serveEntities = (
  entries: Array<[base: string, entity: { fullyQualifiedName: string }]>
) =>
  worker.use(
    ...entries.map(([base, entity]) =>
      http.get(`${base}/name/:fqn`, () => HttpResponse.json(entity))
    )
  );

/** Sibling lists a page only counts (e.g. the stored-procedure tab badge). */
export const serveEmptyLists = (paths: string[]) =>
  worker.use(
    ...paths.map((path) => http.get(path, () => HttpResponse.json(EMPTY_LIST)))
  );
