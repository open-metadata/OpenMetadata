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
 * Reproduces issue #28696: renaming a glossary term so the new name keeps the
 * original name as a PREFIX (e.g. "Customer Lifetime Value" -> "Customer
 * Lifetime Value Renamed") corrupted the glossary {@code tagFQN} on every
 * linked asset in the search index, so the term's asset page showed 0 assets
 * even though the database relationship stayed intact.
 *
 * <p>Two conditions are required and both differ from
 * {@code GlossaryRenameCascade.spec.ts}:
 * <ul>
 *   <li>The term name must NOT contain a dot, so the FQN is unquoted and the
 *   new FQN literally startsWith the old FQN (a quoted name breaks the raw
 *   prefix and the bug does not trigger).</li>
 *   <li>The rename must change name AND displayName in the same PATCH — exactly
 *   what the UI rename modal submits — because the redundant post-commit
 *   propagation pass that double-applies the prefix replace is gated on a
 *   propagated field (displayName) changing.</li>
 * </ul>
 *
 * <p>Before the fix the asset's {@code tags[].tagFQN} becomes
 * "&lt;newFqn&gt; Renamed" and {@code glossaryTags[]} loses the term entirely.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage, uuid } from '../../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('glossary-term prefix rename keeps linked asset glossary tag consistent', async ({
  browser,
}) => {
  // Create + tag + dual-field rename + ES poll comfortably exceeds the default.
  test.setTimeout(180_000);
  const { apiContext, afterAction } = await createNewPage(browser);

  const table = new TableClass();
  const glossary = new Glossary();
  // Dot-free name so the FQN is unquoted and the new FQN startsWith the old one.
  const glossaryTerm = new GlossaryTerm(glossary, undefined, `clv_${uuid()}`);

  try {
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await table.create(apiContext);

    const originalTermFqn = glossaryTerm.responseData
      .fullyQualifiedName as string;
    const tableFqn = table.entityResponseData.fullyQualifiedName as string;

    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            tagFQN: originalTermFqn,
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Glossary',
          },
        },
      ],
    });

    await assertAssetGlossaryTag({
      apiContext,
      tableFqn,
      expectedTermFqn: originalTermFqn,
      label: 'pre-rename',
    });

    // UI rename shape: extend the name as a prefix AND change displayName in the
    // same PATCH (EntityNameModal always submits both fields).
    await glossaryTerm.patch(apiContext, [
      {
        op: 'replace',
        path: '/name',
        value: `${glossaryTerm.responseData.name} Renamed`,
      },
      {
        op: 'replace',
        path: '/displayName',
        value: 'Customer Lifetime Value Renamed',
      },
    ]);

    const newTermFqn = glossaryTerm.responseData.fullyQualifiedName as string;
    expect(newTermFqn).not.toBe(originalTermFqn);
    expect(newTermFqn.startsWith(originalTermFqn)).toBe(true);

    await assertAssetGlossaryTag({
      apiContext,
      tableFqn,
      expectedTermFqn: newTermFqn,
      label: 'post-prefix-rename',
    });
  } finally {
    await table.delete(apiContext);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  }
});

async function assertAssetGlossaryTag(opts: {
  apiContext: import('@playwright/test').APIRequestContext;
  tableFqn: string;
  expectedTermFqn: string;
  label: string;
}): Promise<void> {
  const { apiContext, tableFqn, expectedTermFqn, label } = opts;

  await expect
    .poll(
      async () => {
        const res = await apiContext.get(
          `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
            tableFqn
          )}%22&index=table_search_index`
        );
        if (res.status() !== 200) {
          return undefined;
        }
        const body = await res.json();
        const source = body?.hits?.hits?.[0]?._source;
        if (!source) {
          return undefined;
        }

        const glossaryTagFqns = (source.tags ?? [])
          .filter((t: { source?: string }) => t.source === 'Glossary')
          .map((t: { tagFQN?: string }) => t.tagFQN);

        return {
          tagsHasExactTerm: glossaryTagFqns.includes(expectedTermFqn),
          glossaryTagsHasFqn: (source.glossaryTags ?? []).includes(
            expectedTermFqn
          ),
          noDuplicatedFqn: !glossaryTagFqns.some(
            (fqn: string) =>
              fqn !== expectedTermFqn && fqn.startsWith(expectedTermFqn)
          ),
        };
      },
      {
        message: `${label}: the linked asset must carry the glossary term FQN "${expectedTermFqn}" in both tags[] and glossaryTags[], with no double-suffixed FQN`,
        timeout: 60_000,
      }
    )
    .toEqual({
      tagsHasExactTerm: true,
      glossaryTagsHasFqn: true,
      noDuplicatedFqn: true,
    });
}
