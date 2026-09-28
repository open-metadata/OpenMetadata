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
import { APIRequestContext } from '@playwright/test';
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

export type ParentLevel =
  | 'service'
  | 'database'
  | 'schema'
  | 'collection'
  | 'directory'
  | 'spreadsheet';

export type ParentSnapshot = Partial<Record<ParentLevel, ResponseDataType>>;

/**
 * Anything that can stand in for one level of an entity's parent chain:
 * the service classes, the mid-level entity classes (DatabaseClass,
 * DatabaseSchemaClass, ApiCollectionClass, DirectoryClass, SpreadsheetClass)
 * and the fresh nodes the resolver creates below an override.
 */
export interface ParentNode {
  readonly parentLevel: ParentLevel;
  isCreated(): boolean;
  create(apiContext: APIRequestContext): Promise<unknown>;
  /** This node's response data plus every ancestor it resolved. */
  parentSnapshot(): ParentSnapshot;
  /**
   * Entity path (no query) whose recursive delete removes this node and
   * everything it owns. A node that created its own parents points at the
   * top-most one, so one recursive delete cleans the whole owned chain.
   */
  rootDeletePath(): string;
}

export type ChainKind =
  | 'database'
  | 'messaging'
  | 'dashboard'
  | 'pipeline'
  | 'mlmodel'
  | 'storage'
  | 'search'
  | 'api'
  | 'drive'
  | 'driveDirectory'
  | 'driveSpreadsheet';

interface ChainLevelSpec {
  level: ParentLevel;
  /** Collection segment under /api/v1, used for create and delete. */
  collection: string;
  namePrefix: string;
  body: (name: string, ancestors: ParentSnapshot) => object;
}

/** Entity path without the query; callers append recursive/hardDelete. */
export const parentDeletePath = (collection: string, fqn: string) =>
  `/api/v1/${collection}/name/${encodeURIComponent(fqn)}`;

// Service configs come from the service classes so a connector config lives
// in exactly one place.
const serviceLevel = (
  collection: string,
  namePrefix: string,
  defaultConfig: () => object
): ChainLevelSpec => ({
  level: 'service',
  collection,
  namePrefix,
  body: (name) => ({ ...defaultConfig(), name }),
});

const underService = (
  level: ParentLevel,
  collection: string,
  namePrefix: string,
  extra: object = {}
): ChainLevelSpec => ({
  level,
  collection,
  namePrefix,
  body: (name, ancestors) => ({
    name,
    service: ancestors.service?.fullyQualifiedName,
    ...extra,
  }),
});

const databaseService = serviceLevel(
  'services/databaseServices',
  'pw-database-service',
  () => new DatabaseServiceClass().entity
);
const driveService = serviceLevel(
  'services/driveServices',
  'pw-drive-service',
  () => new DriveServiceClass().entity
);

export const CHAINS: Record<ChainKind, ChainLevelSpec[]> = {
  database: [
    databaseService,
    underService('database', 'databases', 'pw-database'),
    {
      level: 'schema',
      collection: 'databaseSchemas',
      namePrefix: 'pw-database-schema',
      body: (name, ancestors) => ({
        name,
        database: ancestors.database?.fullyQualifiedName,
      }),
    },
  ],
  messaging: [
    serviceLevel(
      'services/messagingServices',
      'pw-messaging-service',
      () => new MessagingServiceClass().entity
    ),
  ],
  dashboard: [
    serviceLevel(
      'services/dashboardServices',
      'pw-dashboard-service',
      () => new DashboardServiceClass().entity
    ),
  ],
  pipeline: [
    serviceLevel(
      'services/pipelineServices',
      'pw-pipeline-service',
      () => new PipelineServiceClass().entity
    ),
  ],
  mlmodel: [
    serviceLevel(
      'services/mlmodelServices',
      'pw-mlmodel-service',
      () => new MlmodelServiceClass().entity
    ),
  ],
  storage: [
    serviceLevel(
      'services/storageServices',
      'pw-storage-service',
      () => new StorageServiceClass().entity
    ),
  ],
  search: [
    serviceLevel(
      'services/searchServices',
      'pw-search-service',
      () => new SearchIndexServiceClass().entity
    ),
  ],
  api: [
    serviceLevel(
      'services/apiServices',
      'pw-api-service',
      () => new ApiServiceClass().entity
    ),
    underService('collection', 'apiCollections', 'pw-api-collection', {
      endpointURL: 'https://petstore3.swagger.io/api/v3/pet',
    }),
  ],
  drive: [driveService],
  driveDirectory: [
    driveService,
    underService('directory', 'drives/directories', 'pw-directory'),
  ],
  driveSpreadsheet: [
    driveService,
    underService('spreadsheet', 'drives/spreadsheets', 'pw-spreadsheet'),
  ],
};

export const levelIndex = (kind: ChainKind, level: ParentLevel): number => {
  const index = CHAINS[kind].findIndex((spec) => spec.level === level);
  if (index === -1) {
    throw new Error(`"${level}" is not a level of the ${kind} chain.`);
  }

  return index;
};

/** A parent level the resolver creates itself — one POST, no children. */
class FreshParentNode implements ParentNode {
  readonly parentLevel: ParentLevel;
  private response?: ResponseDataType;
  private readonly name: string;

  constructor(
    private readonly spec: ChainLevelSpec,
    private readonly ancestors: ParentSnapshot,
    private readonly ancestorNames: string[],
    namePrefix: string
  ) {
    this.parentLevel = spec.level;
    this.name = `${namePrefix}-${uuid()}`;
  }

  isCreated() {
    return Boolean(this.response?.id);
  }

  async create(apiContext: APIRequestContext) {
    this.response = await createOrFetch<ResponseDataType>(apiContext, {
      label: `ParentChain ${this.spec.level}`,
      createPath: `/api/v1/${this.spec.collection}`,
      fqnSegments: [...this.ancestorNames, this.name],
      data: this.spec.body(this.name, this.ancestors),
    });
  }

  parentSnapshot(): ParentSnapshot {
    return { ...this.ancestors, [this.spec.level]: this.response };
  }

  rootDeletePath() {
    return parentDeletePath(
      this.spec.collection,
      this.response?.fullyQualifiedName ?? ''
    );
  }
}

/**
 * Create the levels of `kind`'s chain after `startAfter` (default: from the
 * top) up to and including `through` (default: the bottom), each under the
 * previous one.
 */
export const createChainLevels = async (
  apiContext: APIRequestContext,
  kind: ChainKind,
  options: {
    ancestors?: ParentSnapshot;
    startAfter?: ParentLevel;
    through?: ParentLevel;
    namePrefix?: (spec: { level: ParentLevel; namePrefix: string }) => string;
  } = {}
): Promise<{ parents: ParentSnapshot; created: ParentNode[] }> => {
  const chain = CHAINS[kind];
  const startIndex = options.startAfter
    ? levelIndex(kind, options.startAfter) + 1
    : 0;
  const endIndex = options.through
    ? levelIndex(kind, options.through) + 1
    : chain.length;
  let parents: ParentSnapshot = { ...options.ancestors };
  const created: ParentNode[] = [];

  for (const spec of chain.slice(startIndex, endIndex)) {
    const ancestorNames = chain
      .slice(0, chain.indexOf(spec))
      .map((ancestor) => parents[ancestor.level]?.name ?? '');
    const node = new FreshParentNode(
      spec,
      parents,
      ancestorNames,
      options.namePrefix?.(spec) ?? spec.namePrefix
    );
    await node.create(apiContext);
    created.push(node);
    parents = node.parentSnapshot();
  }

  return { parents, created };
};

/** Entity path (no query) of the service at the top of a resolved chain. */
export const serviceDeletePath = (
  kind: ChainKind,
  parents: ParentSnapshot
): string | undefined => {
  const fqn = parents.service?.fullyQualifiedName;

  return fqn ? parentDeletePath(CHAINS[kind][0].collection, fqn) : undefined;
};
