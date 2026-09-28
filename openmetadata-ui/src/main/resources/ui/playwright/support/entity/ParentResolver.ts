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
import {
  ChainKind,
  CHAINS,
  createChainLevels,
  levelIndex,
  ParentLevel,
  ParentNode,
  ParentSnapshot,
} from './ParentChain';
import { SharedInfra } from './SharedInfra';

export type ParentOverrides = Partial<Record<ParentLevel, ParentNode>>;

export interface ResolvedParents {
  parents: ParentSnapshot;
  /** Set only when this entity created a parent; see ParentNode.rootDeletePath. */
  ownedRootPath?: string;
}

/**
 * Resolve an entity's parent chain.
 *
 *  - No override: the shared chain for `kind` (keyed by `sharedInfraKey`).
 *  - One override: used as-is. Its ancestors come from it; the levels below
 *    it are created fresh. An override that is not created yet is created
 *    here and becomes owned; an already-created one is borrowed.
 *
 * `through` stops the chain at a level — a mid-level entity (DatabaseClass)
 * resolves only the levels above itself.
 *
 * Only the deepest parent may be passed — to put a schema under your own
 * service, build `new DatabaseSchemaClass({ service })` and pass the schema.
 * Passing two levels would let them disagree about who contains whom.
 */
export const resolveParents = async (
  apiContext: APIRequestContext,
  kind: ChainKind,
  overrides: ParentOverrides = {},
  sharedInfraKey?: string,
  through?: ParentLevel
): Promise<ResolvedParents> => {
  const chain = CHAINS[kind].slice(
    0,
    through ? levelIndex(kind, through) + 1 : undefined
  );
  const given = chain.filter((spec) => overrides[spec.level]);

  if (given.length === 0) {
    const shared = await SharedInfra.parents(apiContext, kind, sharedInfraKey);

    return {
      parents: Object.fromEntries(
        chain.map((spec) => [spec.level, shared[spec.level]])
      ) as ParentSnapshot,
    };
  }
  if (given.length > 1) {
    throw new Error(
      `Pass only the deepest parent (got ${given
        .map((spec) => spec.level)
        .join(', ')}). Build the deeper one under the higher one instead.`
    );
  }

  const level = given[0].level;
  const override = overrides[level] as ParentNode;
  if (override.parentLevel !== level) {
    throw new Error(
      `A ${override.parentLevel} was passed as the "${level}" parent.`
    );
  }

  let ownedRootPath: string | undefined;
  if (!override.isCreated()) {
    await (override.createAsParent
      ? override.createAsParent(apiContext)
      : override.create(apiContext));
    ownedRootPath = override.rootDeletePath();
  }

  const { parents, created } = await createChainLevels(apiContext, kind, {
    ancestors: override.parentSnapshot(),
    startAfter: level,
    through,
  });

  return {
    parents,
    ownedRootPath: ownedRootPath ?? created[0]?.rootDeletePath(),
  };
};
