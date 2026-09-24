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
 * SharedInfra — per-shard cache of parent chains that entity fixtures reuse.
 *
 * WHY. Every `TableClass.create()` fires four POSTs (service → database →
 * databaseSchema → table); TopicClass fires two (messagingService → topic);
 * etc. In a beforeAll that seeds N entities, N × parent-chain services are
 * created per Playwright worker, and three workers all racing the same
 * `POST /services/…` endpoints is what produces the "socket hang up" flakes
 * observed on the Lineage suite.
 *
 * A fixture that opts into shared mode reads its parents from here instead
 * of creating fresh ones. The parents are created ONCE per shard by the
 * setup project (`entity-data.setup.ts`, via the `seedLineageAndSharedInfra`
 * helper), then their FQNs are serialised to disk. Every test worker loads
 * the serialised data on
 * module import — so the very first `.create()` call in every worker
 * already has the shared parents in hand, with zero network cost for the
 * parent tier.
 *
 * SCOPE. Per-shard (per-CI-shard, per-local-run). Cross-process sharing
 * uses the same trick `EntityDataClass` does today: a JSON file under
 * `playwright/output/shared-infra.json`.
 *
 * IMPLEMENTATION. Two-layer cache:
 *   - `_*Data` slots hold pre-resolved response data (populated by
 *     `loadResponseData()` at import, or by an in-process create).
 *   - `_*` promise slots are only used inside the process that runs
 *     `create()`; they de-dupe concurrent first-time calls.
 *   Test workers only ever hit the `_*Data` fast path — no network.
 *
 * OWNERSHIP. Shared parents are teardown-owned by whichever setup/teardown
 * pairs with them (today: `entity-data.setup.ts` creates and saves via
 * `seedLineageAndSharedInfra`; `entity-data.teardown.ts` deletes via
 * `SharedInfra.reset()` and cleans up the JSON). Individual leaf entities'
 * `delete()` in shared mode must NEVER cascade to a shared parent, or one
 * test's cleanup orphans every other test's leaves in the shard.
 */

import { APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createOrFetch } from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { ResponseDataType } from './Entity.interface';
import { ApiServiceClass } from './service/ApiServiceClass';
import { DashboardServiceClass } from './service/DashboardServiceClass';
import { DatabaseServiceClass } from './service/DatabaseServiceClass';
import { DriveServiceClass } from './service/DriveServiceClass';
import { MessagingServiceClass } from './service/MessagingServiceClass';
import { MlmodelServiceClass } from './service/MlmodelServiceClass';
import { PipelineServiceClass } from './service/PipelineServiceClass';
import { SearchIndexServiceClass } from './service/SearchIndexServiceClass';
import { StorageServiceClass } from './service/StorageServiceClass';

export interface DatabaseHierarchy {
  service: ResponseDataType;
  database: ResponseDataType;
  schema: ResponseDataType;
}

export interface DriveDirectoryHierarchy {
  service: ResponseDataType;
  directory: ResponseDataType;
}

export interface DriveSpreadsheetHierarchy {
  service: ResponseDataType;
  spreadsheet: ResponseDataType;
}

export interface ApiCollectionHierarchy {
  service: ResponseDataType;
  collection: ResponseDataType;
}

const OUTPUT_FILENAME = 'shared-infra.json';

// Delete paths keyed to the promise slots below. Used only by reset().
const SERVICE_DELETE_PATHS = {
  databaseServices: 'databaseServices',
  messagingServices: 'messagingServices',
  dashboardServices: 'dashboardServices',
  mlmodelServices: 'mlmodelServices',
  pipelineServices: 'pipelineServices',
  searchServices: 'searchServices',
  storageServices: 'storageServices',
  apiServices: 'apiServices',
  driveServices: 'driveServices',
} as const;

const outputFilePath = (): string =>
  path.join(__dirname, '..', '..', 'output', OUTPUT_FILENAME);

export class SharedInfra {
  // --- Resolved data slots. Populated by loadResponseData() at import
  //     (test workers) or by an in-process create (setup process). Test
  //     workers hit these directly and skip every network call.
  private static _databaseHierarchyData: Map<string, DatabaseHierarchy> =
    new Map();
  private static _messagingServiceData: ResponseDataType | null = null;
  // Keyed slots (dashboardService, driveService, driveDirectory,
  // driveSpreadsheet): LineageFilters iterates depth-2 entities and asserts
  // "only THIS entity shows for its service" — but Dashboard+DataModel share
  // one dashboardService and Directory/File/Spreadsheet/Worksheet share one
  // driveService when everyone uses the same slot. Passing a per-entity key
  // gives each its own umbrella service without leaving shared mode; callers
  // that omit the key stay on 'default' and share as before.
  private static _dashboardServiceData: Map<string, ResponseDataType> =
    new Map();
  private static _mlmodelServiceData: ResponseDataType | null = null;
  private static _pipelineServiceData: ResponseDataType | null = null;
  private static _searchIndexServiceData: ResponseDataType | null = null;
  private static _storageServiceData: ResponseDataType | null = null;
  private static _apiCollectionData: ApiCollectionHierarchy | null = null;
  private static _driveServiceData: Map<string, ResponseDataType> = new Map();
  private static _driveDirectoryData: Map<string, DriveDirectoryHierarchy> =
    new Map();
  private static _driveSpreadsheetData: Map<string, DriveSpreadsheetHierarchy> =
    new Map();

  // --- In-flight promise slots. Only meaningful inside the setup process
  //     when two concurrent callers arrive before the first has resolved.
  //     Test workers never touch these because loadResponseData() has
  //     already populated the *Data slots.
  private static _databaseHierarchy: Map<string, Promise<DatabaseHierarchy>> =
    new Map();
  private static _messagingService: Promise<ResponseDataType> | null = null;
  private static _dashboardService: Map<string, Promise<ResponseDataType>> =
    new Map();
  private static _mlmodelService: Promise<ResponseDataType> | null = null;
  private static _pipelineService: Promise<ResponseDataType> | null = null;
  private static _searchIndexService: Promise<ResponseDataType> | null = null;
  private static _storageService: Promise<ResponseDataType> | null = null;
  private static _apiCollection: Promise<ApiCollectionHierarchy> | null = null;
  private static _driveService: Map<string, Promise<ResponseDataType>> =
    new Map();
  private static _driveDirectory: Map<
    string,
    Promise<DriveDirectoryHierarchy>
  > = new Map();
  private static _driveSpreadsheet: Map<
    string,
    Promise<DriveSpreadsheetHierarchy>
  > = new Map();

  /* ---------- database chain: service → database → schema ---------- */

  static async databaseHierarchy(
    apiContext: APIRequestContext,
    key = 'default'
  ): Promise<DatabaseHierarchy> {
    const cached = this._databaseHierarchyData.get(key);
    if (cached) {
      return cached;
    }
    let inFlight = this._databaseHierarchy.get(key);
    if (!inFlight) {
      inFlight = this.buildDatabaseHierarchy(apiContext);
      this._databaseHierarchy.set(key, inFlight);
    }
    const data = await inFlight;
    this._databaseHierarchyData.set(key, data);

    return data;
  }

  private static async buildDatabaseHierarchy(
    apiContext: APIRequestContext
  ): Promise<DatabaseHierarchy> {
    const service = await new DatabaseServiceClass().create(apiContext);
    const databaseName = `pw-shared-database-${uuid()}`;
    const schemaName = `pw-shared-database-schema-${uuid()}`;

    const database = await createOrFetch<ResponseDataType>(apiContext, {
      label: 'SharedInfra.databaseHierarchy database',
      createPath: '/api/v1/databases',
      fqnSegments: [service.name, databaseName],
      data: { name: databaseName, service: service.fullyQualifiedName },
    });

    const schema = await createOrFetch<ResponseDataType>(apiContext, {
      label: 'SharedInfra.databaseHierarchy schema',
      createPath: '/api/v1/databaseSchemas',
      fqnSegments: [service.name, databaseName, schemaName],
      data: { name: schemaName, database: database.fullyQualifiedName },
    });

    return { service, database, schema };
  }

  /* ---------- single-parent services ---------- */

  static async messagingService(
    apiContext: APIRequestContext
  ): Promise<ResponseDataType> {
    if (this._messagingServiceData) {
      return this._messagingServiceData;
    }
    if (!this._messagingService) {
      this._messagingService = new MessagingServiceClass().create(apiContext);
    }
    const data = await this._messagingService;
    this._messagingServiceData = data;

    return data;
  }

  static async dashboardService(
    apiContext: APIRequestContext,
    key = 'default'
  ): Promise<ResponseDataType> {
    const cached = this._dashboardServiceData.get(key);
    if (cached) {
      return cached;
    }
    let inFlight = this._dashboardService.get(key);
    if (!inFlight) {
      // DashboardServiceClass.create() returns { service, children }; the
      // rest of SharedInfra normalises on the service object alone.
      inFlight = new DashboardServiceClass()
        .create(apiContext)
        .then(({ service }) => service);
      this._dashboardService.set(key, inFlight);
    }
    const data = await inFlight;
    this._dashboardServiceData.set(key, data);

    return data;
  }

  static async mlmodelService(
    apiContext: APIRequestContext
  ): Promise<ResponseDataType> {
    if (this._mlmodelServiceData) {
      return this._mlmodelServiceData;
    }
    if (!this._mlmodelService) {
      this._mlmodelService = new MlmodelServiceClass().create(apiContext);
    }
    const data = await this._mlmodelService;
    this._mlmodelServiceData = data;

    return data;
  }

  static async pipelineService(
    apiContext: APIRequestContext
  ): Promise<ResponseDataType> {
    if (this._pipelineServiceData) {
      return this._pipelineServiceData;
    }
    if (!this._pipelineService) {
      this._pipelineService = new PipelineServiceClass().create(apiContext);
    }
    const data = await this._pipelineService;
    this._pipelineServiceData = data;

    return data;
  }

  static async searchIndexService(
    apiContext: APIRequestContext
  ): Promise<ResponseDataType> {
    if (this._searchIndexServiceData) {
      return this._searchIndexServiceData;
    }
    if (!this._searchIndexService) {
      this._searchIndexService = new SearchIndexServiceClass().create(
        apiContext
      );
    }
    const data = await this._searchIndexService;
    this._searchIndexServiceData = data;

    return data;
  }

  static async storageService(
    apiContext: APIRequestContext
  ): Promise<ResponseDataType> {
    if (this._storageServiceData) {
      return this._storageServiceData;
    }
    if (!this._storageService) {
      this._storageService = new StorageServiceClass().create(apiContext);
    }
    const data = await this._storageService;
    this._storageServiceData = data;

    return data;
  }

  static async driveService(
    apiContext: APIRequestContext,
    key = 'default'
  ): Promise<ResponseDataType> {
    const cached = this._driveServiceData.get(key);
    if (cached) {
      return cached;
    }
    let inFlight = this._driveService.get(key);
    if (!inFlight) {
      inFlight = new DriveServiceClass().create(apiContext);
      this._driveService.set(key, inFlight);
    }
    const data = await inFlight;
    this._driveServiceData.set(key, data);

    return data;
  }

  /* ---------- multi-parent chains ---------- */

  static async apiCollection(
    apiContext: APIRequestContext
  ): Promise<ApiCollectionHierarchy> {
    if (this._apiCollectionData) {
      return this._apiCollectionData;
    }
    if (!this._apiCollection) {
      this._apiCollection = this.buildApiCollection(apiContext);
    }
    const data = await this._apiCollection;
    this._apiCollectionData = data;

    return data;
  }

  private static async buildApiCollection(
    apiContext: APIRequestContext
  ): Promise<ApiCollectionHierarchy> {
    const service = await new ApiServiceClass().create(apiContext);
    const collectionName = `pw-shared-api-collection-${uuid()}`;

    const collection = await createOrFetch<ResponseDataType>(apiContext, {
      label: 'SharedInfra.apiCollection collection',
      createPath: '/api/v1/apiCollections',
      fqnSegments: [service.name, collectionName],
      data: {
        name: collectionName,
        endpointURL: 'https://petstore3.swagger.io/api/v3/pet',
        service: service.fullyQualifiedName,
      },
    });

    return { service, collection };
  }

  static async driveDirectory(
    apiContext: APIRequestContext,
    key = 'default'
  ): Promise<DriveDirectoryHierarchy> {
    const cached = this._driveDirectoryData.get(key);
    if (cached) {
      return cached;
    }
    let inFlight = this._driveDirectory.get(key);
    if (!inFlight) {
      inFlight = this.buildDriveDirectory(apiContext, key);
      this._driveDirectory.set(key, inFlight);
    }
    const data = await inFlight;
    this._driveDirectoryData.set(key, data);

    return data;
  }

  private static async buildDriveDirectory(
    apiContext: APIRequestContext,
    key: string
  ): Promise<DriveDirectoryHierarchy> {
    // Passes `key` through so the driveService this Directory sits in is
    // itself the caller's own slot — Directory and File must not collide.
    const service = await this.driveService(apiContext, key);
    const directoryName = `pw-shared-directory-${uuid()}`;

    const directory = await createOrFetch<ResponseDataType>(apiContext, {
      label: 'SharedInfra.driveDirectory directory',
      createPath: '/api/v1/drives/directories',
      fqnSegments: [service.name, directoryName],
      data: { name: directoryName, service: service.fullyQualifiedName },
    });

    return { service, directory };
  }

  static async driveSpreadsheet(
    apiContext: APIRequestContext,
    key = 'default'
  ): Promise<DriveSpreadsheetHierarchy> {
    const cached = this._driveSpreadsheetData.get(key);
    if (cached) {
      return cached;
    }
    let inFlight = this._driveSpreadsheet.get(key);
    if (!inFlight) {
      inFlight = this.buildDriveSpreadsheet(apiContext, key);
      this._driveSpreadsheet.set(key, inFlight);
    }
    const data = await inFlight;
    this._driveSpreadsheetData.set(key, data);

    return data;
  }

  private static async buildDriveSpreadsheet(
    apiContext: APIRequestContext,
    key: string
  ): Promise<DriveSpreadsheetHierarchy> {
    // Spreadsheet is a direct child of driveService (not under a directory)
    // — see WorksheetClass.create's fqnSegments: [service, spreadsheet]
    // (2 segments) whereas File uses [service, directory, file] (3). Key
    // passes through so Spreadsheet and Worksheet each get their own drive
    // service.
    const service = await this.driveService(apiContext, key);
    const spreadsheetName = `pw-shared-spreadsheet-${uuid()}`;

    const spreadsheet = await createOrFetch<ResponseDataType>(apiContext, {
      label: 'SharedInfra.driveSpreadsheet spreadsheet',
      createPath: '/api/v1/drives/spreadsheets',
      fqnSegments: [service.name, spreadsheetName],
      data: {
        name: spreadsheetName,
        service: service.fullyQualifiedName,
      },
    });

    return { service, spreadsheet };
  }

  /* ---------- cross-process persistence ---------- */

  /**
   * Serialise every populated `_*Data` slot to disk so test workers can
   * pick them up on module import. Called by the setup project after it
   * has finished triggering every parent chain the shard needs.
   */
  static saveResponseData(): void {
    const payload = {
      databaseHierarchy: Object.fromEntries(this._databaseHierarchyData),
      messagingService: this._messagingServiceData,
      dashboardService: Object.fromEntries(this._dashboardServiceData),
      mlmodelService: this._mlmodelServiceData,
      pipelineService: this._pipelineServiceData,
      searchIndexService: this._searchIndexServiceData,
      storageService: this._storageServiceData,
      apiCollection: this._apiCollectionData,
      driveService: Object.fromEntries(this._driveServiceData),
      driveDirectory: Object.fromEntries(this._driveDirectoryData),
      driveSpreadsheet: Object.fromEntries(this._driveSpreadsheetData),
    };

    const filePath = outputFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { flag: 'w' });
  }

  /**
   * Read whatever the setup project persisted and populate the fast-path
   * data slots. Runs on module import (see the bottom of this file), so
   * every entity's `create()` in shared mode has parents ready with no
   * further round-trip.
   *
   * Silently no-ops when the file is missing (first run, or a project
   * that runs before the setup) — the create() path will still fall back
   * to building the chain in-process.
   */
  static loadResponseData(): void {
    try {
      const filePath = outputFilePath();
      if (!fs.existsSync(filePath)) {
        return;
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
        string,
        unknown
      >;

      if (data.databaseHierarchy) {
        this._databaseHierarchyData = new Map(
          Object.entries(
            data.databaseHierarchy as Record<string, DatabaseHierarchy>
          )
        );
      }
      if (data.messagingService) {
        this._messagingServiceData = data.messagingService as ResponseDataType;
      }
      if (data.dashboardService) {
        this._dashboardServiceData = new Map(
          Object.entries(
            data.dashboardService as Record<string, ResponseDataType>
          )
        );
      }
      if (data.mlmodelService) {
        this._mlmodelServiceData = data.mlmodelService as ResponseDataType;
      }
      if (data.pipelineService) {
        this._pipelineServiceData = data.pipelineService as ResponseDataType;
      }
      if (data.searchIndexService) {
        this._searchIndexServiceData =
          data.searchIndexService as ResponseDataType;
      }
      if (data.storageService) {
        this._storageServiceData = data.storageService as ResponseDataType;
      }
      if (data.apiCollection) {
        this._apiCollectionData = data.apiCollection as ApiCollectionHierarchy;
      }
      if (data.driveService) {
        this._driveServiceData = new Map(
          Object.entries(data.driveService as Record<string, ResponseDataType>)
        );
      }
      if (data.driveDirectory) {
        this._driveDirectoryData = new Map(
          Object.entries(
            data.driveDirectory as Record<string, DriveDirectoryHierarchy>
          )
        );
      }
      if (data.driveSpreadsheet) {
        this._driveSpreadsheetData = new Map(
          Object.entries(
            data.driveSpreadsheet as Record<string, DriveSpreadsheetHierarchy>
          )
        );
      }
    } catch {
      // Corrupt or partially-written file — treat as absent. The setup
      // project owns rewriting it on its next run.
    }
  }

  /* ---------- teardown helper ---------- */

  /**
   * Delete every parent SharedInfra has ever handed out on this shard.
   * Reads FQNs from both the resolved data slots and the loaded JSON, so
   * a teardown process that never ran a create still cleans up. Only the
   * leaf-owning teardown project should call this — leaves that reference
   * these parents must be gone first, or their cascade delete will race.
   */
  static async reset(apiContext: APIRequestContext): Promise<void> {
    // Ensure the disk-persisted parents are in the fast slots so teardown
    // running in a different process from setup still sees them.
    this.loadResponseData();

    const services: Array<
      [keyof typeof SERVICE_DELETE_PATHS, ResponseDataType | null | undefined]
    > = [
      ...Array.from(this._databaseHierarchyData.values()).map(
        (h): [keyof typeof SERVICE_DELETE_PATHS, ResponseDataType] => [
          'databaseServices',
          h.service,
        ]
      ),
      ['messagingServices', this._messagingServiceData],
      ...Array.from(this._dashboardServiceData.values()).map(
        (svc): [keyof typeof SERVICE_DELETE_PATHS, ResponseDataType] => [
          'dashboardServices',
          svc,
        ]
      ),
      ['mlmodelServices', this._mlmodelServiceData],
      ['pipelineServices', this._pipelineServiceData],
      ['searchServices', this._searchIndexServiceData],
      ['storageServices', this._storageServiceData],
      ['apiServices', this._apiCollectionData?.service],
      ...Array.from(this._driveServiceData.values()).map(
        (svc): [keyof typeof SERVICE_DELETE_PATHS, ResponseDataType] => [
          'driveServices',
          svc,
        ]
      ),
    ];

    await Promise.allSettled(
      services.map(async ([path, service]) => {
        if (!service?.fullyQualifiedName) {
          return;
        }
        await apiContext.delete(
          `/api/v1/services/${
            SERVICE_DELETE_PATHS[path]
          }/name/${encodeURIComponent(
            service.fullyQualifiedName
          )}?recursive=true&hardDelete=true`
        );
      })
    );

    // Clear in-memory state (both data and any in-flight promises).
    this._databaseHierarchyData.clear();
    this._messagingServiceData = null;
    this._dashboardServiceData.clear();
    this._mlmodelServiceData = null;
    this._pipelineServiceData = null;
    this._searchIndexServiceData = null;
    this._storageServiceData = null;
    this._apiCollectionData = null;
    this._driveServiceData.clear();
    this._driveDirectoryData.clear();
    this._driveSpreadsheetData.clear();

    this._databaseHierarchy.clear();
    this._messagingService = null;
    this._dashboardService.clear();
    this._mlmodelService = null;
    this._pipelineService = null;
    this._searchIndexService = null;
    this._storageService = null;
    this._apiCollection = null;
    this._driveService.clear();
    this._driveDirectory.clear();
    this._driveSpreadsheet.clear();

    // Remove the persisted file too so a subsequent run of the setup
    // project starts fresh instead of adopting orphaned FQNs.
    try {
      fs.rmSync(outputFilePath(), { force: true });
    } catch {
      // Ignore — either the file was already gone or we don't have write
      // permission, which the setup would surface anyway.
    }
  }
}

// Runs at module import so test workers pick up whatever the setup
// process persisted. Safe when the file is absent (setup hasn't run yet
// or this shard doesn't use SharedInfra — see loadResponseData).
SharedInfra.loadResponseData();
