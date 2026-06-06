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
 * Locks in the painless reseparation contract introduced when {@code TAG_RESEPARATION_SCRIPT}
 * was appended to every script that mutates {@code ctx._source.tags}. This is the one path
 * that the static {@code SearchClientTagScriptSeparationTest} unit test guards by name, but
 * doesn't actually execute end-to-end.
 *
 * <p>Scenario: tag a Table with a glossary term, then rename the term. The server fires
 * {@code UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX_SCRIPT} against every doc tagged with the
 * term — which mutates {@code tags[].tagFQN} in place. Without the appended
 * {@code TAG_RESEPARATION_SCRIPT}, {@code glossaryTags[]} keeps the old FQN and queries
 * against the dedicated field stop matching. This spec proves the appended snippet runs.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const TIER_FQN = 'Tier.Tier1';
const CERTIFICATION_FQN = 'Certification.Gold';

test('glossary-term rename cascade keeps tags[] + glossaryTags + tier + cert consistent', async ({
  browser,
}) => {
  // Create + tag + rename + dual ES poll comfortably exceeds the 60s default.
  test.setTimeout(180_000);
  const { apiContext, afterAction } = await createNewPage(browser);

  const table = new TableClass();
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  try {
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await table.create(apiContext);

    const originalGlossaryTermFqn = glossaryTerm.responseData
      .fullyQualifiedName as string;

    // Apply all four facets so a regression in any of them is observable.
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            name: 'Tier1',
            tagFQN: TIER_FQN,
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Classification',
          },
        },
        {
          op: 'add',
          path: '/tags/1',
          value: {
            tagFQN: originalGlossaryTermFqn,
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Glossary',
          },
        },
        {
          op: 'add',
          path: '/certification',
          value: {
            tagLabel: {
              tagFQN: CERTIFICATION_FQN,
              labelType: 'Manual',
              state: 'Confirmed',
              source: 'Classification',
            },
          },
        },
      ],
    });

    const tableFqn = table.entityResponseData.fullyQualifiedName as string;

    // Pre-rename: confirm live indexing produced the expected separation.
    await assertDocShape({
      apiContext,
      tableFqn,
      expectedGlossaryFqn: originalGlossaryTermFqn,
      label: 'pre-rename live shape',
    });

    // Rename the glossary term — triggers UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX_SCRIPT on
    // every doc tagged with this term. Without TAG_RESEPARATION_SCRIPT appended, tags[] is
    // updated but glossaryTags[] keeps the old FQN, which the assertion below catches.
    const renamedTermName = `${glossaryTerm.responseData.name}_renamed`;
    await glossaryTerm.patch(apiContext, [
      { op: 'replace', path: '/name', value: renamedTermName },
    ]);
    const newGlossaryTermFqn = glossaryTerm.responseData
      .fullyQualifiedName as string;
    expect(newGlossaryTermFqn).not.toBe(originalGlossaryTermFqn);

    // Post-rename: tags[].tagFQN AND glossaryTags[] must both reflect the new FQN, tier and
    // certification stay on their dedicated fields, no Tier.* leakage into tags[].
    await assertDocShape({
      apiContext,
      tableFqn,
      expectedGlossaryFqn: newGlossaryTermFqn,
      label: 'post-rename cascade shape',
    });
  } finally {
    await table.delete(apiContext);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  }
});

async function assertDocShape(opts: {
  apiContext: import('@playwright/test').APIRequestContext;
  tableFqn: string;
  expectedGlossaryFqn: string;
  label: string;
}): Promise<void> {
  const { apiContext, tableFqn, expectedGlossaryFqn, label } = opts;

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
        return {
          tier: source.tier?.tagFQN,
          certification: source.certification?.tagLabel?.tagFQN,
          tagsHasGlossary: (source.tags ?? []).some(
            (t: { tagFQN?: string }) => t.tagFQN === expectedGlossaryFqn
          ),
          glossaryTagsHasFqn: (source.glossaryTags ?? []).includes(
            expectedGlossaryFqn
          ),
          tierNotInTagsBag: !(source.tags ?? []).some(
            (t: { tagFQN?: string }) => t.tagFQN === TIER_FQN
          ),
        };
      },
      {
        message: `${label}: tier must be on tier.tagFQN, certification on certification.tagLabel.tagFQN, glossary term in both tags[] and glossaryTags[], and Tier.* must NOT leak into tags[]`,
        timeout: 60_000,
      }
    )
    .toEqual({
      tier: TIER_FQN,
      certification: CERTIFICATION_FQN,
      tagsHasGlossary: true,
      glossaryTagsHasFqn: true,
      tierNotInTagsBag: true,
    });
}
