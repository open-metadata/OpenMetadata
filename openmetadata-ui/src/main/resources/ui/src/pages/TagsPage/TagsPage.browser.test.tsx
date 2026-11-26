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
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import {
  DESCRIPTION,
  openPicker,
  setSelected,
} from '../../test/browser/entity-matrix/entityMatrix';
import { DOMAINS, serveDomains } from '../../test/browser/fixtures/domains';
import { many, named } from '../../test/browser/fixtures/entities';
import { serveEntity } from '../../test/browser/fixtures/entityPage';
import { EMPTY_LIST, worker } from '../../test/browser/msw';
import { networkIdle } from '../../test/browser/network';
import { describePaginatedList } from '../../test/browser/paginationContract';
import { renderApp } from '../../test/browser/renderWithApp';

const classification: Classification = {
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'PwPagination',
  fullyQualifiedName: 'PwPagination',
  description: 'Classification for pagination tests',
  mutuallyExclusive: false,
  termCount: 40,
};

const tags: Tag[] = many(40, (i) => ({
  ...named('tag', i, classification.name),
  description: `Tag ${i}`,
  classification: {
    id: classification.id,
    type: 'classification',
    name: classification.name,
    fullyQualifiedName: classification.name,
  },
}));

describePaginatedList({
  name: 'Classification › Tags',
  route: `/tags/${classification.name}`,
  listPath: '/api/v1/tags',
  items: tags,
  itemLabel: (t) => t.displayName ?? t.name,
  setup: () =>
    worker.use(
      http.get('/api/v1/classifications', () =>
        HttpResponse.json({
          data: [classification],
          paging: { total: 1 },
        })
      ),
      http.get('/api/v1/classifications/name/:name', () =>
        HttpResponse.json(classification)
      )
    ),
});

describe('Classification › Domains', () => {
  const [assigned, other] = DOMAINS;
  const governed: Classification = {
    id: '00000000-0000-4000-8000-0000000000c2',
    name: 'PwDomains',
    fullyQualifiedName: 'PwDomains',
    description: 'Classification for domain tests',
    mutuallyExclusive: false,
    termCount: 0,
    domains: [
      {
        id: assigned.id,
        type: 'domain',
        name: assigned.name,
        fullyQualifiedName: assigned.fullyQualifiedName,
        displayName: assigned.displayName,
      },
    ],
  };

  const domainChip = (fqn?: string) => page.getByTestId(`domain-tag-${fqn}`);

  const serveGoverned = () => {
    const server = serveEntity('classifications', governed);
    serveDomains();
    worker.use(
      http.get('/api/v1/classifications', () =>
        HttpResponse.json({ data: [server.current()], paging: { total: 1 } })
      ),
      http.get('/api/v1/tags', () => HttpResponse.json(EMPTY_LIST))
    );

    return server;
  };

  const replaceAssignedDomain = async () => {
    await renderApp(`/tags/${governed.name}`);

    await expect
      .element(domainChip(assigned.fullyQualifiedName))
      .toHaveTextContent(assigned.displayName ?? '');

    const assignedNode = page.getByTestId(
      `tree-node-${assigned.fullyQualifiedName}`
    );
    await openPicker(page.getByTestId('edit-domain'), assignedNode);

    await expect.element(assignedNode).toHaveAttribute('data-selected', 'true');

    await setSelected(assignedNode, false);
    await setSelected(
      page.getByTestId(`tree-node-${other.fullyQualifiedName}`),
      true
    );
    await userEvent.click(page.getByTestId('update-btn'));

    await expect
      .element(page.getByTestId('update-btn'))
      .not.toBeInTheDocument();
  };

  test('shows the assigned domain and saves a replacement to the classification', async () => {
    const server = serveGoverned();

    await replaceAssignedDomain();

    await expect
      .poll(() => server.current().domains?.map((d) => d.id))
      .toEqual([other.id]);
    await expect.element(domainChip(other.fullyQualifiedName)).toBeVisible();
    await expect
      .element(domainChip(assigned.fullyQualifiedName))
      .not.toBeInTheDocument();
  });

  test('opens the edit form with the domains saved from the panel', async () => {
    const server = serveGoverned();

    await replaceAssignedDomain();

    await expect
      .poll(() => server.current().domains?.map((d) => d.id))
      .toEqual([other.id]);

    await userEvent.click(page.getByTestId('manage-button'));
    await userEvent.click(page.getByTestId('edit-classification'));

    const domainField = page
      .getByTestId('classification-form-drawer')
      .getByTestId('domain-select');

    await expect
      .element(domainField)
      .toHaveTextContent(other.displayName ?? '');
    await expect
      .element(domainField)
      .not.toHaveTextContent(assigned.displayName ?? '');
  });

  test('keeps the saved domain on screen when the save is rejected', async () => {
    const server = serveGoverned();
    let rejectedPatches = 0;
    worker.use(
      http.patch('/api/v1/classifications/:id', () => {
        rejectedPatches++;

        return HttpResponse.json(
          { code: 403, message: 'Principal is not authorized' },
          { status: 403 }
        );
      })
    );

    await replaceAssignedDomain();

    await expect.poll(() => rejectedPatches).toBe(1);
    await expect.element(domainChip(assigned.fullyQualifiedName)).toBeVisible();
    await expect
      .element(domainChip(other.fullyQualifiedName))
      .not.toBeInTheDocument();
    expect(server.current().domains?.map((d) => d.id)).toEqual([assigned.id]);
  });

  test('a domain save that lands after switching classification leaves the new one unchanged', async () => {
    const sibling: Classification = {
      ...governed,
      id: '00000000-0000-4000-8000-0000000000c5',
      name: 'PwSibling',
      fullyQualifiedName: 'PwSibling',
      domains: [],
    };
    const stored = [governed, sibling];
    let releasePatch = () => undefined as void;
    const patchHeld = new Promise<void>((resolve) => {
      releasePatch = resolve;
    });
    let patches = 0;

    serveDomains();
    worker.use(
      http.get('/api/v1/classifications', () =>
        HttpResponse.json({ data: stored, paging: { total: stored.length } })
      ),
      http.get('/api/v1/classifications/name/:name', ({ params }) =>
        HttpResponse.json(stored.find((c) => c.name === params.name))
      ),
      http.get('/api/v1/tags', () => HttpResponse.json(EMPTY_LIST)),
      http.patch('/api/v1/classifications/:id', async () => {
        patches++;
        await patchHeld;

        return HttpResponse.json({
          ...governed,
          domains: [
            {
              id: other.id,
              type: 'domain',
              name: other.name,
              fullyQualifiedName: other.fullyQualifiedName,
              displayName: other.displayName,
            },
          ],
        });
      })
    );

    await replaceAssignedDomain();

    await expect.poll(() => patches).toBe(1);

    await userEvent.click(
      page
        .getByTestId('side-panel-classification')
        .filter({ hasText: sibling.name })
    );

    await expect
      .element(page.getByTestId('entity-header-name'))
      .toHaveTextContent(sibling.name);

    releasePatch();
    await networkIdle();

    await expect.element(page.getByTestId('add-domain')).toBeVisible();
    await expect
      .element(domainChip(other.fullyQualifiedName))
      .not.toBeInTheDocument();

    await userEvent.click(page.getByTestId('manage-button'));
    await userEvent.click(page.getByTestId('edit-classification'));
    const drawer = page.getByTestId('classification-form-drawer');

    await expect
      .element(drawer.getByTestId('name').getByRole('textbox'))
      .toHaveValue(sibling.name);
    await expect
      .element(drawer.getByTestId('domain-select'))
      .not.toHaveTextContent(other.displayName ?? '');
  });
});

describe('Classification › Create', () => {
  test('a new classification opens on its empty state without showing the tags table', async () => {
    const existing: Classification = {
      ...classification,
      id: '00000000-0000-4000-8000-0000000000c3',
      name: 'PwExisting',
      fullyQualifiedName: 'PwExisting',
      termCount: 3,
    };
    const existingTags = tags.slice(0, 3);
    const stored: Classification[] = [existing];

    worker.use(
      http.get('/api/v1/classifications', () =>
        HttpResponse.json({ data: stored, paging: { total: stored.length } })
      ),
      http.get('/api/v1/classifications/name/:name', ({ params }) =>
        HttpResponse.json(stored.find((c) => c.name === params.name))
      ),
      http.post('/api/v1/classifications', async ({ request }) => {
        const body = (await request.json()) as Classification;
        // The server's create response carries no termCount.
        const created: Classification = {
          id: '00000000-0000-4000-8000-0000000000c4',
          name: body.name,
          fullyQualifiedName: body.name,
          description: body.description,
          mutuallyExclusive: false,
        };
        stored.push({ ...created, termCount: 0 });

        return HttpResponse.json(created, { status: 201 });
      }),
      http.get('/api/v1/tags', async ({ request }) => {
        const parent = new URL(request.url).searchParams.get('parent');
        if (parent !== existing.name) {
          await delay(1_000);

          return HttpResponse.json(EMPTY_LIST);
        }

        return HttpResponse.json({
          data: existingTags,
          paging: { total: existingTags.length },
        });
      })
    );

    await renderApp(`/tags/${existing.name}`);

    await expect.element(page.getByTestId('table')).toBeVisible();

    let tableGone = false;
    let tableFlashed = false;
    const observer = new MutationObserver(() => {
      const table = document.querySelector('[data-testid="table"]');
      tableFlashed ||= tableGone && table !== null;
      tableGone ||= table === null;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    await userEvent.click(page.getByTestId('add-classification'));
    const drawer = page.getByTestId('classification-form-drawer');
    await userEvent.fill(
      drawer.getByTestId('name').getByRole('textbox'),
      'PwCreated'
    );
    await userEvent.fill(
      drawer.getByCSS('.om-block-editor[contenteditable="true"]'),
      DESCRIPTION
    );
    await userEvent.click(drawer.getByTestId('save-button'));

    await expect.element(page.getByText('Add the first tag')).toBeVisible();

    observer.disconnect();

    await expect
      .element(page.getByTestId('entity-header-name'))
      .toHaveTextContent('PwCreated');
    expect(tableFlashed).toBe(false);
  });
});
