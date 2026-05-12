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
 * Regression coverage for issue #28038 — PATCH on a tag-bearing entity must
 * not 500 with "Non-existing name/value pair in the object for key appliedBy"
 * when a derived (inherited) tag is reshuffled out of an index that the UI's
 * local entity copy still believes carries an `appliedBy` value.
 *
 * The bug came from two interacting halves of PR #24817 "Tagging explanation":
 *   1. `EntityRepository.updateTags` stamps `appliedBy` in memory on tags it
 *      just touched, so the PATCH response carries the key for direct tags.
 *   2. `CollectionDAO.getDerivedTagsBatch` propagated `appliedAt` but dropped
 *      `appliedBy` when reconstructing derived TagLabels.
 *
 * After (1) the UI retains a local state where some tag has `appliedBy`. The
 * UI never re-fetches between operations, so on a second edit `fast-json-patch
 * compare(local, updated)` emits `remove /tags/N/appliedBy`. The server then
 * loads the entity fresh — and for the derived tag the loaded JSON has no
 * `appliedBy` key (due to (2) + `@JsonInclude(NON_NULL)` on `TagLabel`),
 * causing Jakarta JSON Patch to throw.
 *
 * This spec drives the same API shape the captured UI repro produced so the
 * bug is caught regardless of how the tag editor evolves.
 */

import { expect, test } from '@playwright/test';
import { compare } from 'fast-json-patch';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const SEEDED_CLASSIFICATION_TAG = 'PII.Sensitive';

test('PATCH succeeds when removing a tag that carries derived appliedBy from a glossary term (#28038)', async ({
  browser,
}) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const table = new TableClass();

  try {
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await table.create(apiContext);

    // 1. Apply a classification tag to the glossary term — this is what makes
    //    the term contribute *inherited* tags to anything that references it,
    //    which is the only shape that exercises CollectionDAO.getDerivedTagsBatch.
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/tags',
        value: [
          {
            tagFQN: SEEDED_CLASSIFICATION_TAG,
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
      },
    ]);

    // 2. Attach the glossary term to the table. The PATCH response stamps
    //    `appliedBy` in memory on the direct glossary-term tag — this is the
    //    response the UI keeps in local state.
    const firstResponse = await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags',
          value: [
            {
              tagFQN: glossaryTerm.responseData.fullyQualifiedName,
              source: 'Glossary',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          ],
        },
      ],
    });

    const tagsFromFirstPatch = firstResponse.entity.tags ?? [];

    // After (1) and the propagation fix at CollectionDAO.getDerivedTagsBatch,
    // every tag on the table (direct + derived) must carry `appliedBy` so the
    // UI's local copy and the server's loaded copy agree on the key.
    expect(tagsFromFirstPatch.length).toBeGreaterThan(0);
    for (const tag of tagsFromFirstPatch) {
      expect(tag.appliedBy).toBeDefined();
    }

    // 3. Drive the exact second-edit shape from the captured curl in #28038 —
    //    swap the glossary-term tag at index 0 for a different tag without
    //    surfacing it through the UI. fast-json-patch compare(...) emits the
    //    same `remove /tags/0/appliedBy` + `replace /tags/0/<field>` cluster
    //    the React tag editor produces.
    const updated = {
      ...firstResponse.entity,
      tags: [
        ...tagsFromFirstPatch.filter(
          (tag: { labelType?: string }) => tag.labelType === 'Derived'
        ),
        {
          tagFQN: 'Tier.Tier1',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
    };

    const secondPatch = compare(firstResponse.entity, updated);

    // The exact failure shape from the issue: at least one `remove ...appliedBy`
    // op must be present, otherwise the test isn't exercising the regression.
    const removesAppliedBy = secondPatch.some(
      (op) => op.op === 'remove' && op.path.endsWith('/appliedBy')
    );
    expect(removesAppliedBy).toBe(true);

    const secondResponse = await table.patch({
      apiContext,
      patchData: secondPatch,
    });

    // Pre-fix this PATCH returns 500 with
    // "Non-existing name/value pair in the object for key appliedBy".
    // Post-fix it must succeed and leave the entity in a valid state.
    expect(secondResponse.entity.id).toBe(firstResponse.entity.id);
    for (const tag of secondResponse.entity.tags ?? []) {
      expect(tag.appliedBy).toBeDefined();
    }
  } finally {
    await table.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  }
});
