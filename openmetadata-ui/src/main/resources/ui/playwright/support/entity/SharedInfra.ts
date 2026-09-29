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
 * SharedInfra — per-shard cache of parent chains that entity fixtures reuse
 * when a test does not pass its own parent.
 *
 * WHY. A leaf that creates its own chain costs a POST per level (a table is
 * service → database → schema → table). Seeding many leaves per worker fans
 * those POSTs out across three workers racing the same `/services/…`
 * endpoints, which is what produced the "socket hang up" flakes on the
 * Lineage suite.
 *
 * SCOPE. One chain per `(ChainKind, key)` slot. The setup project
 * (`entity-data.setup.ts`) builds the slots it needs and persists them to
 * `playwright/output/shared-infra.json`; every worker loads that file on
 * import, so test workers resolve shared parents with one existence check
 * instead of creating them.
 *
 * OWNERSHIP. Shared parents belong to setup/teardown: `reset()` deletes them
 * from `entity-data.teardown.ts`. A leaf in shared mode records no owned
 * parent, so its `delete()` removes only itself.
 */

import { APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { deleteFixtureEntity } from '../../utils/apiResponse';
import {
  ChainKind,
  CHAINS,
  createChainLevels,
  parentDeletePath,
  ParentSnapshot,
  serviceDeletePath,
} from './ParentChain';

const OUTPUT_FILENAME = 'shared-infra.json';

// ponytail: hard cap instead of eviction — evicting a live shared chain would
// orphan every leaf under it. Slots are (kind × key); real usage is ~20.
const MAX_SHARED_SLOTS = 64;

const outputFilePath = (): string =>
  path.join(__dirname, '..', '..', 'output', OUTPUT_FILENAME);

const slotId = (kind: ChainKind, key: string) => `${kind}:${key}`;

interface PersistedSlot {
  kind: ChainKind;
  parents: ParentSnapshot;
}

export class SharedInfra {
  private static slots = new Map<string, PersistedSlot>();
  // Only used by the process that builds a chain: de-dupes concurrent
  // first-time callers. Workers hit `slots` directly after loadResponseData().
  private static inFlight = new Map<string, Promise<ParentSnapshot>>();

  static async parents(
    apiContext: APIRequestContext,
    kind: ChainKind,
    key = 'default'
  ): Promise<ParentSnapshot> {
    const id = slotId(kind, key);
    const cached = this.slots.get(id);
    if (cached) {
      if (await this.chainExists(apiContext, cached)) {
        return cached.parents;
      }
      this.slots.delete(id);
    }

    let pending = this.inFlight.get(id);
    if (!pending) {
      if (this.slots.size + this.inFlight.size >= MAX_SHARED_SLOTS) {
        throw new Error(
          `SharedInfra: more than ${MAX_SHARED_SLOTS} shared chains requested ` +
            `(asked for "${id}"). A sharedInfraKey is probably being generated ` +
            `per test — keys must be a small fixed set.`
        );
      }
      pending = createChainLevels(apiContext, kind, {
        namePrefix: (spec) => spec.namePrefix.replace(/^pw-/, 'pw-shared-'),
      }).then(({ parents }) => parents);
      this.inFlight.set(id, pending);
    }

    try {
      const parents = await pending;
      this.slots.set(id, { kind, parents });

      return parents;
    } finally {
      this.inFlight.delete(id);
    }
  }

  /**
   * A cached chain hands out parents without a request, so a parent deleted
   * by some other test would only surface later as a 404 on the leaf POST.
   * Checking the deepest level (it is gone whenever anything above it is)
   * turns that into a rebuild plus a warning that names what went missing.
   */
  private static async chainExists(
    apiContext: APIRequestContext,
    { kind, parents }: PersistedSlot
  ): Promise<boolean> {
    const deepest = CHAINS[kind][CHAINS[kind].length - 1];
    const fqn = parents[deepest.level]?.fullyQualifiedName;
    if (!fqn) {
      return false;
    }
    const response = await apiContext.get(
      parentDeletePath(deepest.collection, fqn)
    );
    if (response.ok()) {
      return true;
    }
    console.warn(
      `SharedInfra: shared ${kind} ${deepest.level} "${fqn}" is gone ` +
        `(HTTP ${response.status()}); rebuilding the chain. Something deleted a shared parent.`
    );

    return false;
  }

  static saveResponseData(): void {
    const filePath = outputFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify(Object.fromEntries(this.slots), null, 2),
      { flag: 'w' }
    );
  }

  /** Runs on import. A missing or unreadable file means "nothing seeded yet". */
  static loadResponseData(): void {
    const filePath = outputFilePath();
    if (!fs.existsSync(filePath)) {
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
        string,
        PersistedSlot
      >;
      // Skip anything not in the current slot shape (e.g. a file written by
      // an older layout), so it can neither resolve nor be "reset".
      this.slots = new Map(
        Object.entries(data).filter(
          ([, slot]) => slot?.kind in CHAINS && Boolean(slot.parents?.service)
        )
      );
    } catch {
      // Partially written or from an older format — the setup project
      // rewrites it on its next run.
    }
  }

  /**
   * Delete every shared chain on this shard. Leaves under them must already
   * be gone (or be cascaded here). Removes the persisted file so the next
   * setup starts clean.
   */
  static async reset(apiContext: APIRequestContext): Promise<void> {
    this.loadResponseData();

    await Promise.allSettled(
      Array.from(this.slots.values()).map(async ({ kind, parents }) => {
        const url = serviceDeletePath(kind, parents);
        if (url) {
          await deleteFixtureEntity(
            apiContext,
            `${url}?recursive=true&hardDelete=true`
          );
        }
      })
    );

    this.slots.clear();
    this.inFlight.clear();
    fs.rmSync(outputFilePath(), { force: true });
  }
}

SharedInfra.loadResponseData();
