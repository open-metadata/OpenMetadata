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
import { ToastProvider } from '@openmetadata/ui-core-components';
import { applyPatch, Operation } from 'fast-json-patch';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { CreateTag } from '../../generated/api/classification/createTag';
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
import { cursorPage } from '../../test/browser/fixtures/paging';
import {
  DATA_STEWARD,
  servePersona,
} from '../../test/browser/fixtures/personas';
import { EMPTY_LIST, worker } from '../../test/browser/msw';
import { networkIdle } from '../../test/browser/network';
import { describePaginatedList } from '../../test/browser/paginationContract';
import { renderApp } from '../../test/browser/renderWithApp';
import { getClassificationTagPath } from '../../utils/RouterUtils';

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

describe('Classification › Child tags', () => {
  const quotedParent: Tag = {
    ...tags[15],
    name: 'Private.Data',
    fullyQualifiedName: 'PwPagination."Private.Data"',
  };
  const parentReference = (tag: Tag) => ({
    id: tag.id,
    type: 'tag',
    name: tag.name,
    fullyQualifiedName: tag.fullyQualifiedName,
  });
  const child: Tag = {
    ...tags[16],
    name: 'Email',
    fullyQualifiedName: 'PwPagination."Private.Data".Email',
    parent: parentReference(quotedParent),
  };
  const grandchild: Tag = {
    ...tags[17],
    name: 'Work',
    fullyQualifiedName: 'PwPagination."Private.Data".Email.Work',
    parent: parentReference(child),
  };
  const rootTag: Tag = {
    ...tags[18],
    name: 'Root',
    fullyQualifiedName: 'PwPagination.Root',
  };
  const drawer = page.getByTestId('tag-form-drawer');
  const name = drawer.getByTestId('name').getByRole('textbox');
  const description = drawer.getByCSS(
    '.om-block-editor[contenteditable="true"]'
  );
  const save = drawer.getByTestId('save-button');
  const row = (tag: Tag) =>
    page.getByRole('row').filter({
      has: page.getByRole('link', { name: tag.name, exact: true }),
    });
  const openChildForm = async (parent: Tag) => {
    await userEvent.click(row(parent).getByTestId('add-child-tag-button'));

    await expect
      .element(drawer.getByTestId('parent-tag'))
      .toHaveTextContent(parent.fullyQualifiedName ?? '');
  };
  const fillTag = async (tagName: string) => {
    await userEvent.fill(name, tagName);
    await userEvent.fill(description, DESCRIPTION);
  };
  const holdRequest = () => {
    let release = () => undefined as void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    return { pending, release };
  };

  const serveTags = (
    initial: Tag[],
    category = classification,
    other?: Classification
  ) => {
    const stored = [...initial];
    const listReads: URL[] = [];
    const requests: CreateTag[] = [];
    const patches: { id: string; operations: Operation[] }[] = [];
    const deletions: URL[] = [];
    const categoryWithCount = () => ({ ...category, termCount: stored.length });
    const classifications = () => [
      categoryWithCount(),
      ...(other ? [other] : []),
    ];

    worker.use(
      http.get('/api/v1/classifications', () =>
        HttpResponse.json({
          data: classifications(),
          paging: { total: classifications().length },
        })
      ),
      http.get('/api/v1/classifications/name/:fqn', ({ params }) =>
        HttpResponse.json(
          classifications().find(
            (item) => item.fullyQualifiedName === params.fqn
          )
        )
      ),
      http.get('/api/v1/tags', ({ request }) => {
        const url = new URL(request.url);
        listReads.push(url);

        return HttpResponse.json(
          cursorPage(
            url.searchParams.get('parent') === category.fullyQualifiedName
              ? stored
              : [],
            url
          )
        );
      }),
      http.post('/api/v1/tags', async ({ request }) => {
        const payload = (await request.json()) as CreateTag;
        requests.push(payload);
        const created = [child, grandchild, rootTag].find(
          (tag) => tag.name === payload.name
        );
        if (!created) {
          return HttpResponse.json(
            { code: 400, message: 'Unexpected fixture tag' },
            { status: 400 }
          );
        }
        stored.push(created);

        return HttpResponse.json(created, { status: 201 });
      }),
      http.patch('/api/v1/tags/:id', async ({ request, params }) => {
        const operations = (await request.json()) as Operation[];
        const id = String(params.id);
        patches.push({ id, operations });
        const index = stored.findIndex((item) => item.id === id);
        const updated = applyPatch(
          { ...stored[index] },
          operations
        ).newDocument;
        stored[index] = updated;

        return HttpResponse.json(updated);
      }),
      http.delete('/api/v1/tags/:id', ({ request, params }) => {
        deletions.push(new URL(request.url));
        const target = stored.find((tag) => tag.id === params.id);
        if (!target?.fullyQualifiedName) {
          return HttpResponse.json(
            { code: 404, message: 'Tag not found' },
            { status: 404 }
          );
        }
        const descendants = target.fullyQualifiedName + '.';
        stored.splice(
          0,
          stored.length,
          ...stored.filter(
            (tag) =>
              tag.id !== target.id &&
              !tag.fullyQualifiedName?.startsWith(descendants)
          )
        );

        return HttpResponse.json(target);
      })
    );

    return { stored, listReads, requests, patches, deletions };
  };

  test('posts a quoted parent FQN, links to the returned child and resets the cursor once', async () => {
    const server = serveTags([...tags.slice(0, 15), quotedParent]);

    await renderApp('/tags/PwPagination?pageSize=15', undefined, {
      wrap: (app) => (
        <>
          {app}
          <ToastProvider />
        </>
      ),
    });
    await userEvent.click(page.getByTestId('next'));
    await openChildForm(quotedParent);
    await fillTag('Email');
    await networkIdle();
    const readCount = server.listReads.length;

    await userEvent.click(save);

    await expect.element(drawer).not.toBeInTheDocument();
    await expect
      .element(page.getByRole('link', { name: 'View Tag' }))
      .toHaveAttribute(
        'href',
        getClassificationTagPath(child.fullyQualifiedName ?? '')
      );
    expect(server.requests).toMatchObject([
      {
        name: 'Email',
        classification: classification.fullyQualifiedName,
        parent: quotedParent.fullyQualifiedName,
      },
    ]);
    await expect
      .element(page.getByTestId('page-indicator'))
      .toHaveTextContent(/1\s*of\s*2/);

    await networkIdle();

    expect(
      server.listReads
        .slice(readCount)
        .map((url) => [
          url.searchParams.get('before'),
          url.searchParams.get('after'),
        ])
    ).toEqual([[null, null]]);

    await userEvent.click(page.getByTestId('next'));

    await expect
      .element(row(child))
      .toHaveTextContent(quotedParent.fullyQualifiedName ?? '');
  });

  test('creates a grandchild using the exact FQN of the child', async () => {
    const server = serveTags([quotedParent, child]);
    await renderApp('/tags/PwPagination');

    await openChildForm(child);
    await fillTag('Work');
    await userEvent.click(save);

    await expect.element(drawer).not.toBeInTheDocument();
    expect(server.requests).toMatchObject([
      { name: 'Work', parent: child.fullyQualifiedName },
    ]);
    await expect
      .element(row(grandchild))
      .toHaveTextContent(child.fullyQualifiedName ?? '');
  });

  test('cancels a child draft and submits the next root tag without a parent', async () => {
    const server = serveTags([quotedParent]);
    await renderApp('/tags/PwPagination');

    await openChildForm(quotedParent);
    await userEvent.click(drawer.getByTestId('cancel-button'));
    await userEvent.click(page.getByTestId('add-new-tag-button'));

    await expect
      .element(drawer.getByTestId('parent-tag'))
      .not.toBeInTheDocument();

    await fillTag('Root');
    await userEvent.click(save);

    await expect.element(drawer).not.toBeInTheDocument();
    expect(server.requests).toMatchObject([
      { name: 'Root', classification: classification.fullyQualifiedName },
    ]);
    expect(server.requests[0]).not.toHaveProperty('parent');
  });

  test.each([403, 404, 409])(
    'keeps the selected parent and entered values after a %i response',
    async (status) => {
      serveTags([quotedParent]);
      let calls = 0;
      const held = holdRequest();
      worker.use(
        http.post('/api/v1/tags', async () => {
          calls++;
          await held.pending;

          return HttpResponse.json(
            { code: status, message: 'Tag create was rejected' },
            { status }
          );
        })
      );

      await renderApp('/tags/PwPagination');
      await openChildForm(quotedParent);
      await fillTag('Email');
      try {
        await userEvent.dblClick(save);

        await expect.poll(() => calls).toBe(1);
        await expect.element(save).toBeDisabled();
      } finally {
        held.release();
      }

      await expect.element(save).toBeEnabled();
      await expect.element(name).toHaveValue('Email');
      await expect.element(description).toHaveTextContent(DESCRIPTION);
      await expect
        .element(drawer.getByTestId('parent-tag'))
        .toHaveTextContent(quotedParent.fullyQualifiedName ?? '');
      expect(calls).toBe(1);
    }
  );

  test('refresh failure keeps a committed create closed and reload retries only the read', async () => {
    const server = serveTags([quotedParent]);
    await renderApp('/tags/PwPagination');
    await openChildForm(quotedParent);
    await fillTag('Email');
    worker.use(
      http.get(
        '/api/v1/tags',
        () =>
          HttpResponse.json(
            { code: 500, message: 'Could not refresh tags' },
            { status: 500 }
          ),
        { once: true }
      )
    );

    await userEvent.click(save);

    await expect.element(drawer).not.toBeInTheDocument();

    await userEvent.click(
      page.getByRole('button', { name: 'Reload', exact: true })
    );

    await expect.element(row(child)).toBeVisible();
    expect(server.requests).toHaveLength(1);
  });

  test('a pending child create cannot close a newer drawer or reload another classification', async () => {
    const sibling: Classification = {
      ...classification,
      id: '00000000-0000-4000-8000-0000000000c6',
      name: 'OtherClassification',
      fullyQualifiedName: 'OtherClassification',
      termCount: 0,
    };
    const server = serveTags([quotedParent], classification, sibling);
    const held = holdRequest();
    worker.use(
      http.post('/api/v1/tags', async ({ request }) => {
        server.requests.push((await request.json()) as CreateTag);
        await held.pending;
        server.stored.push(child);

        return HttpResponse.json(child, { status: 201 });
      })
    );

    await renderApp('/tags/OtherClassification');
    await userEvent.click(
      page
        .getByTestId('side-panel-classification')
        .filter({ hasText: 'PwPagination' })
    );
    await openChildForm(quotedParent);
    await fillTag('Email');
    try {
      await userEvent.click(save);

      await expect.poll(() => server.requests.length).toBe(1);

      globalThis.history.back();

      await expect
        .element(page.getByTestId('entity-header-name'))
        .toHaveTextContent('OtherClassification');
      await expect.element(drawer).not.toBeInTheDocument();

      await userEvent.click(page.getByTestId('add-new-tag-button'));
      await userEvent.fill(name, 'New draft');
      const listReads = server.listReads.length;
      held.release();
      await networkIdle();

      await expect.element(name).toHaveValue('New draft');
      expect(server.listReads).toHaveLength(listReads);
      expect(server.requests[0].parent).toBe(quotedParent.fullyQualifiedName);
    } finally {
      held.release();
    }
  });

  test('requires a new selection when a refresh replaces the row under the same FQN', async () => {
    const server = serveTags([tags[0], quotedParent]);
    const held = holdRequest();
    worker.use(
      http.post('/api/v1/tags', async ({ request }) => {
        server.requests.push((await request.json()) as CreateTag);
        await held.pending;

        return HttpResponse.json(rootTag, { status: 201 });
      })
    );

    await renderApp('/tags/PwPagination');
    await userEvent.click(page.getByTestId('add-new-tag-button'));
    await fillTag('Root');
    try {
      await userEvent.click(save);

      await expect.poll(() => server.requests.length).toBe(1);

      await userEvent.click(drawer.getByTestId('cancel-button'));
      await openChildForm(quotedParent);
      await fillTag('Email');
      const replacement = { ...quotedParent, id: tags[19].id };
      server.stored[1] = replacement;
      held.release();

      await expect
        .element(page.getByCSS('tr[data-row-key="' + replacement.id + '"]'))
        .toBeVisible();

      await userEvent.click(save);
      await networkIdle();

      await expect.element(name).toHaveValue('Email');
      expect(server.requests).toHaveLength(1);
    } finally {
      held.release();
    }
  });

  test('edits the child by ID without altering its parent and refreshes the subtree count after delete', async () => {
    const server = serveTags([...tags.slice(0, 15), quotedParent, child]);
    await renderApp('/tags/PwPagination?pageSize=15');
    await userEvent.click(page.getByTestId('next'));
    await userEvent.click(row(child).getByTestId('edit-button'));
    await userEvent.fill(
      drawer.getByTestId('displayName').getByRole('textbox'),
      'Email address'
    );
    await userEvent.click(save);

    await expect.element(drawer).not.toBeInTheDocument();
    expect(server.patches).toHaveLength(1);
    expect(server.patches[0].id).toBe(child.id);
    expect(server.stored.at(-1)).toMatchObject({
      displayName: 'Email address',
      parent: child.parent,
    });

    await userEvent.click(page.getByTestId('next'));
    await userEvent.click(row(quotedParent).getByTestId('delete-tag'));
    const modal = page.getByTestId('delete-modal');

    await expect.element(modal).toHaveTextContent(/descendant tags/i);

    await userEvent.click(modal.getByTestId('cancel-button'));

    await expect.element(row(child)).toBeVisible();
    expect(server.deletions).toHaveLength(0);

    await userEvent.click(row(quotedParent).getByTestId('delete-tag'));
    await userEvent.dblClick(modal.getByTestId('confirm-button'));

    await expect
      .element(page.getByTestId('filter-count'))
      .toHaveTextContent('15');
    expect(server.deletions).toHaveLength(1);
    expect(server.deletions[0].pathname).toBe(
      '/api/v1/tags/' + quotedParent.id
    );
    expect(server.deletions[0].searchParams.get('hardDelete')).toBe('true');
    expect(server.deletions[0].searchParams.get('recursive')).toBe('true');
    await expect.element(row(tags[0])).toBeVisible();
    expect(row(child).query()).toBeNull();
  });

  test('keeps the child action unavailable without tag creation or classification edit access', async () => {
    serveTags([quotedParent]);
    servePersona(DATA_STEWARD);

    await renderApp('/tags/PwPagination', DATA_STEWARD.user);

    await expect.element(row(quotedParent)).toBeVisible();
    expect(page.getByTestId('add-child-tag-button').query()).toBeNull();
    expect(page.getByTestId('add-new-tag-button').query()).toBeNull();
  });
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
