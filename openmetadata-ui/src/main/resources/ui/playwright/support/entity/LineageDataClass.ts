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
 * LineageDataClass — the shared entity graph used by Lineage specs.
 *
 * Historical shape: LineageFilters.spec.ts had a beforeAll that created
 * 16 entities (1 root Table + 15 across every allEntities type) plus 15
 * edges plus 16 search-index waits — per Playwright worker. Under
 * fullyParallel that runs 3× on a shard and races the same
 * `POST /services/…` endpoints, producing the "socket hang up" flakes on
 * `beforeAll` at LineageFilters.spec.ts:141.
 *
 * New shape: this class holds static instances of every entity type in
 * a stable order that matches the spec's `Object.values(allEntities)`
 * iteration. `entity-data.setup.ts` calls `create()` (via
 * `seedLineageAndSharedInfra`) once per shard
 * against the same `apiContext` used by the auth setup; each entity's
 * `createFullHierarchy: false` means parents are pulled from
 * `SharedInfra` and only the leaf is POSTed. Response data is serialised
 * to `playwright/output/lineage-data.json` and re-loaded on module import
 * (mirrors `EntityDataClass`), so every test process sees the same FQNs.
 *
 * Ordering contract: `allEntities()` returns 15 entities in the same
 * order the spec today iterates. The first is the depth-1 table; the
 * remaining 14 are the depth-2 entities. `lineageEntity` is the root
 * table that the spec builds a graph around.
 *
 * Mutation contract: filter tests (Domains / Owners / Tag / Tier) patch
 * these entities to add different metadata fields — the entity that ends
 * up with all four labels still passes each test's assertion because each
 * test filters by a different value. No test in the Lineage suite reads
 * a field another test wrote. Adding a lineage-shape assertion here
 * would break that; anything checking upstream/downstream counts must
 * use its own dedicated entities.
 */

import { APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ApiEndpointClass } from './ApiEndpointClass';
import { ContainerClass } from './ContainerClass';
import { DashboardClass } from './DashboardClass';
import { DashboardDataModelClass } from './DashboardDataModelClass';
import { DirectoryClass } from './DirectoryClass';
import { FileClass } from './FileClass';
import { MetricClass } from './MetricClass';
import { MlModelClass } from './MlModelClass';
import { PipelineClass } from './PipelineClass';
import { SearchIndexClass } from './SearchIndexClass';
import { SpreadsheetClass } from './SpreadsheetClass';
import { StoredProcedureClass } from './StoredProcedureClass';
import { TableClass } from './TableClass';
import { TopicClass } from './TopicClass';
import { WorksheetClass } from './WorksheetClass';

/**
 * Union of every entity type LineageDataClass exposes — mirrors the
 * LineageFilters spec's own EntityClassUnion so the spec can drop its
 * ad-hoc union in favour of this one.
 */
export type LineageEntityUnion =
  | TableClass
  | ContainerClass
  | TopicClass
  | DashboardClass
  | MlModelClass
  | PipelineClass
  | StoredProcedureClass
  | SearchIndexClass
  | DashboardDataModelClass
  | ApiEndpointClass
  | MetricClass
  | DirectoryClass
  | FileClass
  | SpreadsheetClass
  | WorksheetClass;

const OUTPUT_FILENAME = 'lineage-data.json';

export class LineageDataClass {
  // Root entity — lineageEntity in the spec.
  static readonly lineageEntity = new TableClass(
    undefined,
    undefined,
    undefined,
    {
      createFullHierarchy: false,
    }
  );

  // depth-1 entity + 14 depth-2 entities. Order MUST match the spec's
  // `Object.values(allEntities).map(E => new E())` iteration, because the
  // spec does `[depth1Entity, ...depth2ndEntities] = entities` and depth1
  // is a second Table by contract.
  static readonly table = new TableClass(undefined, undefined, undefined, {
    createFullHierarchy: false,
  });
  static readonly container = new ContainerClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly topic = new TopicClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly dashboard = new DashboardClass(
    undefined,
    undefined,
    undefined,
    {
      createFullHierarchy: false,
    }
  );
  static readonly mlmodel = new MlModelClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly pipeline = new PipelineClass(undefined, undefined, {
    createFullHierarchy: false,
  });
  static readonly storedProcedure = new StoredProcedureClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly searchIndex = new SearchIndexClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly dataModel = new DashboardDataModelClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly apiEndpoint = new ApiEndpointClass();
  static readonly metric = new MetricClass();
  static readonly directory = new DirectoryClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly file = new FileClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly spreadsheet = new SpreadsheetClass(undefined, {
    createFullHierarchy: false,
  });
  static readonly worksheet = new WorksheetClass(undefined, {
    createFullHierarchy: false,
  });

  /** Order-preserving list matching the spec's iteration contract. */
  static allEntities(): LineageEntityUnion[] {
    return [
      this.table,
      this.container,
      this.topic,
      this.dashboard,
      this.mlmodel,
      this.pipeline,
      this.storedProcedure,
      this.searchIndex,
      this.dataModel,
      this.apiEndpoint,
      this.metric,
      this.directory,
      this.file,
      this.spreadsheet,
      this.worksheet,
    ];
  }

  static depth1Entity(): LineageEntityUnion {
    return this.table;
  }

  static depth2ndEntities(): LineageEntityUnion[] {
    return this.allEntities().slice(1);
  }

  /**
   * Called from the setup project. Creates the root + all 15 entities
   * sequentially so a single worker's parent-chain POSTs (via SharedInfra)
   * collapse to one; then serialises responseData to disk.
   */
  static async create(apiContext: APIRequestContext): Promise<void> {
    // Sequential, not Promise.all: SharedInfra's per-parent-chain guard
    // dedupes concurrent calls into one create, but sequential creation
    // gives the server predictable, un-thundering load. On the setup
    // project this runs once per shard so wall-clock cost is trivial.
    await this.lineageEntity.create(apiContext);
    for (const entity of this.allEntities()) {
      await entity.create(apiContext);
    }
  }

  /**
   * Called from the teardown project. Deletes the leaves in reverse
   * order, then hard-deletes the unique per-worker shared parents that
   * SharedInfra created in the setup process. Reading FQNs off the
   * loaded entity responseData works across processes; SharedInfra's
   * in-memory cache does not.
   */
  static async delete(apiContext: APIRequestContext): Promise<void> {
    const leaves = [this.lineageEntity, ...this.allEntities()].reverse();
    await Promise.allSettled(leaves.map((entity) => entity.delete(apiContext)));

    // Collect unique service FQNs across every entity. Different entity
    // types point at different service paths; group them so we DELETE
    // /api/v1/services/<path>/name/<fqn> once each.
    type ServiceRef = { fqn: string; path: string };
    const refs = new Map<string, ServiceRef>();

    const push = (fqn: string | undefined, path: string) => {
      if (!fqn) {
        return;
      }
      const key = `${path}::${fqn}`;
      if (!refs.has(key)) {
        refs.set(key, { fqn, path });
      }
    };

    // Database chain: TableClass + StoredProcedureClass share it.
    push(
      this.lineageEntity.serviceResponseData?.fullyQualifiedName,
      'databaseServices'
    );
    push(
      this.table.serviceResponseData?.fullyQualifiedName,
      'databaseServices'
    );
    push(
      this.storedProcedure.serviceResponseData?.fullyQualifiedName,
      'databaseServices'
    );
    push(
      this.topic.serviceResponseData?.fullyQualifiedName,
      'messagingServices'
    );
    push(
      this.dashboard.serviceResponseData?.fullyQualifiedName,
      'dashboardServices'
    );
    push(
      this.dataModel.serviceResponseData?.fullyQualifiedName,
      'dashboardServices'
    );
    push(
      this.mlmodel.serviceResponseData?.fullyQualifiedName,
      'mlmodelServices'
    );
    push(
      this.pipeline.serviceResponseData?.fullyQualifiedName,
      'pipelineServices'
    );
    push(
      this.searchIndex.serviceResponseData?.fullyQualifiedName,
      'searchServices'
    );
    push(
      this.container.serviceResponseData?.fullyQualifiedName,
      'storageServices'
    );
    push(
      this.apiEndpoint.serviceResponseData?.fullyQualifiedName,
      'apiServices'
    );
    push(
      this.directory.serviceResponseData?.fullyQualifiedName,
      'driveServices'
    );
    push(this.file.serviceResponseData?.fullyQualifiedName, 'driveServices');
    push(
      this.spreadsheet.serviceResponseData?.fullyQualifiedName,
      'driveServices'
    );
    push(
      this.worksheet.serviceResponseData?.fullyQualifiedName,
      'driveServices'
    );

    await Promise.allSettled(
      Array.from(refs.values()).map((ref) =>
        apiContext.delete(
          `/api/v1/services/${ref.path}/name/${encodeURIComponent(
            ref.fqn
          )}?recursive=true&hardDelete=true`
        )
      )
    );
  }

  /** Persist minimal responseData so test processes can rehydrate. */
  static saveResponseData(): void {
    const responseData = {
      lineageEntity: this.lineageEntity.get(),
      table: this.table.get(),
      container: this.container.get(),
      topic: this.topic.get(),
      dashboard: this.dashboard.get(),
      mlmodel: this.mlmodel.get(),
      pipeline: this.pipeline.get(),
      storedProcedure: this.storedProcedure.get(),
      searchIndex: this.searchIndex.get(),
      dataModel: this.dataModel.get(),
      apiEndpoint: this.apiEndpoint.get(),
      metric: this.metric.get(),
      directory: this.directory.get(),
      file: this.file.get(),
      spreadsheet: this.spreadsheet.get(),
      worksheet: this.worksheet.get(),
    };

    const filePath = path.join(
      __dirname,
      '..',
      '..',
      'output',
      OUTPUT_FILENAME
    );
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(responseData, null, 2), {
      flag: 'w',
    });
  }

  /**
   * True after loadResponseData() has populated every instance at least
   * once. Lets test-time helpers detect the "module imported before setup
   * wrote the JSON" race and re-load on demand.
   */
  static isLoaded = false;

  /** Rehydrate the static instances from disk. Safe to call repeatedly. */
  static loadResponseData(): void {
    try {
      const filePath = path.join(
        __dirname,
        '..',
        '..',
        'output',
        OUTPUT_FILENAME
      );
      if (!fs.existsSync(filePath)) {
        return;
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const restoreSimple = <
        T extends { set: (v: never) => void } | { entityResponseData: unknown }
      >(
        instance: T,
        payload: unknown
      ): void => {
        if (!payload) {
          return;
        }
        const anyInstance = instance as unknown as {
          set?: (data: unknown) => void;
          entityResponseData?: unknown;
          serviceResponseData?: unknown;
        };
        if (typeof anyInstance.set === 'function') {
          anyInstance.set(payload);

          return;
        }
        // Fallback: entities without a `set()` accept direct assignment.
        const p = payload as {
          entity?: unknown;
          service?: unknown;
        };
        if (p.entity !== undefined) {
          anyInstance.entityResponseData = p.entity;
        }
        if (p.service !== undefined) {
          anyInstance.serviceResponseData = p.service;
        }
      };

      restoreSimple(this.lineageEntity, data.lineageEntity);
      restoreSimple(this.table, data.table);
      restoreSimple(this.container, data.container);
      restoreSimple(this.topic, data.topic);
      restoreSimple(this.dashboard, data.dashboard);
      restoreSimple(this.mlmodel, data.mlmodel);
      restoreSimple(this.pipeline, data.pipeline);
      restoreSimple(this.storedProcedure, data.storedProcedure);
      restoreSimple(this.searchIndex, data.searchIndex);
      restoreSimple(this.dataModel, data.dataModel);
      restoreSimple(this.apiEndpoint, data.apiEndpoint);
      restoreSimple(this.metric, data.metric);
      restoreSimple(this.directory, data.directory);
      restoreSimple(this.file, data.file);
      restoreSimple(this.spreadsheet, data.spreadsheet);
      restoreSimple(this.worksheet, data.worksheet);
      // Flip only after every restoreSimple completed without throwing —
      // partial hydration would still be a stale-instance risk.
      this.isLoaded = Boolean(
        this.lineageEntity.entityResponseData?.fullyQualifiedName
      );
    } catch (err) {
      // Surface the load error to CI logs instead of swallowing it — the
      // silent catch hid a race where module-import ran before setup
      // wrote the file, and every LineageFilters test then fell back to
      // FQN-less navigation. Callers must still handle the pre-setup
      // case; loadOrThrow() below is the escape hatch.
      console.error('LineageDataClass.loadResponseData failed:', err);
    }
  }

  /**
   * Idempotent, throws on failure. Call from a test-time hook
   * (beforeAll/beforeEach) to defeat the module-import race: if the file
   * did not exist at import time, this re-attempts the load and either
   * succeeds or fails loudly with the FQN that was still missing.
   */
  static ensureLoaded(): void {
    if (this.isLoaded) {
      return;
    }
    this.loadResponseData();
    if (!this.isLoaded) {
      throw new Error(
        `LineageDataClass.ensureLoaded: lineageEntity FQN still empty ` +
          `after loadResponseData(). Setup project 'entity-data-setup' ` +
          `must run before any Lineage spec (it invokes ` +
          `seedLineageAndSharedInfra internally).`
      );
    }
  }
}

LineageDataClass.loadResponseData();
