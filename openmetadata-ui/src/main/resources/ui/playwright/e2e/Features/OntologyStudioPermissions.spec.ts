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

import { APIRequestContext, Page } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { UserClass } from '../../support/user/UserClass';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { findOntologyInScopeMenu } from '../../utils/ontologyStudio';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';

const ONTOLOGIES = '/api/v1/ontologies';
const AGGREGATE_LIMIT = 20;
const SCREENSHOTS = 'test-results/g3';

interface StudioFixture {
  ontology: Ontology;
  concepts: OntologyConcept[];
}

const createStudioFixture = async (
  api: APIRequestContext
): Promise<StudioFixture> => {
  const name = `pw_perm_${uuid()}`;
  const ontology = await okJson<Ontology>(
    await api.post(ONTOLOGIES, {
      data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
    }),
    'Create permission fixture ontology'
  );
  const concepts: OntologyConcept[] = [];
  for (const conceptName of ['Customer', 'Order']) {
    concepts.push(
      await okJson<OntologyConcept>(
        await api.post('/api/v1/ontologyConcepts', {
          data: {
            name: conceptName,
            ontology: ontology.fullyQualifiedName,
            conceptType: 'OWL_CLASS',
          },
        }),
        'Create permission fixture concept'
      )
    );
  }

  // A reader sees only what is published, so the fixture publishes its two concepts.
  const state = await okJson<OntologyState>(
    await api.get(`${ONTOLOGIES}/${ontology.id}/state`),
    'Read permission fixture state'
  );
  const release = await okJson<OntologyRelease>(
    await api.post(`${ONTOLOGIES}/${ontology.id}/releases`, {
      data: { expectedWorkingRevision: state.workingRevision },
    }),
    'Capture permission fixture release'
  );
  await okJson(
    await api.put(`${ONTOLOGIES}/${ontology.id}/activation`, {
      data: {
        releaseId: release.id,
        expectedActivationRevision: state.activationRevision,
      },
    }),
    'Publish permission fixture release'
  );

  return { ontology, concepts };
};

const deleteOntology = async (
  api: APIRequestContext,
  ontology?: Ontology
): Promise<void> => {
  if (ontology) {
    await deleteFixtureEntity(
      api,
      `${ONTOLOGIES}/${ontology.id}?recursive=true&hardDelete=true`
    );
  }
};

const roleRef = async (api: APIRequestContext, roleName: string) => {
  const role = await okJson<{ id: string }>(
    await api.get(`/api/v1/roles/name/${roleName}`),
    `Read the ${roleName} role`
  );

  return { id: role.id, type: 'role' };
};

const grantRole = async (
  api: APIRequestContext,
  user: UserClass,
  roleName: string
): Promise<void> => {
  await okJson(
    await api.patch(`/api/v1/users/${user.responseData.id}`, {
      data: [
        { op: 'add', path: '/roles/-', value: await roleRef(api, roleName) },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    }),
    `Assign ${roleName}`
  );
};

const revokeRole = async (
  api: APIRequestContext,
  user: UserClass,
  roleName: string
): Promise<void> => {
  const current = await okJson<{ roles?: { id: string }[] }>(
    await api.get(`/api/v1/users/${user.responseData.id}?fields=roles`),
    'Read user roles'
  );
  const target = await roleRef(api, roleName);
  const index = (current.roles ?? []).findIndex(
    (role) => role.id === target.id
  );
  await okJson(
    await api.patch(`/api/v1/users/${user.responseData.id}`, {
      data: [{ op: 'remove', path: `/roles/${index}` }],
      headers: { 'Content-Type': 'application/json-patch+json' },
    }),
    `Remove ${roleName}`
  );
};

const openOntology = async (page: Page, fixture: StudioFixture) => {
  await page.goto(`/governance/ontology?ontology=${fixture.ontology.id}`);
  await expect(page.getByTestId('mode-tab-view')).toBeVisible();
  await expect(page.getByTestId('ontology-health-panel')).toBeVisible();
};

const hideCatalog = async (page: Page) => {
  await page.route(
    (url) => url.pathname === ONTOLOGIES,
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { data: [], paging: { total: 0 } } });
      } else {
        await route.fallback();
      }
    }
  );
};

// The app shell outside the Studio overflows by 17px at 1024 px on its own, so the check
// covers the Studio surface only.
const hasStudioHorizontalScroll = (page: Page) =>
  page
    .getByTestId('ontology-studio-shell')
    .evaluate((shell) => shell.scrollWidth > shell.clientWidth);

test.describe(
  'Ontology Studio shows only the actions a user can take',
  { tag: ['@Features', '@Governance'] },
  () => {
    let fixture: StudioFixture | undefined;
    let api: APIRequestContext;

    test.beforeEach(async () => {
      api = await getWorkerAdminAPIContext();
      fixture = await createStudioFixture(api);
    });

    test.afterEach(async () => {
      await deleteOntology(api, fixture?.ontology);
      fixture = undefined;
    });

    test('a DataConsumer sees View and Query but no Edit, Publish or Connect', async ({
      freshUserPage: { page },
    }) => {
      if (!fixture) {
        throw new Error('fixture missing');
      }
      await openOntology(page, fixture);

      await expect(page.getByTestId('mode-tab-view')).toBeVisible();
      await expect(page.getByTestId('mode-tab-query')).toBeVisible();
      await expect(page.getByTestId('mode-tab-edit')).toHaveCount(0);
      await expect(
        page.getByTestId('ontology-publication-trigger')
      ).toHaveCount(0);
      // The floating health card lists isolated terms once it is expanded.
      await page.getByTestId('ontology-health-review').click();
      await expect(
        page.getByTestId(`ontology-isolated-term-${fixture.concepts[0].id}`)
      ).toBeVisible();
      await expect(page.getByRole('button', { name: /^Connect/ })).toHaveCount(
        0
      );
      await page.screenshot({ path: `${SCREENSHOTS}/g3-consumer-view.png` });
    });

    test('a user with only OntologyReviewer cannot edit or connect but opens Tasks', async ({
      freshUserPage: { page, user },
    }) => {
      if (!fixture) {
        throw new Error('fixture missing');
      }
      await grantRole(api, user, 'OntologyReviewer');
      await openOntology(page, fixture);

      await expect(page.getByTestId('mode-tab-edit')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Connect/ })).toHaveCount(
        0
      );
      await page.getByTestId('ontology-tasks-trigger').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOTS}/g3-reviewer-view.png` });
    });

    test('a user with OntologyAuthor sees Edit, Publish and Connect, and Connect opens the editor', async ({
      freshUserPage: { page, user },
    }) => {
      if (!fixture) {
        throw new Error('fixture missing');
      }
      await grantRole(api, user, 'OntologyAuthor');
      // The panel offers no capture while the working copy equals the published release.
      await okJson(
        await api.post('/api/v1/ontologyConcepts', {
          data: {
            name: 'Invoice',
            ontology: fixture.ontology.fullyQualifiedName,
            conceptType: 'OWL_CLASS',
          },
        }),
        'Create an unpublished concept'
      );
      await openOntology(page, fixture);

      await expect(page.getByTestId('mode-tab-edit')).toBeVisible();
      await expect(
        page.getByTestId('ontology-publication-trigger')
      ).toBeVisible();
      const connect = page.getByTestId(
        `ontology-connect-${fixture.concepts[0].id}`
      );
      await expect(connect).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOTS}/g3-author-view.png` });

      await connect.click();
      await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await page.getByTestId('mode-tab-view').click();
      await page.getByTestId('ontology-publication-trigger').click();
      await expect(page.getByTestId('ontology-capture-release')).toBeVisible();
    });

    test('a consumer who deep links to a concept reads it, and Back leaves no edit state', async ({
      freshUserPage: { page },
    }) => {
      if (!fixture) {
        throw new Error('fixture missing');
      }
      await page.goto('/governance/ontology');
      await expect(page.getByTestId('mode-tab-view')).toBeVisible();
      await page.goto(
        `/governance/ontology?ontology=${fixture.ontology.id}&concept=${fixture.concepts[0].id}`
      );

      await expect(
        page.getByTestId('ontology-concept-inspector')
      ).toBeVisible();
      await expect(page.getByTestId('ontology-concept-edit')).toHaveCount(0);
      await expect(page.getByTestId('mode-tab-edit')).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOTS}/g3-deeplink.png` });

      await page.goBack();
      await expect(page.getByTestId('mode-tab-view')).toBeVisible();
      await expect(page.getByTestId('mode-tab-edit')).toHaveCount(0);
      await expect(page.getByTestId('ontology-new-class-panel')).toHaveCount(0);
    });

    test('keyboard focus in the header reaches each visible control and skips what is hidden', async ({
      freshUserPage: { page },
    }) => {
      if (!fixture) {
        throw new Error('fixture missing');
      }
      await openOntology(page, fixture);
      await page.getByTestId('ontology-scope-menu-trigger').focus();

      const reached = new Set<string>();
      for (let step = 0; step < 14; step++) {
        const id = await page.evaluate(
          () => document.activeElement?.getAttribute('data-testid') ?? ''
        );
        if (id) {
          reached.add(id);
        }
        await page.keyboard.press('Tab');
      }

      expect(reached.has('ontology-scope-menu-trigger')).toBe(true);
      expect(reached.has('mode-tab-view')).toBe(true);
      expect(reached.has('ontology-tasks-trigger')).toBe(true);
      expect(reached.has('mode-tab-edit')).toBe(false);
      expect(reached.has('ontology-publication-trigger')).toBe(false);
      await page.screenshot({ path: `${SCREENSHOTS}/g3-keyboard.png` });
    });

    test('at 1024 px the consumer header has no overlap and no horizontal scroll', async ({
      freshUserPage: { page },
    }) => {
      if (!fixture) {
        throw new Error('fixture missing');
      }
      await page.setViewportSize({ width: 1024, height: 768 });
      await openOntology(page, fixture);

      const boxes = await page
        .getByTestId('ontology-studio-header')
        .locator('button, [role="tab"]')
        .evaluateAll((elements) =>
          elements
            .map((element) => element.getBoundingClientRect())
            .filter((box) => box.width > 0 && box.height > 0)
            .map(({ left, right, top, bottom }) => ({
              left,
              right,
              top,
              bottom,
            }))
        );
      for (let a = 0; a < boxes.length; a++) {
        for (let b = a + 1; b < boxes.length; b++) {
          const overlaps =
            boxes[a].left < boxes[b].right - 1 &&
            boxes[b].left < boxes[a].right - 1 &&
            boxes[a].top < boxes[b].bottom - 1 &&
            boxes[b].top < boxes[a].bottom - 1;
          expect(overlaps, `header controls ${a} and ${b} overlap`).toBe(false);
        }
      }

      expect(await hasStudioHorizontalScroll(page)).toBe(false);
      await page.screenshot({ path: `${SCREENSHOTS}/g3-narrow.png` });
    });

    test('an author who loses the role keeps the unsaved guard and sees which permission is missing', async ({
      freshUserPage: { page, user },
    }) => {
      test.slow();
      if (!fixture) {
        throw new Error('fixture missing');
      }
      await grantRole(api, user, 'OntologyAuthor');
      await openOntology(page, fixture);
      await page.getByTestId('mode-tab-edit').click();
      await page.getByTestId('ontology-add-concept').click();
      await page.getByTestId('new-class-label').fill('Unsaved class');

      await revokeRole(api, user, 'OntologyAuthor');

      await page.getByTestId('mode-tab-view').click();
      const guard = page.getByRole('dialog', { name: 'Discard your changes?' });
      await expect(guard).toBeVisible();
      await guard.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByTestId('new-class-label')).toHaveValue(
        'Unsaved class'
      );

      await page.getByTestId('new-class-create').click();
      await expect(
        page.getByText(/operations \[EditAll\] not allowed/)
      ).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOTS}/g3-role-lost.png` });
    });
  }
);

test.describe(
  'Ontology Studio first run permissions',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of ['ai', 'classic'] as const) {
      test(`${mode} mode: a user with Create sees the same three enabled options`, async ({
        freshUserPage: { page, user },
      }) => {
        const api = await getWorkerAdminAPIContext();
        await grantRole(api, user, 'OntologyAuthor');
        await (mode === 'ai' ? enableAiAppMode(page) : disableAiAppMode(page));
        await hideCatalog(page);
        await page.goto('/governance/ontology');

        const empty = page.getByTestId('ontology-empty-state');
        await expect(empty).toBeVisible();
        await expect(
          page.getByRole('heading', { name: 'No ontologies yet' })
        ).toBeVisible();
        for (const name of [
          'Install from library',
          'Import a file',
          'Create from scratch',
        ]) {
          await expect(empty.getByRole('button', { name })).toBeEnabled();
        }
        await expect(empty.getByRole('button')).toHaveCount(3);
        await page.screenshot({ path: `${SCREENSHOTS}/g3-empty-${mode}.png` });
      });

      test(`${mode} mode: a user without Create reads the OntologyAuthor sentence and sees no buttons`, async ({
        freshUserPage: { page },
      }) => {
        await (mode === 'ai' ? enableAiAppMode(page) : disableAiAppMode(page));
        await hideCatalog(page);
        await page.goto('/governance/ontology');

        await expect(
          page.getByRole('heading', { name: 'No ontologies yet' })
        ).toBeVisible();
        await expect(page.getByTestId('ontology-empty-no-create')).toHaveText(
          'You do not have permission to create ontologies. An admin can grant you the OntologyAuthor role.'
        );
        await expect(
          page.getByTestId('ontology-empty-state').getByRole('button')
        ).toHaveCount(0);
        await page.screenshot({
          path: `${SCREENSHOTS}/g3-empty-nocreate-${mode}.png`,
        });
      });
    }
  }
);

test.describe(
  'Ontology Studio over the aggregate limit',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('All ontologies shows only a message when the catalog passes the limit', async ({
      freshUserPage: { page },
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const created: Ontology[] = [];
      try {
        const existing = await okJson<{ paging: { total: number } }>(
          await api.get(ONTOLOGIES, { params: { limit: 1 } }),
          'Count ontologies'
        );
        const missing = Math.max(
          0,
          AGGREGATE_LIMIT + 1 - existing.paging.total
        );
        const longName = `pw_long_${uuid().replaceAll('-', '')}`.padEnd(
          243,
          'x'
        );
        for (let index = 0; index <= missing; index++) {
          const name =
            index === 0 ? longName : `pw_over_${index}_${uuid().slice(0, 8)}`;
          created.push(
            await okJson<Ontology>(
              await api.post(ONTOLOGIES, {
                data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
              }),
              'Create over-limit ontology'
            )
          );
        }

        await page.goto('/governance/ontology');
        const message = page.getByTestId('all-ontologies-load-error');
        await expect(message).toBeVisible();
        await expect(message).toContainText(
          'Choose an ontology from the All ontologies menu in the header.'
        );
        await expect(message.getByRole('button')).toHaveCount(0);
        await expect(page.getByTestId('ontology-shortcut-list')).toHaveCount(0);
        await expect(page.getByText(/0 concepts/)).toHaveCount(0);
        expect(await hasStudioHorizontalScroll(page)).toBe(false);
        await page.screenshot({ path: `${SCREENSHOTS}/g3-over-limit.png` });

        await page.getByTestId('ontology-scope-menu-trigger').click();
        await expect(
          await findOntologyInScopeMenu(page, created[0])
        ).toBeVisible();
      } finally {
        for (const ontology of created) {
          await deleteOntology(api, ontology);
        }
      }
    });
  }
);
