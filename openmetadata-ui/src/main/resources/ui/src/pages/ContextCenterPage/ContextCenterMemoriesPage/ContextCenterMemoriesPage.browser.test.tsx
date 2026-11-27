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
 * Every user inherits OrganizationPolicy-Owner-Rule (`All` when `isOwner()`),
 * so a memory's owner may edit and delete it although the resource-level
 * answer for contextMemory only says "conditional". Open-metadata#38638.
 */
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { queryClient } from '../../../queryClient';
import { serveEntity } from '../../../test/browser/fixtures/entityPage';
import { serveList } from '../../../test/browser/fixtures/paging';
import {
  ADMIN,
  DATA_CONSUMER,
  Persona,
  servePersona,
} from '../../../test/browser/fixtures/personas';
import { EMPTY_LIST, worker } from '../../../test/browser/msw';
import { networkIdle } from '../../../test/browser/network';
import { renderApp } from '../../../test/browser/renderWithApp';
import { scaled, suiteTimeout } from '../../../test/browser/timeouts';

const MEMORIES_API = '/api/v1/contextCenter/memories';

const userRef = ({ user }: Persona): EntityReference => ({
  id: user.id,
  name: user.name,
  displayName: user.displayName,
  type: 'user',
});

const AUTHOR: EntityReference = {
  id: '0a8f0c1e-0000-4000-8000-0000000000f1',
  name: 'pw_memory_author',
  displayName: 'PW Memory Author',
  type: 'user',
};

const memoryOf = (
  name: string,
  owner: EntityReference,
  id: string
): ContextMemory => ({
  id,
  name,
  fullyQualifiedName: name,
  title: `PW ${name}`,
  question: `What does ${name} hold?`,
  answer: `The content of ${name}.`,
  entityStatus: ContextMemoryStatus.Approved,
  owners: [owner],
  updatedBy: owner.name,
  updatedAt: 1_778_756_959_299,
  version: 0.1,
});

const OWN = memoryOf(
  'own_memory',
  userRef(DATA_CONSUMER),
  '0a8f0c1e-0000-4000-8000-00000000a001'
);
const OTHERS = memoryOf(
  'others_memory',
  AUTHOR,
  '0a8f0c1e-0000-4000-8000-00000000a002'
);

/**
 * The memories list, the signed-in persona's permissions (each memory lookup
 * evaluated against that memory's owners), a hard DELETE that removes the
 * memory from the next list response, the authors' profiles and the
 * needs-review count (no review tasks).
 */
const serveMemories = (persona: Persona) => {
  const memories = [OWN, OTHERS];
  const lookups: string[] = [];
  const deletes: string[] = [];
  serveList(MEMORIES_API, memories);
  servePersona(persona, ({ resource, fqn, id }) => {
    if (resource === 'contextMemory' && fqn) {
      lookups.push(fqn);
    }

    return (
      memories.find(
        (memory) => memory.fullyQualifiedName === fqn || memory.id === id
      ) ?? { owners: [] }
    );
  });
  const profiles = [persona.user, AUTHOR];
  worker.use(
    http.get('/api/v1/users/name/:name', ({ params }) => {
      const profile = profiles.find((user) => user.name === params.name);

      return profile
        ? HttpResponse.json(profile)
        : HttpResponse.json({ code: 404 }, { status: 404 });
    }),
    http.get('/api/v1/tasks/assigned', () => HttpResponse.json(EMPTY_LIST)),
    http.delete(`${MEMORIES_API}/:id`, ({ params, request }) => {
      deletes.push(`${params.id}${new URL(request.url).search}`);
      // serveList reads this array on every request: the next list omits it.
      memories.splice(
        memories.findIndex((memory) => memory.id === params.id),
        1
      );

      return HttpResponse.json({});
    })
  );

  return { lookups, deletes };
};

const row = (memory: ContextMemory) =>
  page.getByTestId(`memory-row-${memory.id}`);

const openMemoriesPage = async (persona: Persona, search = '') => {
  await renderApp(`/context-center/memories${search}`, persona.user);

  await expect.element(row(OWN), { timeout: scaled(60_000) }).toBeVisible();
};

const dialog = () => page.getByRole('dialog');

describe(
  'Context Center memories: edit and delete for the memory owner',
  suiteTimeout(90_000),
  () => {
    beforeEach(() => {
      // The resource-level answer lives in the app-wide query client for 5 min;
      // each test answers it for its own persona.
      queryClient.clear();
    });

    test("an owner whose edit and delete come only from isOwner() can act on their memory's row", async () => {
      const { lookups } = serveMemories(DATA_CONSUMER);

      await openMemoriesPage(DATA_CONSUMER);

      await expect
        .element(row(OWN).getByTestId('edit-memory-btn'))
        .toBeVisible();
      await expect.element(row(OWN).getByTestId('manage-button')).toBeVisible();
      await expect
        .element(row(OTHERS).getByTestId('edit-memory-btn'))
        .not.toBeInTheDocument();
      await expect
        .element(row(OTHERS).getByTestId('manage-button'))
        .not.toBeInTheDocument();
      await expect.element(page.getByTestId('add-memory-btn')).toBeVisible();
      expect([...new Set(lookups)]).toEqual([OWN.fullyQualifiedName]);
    });

    test('the owner edits their memory from its detail view', async () => {
      serveMemories(DATA_CONSUMER);
      const server = serveEntity('contextCenter/memories', OWN);

      await openMemoriesPage(DATA_CONSUMER, `?memory=${OWN.name}`);

      await expect
        .element(dialog().getByRole('button', { name: 'Delete' }))
        .toBeVisible();
      await expect
        .element(dialog().getByText("You can't edit this memory"))
        .not.toBeInTheDocument();

      await userEvent.click(dialog().getByRole('button', { name: 'Edit' }));
      await userEvent.fill(
        dialog().getByTestId('memory-content-input').getByRole('textbox'),
        'The owner rewrote this memory.'
      );
      await userEvent.click(dialog().getByRole('button', { name: /^save/i }));

      await expect.poll(() => server.patches.length).toBe(1);

      expect(server.patches[0]).toContainEqual(
        expect.objectContaining({
          path: '/answer',
          value: 'The owner rewrote this memory.',
        })
      );
      await expect.element(dialog()).not.toBeInTheDocument();
    });

    test('the owner deletes their memory from its row', async () => {
      const { deletes } = serveMemories(DATA_CONSUMER);

      await openMemoriesPage(DATA_CONSUMER);
      await userEvent.click(row(OWN).getByTestId('manage-button'));
      await userEvent.click(page.getByTestId('delete-btn'));
      await userEvent.click(page.getByTestId('confirm-button'));

      await expect.poll(() => deletes).toEqual([`${OWN.id}?hardDelete=true`]);
      await expect.element(row(OWN)).not.toBeInTheDocument();
      await expect.element(row(OTHERS)).toBeVisible();
    });

    test('the owner keeps edit and delete when the resource level is a conditional deny', async () => {
      serveMemories(DATA_CONSUMER);
      // A deny rule such as `!isOwner() && !noOwner()` makes every
      // resource-level operation conditionalDeny.
      worker.use(
        http.get('/api/v1/permissions/contextMemory', () =>
          HttpResponse.json({
            resource: 'contextMemory',
            permissions: Object.values(Operation).map((operation) => ({
              operation,
              access: 'conditionalDeny',
            })),
          })
        )
      );

      await openMemoriesPage(DATA_CONSUMER);

      await expect
        .element(row(OWN).getByTestId('edit-memory-btn'))
        .toBeVisible();
      await expect.element(row(OWN).getByTestId('manage-button')).toBeVisible();
    });

    test('a failed lookup leaves the memory without edit or delete', async () => {
      serveMemories(DATA_CONSUMER);
      let answered = 0;
      worker.use(
        http.get('/api/v1/permissions/contextMemory/name/:fqn', () => {
          answered++;

          return HttpResponse.json(
            { code: 403, message: 'Forbidden' },
            { status: 403 }
          );
        })
      );

      await openMemoriesPage(DATA_CONSUMER);

      await expect.poll(() => answered).toBeGreaterThan(0);

      // A loading lookup also hides the actions: let the 403 reach the page first.
      await networkIdle();

      await expect
        .element(row(OWN).getByTestId('edit-memory-btn'))
        .not.toBeInTheDocument();
      await expect
        .element(row(OWN).getByTestId('manage-button'))
        .not.toBeInTheDocument();
      await expect.element(row(OWN)).toBeVisible();
    });

    test('an admin keeps edit on every memory without a lookup per memory', async () => {
      const { lookups } = serveMemories(ADMIN);

      await openMemoriesPage(ADMIN);

      await expect
        .element(row(OWN).getByTestId('edit-memory-btn'))
        .toBeVisible();
      await expect
        .element(row(OTHERS).getByTestId('edit-memory-btn'))
        .toBeVisible();
      await expect
        .element(row(OTHERS).getByTestId('manage-button'))
        .toBeVisible();
      expect(lookups).toEqual([]);
    });

    test('a memory someone else owns stays read-only for a user who could act on their own', async () => {
      serveMemories(DATA_CONSUMER);
      serveEntity('contextCenter/memories', OTHERS);

      await openMemoriesPage(DATA_CONSUMER, `?memory=${OTHERS.name}`);

      await expect
        .element(dialog().getByText("You can't edit this memory"))
        .toBeVisible();
      await expect
        .element(dialog().getByRole('button', { name: 'Edit' }))
        .not.toBeInTheDocument();
      await expect
        .element(dialog().getByRole('button', { name: 'Delete' }))
        .not.toBeInTheDocument();
    });
  }
);
