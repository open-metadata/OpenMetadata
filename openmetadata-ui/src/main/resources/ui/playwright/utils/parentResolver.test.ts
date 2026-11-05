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
import { APIRequestContext, expect, test } from '@playwright/test';
import { randomUUID } from 'crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import path from 'path';
import { ApiCollectionClass } from '../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { DatabaseClass } from '../support/entity/DatabaseClass';
import { resolveParents } from '../support/entity/ParentResolver';
import { ApiServiceClass } from '../support/entity/service/ApiServiceClass';
import { DatabaseServiceClass } from '../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../support/entity/service/MessagingServiceClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';

// Stand-in for the OpenMetadata endpoints the resolver touches: POST creates
// an entity whose FQN is built from its parent reference, GET/DELETE by name
// look it up or remove it. `posts` records creates only.
const startFakeApi = async () => {
  const posts: string[] = [];
  const existing = new Set<string>();
  // Per-GET response delays, consumed in order — lets a test force one
  // caller's existence check to finish after another caller's rebuild.
  const getDelaysMs: number[] = [];
  const server: Server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const url = request.url ?? '';
      const byName = decodeURIComponent(
        url.split('/name/')[1]?.split('?')[0] ?? ''
      );
      if (request.method === 'GET' || request.method === 'DELETE') {
        const found = existing.has(byName);
        if (request.method === 'DELETE') {
          existing.delete(byName);
        }
        const delay = request.method === 'GET' ? getDelaysMs.shift() ?? 0 : 0;
        setTimeout(() => {
          response.writeHead(found ? 200 : 404, {
            'Content-Type': 'application/json',
          });
          response.end('{}');
        }, delay);

        return;
      }
      const data = JSON.parse(body || '{}');
      const parent = data.database ?? data.service;
      const fullyQualifiedName = parent ? `${parent}.${data.name}` : data.name;
      posts.push(url);
      existing.add(fullyQualifiedName);
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          id: randomUUID(),
          name: data.name,
          fullyQualifiedName,
        })
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    posts,
    existing,
    getDelaysMs,
    server,
    baseURL: `http://127.0.0.1:${port}`,
  };
};

// SharedInfra records runtime-built chains in its output dir. Point it at a
// scratch dir: CI mounts the workspace read-only, and a record of fake chains
// left in playwright/output would send a later local teardown after them.
const sharedInfraDir = mkdtempSync(path.join(tmpdir(), 'shared-infra-'));
process.env.PW_SHARED_INFRA_DIR = sharedInfraDir;
const runtimeFile = path.join(
  sharedInfraDir,
  `shared-infra.runtime-${process.pid}.json`
);

test.afterAll(() => {
  rmSync(sharedInfraDir, { recursive: true, force: true });
});

test.describe('resolveParents', () => {
  let api: Awaited<ReturnType<typeof startFakeApi>>;
  let apiContext: APIRequestContext;

  test.beforeEach(async ({ playwright }) => {
    api = await startFakeApi();
    apiContext = await playwright.request.newContext({ baseURL: api.baseURL });
  });

  test.afterEach(async () => {
    await apiContext.dispose();
    api.server.close();
  });

  test('an uncreated override is created, owned, and the levels below it are fresh', async () => {
    const service = new DatabaseServiceClass();

    const { parents, ownedRootPath } = await resolveParents(
      apiContext,
      'database',
      { service }
    );

    expect(api.posts).toEqual([
      '/api/v1/services/databaseServices',
      '/api/v1/databases',
      '/api/v1/databaseSchemas',
    ]);
    expect(parents.schema?.fullyQualifiedName).toBe(
      `${service.entity.name}.${parents.database?.name}.${parents.schema?.name}`
    );
    expect(ownedRootPath).toBe(service.rootDeletePath());
  });

  test('a created override is borrowed; ownership starts at the first fresh level', async () => {
    const service = new DatabaseServiceClass();
    await service.create(apiContext);
    api.posts.length = 0;

    const { parents, ownedRootPath } = await resolveParents(
      apiContext,
      'database',
      { service }
    );

    expect(api.posts).toEqual(['/api/v1/databases', '/api/v1/databaseSchemas']);
    expect(ownedRootPath).toBe(
      `/api/v1/databases/name/${encodeURIComponent(
        parents.database?.fullyQualifiedName ?? ''
      )}`
    );
  });

  test('`through` stops at the level above a mid-level entity', async () => {
    const { parents } = await resolveParents(
      apiContext,
      'database',
      { service: new DatabaseServiceClass() },
      undefined,
      'service'
    );

    expect(api.posts).toEqual(['/api/v1/services/databaseServices']);
    expect(Object.keys(parents)).toEqual(['service']);
  });

  test('no override uses one shared chain per key and owns nothing', async () => {
    const key = `unit-${randomUUID()}`;

    const first = await resolveParents(apiContext, 'messaging', {}, key);
    const second = await resolveParents(apiContext, 'messaging', {}, key);

    expect(api.posts).toEqual(['/api/v1/services/messagingServices']);
    expect(first.parents.service?.name).toMatch(
      /^pw-shared-messaging-service-/
    );
    expect(second.parents).toEqual(first.parents);
    expect(first.ownedRootPath).toBeUndefined();
  });

  test('a cached shared chain whose parent was deleted is rebuilt', async () => {
    const key = `unit-${randomUUID()}`;
    const first = await resolveParents(apiContext, 'messaging', {}, key);
    api.existing.delete(first.parents.service?.fullyQualifiedName ?? '');

    const second = await resolveParents(apiContext, 'messaging', {}, key);

    expect(api.posts).toEqual([
      '/api/v1/services/messagingServices',
      '/api/v1/services/messagingServices',
    ]);
    expect(second.parents.service?.name).not.toBe(first.parents.service?.name);

    // Both roots stay recorded: the replaced chain's service may still exist.
    const recorded = JSON.parse(readFileSync(runtimeFile, 'utf-8'));
    for (const { parents } of [first, second]) {
      expect(
        recorded[`messaging:${parents.service?.fullyQualifiedName}`]
      ).toBeDefined();
    }
  });

  test('concurrent callers on a stale chain rebuild it once', async () => {
    const key = `unit-${randomUUID()}`;
    const first = await resolveParents(apiContext, 'messaging', {}, key);
    api.existing.delete(first.parents.service?.fullyQualifiedName ?? '');

    // The second caller's check returns only after the first caller has
    // rebuilt and stored the chain — it must adopt that chain, not delete it.
    api.getDelaysMs.push(0, 500);

    const [a, b] = await Promise.all([
      resolveParents(apiContext, 'messaging', {}, key),
      resolveParents(apiContext, 'messaging', {}, key),
    ]);

    expect(api.posts).toHaveLength(2);
    expect(b.parents).toEqual(a.parents);
  });

  test('chains built at runtime are recorded for teardown', async () => {
    const key = `unit-${randomUUID()}`;
    const { parents } = await resolveParents(apiContext, 'messaging', {}, key);

    const recorded = JSON.parse(readFileSync(runtimeFile, 'utf-8'));

    expect(
      recorded[`messaging:${parents.service?.fullyQualifiedName}`].parents
        .service.fullyQualifiedName
    ).toBe(parents.service?.fullyQualifiedName);
  });

  test('deleting an owned override lets the next create own it again', async () => {
    const topic = new TopicClass({ service: new MessagingServiceClass() });

    await topic.create(apiContext);
    await topic.delete(apiContext);
    await topic.create(apiContext);

    expect(api.posts).toEqual([
      '/api/v1/services/messagingServices',
      '/api/v1/topics',
      '/api/v1/services/messagingServices',
      '/api/v1/topics',
    ]);
    expect(topic.ownedRootPath).toContain('/services/messagingServices/name/');
  });

  test('a database override creates no fixture children of its own', async () => {
    const table = new TableClass({
      database: new DatabaseClass({ service: new DatabaseServiceClass() }),
    });

    await table.create(apiContext);

    expect(api.posts).toEqual([
      '/api/v1/services/databaseServices',
      '/api/v1/databases',
      '/api/v1/databaseSchemas',
      '/api/v1/tables',
    ]);
  });

  test('a collection override creates no fixture endpoint of its own', async () => {
    const endpoint = new ApiEndpointClass({
      collection: new ApiCollectionClass({ service: new ApiServiceClass() }),
    });

    await endpoint.create(apiContext);

    expect(api.posts).toEqual([
      '/api/v1/services/apiServices',
      '/api/v1/apiCollections',
      '/api/v1/apiEndpoints',
    ]);
  });

  test('slots seeded after import are picked up on a miss', async () => {
    const key = `unit-${randomUUID()}`;
    const service = {
      id: randomUUID(),
      name: `pw-shared-messaging-service-${key}`,
      fullyQualifiedName: `pw-shared-messaging-service-${key}`,
    };
    api.existing.add(service.fullyQualifiedName);
    // afterAll may already have removed the dir in this worker (fullyParallel
    // runs the file's hooks per test group).
    mkdirSync(sharedInfraDir, { recursive: true });
    writeFileSync(
      path.join(sharedInfraDir, 'shared-infra.json'),
      JSON.stringify({
        [`messaging:${key}`]: { kind: 'messaging', parents: { service } },
      })
    );

    const { parents } = await resolveParents(apiContext, 'messaging', {}, key);

    expect(api.posts).toEqual([]);
    expect(parents.service?.fullyQualifiedName).toBe(
      service.fullyQualifiedName
    );
  });

  test('passing two levels is rejected', async () => {
    const service = new DatabaseServiceClass();

    await expect(
      resolveParents(apiContext, 'database', {
        service,
        database: service,
      })
    ).rejects.toThrow(/deepest parent/);
    expect(api.posts).toEqual([]);
  });
});
