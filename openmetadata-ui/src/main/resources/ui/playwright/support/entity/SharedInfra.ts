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
 * OWNERSHIP. Shared parents belong to setup/teardown: `reset()` deletes the
 * seeded chains and every chain a worker built at runtime, from
 * `entity-data.teardown.ts`. A leaf in shared mode records no owned
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
// Chains a worker builds at runtime (unseeded slots, rebuilds of a vanished
// chain) are recorded per process so teardown can delete them too; one file
// per process avoids cross-process write races on a shared file.
const RUNTIME_FILE_PATTERN = /^shared-infra\.runtime-\d+\.json$/;

// ponytail: hard cap instead of eviction — evicting a live shared chain would
// orphan every leaf under it. Slots are (kind × key); real usage is ~20.
const MAX_SHARED_SLOTS = 64;

// Overridable so unit tests can run where the workspace is mounted read-only.
const outputDir = (): string =>
  process.env.PW_SHARED_INFRA_DIR ?? path.join(__dirname, '..', '..', 'output');
const outputFilePath = (): string => path.join(outputDir(), OUTPUT_FILENAME);
const runtimeFilePath = (): string =>
  path.join(outputDir(), `shared-infra.runtime-${process.pid}.json`);

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
  private static builtHere = new Map<string, PersistedSlot>();

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
      // Another caller may have replaced the stale slot while this one was
      // checking it; use theirs rather than deleting it and building a third.
      const current = this.slots.get(id);
      if (current && current !== cached) {
        return current.parents;
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
      if (this.slots.get(id)?.parents !== parents) {
        this.slots.set(id, { kind, parents });
        this.recordBuilt(id, { kind, parents });
      }

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

  private static recordBuilt(id: string, slot: PersistedSlot) {
    this.builtHere.set(id, slot);
    fs.mkdirSync(outputDir(), { recursive: true });
    fs.writeFileSync(
      runtimeFilePath(),
      JSON.stringify(Object.fromEntries(this.builtHere), null, 2)
    );
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
    this.slots = new Map(readSlots(outputFilePath()));
  }

  /**
   * Delete every shared chain on this shard. Leaves under them must already
   * be gone (or be cascaded here). Removes the persisted file so the next
   * setup starts clean.
   */
  static async reset(apiContext: APIRequestContext): Promise<void> {
    const runtimeFiles = fs.existsSync(outputDir())
      ? fs
          .readdirSync(outputDir())
          .filter((name) => RUNTIME_FILE_PATTERN.test(name))
          .map((name) => path.join(outputDir(), name))
      : [];
    const urls = new Set<string>();
    for (const file of [outputFilePath(), ...runtimeFiles]) {
      for (const [, { kind, parents }] of readSlots(file)) {
        const url = serviceDeletePath(kind, parents);
        if (url) {
          urls.add(url);
        }
      }
    }

    await Promise.allSettled(
      Array.from(urls).map((url) =>
        deleteFixtureEntity(apiContext, `${url}?recursive=true&hardDelete=true`)
      )
    );

    this.slots.clear();
    this.inFlight.clear();
    this.builtHere.clear();
    for (const file of [outputFilePath(), ...runtimeFiles]) {
      fs.rmSync(file, { force: true });
    }
  }
}

/**
 * Slots from one persisted file. Anything not in the current shape (a file
 * from an older layout, a partial write) is skipped, so it can neither
 * resolve nor be "reset".
 */
function readSlots(filePath: string): Array<[string, PersistedSlot]> {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
      string,
      PersistedSlot
    >;

    return Object.entries(data).filter(
      ([, slot]) => slot?.kind in CHAINS && Boolean(slot.parents?.service)
    );
  } catch {
    return [];
  }
}

SharedInfra.loadResponseData();
