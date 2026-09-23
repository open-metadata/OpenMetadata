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
 * setup project (see `lineage-data.setup.ts`), then their FQNs are
 * serialised to disk. Every test worker loads the serialised data on
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
 * pairs with them (today: `lineage-data.setup.ts` creates and saves;
 * `entity-data.teardown.ts` deletes via `SharedInfra.reset()` and cleans
 * up the JSON). Individual leaf entities' `delete()` in shared mode must
 * NEVER cascade to a shared parent, or one test's cleanup orphans every
 * other test's leaves in the shard.
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
  private static _databaseHierarchyData: DatabaseHierarchy | null = null;
  private static _messagingServiceData: ResponseDataType | null = null;
  private static _dashboardServiceData: ResponseDataType | null = null;
  private static _mlmodelServiceData: ResponseDataType | null = null;
  private static _pipelineServiceData: ResponseDataType | null = null;
  private static _searchIndexServiceData: ResponseDataType | null = null;
  private static _storageServiceData: ResponseDataType | null = null;
  private static _apiCollectionData: ApiCollectionHierarchy | null = null;
  private static _driveServiceData: ResponseDataType | null = null;
  private static _driveDirectoryData: DriveDirectoryHierarchy | null = null;
  private static _driveSpreadsheetData: DriveSpreadsheetHierarchy | null = null;

  // --- In-flight promise slots. Only meaningful inside the setup process
  //     when two concurrent callers arrive before the first has resolved.
  //     Test workers never touch these because loadResponseData() has
  //     already populated the *Data slots.
  private static _databaseHierarchy: Promise<DatabaseHierarchy> | null = null;
  private static _messagingService: Promise<ResponseDataType> | null = null;
  private static _dashboardService: Promise<ResponseDataType> | null = null;
  private static _mlmodelService: Promise<ResponseDataType> | null = null;
  private static _pipelineService: Promise<ResponseDataType> | null = null;
  private static _searchIndexService: Promise<ResponseDataType> | null = null;
  private static _storageService: Promise<ResponseDataType> | null = null;
  private static _apiCollection: Promise<ApiCollectionHierarchy> | null = null;
  private static _driveService: Promise<ResponseDataType> | null = null;
  private static _driveDirectory: Promise<DriveDirectoryHierarchy> | null =
    null;
  private static _driveSpreadsheet: Promise<DriveSpreadsheetHierarchy> | null =
    null;

  /* ---------- database chain: service → database → schema ---------- */

  static async databaseHierarchy(
    apiContext: APIRequestContext
  ): Promise<DatabaseHierarchy> {
    if (this._databaseHierarchyData) {
      return this._databaseHierarchyData;
    }
    if (!this._databaseHierarchy) {
      this._databaseHierarchy = this.buildDatabaseHierarchy(apiContext);
    }
    const data = await this._databaseHierarchy;
    this._databaseHierarchyData = data;

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
    apiContext: APIRequestContext
  ): Promise<ResponseDataType> {
    if (this._dashboardServiceData) {
      return this._dashboardServiceData;
    }
    if (!this._dashboardService) {
      // DashboardServiceClass.create() returns { service, children }; the
      // rest of SharedInfra normalises on the service object alone.
      this._dashboardService = new DashboardServiceClass()
        .create(apiContext)
        .then(({ service }) => service);
    }
    const data = await this._dashboardService;
    this._dashboardServiceData = data;

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
    apiContext: APIRequestContext
  ): Promise<ResponseDataType> {
    if (this._driveServiceData) {
      return this._driveServiceData;
    }
    if (!this._driveService) {
      this._driveService = new DriveServiceClass().create(apiContext);
    }
    const data = await this._driveService;
    this._driveServiceData = data;

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
    apiContext: APIRequestContext
  ): Promise<DriveDirectoryHierarchy> {
    if (this._driveDirectoryData) {
      return this._driveDirectoryData;
    }
    if (!this._driveDirectory) {
      this._driveDirectory = this.buildDriveDirectory(apiContext);
    }
    const data = await this._driveDirectory;
    this._driveDirectoryData = data;

    return data;
  }

  private static async buildDriveDirectory(
    apiContext: APIRequestContext
  ): Promise<DriveDirectoryHierarchy> {
    const service = await this.driveService(apiContext);
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
    apiContext: APIRequestContext
  ): Promise<DriveSpreadsheetHierarchy> {
    if (this._driveSpreadsheetData) {
      return this._driveSpreadsheetData;
    }
    if (!this._driveSpreadsheet) {
      this._driveSpreadsheet = this.buildDriveSpreadsheet(apiContext);
    }
    const data = await this._driveSpreadsheet;
    this._driveSpreadsheetData = data;

    return data;
  }

  private static async buildDriveSpreadsheet(
    apiContext: APIRequestContext
  ): Promise<DriveSpreadsheetHierarchy> {
    // Spreadsheet is a direct child of driveService (not under a directory)
    // — see WorksheetClass.create's fqnSegments: [service, spreadsheet]
    // (2 segments) whereas File uses [service, directory, file] (3).
    const service = await this.driveService(apiContext);
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
      databaseHierarchy: this._databaseHierarchyData,
      messagingService: this._messagingServiceData,
      dashboardService: this._dashboardServiceData,
      mlmodelService: this._mlmodelServiceData,
      pipelineService: this._pipelineServiceData,
      searchIndexService: this._searchIndexServiceData,
      storageService: this._storageServiceData,
      apiCollection: this._apiCollectionData,
      driveService: this._driveServiceData,
      driveDirectory: this._driveDirectoryData,
      driveSpreadsheet: this._driveSpreadsheetData,
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
        this._databaseHierarchyData =
          data.databaseHierarchy as DatabaseHierarchy;
      }
      if (data.messagingService) {
        this._messagingServiceData = data.messagingService as ResponseDataType;
      }
      if (data.dashboardService) {
        this._dashboardServiceData = data.dashboardService as ResponseDataType;
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
        this._driveServiceData = data.driveService as ResponseDataType;
      }
      if (data.driveDirectory) {
        this._driveDirectoryData =
          data.driveDirectory as DriveDirectoryHierarchy;
      }
      if (data.driveSpreadsheet) {
        this._driveSpreadsheetData =
          data.driveSpreadsheet as DriveSpreadsheetHierarchy;
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
      ['databaseServices', this._databaseHierarchyData?.service],
      ['messagingServices', this._messagingServiceData],
      ['dashboardServices', this._dashboardServiceData],
      ['mlmodelServices', this._mlmodelServiceData],
      ['pipelineServices', this._pipelineServiceData],
      ['searchServices', this._searchIndexServiceData],
      ['storageServices', this._storageServiceData],
      ['apiServices', this._apiCollectionData?.service],
      ['driveServices', this._driveServiceData],
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
    this._databaseHierarchyData = null;
    this._messagingServiceData = null;
    this._dashboardServiceData = null;
    this._mlmodelServiceData = null;
    this._pipelineServiceData = null;
    this._searchIndexServiceData = null;
    this._storageServiceData = null;
    this._apiCollectionData = null;
    this._driveServiceData = null;
    this._driveDirectoryData = null;
    this._driveSpreadsheetData = null;

    this._databaseHierarchy = null;
    this._messagingService = null;
    this._dashboardService = null;
    this._mlmodelService = null;
    this._pipelineService = null;
    this._searchIndexService = null;
    this._storageService = null;
    this._apiCollection = null;
    this._driveService = null;
    this._driveDirectory = null;
    this._driveSpreadsheet = null;

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
