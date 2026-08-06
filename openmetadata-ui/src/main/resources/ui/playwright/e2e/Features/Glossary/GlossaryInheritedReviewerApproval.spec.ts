/*
 *  Copyright 2024 Collate.
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
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';

/**
 * Reproduction for the Glossary Approval bug where a term whose reviewers are INHERITED from its
 * glossary is treated as having none: no approval task is created and the term settles in Draft.
 *
 * The ordering matters. The approval workflow resolves inherited fields through
 * `EntityRepository.inheritanceParentCache`, a static ThreadLocal cleared only by
 * `ImpersonationCleanupFilter` — a JAX-RS response filter. Workflow execution threads never pass
 * through that filter, so a glossary snapshot captured while it had NO reviewers can be served
 * indefinitely. These tests therefore create the glossary WITHOUT reviewers first, let a term run the
 * workflow (populating that cache), and only then add the reviewer. Every term created afterwards
 * must still be gated as "has reviewers".
 *
 * Terms are created in a batch because the executor uses a thread pool and only threads that cached
 * the stale parent misbehave — a single term could be routed to a clean thread and pass by luck.
 */

const REVIEWER_ADDED_PROBE_COUNT = 6;
const STATUS_TIMEOUT = 120_000;

const reviewer = new UserClass();
const glossary = new Glossary();

type TermStatus = 'Draft' | 'In Review' | 'Approved' | 'Rejected' | string;

const createTermWithoutReviewers = async (
  apiContext: APIRequestContext,
  glossaryFqn: string,
  name: string
) => {
  const response = await apiContext.post('/api/v1/glossaryTerms', {
    data: {
      name,
      displayName: name,
      // A non-empty description is required to pass the "ready to be reviewed" gate.
      description: 'Term used by the inherited-reviewer approval reproduction',
      glossary: glossaryFqn,
    },
  });

  expect(response.status()).toBe(201);

  return response.json();
};

/**
 * Polls the term until the approval workflow has committed a status.
 *
 * <p>`Draft` is deliberately NOT a settled status. A term under a reviewed parent is written as
 * `Draft` at creation, before the workflow runs, so accepting it here would return on the very first
 * sample and every assertion would read the pre-workflow value. Waiting for a status the workflow
 * itself sets means a term that never leaves `Draft` — the bug under test — times out with the
 * message below rather than being misreported as a wrong-status failure.
 */
const waitForSettledStatus = async (
  apiContext: APIRequestContext,
  termId: string
): Promise<TermStatus> => {
  let status: TermStatus = '';

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/glossaryTerms/${termId}?fields=reviewers`
        );
        const term = await response.json();
        status = term.entityStatus;

        return status;
      },
      {
        message:
          `Glossary term ${termId} never left Draft — the approval workflow did not commit a ` +
          `status. For a term inheriting a reviewer this is the inherited-reviewer bug.`,
        timeout: STATUS_TIMEOUT,
      }
    )
    .toMatch(/In Review|Approved|Rejected/);

  return status;
};

const getOpenApprovalTaskCount = async (
  apiContext: APIRequestContext,
  termFqn: string
) => {
  const response = await apiContext.get(
    `/api/v1/tasks?limit=100&status=Open&aboutEntity=${encodeURIComponent(
      termFqn
    )}`
  );
  const body = await response.json();

  return (body.data ?? []).length;
};

test.describe(
  'Glossary Approval - inherited reviewers',
  { tag: ['@Features', '@Governance'] },
  () => {
    test.beforeAll(
      'Setup reviewer and reviewer-less glossary',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await reviewer.create(apiContext);
        // Deliberately created with NO reviewers so the first term's workflow caches a
        // reviewer-less snapshot of this glossary.
        await glossary.create(apiContext);

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await glossary.delete(apiContext);
      await reviewer.delete(apiContext);

      await afterAction();
    });

    test('term inherits reviewer added to the glossary after an earlier term ran the workflow', async ({
      browser,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      const glossaryFqn = glossary.responseData.fullyQualifiedName;

      await test.step('A term created before any reviewer exists is auto-approved', async () => {
        const seed = await createTermWithoutReviewers(
          apiContext,
          glossaryFqn,
          `seed_before_reviewer_${uuid()}`
        );

        const status = await waitForSettledStatus(apiContext, seed.id);

        expect(status).toBe('Approved');
      });

      await test.step('Add a reviewer to the glossary', async () => {
        const response = await apiContext.patch(
          `/api/v1/glossaries/${glossary.responseData.id}`,
          {
            data: [
              {
                op: 'add',
                path: '/reviewers',
                value: [{ id: reviewer.responseData.id, type: 'user' }],
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );

        expect(response.status()).toBe(200);
      });

      await test.step('Every term created afterwards inherits the reviewer and gets an approval task', async () => {
        for (let index = 0; index < REVIEWER_ADDED_PROBE_COUNT; index++) {
          const term = await createTermWithoutReviewers(
            apiContext,
            glossaryFqn,
            `after_reviewer_${index}_${uuid()}`
          );

          const status = await waitForSettledStatus(apiContext, term.id);

          expect(
            status,
            `Term ${term.name} inherits a reviewer from the glossary, so the approval workflow ` +
              `must move it to "In Review". "Draft" means the reviewers gate saw none — the ` +
              `inherited-reviewer bug.`
          ).toBe('In Review');

          expect(
            await getOpenApprovalTaskCount(apiContext, term.fullyQualifiedName),
            `Term ${term.name} must have an open approval task for the inherited reviewer`
          ).toBeGreaterThan(0);
        }
      });

      await afterAction();
    });

    test('inherited reviewer is shown on the term page and it is not left in Draft', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      // Built from a Glossary constructed without reviewers, so the term is created with an empty
      // reviewers list and must inherit the one added to the glossary server-side.
      const term = new GlossaryTerm(glossary);
      await term.create(apiContext);

      await waitForSettledStatus(apiContext, term.responseData.id);
      await afterAction();

      await redirectToHomePage(page);
      await term.visitEntityPage(page);

      await expect(page.locator('[data-testid="loader"]')).toHaveCount(0);

      await test.step('Inherited reviewer is displayed', async () => {
        await expect(
          page.getByTestId('glossary-reviewer').getByTestId('owner-link')
        ).toContainText(
          reviewer.responseData.displayName ?? reviewer.responseData.name
        );
      });

      await test.step('Term reached In Review, not Draft', async () => {
        await expect(page.getByTestId('status-badge')).toContainText(
          'In Review'
        );
      });

      await test.step('Cleanup term', async () => {
        const { apiContext: cleanupContext, afterAction: cleanupAction } =
          await performAdminLogin(browser);
        await term.delete(cleanupContext);
        await cleanupAction();
      });
    });
  }
);
