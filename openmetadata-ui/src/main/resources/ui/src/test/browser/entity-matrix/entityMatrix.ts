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
 * What the entity-matrix contracts (one per persona, ported from
 * playwright/e2e/Pages/EntityData<Persona>.spec.ts) share: the 15 entity types
 * the specs iterate, how each one's page is served, and the user-level steps
 * (pick owners, toggle tags, edit a description, vote, follow) with the
 * assertions on what the page sent and what it shows after the round trip.
 */
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';
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
import { AssetCertification } from '../../../generated/type/assetCertification';
import {
  EntityServer,
  serveEntity,
  serveSeededEntityRules,
} from '../fixtures/entityPage';
import {
  makeApiEndpoint,
  makeChart,
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
import { AnnouncementServer } from '../fixtures/announcements';
import { DATA_PRODUCTS, DOMAINS, serveDomains } from '../fixtures/domains';
import { GLOSSARY_TERMS, serveGlossary } from '../fixtures/glossary';
import { Persona, servePersona } from '../fixtures/personas';
import { serveSearch } from '../fixtures/search';
import {
  CERTIFICATIONS,
  CLASSIFICATION_TAGS,
  PERSONAL_DATA_PERSONAL,
  PII_NONE,
  serveCertifications,
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

export const USERS = [person(1), person(2), person(3)];

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

export const TEAMS = [team(1), team(2)];

/** The fields every steward edit touches; each generated entity type has them. */
export interface EntityLike {
  id: string;
  name: string;
  description?: string;
  displayName?: string;
  tags?: TagLabel[];
  owners?: EntityReference[];
  domains?: EntityReference[];
  dataProducts?: EntityReference[];
  certification?: AssetCertification;
  deleted?: boolean;
}

/** A child row (column, field, task, feature) as the server holds it. */
interface Child {
  name: string;
  description?: string;
  displayName?: string;
  tags?: TagLabel[];
}

export interface ChildServer {
  current: () => Child;
  /** Every write that changed a child, wherever the page sent it. */
  writes: () => unknown[];
}

export type EntityLabel =
  | 'ApiEndpoint'
  | 'Table'
  | 'StoredProcedure'
  | 'Dashboard'
  | 'Pipeline'
  | 'Topic'
  | 'MlModel'
  | 'Container'
  | 'SearchIndex'
  | 'DashboardDataModel'
  | 'Metric'
  | 'Directory'
  | 'File'
  | 'Spreadsheet'
  | 'Worksheet'
  | 'Chart';

/** How one details page is served: its URL, API endpoint and fixture. */
export interface PageConfig {
  url: string;
  endpoint: string;
  make: () => EntityLike;
  /** Mocks the page's other calls; returns the first child's store if it has children. */
  serveExtras: (server: EntityServer<EntityLike>) => ChildServer | void;
  /** What the user does once the page is up to reach the widgets (e.g. open a tab). */
  afterMount?: () => Promise<void>;
}

export interface EntityConfig extends PageConfig {
  label: EntityLabel;
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
const childOf = <T>(
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

// The flows edit the first column only; a short schema keeps every re-render
// of the columns table cheap (120 columns made each Table test ~2x slower).
const SHORT_COLUMNS = ALL_COLUMNS.slice(0, 15);

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

      return columnOf('tables', SHORT_COLUMNS);
    },
    children: {
      tabId: 'schema',
      rowId: SHORT_COLUMNS[0].fullyQualifiedName ?? '',
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
  {
    label: 'Chart',
    url: at('chart', makeChart().fullyQualifiedName),
    endpoint: 'charts',
    make: makeChart,
    serveExtras: () => undefined,
  },
];

export const header = () => page.getByTestId('data-assets-header');
export const usersPanel = () => page.getByTestId('owner-select-users-panel');

export const openOwnerPicker = async (tab: 'Users' | 'Teams') => {
  await userEvent.click(page.getByTestId('edit-owner'));
  await userEvent.click(
    page.getByTestId('select-owner-tabs').getByRole('tab', { name: tab })
  );
};

/** Every search the mounted page sent; see `mountEntityPage`. */
let searches: URLSearchParams[] = [];

/**
 * Replaces the owners with `users` through the picker, as a user would; with
 * `clear: false`, adds them to the owners already picked.
 */
export const setUserOwners = async (users: typeof USERS, clear = true) => {
  await openOwnerPicker('Users');
  if (clear) {
    await userEvent.click(usersPanel().getByTestId('clear-all-button'));
  }
  for (const user of users) {
    await userEvent.fill(
      page.getByTestId('owner-select-users-search-bar'),
      user.displayName
    );

    // The option may already be listed; wait for the debounced search too, so
    // it cannot fire after the test and land unmocked in the next one.
    await expect
      .poll(() => searches.some((q) => q.get('q')?.includes(user.displayName)))
      .toBe(true);

    await userEvent.click(
      page.getByTestId('owner-option').filter({ hasText: user.displayName })
    );
  }
  await userEvent.click(usersPanel().getByTestId('selectable-list-update-btn'));
};

export const expectOwners = async (
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

/** Sets two user owners, replaces them with a third, then removes all. */
export const addReplaceRemoveUserOwners = async (
  server: EntityServer<EntityLike>
) => {
  await setUserOwners([USERS[0], USERS[2]]);
  await expectOwners(server, [USERS[0], USERS[2]]);

  await setUserOwners([USERS[1]]);
  await expectOwners(server, [USERS[1]]);

  await expect
    .element(header().getByTestId(USERS[0].displayName))
    .not.toBeInTheDocument();

  await openOwnerPicker('Users');
  await userEvent.click(usersPanel().getByTestId('clear-all-button'));
  await userEvent.click(usersPanel().getByTestId('selectable-list-update-btn'));
  await expectOwners(server, []);

  await expect
    .element(header().getByTestId(USERS[1].displayName))
    .not.toBeInTheDocument();
  expect(server.patches).toHaveLength(3);
};

/** Sets one team owner, replaces it with another, then removes it. */
export const addReplaceRemoveTeamOwner = async (
  server: EntityServer<EntityLike>
) => {
  for (const owner of TEAMS) {
    await openOwnerPicker('Teams');
    await userEvent.fill(
      page.getByTestId('owner-select-teams-search-bar'),
      owner.displayName
    );
    await userEvent.click(
      page.getByTestId('owner-option').filter({ hasText: owner.displayName })
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
};

/** Renames the entity's display name from the manage menu; the name stays locked. */
export const updateDisplayName = async (server: EntityServer<EntityLike>) => {
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
};

export const DESCRIPTION =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus varius quam eu mi ullamcorper, in porttitor magna mollis.';

/** Replaces the text in the open rich-text editor and saves. */
export const saveDescription = async (text: string) => {
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
  // Let the debounced search land before picking: its results re-render the
  // tree, and a click on the unfiltered list can be lost in that re-render.
  const name = fqn.split('.').pop() ?? fqn;

  await expect
    .poll(() =>
      searches.some(
        (q) => q.get('index') === 'tag' && q.get('q')?.includes(name)
      )
    )
    .toBe(true);

  for (const other of CLASSIFICATION_TAGS) {
    if (other.fullyQualifiedName !== fqn) {
      await expect
        .element(page.getByTestId(`tree-node-${other.fullyQualifiedName}`))
        .not.toBeInTheDocument();
    }
  }
  await userEvent.click(page.getByTestId(`tree-node-${fqn}`));
  await userEvent.click(page.getByTestId('update-btn'));

  await expect.element(page.getByTestId('update-btn')).not.toBeInTheDocument();
};

/**
 * Adds tag1, adds tag2, removes tag2, removes tag1 — the spec's add/update/remove —
 * asserting after each write what the server holds (`labels()`) and what `scope` shows.
 */
export const addUpdateRemoveTags = async (
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
export const addUpdateRemoveGlossaryTerms = async (
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

export const tagFqns = (entity: { tags?: TagLabel[] }) =>
  (entity.tags ?? []).map((t) => t.tagFQN);

export const entityConfig = (label: EntityLabel) => {
  const config = ENTITIES.find((entity) => entity.label === label);

  if (!config) {
    throw new Error(`No entity config for ${label}`);
  }

  return config;
};

export interface EntityPage {
  server: EntityServer<EntityLike>;
  /** The first child's store, for types with children. */
  child: ChildServer | void;
  /** Unmounts and mounts the page again, as a browser reload would. */
  reload: () => Promise<void>;
}

/**
 * Serves `config`'s entity and everything its page calls, with permissions
 * answered for `persona`, then opens the page signed in as that persona.
 */
export const mountEntityPage = async (
  config: PageConfig,
  persona: Persona
): Promise<EntityPage> => {
  serveSeededEntityRules();
  serveTiers();
  searches = serveSearch({
    user: USERS,
    team: TEAMS,
    tag: CLASSIFICATION_TAGS,
    dataProduct: DATA_PRODUCTS,
  });
  serveCertifications(searches);
  serveGlossary();
  serveDomains();
  const server = serveEntity(config.endpoint, config.make(), {
    ...persona.user,
    type: 'user',
  });
  servePersona(persona, () => server.current());
  const child = config.serveExtras(server);
  const open = async () => {
    const screen = await renderApp(config.url, persona.user);

    // A worker's first mount also loads the page's lazy route chunks.
    await expect.element(header(), { timeout: 60_000 }).toBeVisible();

    await config.afterMount?.();

    return screen;
  };
  let screen = await open();

  return {
    server,
    child,
    reload: async () => {
      await screen.unmount();
      screen = await open();
    },
  };
};

const fqns = (refs: EntityReference[] = []) =>
  refs.map((ref) => ref.fullyQualifiedName);

/** Picks (or, if picked, un-picks) `domain` in the single-select domain picker. */
const toggleDomain = async (domain: (typeof DOMAINS)[number]) => {
  await userEvent.click(page.getByTestId('add-domain'));
  await userEvent.fill(
    page.getByTestId('domain-selectable-tree-search'),
    domain.name
  );
  await userEvent.click(
    page.getByTestId(`tree-node-${domain.fullyQualifiedName}`)
  );

  await expect
    .element(page.getByTestId('domain-selectable-tree-search'))
    .not.toBeInTheDocument();
};

const dataProductsPanel = () => page.getByTestId('KnowledgePanel.DataProducts');

/** Toggles `products` in the data product picker and saves. */
const toggleDataProducts = async (products: typeof DATA_PRODUCTS) => {
  const container = dataProductsPanel().getByTestId('data-products-container');
  await userEvent.click(
    container
      .getByTestId('add-data-product')
      .or(container.getByTestId('edit-button'))
      .first()
  );
  const picker = page.getByTestId('drop-down-menu');
  for (const product of products) {
    await userEvent.fill(
      picker.getByTestId('search-input'),
      product.displayName ?? ''
    );
    await userEvent.click(picker.getByTestId(product.fullyQualifiedName ?? ''));
  }
  await userEvent.click(picker.getByTestId('update-btn'));

  await expect.element(picker).not.toBeInTheDocument();
};

/**
 * The spec's domain flow: per domain, set it, add data products of that
 * domain, remove them, then clear the domain — asserting after each write what
 * the server holds and what the page shows. With the seeded "Data Product
 * Domain Validation" rule on, the data product search is narrowed to the
 * entity's domain.
 */
export const domainWithDataProducts = async (
  server: EntityServer<EntityLike>
) => {
  const dataProducts = () => fqns(server.current().dataProducts);
  const expectDataProducts = async (want: typeof DATA_PRODUCTS) => {
    await expect
      .poll(dataProducts)
      .toEqual(want.map((p) => p.fullyQualifiedName));

    for (const product of DATA_PRODUCTS) {
      const chip = dataProductsPanel().getByTestId(
        `data-product-${product.fullyQualifiedName}`
      );
      await (want.includes(product)
        ? expect.element(chip).toBeVisible()
        : expect.element(chip).not.toBeInTheDocument());
    }
  };
  const plan: [(typeof DOMAINS)[number], (typeof DATA_PRODUCTS)[]][] = [
    [DOMAINS[0], [[DATA_PRODUCTS[0]], [DATA_PRODUCTS[1]]]],
    [DOMAINS[1], [[DATA_PRODUCTS[2]]]],
  ];

  for (const [domain, additions] of plan) {
    await toggleDomain(domain);

    await expect
      .poll(() => fqns(server.current().domains))
      .toEqual([domain.fullyQualifiedName]);
    await expect
      .element(page.getByTestId(`domain-tag-${domain.fullyQualifiedName}`))
      .toHaveTextContent(domain.displayName ?? '');

    searches.splice(0);
    const added: typeof DATA_PRODUCTS = [];
    for (const products of additions) {
      await toggleDataProducts(products);
      added.push(...products);
      await expectDataProducts(added);
    }
    const narrowed = searches.filter((q) => q.get('index') === 'dataProduct');

    expect(narrowed.length).toBeGreaterThan(0);

    for (const query of narrowed) {
      expect(query.get('query_filter')).toContain(domain.fullyQualifiedName);
    }

    for (const product of [...added]) {
      await toggleDataProducts([product]);
      added.splice(added.indexOf(product), 1);
      await expectDataProducts(added);
    }

    await toggleDomain(domain);

    await expect.poll(() => fqns(server.current().domains)).toEqual([]);
    await expect
      .element(page.getByTestId('no-domain-text'))
      .toHaveTextContent('--');
  }
};

const DAY = 86_400_000;

/** Picks `date` in the core DatePicker opened by `trigger`, paging months forward. */
const pickDate = async (trigger: Locator, date: Date) => {
  await userEvent.click(trigger);
  const calendar = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('grid') });
  const heading = calendar.getByRole('heading');
  const month = date.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  await expect.element(heading).toBeVisible();

  while (!heading.element().textContent?.includes(month)) {
    const shown = heading.element().textContent ?? '';
    await userEvent.click(calendar.getByCSS('button[slot="next"]'));

    await expect.element(heading).not.toHaveTextContent(shown);
  }
  await userEvent.click(
    calendar.getByRole('gridcell').getByRole('button', {
      name: new RegExp(`(^|\\D)${date.getDate()}(\\D|$)`),
      disabled: false,
    })
  );
  await userEvent.click(calendar.getByRole('button', { name: 'Apply' }));

  await expect.element(calendar).not.toBeInTheDocument();
};

const openAnnouncements = async () => {
  await userEvent.click(page.getByTestId('manage-button'));
  await userEvent.click(page.getByTestId('announcement-button'));

  await expect.element(page.getByTestId('announcement-drawer')).toBeVisible();
};

const closeAnnouncements = async () => {
  await userEvent.click(
    page
      .getByTestId('announcement-drawer')
      .getByRole('button', { name: 'Close' })
  );

  await expect
    .element(page.getByTestId('announcement-drawer'))
    .not.toBeInTheDocument();
};

const NO_ANNOUNCEMENTS =
  'No Announcements, Click on add announcement to add one.';

/** Adds an announcement running from `fromDay` to `toDay` days out. */
const addAnnouncement = async (
  title: string,
  description: string,
  [fromDay, toDay]: [number, number]
) => {
  await openAnnouncements();

  // Both flows start from none; once listed, the drawer has settled.
  await expect
    .element(page.getByTestId('announcement-error'))
    .toHaveTextContent(NO_ANNOUNCEMENTS);

  const dialog = page.getByTestId('add-announcement-dialog');

  // The drawer may still be sliding in; a click mid-animation can miss.
  await expect
    .poll(
      async () => {
        if (!dialog.query()) {
          await userEvent.click(page.getByTestId('add-announcement'));
        }

        return dialog.query() !== null;
      },
      { timeout: 10_000 }
    )
    .toBe(true);

  await userEvent.fill(dialog.getByCSS('#title'), title);
  await pickDate(
    dialog.getByTestId('startTime').getByRole('button'),
    new Date(Date.now() + fromDay * DAY)
  );
  await pickDate(
    dialog.getByTestId('endTime').getByRole('button'),
    new Date(Date.now() + toDay * DAY)
  );
  await userEvent.fill(dialog.getByCSS('#description'), description);
  await userEvent.click(dialog.getByCSS('#announcement-submit'));

  await expect.element(dialog).not.toBeInTheDocument();
};

/** The created announcement is about the open entity and runs over the picked days. */
const expectCreated = (
  announcements: AnnouncementServer,
  fqn: string,
  title: string,
  [fromDay, toDay]: [number, number]
) => {
  const [created] = announcements.created;
  const day = (millis: number) => new Date(millis).toDateString();

  expect(announcements.created).toHaveLength(1);
  expect(created.displayName).toBe(title);
  expect(created.entityLink).toContain(`::${fqn}>`);
  expect([day(created.startTime), day(created.endTime)]).toEqual([
    day(Date.now() + fromDay * DAY),
    day(Date.now() + toDay * DAY),
  ]);
};

/**
 * Picks `action` from the card's menu until `opened` shows. A late list
 * refetch re-renders the card and can close the menu under the click (the
 * Playwright helper retries for the same reason).
 */
const pickCardAction = async (card: Locator, action: string, opened: Locator) =>
  expect
    .poll(
      async () => {
        if (!opened.query()) {
          const item = page.getByTestId(action);
          await userEvent
            .click(
              item.query() ? item : card.getByTestId('announcement-actions'),
              {
                timeout: 2_000,
              }
            )
            .catch(() => undefined);
        }

        return opened.query() !== null;
      },
      { timeout: 20_000, interval: 200 }
    )
    .toBe(true);

/**
 * The spec's active announcement: create one running from today, see it on
 * the entity header after a reload, edit it in the drawer, then delete it.
 */
export const announcementLifecycle = async (
  entity: EntityPage,
  announcements: AnnouncementServer
) => {
  const fqn = String(
    (entity.server.current() as { fullyQualifiedName?: string })
      .fullyQualifiedName
  );
  const card = () =>
    page.getByTestId('announcement-drawer').getByTestId('announcement-card');

  await addAnnouncement(
    'Playwright Test Announcement',
    'Playwright Test Announcement Description',
    [0, 5]
  );
  expectCreated(announcements, fqn, 'Playwright Test Announcement', [0, 5]);
  const [{ id }] = announcements.current();
  await closeAnnouncements();
  await entity.reload();

  const banner = page.getByTestId('entity-header-announcements');

  await expect
    .element(banner)
    .toHaveTextContent(/Playwright Test Announcement/);
  await expect
    .element(banner)
    .toHaveTextContent(/Playwright Test Announcement Description/);

  await openAnnouncements();
  const edit = page.getByTestId('edit-announcement-dialog');
  await pickCardAction(card(), 'announcement-edit-action', edit);
  await userEvent.fill(
    edit.getByCSS('#title'),
    'Edited Playwright Test Announcement'
  );
  await userEvent.fill(
    edit.getByCSS('#description'),
    'Updated Playwright Test Announcement Description'
  );
  await userEvent.click(edit.getByTestId('announcement-submit'));

  await expect.element(edit).not.toBeInTheDocument();
  await expect
    .element(card())
    .toHaveTextContent(/Edited Playwright Test Announcement/);
  await expect
    .element(card())
    .toHaveTextContent(/Updated Playwright Test Announcement Description/);
  expect(announcements.patches).toHaveLength(1);

  const confirm = page.getByTestId('announcement-delete-confirm');
  await pickCardAction(card(), 'announcement-delete-action', confirm);

  await expect
    .element(confirm)
    .toHaveTextContent(
      'Are you sure you want to permanently delete this message?'
    );

  await userEvent.click(confirm.getByTestId('save-button'));

  await expect
    .element(page.getByTestId('announcement-error'))
    .toHaveTextContent(NO_ANNOUNCEMENTS);
  expect(announcements.deletes).toEqual([`${id}?hardDelete=true`]);

  await closeAnnouncements();
};

/** A scheduled (not yet active) announcement is listed under the Scheduled tab only. */
export const scheduledAnnouncement = async (
  entity: EntityPage,
  announcements: AnnouncementServer
) => {
  const fqn = String(
    (entity.server.current() as { fullyQualifiedName?: string })
      .fullyQualifiedName
  );
  const title = 'Inactive Playwright announcement';

  await addAnnouncement(
    title,
    'Inactive Playwright announcement description',
    [6, 11]
  );
  expectCreated(announcements, fqn, title, [6, 11]);

  const drawer = page.getByTestId('announcement-drawer');
  await userEvent.click(drawer.getByTestId('announcement-status-Scheduled'));

  await expect
    .element(drawer.getByTestId('announcement-card').filter({ hasText: title }))
    .toBeVisible();

  await userEvent.click(drawer.getByTestId('announcement-status-Active'));

  await expect
    .element(page.getByTestId('announcement-error'))
    .toBeInTheDocument();

  await closeAnnouncements();

  await expect
    .element(page.getByTestId('entity-header-announcements'))
    .not.toBeInTheDocument();
};

/** Sets the Gold certification, replaces it with Silver, then clears it. */
export const setReplaceClearCertification = async (
  server: EntityServer<EntityLike>
) => {
  const certified = () => server.current().certification?.tagLabel.tagFQN;
  const picker = () => page.getByTestId('drop-down-menu');

  for (const certification of [CERTIFICATIONS[2], CERTIFICATIONS[1]]) {
    await userEvent.click(page.getByTestId('edit-certification'));
    await userEvent.fill(
      picker().getByTestId('search-input'),
      certification.name
    );

    // Wait for the debounced search so it cannot land in the next test.
    await expect
      .poll(() =>
        searches.some((q) => q.get('q')?.includes(certification.name))
      )
      .toBe(true);

    await userEvent.click(
      picker().getByTestId(certification.fullyQualifiedName ?? '')
    );

    await expect.poll(certified).toBe(certification.fullyQualifiedName);
    await expect
      .element(page.getByTestId('certification-label'))
      .toHaveTextContent(certification.displayName ?? '');
  }

  await userEvent.click(page.getByTestId('edit-certification'));
  await userEvent.click(picker().getByTestId('clear-filter-btn'));

  await expect.poll(certified).toBeUndefined();
  await expect
    .element(page.getByTestId('certification-label'))
    .toHaveTextContent('--');
  expect(server.patches).toHaveLength(3);
};

/** Sets `tiers[0]`, replaces it with `tiers[1]`, then clears the tier. */
export const setReplaceClearTier = async (
  server: EntityServer<EntityLike>,
  tiers: [string, string]
) => {
  for (const tier of tiers) {
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
};

export const updateDescription = async (server: EntityServer<EntityLike>) => {
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
};

export const upVoteThenDownVote = async (server: EntityServer<EntityLike>) => {
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
};

export const followThenUnfollow = async (
  server: EntityServer<EntityLike>,
  userId: string
) => {
  const follow = page.getByTestId('entity-follow-button');

  await userEvent.click(follow);

  await expect.poll(() => server.followed).toEqual([userId]);
  await expect.element(follow).toHaveTextContent('Unfollow');

  await userEvent.click(follow);

  await expect.poll(() => server.unfollowed).toEqual([userId]);
  await expect.element(follow).toHaveTextContent(/^Follow/);
};

/** Where a page goes after a hard delete, and what that page loads. */
export interface DeleteTarget {
  path: string;
  serve: () => void;
}

const manageMenu = () => page.getByTestId('manage-dropdown-list-container');

const openDeleteModal = async () => {
  await userEvent.click(page.getByTestId('manage-button'));
  await userEvent.click(manageMenu().getByTestId('delete-button'));

  await expect.element(page.getByTestId('delete-modal')).toBeVisible();
};

/**
 * Soft deletes the entity and, after a reload, finds it marked deleted with
 * only restore and delete left in the manage menu (plus `whileDeleted`'s own
 * checks); restores it; then hard deletes it and lands on `target`. Asserted
 * up to the DELETE the page sends: that the server removes the entity (and
 * cascades) is the server's job.
 */
export const softDeleteRestoreHardDelete = async (
  entity: EntityPage,
  target: DeleteTarget,
  whileDeleted: () => Promise<void> = async () => undefined
) => {
  const { server } = entity;

  await openDeleteModal();
  await userEvent.click(page.getByTestId('confirm-button'));

  await expect
    .poll(() => server.deletes)
    .toEqual(['?hardDelete=false&recursive=true']);

  await entity.reload();

  await expect
    .element(page.getByTestId('deleted-badge'))
    .toHaveTextContent('Deleted');

  await whileDeleted();
  await userEvent.click(page.getByTestId('manage-button'));

  await expect
    .element(manageMenu().getByTestId('announcement-button'))
    .not.toBeInTheDocument();
  await expect
    .element(manageMenu().getByTestId('rename-button'))
    .not.toBeInTheDocument();
  await expect.element(manageMenu().getByTestId('delete-button')).toBeVisible();

  await userEvent.click(manageMenu().getByTestId('restore-button'));
  await userEvent.click(page.getByRole('button', { name: 'Restore' }));

  await expect.poll(() => server.current().deleted).toBe(false);
  await expect
    .element(page.getByTestId('deleted-badge'))
    .not.toBeInTheDocument();

  target.serve();
  await openDeleteModal();
  await userEvent.click(page.getByTestId('hard-delete'));
  await userEvent.click(page.getByTestId('confirm-button'));

  await expect
    .poll(() => server.deletes)
    .toEqual([
      '?hardDelete=false&recursive=true',
      '?hardDelete=true&recursive=true',
    ]);
  await expect
    .element(page.getByTestId('__location'))
    .toHaveTextContent(target.path);
};

/** The first child's row on the children tab, keyed as the spec keys it. */
export const childRow = (config: EntityConfig) => {
  const { rowId = '', rowSelector = 'data-row-key' } = config.children ?? {};

  return () => page.getByCSS(`[${rowSelector}="${rowId}"]`);
};

export const openChildrenTab = async (config: EntityConfig) => {
  await userEvent.click(page.getByTestId(config.children?.tabId ?? ''));

  await expect.element(childRow(config)()).toBeVisible();
};

/** Adds, updates, then clears the child's description from its row. */
export const addUpdateRemoveChildDescription = async (
  row: () => Scope,
  child: ChildServer
) => {
  for (const text of [DESCRIPTION, `${DESCRIPTION} updated`, '']) {
    await userEvent.click(
      row().getByTestId('description').first().getByTestId('edit-button')
    );
    await saveDescription(text);

    await expect.element(page.getByTestId('editor')).not.toBeInTheDocument();

    await expect
      // A cleared description is "" after a PATCH, absent after a column PUT.
      .poll(() => child.current().description ?? '')
      .toBe(text ? `<p>${text}</p>` : '');

    await (text
      ? expect
          .element(row().getByTestId('viewer-container').getByRole('paragraph'))
          .toHaveTextContent(text)
      : expect
          .element(row().getByTestId('description'))
          .toHaveTextContent('No Description'));
  }

  expect(child.writes()).toHaveLength(3);
};
