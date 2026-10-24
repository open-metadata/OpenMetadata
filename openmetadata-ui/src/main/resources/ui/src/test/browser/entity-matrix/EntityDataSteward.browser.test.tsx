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
 * Replaces playwright/e2e/Pages/EntityDataSteward.spec.ts: a Data Steward edits
 * an entity's metadata from its details page. Real page, real widgets, real
 * permission-driven rendering; only the network is mocked. Each test asserts
 * the write the page sends and what it shows after the round trip.
 */
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test } from 'vitest';
import { Locator, locators, page, userEvent } from 'vitest/browser';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import {
  Column,
  EntityReference,
  TagLabel,
} from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import {
  EntityServer,
  serveEntity,
  serveSeededEntityRules,
} from '../fixtures/entityPage';
import {
  makeApiEndpoint,
  makeContainer,
  makeDashboard,
  makeDashboardDataModel,
  makeDirectory,
  makeFile,
  makeMetric,
  makeMlModel,
  makePipeline,
  makeSearchIndex,
  makeSpreadsheet,
  makeStoredProcedure,
  makeTopic,
  makeWorksheet,
  UNTOUCHED,
} from '../fixtures/dataAssets';
import { GLOSSARY_TERMS, serveGlossary } from '../fixtures/glossary';
import { DATA_STEWARD, servePersona } from '../fixtures/personas';
import { serveSearch } from '../fixtures/search';
import {
  CLASSIFICATION_TAGS,
  PERSONAL_DATA_PERSONAL,
  PII_NONE,
  serveTiers,
} from '../fixtures/tags';
import {
  ALL_COLUMNS,
  makeTable,
  serveColumns,
  TABLE_FQN,
} from '../fixtures/table';
import { EMPTY_LIST, worker } from '../msw';
import { renderApp } from '../renderWithApp';

declare module 'vitest/browser' {
  interface LocatorSelectors {
    getByCSS(css: string): Locator;
  }
}

locators.extend({
  getByCSS(css: string) {
    return `css=${css}`;
  },
});

const person = (n: number) => ({
  id: `0a8f0c1e-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`,
  name: `pw_owner_${n}`,
  displayName: `PW Owner ${n}`,
  fullyQualifiedName: `pw_owner_${n}`,
  entityType: 'user',
  type: 'user',
  deleted: false,
});

const USERS = [person(1), person(2), person(3)];

const team = (n: number) => ({
  id: `0a8f0c1e-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`,
  name: `pw_team_${n}`,
  displayName: `PW Team ${n}`,
  fullyQualifiedName: `pw_team_${n}`,
  entityType: 'team',
  type: 'team',
  teamType: 'Group',
  deleted: false,
});

const TEAMS = [team(1), team(2)];

/** The fields every steward edit touches; each generated entity type has them. */
interface EntityLike {
  id: string;
  name: string;
  description?: string;
  displayName?: string;
  tags?: TagLabel[];
  owners?: EntityReference[];
}

/** A child row (column, field, task, feature) as the server holds it. */
interface Child {
  name: string;
  description?: string;
  displayName?: string;
  tags?: TagLabel[];
}

interface ChildServer {
  current: () => Child;
  /** Every write that changed a child, wherever the page sent it. */
  writes: () => unknown[];
}

interface EntityConfig {
  label: string;
  url: string;
  endpoint: string;
  make: () => EntityLike;
  /** Mocks the page's other calls; returns the first child's store if it has children. */
  serveExtras: (server: EntityServer<EntityLike>) => ChildServer | void;
  /** Mirrors the Playwright class's `childrenTabId`; absent = no child tests. */
  children?: {
    tabId: string;
    /** The first child's row key: `data-row-key` (`data-testid` for MlModel), as in the spec. */
    rowId: string;
    rowSelector?: 'data-row-key' | 'data-testid';
    /** Children carry an editable display name (Table, DashboardDataModel). */
    displayName?: boolean;
  };
}

/** A child that lives inside the entity, so the page edits it with a PATCH on the entity. */
const childOf = <T,>(
  server: EntityServer<EntityLike>,
  read: (entity: T) => Child | undefined
): ChildServer => ({
  current: () => read(server.current() as unknown as T) ?? { name: '' },
  writes: () => server.patches,
});

/** A table-like child the page edits through `PUT /columns/name/{fqn}`. */
const columnOf = (parent: string, columns: Column[]): ChildServer => {
  const store = serveColumns(parent, columns);

  return { current: () => store.current()[0], writes: () => store.updates };
};

const at = (route: string, fqn?: string) =>
  `/${route}/${encodeURIComponent(fqn ?? '')}`;

const ENTITIES: EntityConfig[] = [
  {
    label: 'ApiEndpoint',
    url: at('apiEndpoint', makeApiEndpoint().fullyQualifiedName),
    endpoint: 'apiEndpoints',
    make: makeApiEndpoint,
    serveExtras: (server) =>
      childOf<APIEndpoint>(server, (e) => e.requestSchema?.schemaFields?.[0]),
    children: {
      tabId: 'schema',
      rowId:
        makeApiEndpoint().requestSchema?.schemaFields?.[0].fullyQualifiedName ??
        '',
    },
  },
  {
    label: 'Table',
    url: at('table', TABLE_FQN),
    endpoint: 'tables',
    make: () => makeTable(UNTOUCHED),
    serveExtras: () => {
      worker.use(
        http.get('/api/v1/queries', () => HttpResponse.json(EMPTY_LIST))
      );

      return columnOf('tables', ALL_COLUMNS);
    },
    children: {
      tabId: 'schema',
      rowId: ALL_COLUMNS[0].fullyQualifiedName ?? '',
      displayName: true,
    },
  },
  {
    label: 'StoredProcedure',
    url: at('storedProcedure', makeStoredProcedure().fullyQualifiedName),
    endpoint: 'storedProcedures',
    make: makeStoredProcedure,
    serveExtras: () => undefined,
  },
  {
    label: 'Dashboard',
    url: at('dashboard', makeDashboard().fullyQualifiedName),
    endpoint: 'dashboards',
    make: makeDashboard,
    serveExtras: () => undefined,
  },
  {
    label: 'Pipeline',
    url: at('pipeline', makePipeline().fullyQualifiedName),
    endpoint: 'pipelines',
    make: makePipeline,
    serveExtras: (server) => childOf<Pipeline>(server, (e) => e.tasks?.[0]),
    children: { tabId: 'tasks', rowId: makePipeline().tasks?.[0].name ?? '' },
  },
  {
    label: 'Topic',
    url: at('topic', makeTopic().fullyQualifiedName),
    endpoint: 'topics',
    make: makeTopic,
    serveExtras: (server) =>
      childOf<Topic>(server, (e) => e.messageSchema?.schemaFields?.[0]),
    children: {
      tabId: 'schema',
      rowId:
        makeTopic().messageSchema?.schemaFields?.[0].fullyQualifiedName ?? '',
    },
  },
  {
    label: 'MlModel',
    url: at('mlmodel', makeMlModel().fullyQualifiedName),
    endpoint: 'mlmodels',
    make: makeMlModel,
    serveExtras: (server) =>
      childOf<Mlmodel>(server, (e) => {
        const feature = e.mlFeatures?.[0];

        return feature && { ...feature, name: feature.name ?? '' };
      }),
    children: {
      tabId: 'features',
      rowId: `feature-card-${makeMlModel().mlFeatures?.[0].name}`,
      rowSelector: 'data-testid',
    },
  },
  {
    label: 'Container',
    url: at('container', makeContainer().fullyQualifiedName),
    endpoint: 'containers',
    make: makeContainer,
    serveExtras: () => {
      worker.use(
        http.get('/api/v1/containers/name/:fqn/children', () =>
          HttpResponse.json(EMPTY_LIST)
        ),
        http.get('/api/v1/containers/name/:fqn/ancestors', () =>
          HttpResponse.json([])
        )
      );
    },
  },
  {
    label: 'SearchIndex',
    url: at('searchIndex', makeSearchIndex().fullyQualifiedName),
    endpoint: 'searchIndexes',
    make: makeSearchIndex,
    serveExtras: (server) => childOf<SearchIndex>(server, (e) => e.fields?.[0]),
    children: {
      tabId: 'fields',
      rowId: makeSearchIndex().fields[0].fullyQualifiedName ?? '',
    },
  },
  {
    label: 'DashboardDataModel',
    url: at('dashboardDataModel', makeDashboardDataModel().fullyQualifiedName),
    endpoint: 'dashboard/datamodels',
    make: makeDashboardDataModel,
    serveExtras: () =>
      columnOf('dashboard/datamodels', makeDashboardDataModel().columns),
    children: {
      tabId: 'model',
      rowId: makeDashboardDataModel().columns[0].fullyQualifiedName ?? '',
      displayName: true,
    },
  },
  {
    label: 'Metric',
    url: at('metric', makeMetric().fullyQualifiedName),
    endpoint: 'metrics',
    make: makeMetric,
    serveExtras: (server) => {
      worker.use(
        http.get('/api/v1/metrics/:id/assets', () =>
          HttpResponse.json(EMPTY_LIST)
        ),
        http.get('/api/v1/metrics/:id/hierarchy', () =>
          HttpResponse.json({
            current: server.current(),
            ancestors: [],
            children: [],
            siblings: [],
            childrenPaging: { total: 0 },
            siblingPaging: { total: 0 },
          })
        )
      );
    },
  },
  {
    label: 'Directory',
    url: at('directory', makeDirectory().fullyQualifiedName),
    endpoint: 'drives/directories',
    make: makeDirectory,
    serveExtras: () => undefined,
  },
  {
    label: 'File',
    url: at('file', makeFile().fullyQualifiedName),
    endpoint: 'drives/files',
    make: makeFile,
    serveExtras: () => undefined,
  },
  {
    label: 'Spreadsheet',
    url: at('spreadsheet', makeSpreadsheet().fullyQualifiedName),
    endpoint: 'drives/spreadsheets',
    make: makeSpreadsheet,
    serveExtras: () => undefined,
  },
  {
    label: 'Worksheet',
    url: at('worksheet', makeWorksheet().fullyQualifiedName),
    endpoint: 'drives/worksheets',
    make: makeWorksheet,
    serveExtras: () => undefined,
  },
];

const header = () => page.getByTestId('data-assets-header');
const usersPanel = () => page.getByTestId('owner-select-users-panel');

const openOwnerPicker = async (tab: 'Users' | 'Teams') => {
  await userEvent.click(page.getByTestId('edit-owner'));
  await userEvent.click(
    page.getByTestId('select-owner-tabs').getByRole('tab', { name: tab })
  );
};

/** Replaces the owners with `users` through the picker, as a user would. */
const setUserOwners = async (users: typeof USERS) => {
  await openOwnerPicker('Users');
  await userEvent.click(usersPanel().getByTestId('clear-all-button'));
  for (const user of users) {
    await userEvent.fill(
      page.getByTestId('owner-select-users-search-bar'),
      user.displayName
    );
    await userEvent.click(
      page.getByTestId('owner-option').filter({ hasText: user.displayName })
    );
  }
  await userEvent.click(usersPanel().getByTestId('selectable-list-update-btn'));
};

const expectOwners = async (
  server: EntityServer<{ id: string; owners?: { id: string }[] }>,
  users: { id: string; displayName: string }[]
) => {
  const want = users.map((u) => u.id).sort();

  await expect
    .poll(() => (server.current().owners ?? []).map((o) => o.id).sort())
    .toEqual(want);

  for (const user of users) {
    await expect.element(header().getByTestId(user.displayName)).toBeVisible();
  }
};

const DESCRIPTION =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus varius quam eu mi ullamcorper, in porttitor magna mollis.';

/** Replaces the text in the open rich-text editor and saves. */
const saveDescription = async (text: string) => {
  // The block editor has no role or test id of its own; find it by class.
  const editor = page.getByCSS('.om-block-editor[contenteditable="true"]');
  await userEvent.click(editor);
  await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}{Backspace}');
  if (text) {
    await userEvent.fill(editor, text);
  }
  await userEvent.click(page.getByTestId('save'));
};

type Scope = ReturnType<typeof page.getByTestId>;

/** Toggles one classification tag through the picker opened from `scope` and applies. */
const toggleTag = async (scope: Scope, fqn: string) => {
  const container = scope.getByTestId('tags-container');
  const trigger = container
    .getByTestId('add-tag')
    .or(container.getByTestId('edit-button'));
  await userEvent.click(trigger.first());
  await userEvent.fill(
    page.getByTestId('classification-tag-picker-search'),
    fqn
  );
  await userEvent.click(page.getByTestId(`tree-node-${fqn}`));
  await userEvent.click(page.getByTestId('update-btn'));

  await expect.element(page.getByTestId('update-btn')).not.toBeInTheDocument();
};

/**
 * Adds tag1, adds tag2, removes tag2, removes tag1 — the spec's add/update/remove —
 * asserting after each write what the server holds (`labels()`) and what `scope` shows.
 */
const addUpdateRemoveTags = async (
  scope: () => Scope,
  labels: () => string[]
) => {
  const [tag1, tag2] = [
    PERSONAL_DATA_PERSONAL.fullyQualifiedName ?? '',
    PII_NONE.fullyQualifiedName ?? '',
  ];
  const steps: [string, string[]][] = [
    [tag1, [tag1]],
    [tag2, [tag1, tag2]],
    [tag2, [tag1]],
    [tag1, []],
  ];

  for (const [toggled, want] of steps) {
    await toggleTag(scope(), toggled);

    await expect.poll(() => labels().sort()).toEqual([...want].sort());

    for (const fqn of [tag1, tag2]) {
      const chip = scope()
        .getByTestId('tags-container')
        .getByTestId(`tag-${fqn}`);
      await (want.includes(fqn)
        ? expect.element(chip).toBeVisible()
        : expect.element(chip).not.toBeInTheDocument());
    }
  }

  await expect
    .element(scope().getByTestId('tags-container').getByTestId('add-tag'))
    .toBeVisible();
};

/** Toggles one glossary term through the picker opened from `scope` and applies. */
const toggleGlossaryTerm = async (
  scope: Scope,
  term: (typeof GLOSSARY_TERMS)[number]
) => {
  const container = scope.getByTestId('glossary-container');
  await userEvent.click(
    container
      .getByTestId('add-tag')
      .or(container.getByTestId('edit-button'))
      .first()
  );
  await userEvent.fill(
    page.getByPlaceholder('Search Glossary Terms'),
    term.displayName ?? ''
  );
  await userEvent.click(
    page.getByTestId(`tree-node-${term.fullyQualifiedName}`)
  );
  await userEvent.click(page.getByTestId('update-btn'));

  await expect.element(page.getByTestId('update-btn')).not.toBeInTheDocument();
};

/** Adds term1, adds term2, removes both — the spec's add/update/remove. */
const addUpdateRemoveGlossaryTerms = async (
  scope: () => Scope,
  labels: () => string[]
) => {
  const [term1, term2] = GLOSSARY_TERMS;
  const fqn = (t: typeof term1) => t.fullyQualifiedName ?? '';
  const steps: [typeof term1, string[]][] = [
    [term1, [fqn(term1)]],
    [term2, [fqn(term1), fqn(term2)]],
    [term1, [fqn(term2)]],
    [term2, []],
  ];

  for (const [toggled, want] of steps) {
    await toggleGlossaryTerm(scope(), toggled);

    await expect.poll(() => labels().sort()).toEqual([...want].sort());

    for (const t of GLOSSARY_TERMS) {
      const chip = scope()
        .getByTestId('glossary-container')
        .getByTestId(`tag-${fqn(t)}`);
      await (want.includes(fqn(t))
        ? expect.element(chip).toBeVisible()
        : expect.element(chip).not.toBeInTheDocument());
    }
  }

  await expect
    .element(scope().getByTestId('glossary-container').getByTestId('add-tag'))
    .toBeVisible();
};

const tagFqns = (entity: { tags?: TagLabel[] }) =>
  (entity.tags ?? []).map((t) => t.tagFQN);

// The Table page renders a 120-column schema, so its multi-step tests run
// past the default 15s.
describe.each(ENTITIES)(
  'Data Steward edits a $label',
  { timeout: 60_000 },
  (config) => {
    let server: EntityServer<EntityLike>;
    let child: ChildServer | void;

    beforeEach(async () => {
      servePersona(DATA_STEWARD);
      serveSeededEntityRules();
      serveTiers();
      serveSearch({ user: USERS, team: TEAMS, tag: CLASSIFICATION_TAGS });
      serveGlossary();
      server = serveEntity(config.endpoint, config.make(), {
        ...DATA_STEWARD.user,
        type: 'user',
      });
      child = config.serveExtras(server);
      renderApp(config.url, DATA_STEWARD.user);

      await expect.element(header()).toBeVisible();
    });

    test('user owners: add two, replace with a third, remove', async () => {
      await setUserOwners([USERS[0], USERS[2]]);
      await expectOwners(server, [USERS[0], USERS[2]]);

      await setUserOwners([USERS[1]]);
      await expectOwners(server, [USERS[1]]);

      await expect
        .element(header().getByTestId(USERS[0].displayName))
        .not.toBeInTheDocument();

      await openOwnerPicker('Users');
      await userEvent.click(usersPanel().getByTestId('clear-all-button'));
      await userEvent.click(
        usersPanel().getByTestId('selectable-list-update-btn')
      );
      await expectOwners(server, []);

      await expect
        .element(header().getByTestId(USERS[1].displayName))
        .not.toBeInTheDocument();
      expect(server.patches).toHaveLength(3);
    });

    test('team owner: add, replace, remove', async () => {
      for (const owner of TEAMS) {
        await openOwnerPicker('Teams');
        await userEvent.fill(
          page.getByTestId('owner-select-teams-search-bar'),
          owner.displayName
        );
        await userEvent.click(
          page
            .getByTestId('owner-option')
            .filter({ hasText: owner.displayName })
        );
        await expectOwners(server, [owner]);
      }

      await expect
        .element(header().getByTestId(TEAMS[0].displayName))
        .not.toBeInTheDocument();

      await userEvent.click(page.getByTestId('edit-owner'));
      await userEvent.click(page.getByTestId('remove-owner'));
      await expectOwners(server, []);

      await expect
        .element(header().getByTestId(TEAMS[1].displayName))
        .not.toBeInTheDocument();
      expect(server.patches).toHaveLength(3);
    });

    test('tier: add, replace, remove', async () => {
      for (const tier of ['Tier1', 'Tier2']) {
        await userEvent.click(page.getByTestId('edit-tier'));
        await userEvent.click(
          page.getByTestId('drop-down-menu').getByTestId(`Tier.${tier}`)
        );

        await expect
          .poll(() => tagFqns(server.current()))
          .toEqual([`Tier.${tier}`]);
        await expect.element(page.getByTestId('Tier')).toHaveTextContent(tier);
      }

      await userEvent.click(page.getByTestId('edit-tier'));
      await userEvent.click(
        page.getByTestId('drop-down-menu').getByTestId('clear-filter-btn')
      );

      await expect.poll(() => tagFqns(server.current())).toEqual([]);
      await expect.element(page.getByTestId('Tier')).toHaveTextContent('--');
      expect(server.patches).toHaveLength(3);
    });

    test('description: update', async () => {
      await userEvent.click(page.getByTestId('edit-description'));
      await saveDescription(DESCRIPTION);

      await expect
        .poll(() => server.current().description)
        .toBe(`<p>${DESCRIPTION}</p>`);
      await expect
        .element(
          page.getByTestId('asset-description-container').getByRole('paragraph')
        )
        .toHaveTextContent(DESCRIPTION);
      expect(server.patches).toEqual([
        [{ op: 'add', path: '/description', value: `<p>${DESCRIPTION}</p>` }],
      ]);
    });

    test('tags: add, update, remove', async () => {
      await addUpdateRemoveTags(
        () => page.getByTestId('KnowledgePanel.Tags'),
        () => tagFqns(server.current())
      );

      expect(server.patches).toHaveLength(4);
    });

    test('glossary terms: add, update, remove', async () => {
      await addUpdateRemoveGlossaryTerms(
        () => page.getByTestId('KnowledgePanel.GlossaryTerms'),
        () => tagFqns(server.current())
      );

      expect(server.patches).toHaveLength(4);
    });

    test('votes: up-vote, then down-vote', async () => {
      await userEvent.click(page.getByTestId('up-vote-btn'));

      await expect
        .element(page.getByTestId('up-vote-count'))
        .toHaveTextContent('1');

      await userEvent.click(page.getByTestId('down-vote-btn'));

      await expect
        .element(page.getByTestId('down-vote-count'))
        .toHaveTextContent('1');
      await expect
        .element(page.getByTestId('up-vote-count'))
        .toHaveTextContent('0');

      expect(server.votes).toEqual([
        { updatedVoteType: 'votedUp' },
        { updatedVoteType: 'votedDown' },
      ]);
    });

    test('follow, then un-follow', async () => {
      const follow = page.getByTestId('entity-follow-button');

      await userEvent.click(follow);

      await expect.poll(() => server.followed).toEqual([DATA_STEWARD.user.id]);
      await expect.element(follow).toHaveTextContent('Unfollow');

      await userEvent.click(follow);

      await expect
        .poll(() => server.unfollowed)
        .toEqual([DATA_STEWARD.user.id]);
      await expect.element(follow).toHaveTextContent(/^Follow/);
    });

    test('display name: update', async () => {
      const displayName = `Cypress ${server.current().name} updated`;

      await userEvent.click(page.getByTestId('manage-button'));
      await userEvent.click(page.getByTestId('rename-button'));

      await expect
        .element(page.getByRole('textbox', { name: /^Name/ }))
        .toBeDisabled();

      await userEvent.fill(
        page.getByRole('textbox', { name: /Display Name/ }),
        displayName
      );
      await userEvent.click(page.getByTestId('save-button'));

      await expect
        .element(page.getByTestId('entity-header-display-name'))
        .toHaveTextContent(displayName);
      expect(server.patches).toEqual([
        [{ op: 'add', path: '/displayName', value: displayName }],
      ]);
    });

    describe.runIf(config.children)('children', () => {
      const {
        tabId,
        rowId,
        rowSelector = 'data-row-key',
        displayName,
      } = config.children ?? { tabId: '', rowId: '' };
      const row = () => page.getByCSS(`[${rowSelector}="${rowId}"]`);
      const childServer = () => child as ChildServer;

      beforeEach(async () => {
        await userEvent.click(page.getByTestId(tabId));

        await expect.element(row()).toBeVisible();
      });

      test('child tags: add, update, remove', async () => {
        await addUpdateRemoveTags(row, () => tagFqns(childServer().current()));

        expect(childServer().writes()).toHaveLength(4);
      });

      test('child glossary terms: add, update, remove', async () => {
        await addUpdateRemoveGlossaryTerms(row, () =>
          tagFqns(childServer().current())
        );

        expect(childServer().writes()).toHaveLength(4);
      });

      test.runIf(displayName)(
        'child display name: add, update, remove',
        async () => {
          const names = [
            `Playwright ${rowId} updated`,
            `Playwright ${rowId} updated again`,
            '',
          ];
          let previous = '';

          for (const name of names) {
            await userEvent.click(row().getByTestId('edit-displayName-button'));

            await expect
              .element(page.getByRole('textbox', { name: /^Name/ }))
              .toBeDisabled();

            const input = page.getByRole('textbox', { name: /Display Name/ });

            await expect.element(input).toHaveValue(previous);

            await userEvent.fill(input, name);
            await userEvent.click(page.getByTestId('save-button'));

            await expect
              .poll(() => childServer().current().displayName)
              .toBe(name || undefined);

            const shown = row().getByTestId('column-display-name');
            await (name
              ? expect.element(shown).toHaveTextContent(name)
              : expect.element(shown).not.toBeInTheDocument());
            previous = name;
          }

          expect(childServer().writes()).toHaveLength(3);
        }
      );

      test('child description: add, update, remove', async () => {
        for (const text of [DESCRIPTION, `${DESCRIPTION} updated`, '']) {
          await userEvent.click(
            row().getByTestId('description').first().getByTestId('edit-button')
          );
          await saveDescription(text);

          await expect
            .element(page.getByTestId('editor'))
            .not.toBeInTheDocument();

          await expect
            // A cleared description is "" after a PATCH, absent after a column PUT.
            .poll(() => childServer().current().description ?? '')
            .toBe(text ? `<p>${text}</p>` : '');

          await (text
            ? expect
                .element(
                  row().getByTestId('viewer-container').getByRole('paragraph')
                )
                .toHaveTextContent(text)
            : expect
                .element(row().getByTestId('description'))
                .toHaveTextContent('No Description'));
        }

        expect(childServer().writes()).toHaveLength(3);
      });
    });
  }
);
