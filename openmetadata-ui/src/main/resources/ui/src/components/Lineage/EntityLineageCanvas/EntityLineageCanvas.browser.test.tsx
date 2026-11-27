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
 * The lineage canvas on an entity's Lineage tab: nodes for every lineage
 * entity type and their drawer, the column layer and column tracing, temp
 * tables, the lineage config, the lineage search, the quick filters, and
 * adding, editing and removing edges. Replaces the browser half of
 * DataAssetLineage.spec.ts and the canvas half of LineageFilters.spec.ts;
 * what the server stores and returns is the Java ITs' job.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { Locator, page, userEvent } from 'vitest/browser';
import {
  entityConfig,
  EntityLabel,
} from '../../../test/browser/entity-matrix/entityMatrix';
import { serveEntity } from '../../../test/browser/fixtures/entityPage';
import {
  edgeBetween,
  LineageDoc,
  lineageTable,
  LINEAGE_ROOT,
  serveLineage,
  ServeLineageSpec,
} from '../../../test/browser/fixtures/lineage';
import { serveSearch } from '../../../test/browser/fixtures/paging';
import { worker } from '../../../test/browser/msw';
import {
  renderApp,
  RenderAppOptions,
} from '../../../test/browser/renderWithApp';
import { scaled } from '../../../test/browser/timeouts';
import { EntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';

// The data assets DataAssetLineage.spec.ts draws lineage for.
const LINEAGE_TYPES: EntityLabel[] = [
  'Table',
  'Container',
  'Topic',
  'Dashboard',
  'MlModel',
  'Pipeline',
  'StoredProcedure',
  'SearchIndex',
  'DashboardDataModel',
  'ApiEndpoint',
  'Metric',
  'Directory',
  'File',
  'Spreadsheet',
  'Worksheet',
];

const node = (doc: LineageDoc) =>
  page.getByTestId(`lineage-node-${doc.fullyQualifiedName}`);

const drawer = () => page.getByTestId('lineage-entity-panel');

/** Columns as a table's search document lists them. */
const columnsOf = (tableFqn: string, ...names: string[]) =>
  names.map((name) => ({ name, fullyQualifiedName: `${tableFqn}.${name}` }));

/** A table node under the shared schema, with its columns. */
const tableWithColumns = (
  n: number,
  name: string,
  columns: string[],
  fields: Partial<LineageDoc> = {}
) =>
  lineageTable(n, name, {
    columns: columnsOf(
      `${LINEAGE_ROOT.databaseSchema?.fullyQualifiedName}.${name}`,
      ...columns
    ),
    ...fields,
  });

const ROOT: LineageDoc = {
  id: LINEAGE_ROOT.id,
  type: 'table',
  name: LINEAGE_ROOT.name,
  fullyQualifiedName: LINEAGE_ROOT.fullyQualifiedName ?? '',
  columns: columnsOf(
    LINEAGE_ROOT.fullyQualifiedName ?? '',
    'order_id',
    'amount'
  ),
};

const lineageUrl = `/table/${encodeURIComponent(
  ROOT.fullyQualifiedName
)}/lineage`;

/** Serves the root table's lineage and opens its Lineage tab. */
const openCanvas = async (
  spec: ServeLineageSpec,
  options?: RenderAppOptions
) => {
  const calls = serveLineage({ root: ROOT, ...spec });
  const screen = await renderApp(lineageUrl, undefined, options);

  await expect.element(node(ROOT), { timeout: scaled(60_000) }).toBeVisible();

  return { calls, screen };
};

/**
 * Opens an edge the way a keyboard user does: its midpoint marker is a
 * focusable "Edge" button, and Enter selects that edge. A pointer click there
 * lands on React Flow's pane instead, which hit-tests it against the edge
 * paths of a layout whose fit-to-view animation nothing in the DOM marks as
 * finished, so it can miss.
 */
const openEdge = async (marker: Locator) => {
  await expect.element(marker).toBeInTheDocument();

  (marker.element() as HTMLButtonElement).focus();
  await userEvent.keyboard('{Enter}');
};

const lastParam = (calls: URL[], name: string) =>
  calls[calls.length - 1].searchParams.get(name);

const termFilter = (field: string, value: string) => ({
  query: {
    bool: { must: [{ bool: { should: [{ term: { [field]: value } }] } }] },
  },
});

const mysql = {
  name: 'pw_mysql',
  displayName: 'pw_mysql',
  type: 'databaseService',
};
const otherDb = {
  database: { name: 'other_db', displayName: 'other_db' },
  databaseSchema: { name: 'other_schema', displayName: 'other_schema' },
};

// root -> MID -> SNOW, TOPIC, PG: the graph LineageFilterIT builds.
const MID = tableWithColumns(21, 'orders_mid', ['mid_only'], {
  service: mysql,
  database: { name: 'pw_db', displayName: 'pw_db' },
  databaseSchema: { name: 'pw_schema', displayName: 'pw_schema' },
});
const SNOW = lineageTable(22, 'customers_snow', {
  ...otherDb,
  serviceType: 'Snowflake',
  service: {
    name: 'pw_snowflake',
    displayName: 'pw_snowflake',
    type: 'databaseService',
  },
  domains: [
    { name: 'PW_Domain_1', displayName: 'PW Domain 1', type: 'domain' },
  ],
  ownerDisplayName: ['Aaron Johnson'],
  tags: [{ tagFQN: 'PII.Sensitive' }, { tagFQN: 'Tier.Tier1' }],
  tier: { tagFQN: 'Tier.Tier1' },
});
const PG = lineageTable(23, 'payments_pg', {
  ...otherDb,
  serviceType: 'Postgres',
  service: {
    name: 'pw_postgres',
    displayName: 'pw_postgres',
    type: 'databaseService',
  },
});
const TOPIC: LineageDoc = {
  id: '00000000-0000-4000-8000-000000000124',
  type: 'topic',
  name: 'order_events',
  displayName: 'order_events',
  fullyQualifiedName: 'pw_kafka.order_events',
  serviceType: 'Kafka',
  service: {
    name: 'pw_kafka',
    displayName: 'pw_kafka',
    type: 'messagingService',
  },
  domains: [
    { name: 'PW_Domain_2', displayName: 'PW Domain 2', type: 'domain' },
  ],
  ownerDisplayName: ['Bea Lin'],
  tags: [{ tagFQN: 'Tier.Tier3' }],
  tier: { tagFQN: 'Tier.Tier3' },
};
const LEAVES = [SNOW, TOPIC, PG];
const GRAPH: ServeLineageSpec = {
  downstream: [
    { doc: MID, depth: 1 },
    ...LEAVES.map((doc) => ({ doc, depth: 2 })),
  ],
  edges: [
    edgeBetween(ROOT, MID),
    ...LEAVES.map((leaf) => edgeBetween(MID, leaf)),
  ],
  facets: {
    'service.displayName.keyword': [
      'pw_mysql',
      'pw_snowflake',
      'pw_postgres',
      'pw_kafka',
    ],
    serviceType: ['mysql', 'snowflake', 'postgres', 'kafka'],
    'database.displayName.keyword': ['pw_db', 'other_db'],
    'databaseSchema.displayName.keyword': ['pw_schema', 'other_schema'],
    'columns.name.keyword': ['mid_only', 'order_id'],
    'domains.displayName.keyword': ['PW Domain 1', 'PW Domain 2'],
    ownerDisplayName: ['Aaron Johnson', 'Bea Lin'],
    'tags.tagFQN': ['PII.Sensitive'],
    'tier.tagFQN': ['Tier.Tier1', 'Tier.Tier3'],
  },
};
const ALL = [ROOT, MID, ...LEAVES];

/** Every lineage node the canvas has drawn, by FQN. */
const drawnNodes = () =>
  [
    ...document.querySelectorAll(
      '.react-flow__node > [data-testid^="lineage-node-"]'
    ),
  ]
    .map((el) => el.getAttribute('data-testid')?.slice('lineage-node-'.length))
    .sort();

const fqns = (docs: LineageDoc[]) =>
  docs.map((doc) => doc.fullyQualifiedName).sort();

describe('Lineage canvas', () => {
  test.each(LINEAGE_TYPES)(
    'a %s lineage tab draws its nodes and opens a node in the drawer',
    async (label) => {
      const config = entityConfig(label);
      const entity = config.make();
      // The page URL is /<entity type>/<fqn>.
      const [, type, fqn] = config.url.split('/');
      const downstreamEntity = {
        ...entity,
        id: '00000000-0000-4000-8000-0000000002ff',
        name: `${entity.name}_downstream`,
        displayName: `${entity.name} downstream`,
        fullyQualifiedName: `${decodeURIComponent(fqn)}_downstream`,
      };
      // A lineage node is the entity's search document, which carries the
      // entity itself (columns, fields, charts...) plus its type.
      const root = { ...entity, type } as LineageDoc;
      const downstream = { ...downstreamEntity, type } as LineageDoc;
      serveLineage({ root, downstream: [{ doc: downstream, depth: 1 }] });
      config.serveExtras(serveEntity(config.endpoint, entity));
      worker.use(
        http.get(`/api/v1/${config.endpoint}/name/:fqn`, ({ params }) =>
          params.fqn === downstream.fullyQualifiedName
            ? HttpResponse.json(downstreamEntity)
            : undefined
        )
      );

      await renderApp(`${config.url}/lineage`);

      await expect
        .element(node(downstream), { timeout: scaled(60_000) })
        .toBeVisible();
      await expect.element(node(root)).toBeVisible();
      await expect
        .element(node(downstream).getByTestId('entity-header-display-name'))
        .toHaveTextContent(downstream.displayName ?? '');

      await userEvent.click(
        node(downstream)
          .getByTestId('entity-header-display-name')
          .getByRole('button')
      );

      await expect
        .element(drawer().getByTestId('entity-header-title'))
        .toHaveTextContent(downstream.displayName ?? '');

      await userEvent.click(drawer().getByTestId('drawer-close-icon'));

      await expect.element(drawer()).not.toBeInTheDocument();
    },
    scaled(90_000)
  );

  test(
    'the column layer is off at first and an editor can turn it on',
    async () => {
      await openCanvas({});

      await userEvent.click(page.getByTestId('lineage-layer-btn'));

      await expect
        .element(page.getByTestId('lineage-layer-column-btn'))
        .not.toHaveAttribute('data-selected');

      await userEvent.click(page.getByTestId('lineage-layer-column-btn'));

      await expect
        .element(page.getByTestId('lineage-layer-column-btn'))
        .toHaveAttribute('data-selected');
      await expect
        .element(page.getByTestId('lineage-layer-btn'))
        .not.toHaveStyle({ pointerEvents: 'none' });
    },
    scaled(90_000)
  );

  test(
    'clicking a column traces it without an edit mode',
    async () => {
      await openCanvas({});
      const column = page.getByTestId(
        `column-${ROOT.columns?.[0].fullyQualifiedName}`
      );

      await userEvent.click(page.getByTestId('lineage-layer-btn'));
      await userEvent.click(page.getByTestId('lineage-layer-column-btn'));
      await userEvent.keyboard('{Escape}');
      // The column layer lists only columns with lineage; show them all.
      await userEvent.click(node(ROOT).getByTestId('lineage-filter-button'));
      await userEvent.click(column);

      await expect
        .element(column)
        .toHaveClass('custom-node-header-column-tracing');
    },
    scaled(90_000)
  );

  test(
    'temp tables on an edge are drawn as nodes, and the config hides them',
    async () => {
      const target = lineageTable(31, 'order_mart');
      const temps = ['tmp_order_staging', 'tmp_order_enriched'];
      const tempNode = (name: string) =>
        page.getByTestId(`lineage-node-${name}`);
      const directEdge = page.getByTestId(
        `edge-${ROOT.fullyQualifiedName}-${target.fullyQualifiedName}`
      );
      const showTempTables = async (show: boolean) => {
        await userEvent.click(page.getByTestId('lineage-config'));
        const toggle = page.getByRole('switch', {
          name: 'Show temporary tables',
        });

        await expect.element(toggle).toBeInTheDocument();

        if ((toggle.element() as HTMLInputElement).checked !== show) {
          await userEvent.click(
            page.getByTestId('lineage-config-show-temp-tables')
          );
        }

        await expect.element(toggle).toHaveProperty('checked', show);

        await userEvent.click(page.getByRole('button', { name: 'OK' }));

        await expect.element(toggle).not.toBeInTheDocument();
      };
      const { screen } = await openCanvas({
        downstream: [{ doc: target, depth: 1 }],
        edges: [
          edgeBetween(ROOT, target, {
            tempLineageTables: [
              { fromEntity: ROOT.fullyQualifiedName, toEntity: temps[0] },
              { fromEntity: temps[0], toEntity: temps[1] },
              { fromEntity: temps[1], toEntity: target.fullyQualifiedName },
            ],
          }),
        ],
      });

      for (const temp of temps) {
        await expect.element(tempNode(temp)).toBeVisible();
      }

      await expect.element(directEdge).not.toBeInTheDocument();

      await showTempTables(false);

      await expect.element(tempNode(temps[0])).not.toBeInTheDocument();
      await expect.element(node(target)).toBeVisible();
      await expect.element(directEdge).toBeInTheDocument();

      // The choice is remembered on the next visit.
      await screen.unmount();
      await renderApp(lineageUrl);

      await expect
        .element(node(target), { timeout: scaled(30_000) })
        .toBeVisible();
      await expect.element(directEdge).toBeInTheDocument();
      await expect.element(tempNode(temps[0])).not.toBeInTheDocument();

      await showTempTables(true);

      await expect.element(tempNode(temps[0])).toBeVisible();
      await expect.element(directEdge).not.toBeInTheDocument();
    },
    scaled(90_000)
  );

  test(
    'the lineage config sets the depth the canvas fetches, and rejects a negative one',
    async () => {
      const { calls } = await openCanvas({});
      const dialog = page.getByRole('dialog');
      const upstream = page.getByLabelText(/upstream/i);
      const downstream = page.getByLabelText(/downstream/i);
      const ok = page.getByRole('button', { name: 'OK' });

      await userEvent.click(page.getByTestId('lineage-config'));

      await expect.element(upstream).toBeVisible();
      await expect.element(downstream).toBeVisible();

      const fetched = calls.canvas.length;
      await userEvent.fill(upstream, '-1');
      await userEvent.click(ok);

      await expect
        .element(page.getByText(/cannot be less than/i))
        .toBeVisible();
      await expect.element(dialog).toBeVisible();

      await userEvent.fill(upstream, '2');
      await userEvent.fill(downstream, '1');
      await userEvent.click(ok);

      await expect.element(dialog).not.toBeInTheDocument();
      await expect.poll(() => calls.canvas.length).toBe(fetched + 1);
      expect(lastParam(calls.canvas, 'upstreamDepth')).toBe('2');
      expect(lastParam(calls.canvas, 'downstreamDepth')).toBe('1');
    },
    scaled(90_000)
  );

  test(
    'picking a node in the lineage search opens it in the drawer',
    async () => {
      await openCanvas(GRAPH);
      worker.use(
        http.get('/api/v1/topics/name/:fqn', () =>
          HttpResponse.json({
            ...TOPIC,
            service: { ...TOPIC.service, id: TOPIC.id },
          })
        )
      );

      await userEvent.fill(
        page.getByTestId('lineage-search').getByRole('combobox'),
        TOPIC.name
      );
      await userEvent.click(
        page.getByTestId(`option-${TOPIC.fullyQualifiedName}`)
      );

      await expect
        .element(
          page
            .getByTestId('entity-summary-panel-container')
            .getByTestId('entity-header-title')
        )
        .toHaveTextContent(TOPIC.name);

      await userEvent.click(drawer().getByTestId('drawer-close-icon'));

      await expect.element(drawer()).not.toBeInTheDocument();
    },
    scaled(90_000)
  );

  test(
    'the filters button shows and hides the filter dropdowns',
    async () => {
      await openCanvas({});
      const dropdowns = ['Domains', 'Owners', 'Tier', 'Service', 'Database'];

      await userEvent.click(page.getByTestId('filters-button'));

      for (const label of dropdowns) {
        await expect
          .element(page.getByTestId(`search-dropdown-${label}`))
          .toBeVisible();
      }

      await userEvent.click(page.getByTestId('filters-button'));

      for (const label of dropdowns) {
        await expect
          .element(page.getByTestId(`search-dropdown-${label}`))
          .not.toBeInTheDocument();
      }
    },
    scaled(90_000)
  );

  // Service, service type and the metadata filters match a node two hops out,
  // so the canvas keeps the root and the node in between (LineageFilterIT pins
  // this server side for service and service type).
  // Database, schema and column match the node next to the root only: past a
  // non-matching node those filters stop early on the server (#38783).
  test.each([
    ['Service', 'service.displayName.keyword', 'pw_snowflake', [SNOW]],
    ['Service Type', 'serviceType', 'kafka', [TOPIC]],
    ['Domains', 'domains.displayName.keyword', 'PW Domain 2', [TOPIC]],
    ['Owners', 'ownerDisplayName', 'Aaron Johnson', [SNOW]],
    ['Tag', 'tags.tagFQN', 'PII.Sensitive', [SNOW]],
    ['Tier', 'tier.tagFQN', 'Tier.Tier3', [TOPIC]],
    ['Database', 'database.displayName.keyword', 'pw_db', []],
    ['Schema', 'databaseSchema.displayName.keyword', 'pw_schema', []],
    ['Column', 'columns.name.keyword', 'mid_only', []],
  ])(
    'the %s filter keeps the root and the path to its matches',
    async (label, field, key, matches) => {
      const { calls } = await openCanvas(GRAPH);

      await expect.poll(drawnNodes).toEqual(fqns(ALL));

      await userEvent.click(page.getByTestId('filters-button'));
      await userEvent.click(page.getByTestId(`search-dropdown-${label}`));
      await userEvent.click(
        page.getByTestId('drop-down-menu').getByTestId(key)
      );
      await userEvent.click(page.getByTestId('update-btn'));

      await expect.poll(drawnNodes).toEqual(fqns([ROOT, MID, ...matches]));
      expect(JSON.parse(lastParam(calls.canvas, 'query_filter') ?? '')).toEqual(
        termFilter(field, key)
      );

      await userEvent.click(page.getByRole('button', { name: /clear all/i }));

      await expect.poll(drawnNodes).toEqual(fqns(ALL));
      expect(lastParam(calls.canvas, 'query_filter')).toBeFalsy();
    },
    scaled(90_000)
  );

  describe('edges', () => {
    const TARGET = lineageTable(41, 'orders_target');
    const marker = () =>
      page.getByTestId(
        `edge-${ROOT.fullyQualifiedName}-${TARGET.fullyQualifiedName}`
      );

    /** Clicks the edge's midpoint and picks `action` in its drawer menu. */
    const edgeAction = async (action: 'Edit Pipeline' | 'Delete') => {
      await openEdge(marker());

      await expect
        .element(drawer().getByTestId('edge-header-title'))
        .toBeVisible();
      await expect.element(drawer()).toHaveTextContent(TARGET.name);

      await userEvent.click(drawer().getByTestId('edge-drawer-menu'));
      await userEvent.click(page.getByRole('menuitem', { name: action }));
    };

    test(
      'adding a downstream asset from the node menu saves the edge and draws the node',
      async () => {
        const { calls } = await openCanvas({
          // Not connected yet, so the canvas does not draw it.
          downstream: [{ doc: TARGET, depth: 1 }],
          edges: [],
        });
        serveSearch('table', [{ ...TARGET, entityType: 'table' }]);

        await expect.element(node(TARGET)).not.toBeInTheDocument();

        await userEvent.click(node(ROOT).getByTestId('lineage-node-menu'));
        await userEvent.click(
          page.getByRole('menuitem', { name: 'Edit Downstream' })
        );
        const popover = page.getByTestId('add-lineage-popover');
        await userEvent.click(popover.getByTestId('add-lineage-type-select'));
        await userEvent.click(
          page.getByRole('menuitemradio', { name: /Tables/ })
        );
        await userEvent.fill(
          popover.getByTestId('add-lineage-entity-input').getByRole('combobox'),
          TARGET.name
        );
        await userEvent.click(
          page.getByTestId(`option-${TARGET.fullyQualifiedName}`)
        );
        await userEvent.click(popover.getByTestId('add-lineage-submit'));

        await expect.element(node(TARGET)).toBeVisible();
        await expect.element(popover).not.toBeInTheDocument();
        expect(calls.puts).toHaveLength(1);
        expect(calls.puts[0].edge).toMatchObject({
          fromEntity: { id: ROOT.id, type: 'table' },
          toEntity: { id: TARGET.id, type: 'table' },
        });
      },
      scaled(90_000)
    );

    test(
      'picking a pipeline for an edge saves it on the edge',
      async () => {
        const pipeline = {
          id: '00000000-0000-4000-8000-0000000001a0',
          name: 'orders_etl',
          displayName: 'orders_etl',
          fullyQualifiedName: 'pw_airflow.orders_etl',
          entityType: 'pipeline',
          type: 'pipeline',
        };
        const { calls } = await openCanvas({
          downstream: [{ doc: TARGET, depth: 1 }],
        });
        serveSearch('pipeline', [pipeline]);

        await edgeAction('Edit Pipeline');
        const modal = page.getByTestId('add-edge-modal');
        await userEvent.fill(modal.getByTestId('field-input'), pipeline.name);
        await userEvent.click(
          page.getByTestId(`pipeline-entry-${pipeline.fullyQualifiedName}`)
        );
        await userEvent.click(page.getByTestId('save-button'));

        await expect.element(modal).not.toBeInTheDocument();
        expect(calls.puts).toHaveLength(1);
        expect(calls.puts[0].edge).toMatchObject({
          fromEntity: { id: ROOT.id, type: 'table' },
          toEntity: { id: TARGET.id, type: 'table' },
          lineageDetails: { pipeline: { id: pipeline.id, type: 'pipeline' } },
        });
      },
      scaled(90_000)
    );

    test(
      'exporting the lineage as CSV starts an export of the graph on screen',
      async () => {
        // The app shell provides the export dialog.
        const { calls } = await openCanvas(
          { downstream: [{ doc: TARGET, depth: 1 }] },
          {
            wrap: (app) => (
              <EntityExportModalProvider>{app}</EntityExportModalProvider>
            ),
          }
        );

        await userEvent.click(page.getByTestId('export-button'));
        await userEvent.click(
          page.getByTestId('export-entity-modal').getByTestId('submit-button')
        );

        await expect.poll(() => calls.exports.length).toBe(1);
        expect(Object.fromEntries(calls.exports[0].searchParams)).toMatchObject(
          {
            fqn: ROOT.fullyQualifiedName,
            type: 'table',
            upstreamDepth: '3',
            downstreamDepth: '3',
          }
        );
      },
      scaled(90_000)
    );

    test(
      'deleting an edge sends the DELETE and takes it off the canvas',
      async () => {
        const { calls } = await openCanvas({
          downstream: [{ doc: TARGET, depth: 1 }],
        });

        await edgeAction('Delete');
        await userEvent.click(
          page
            .getByTestId('delete-edge-confirmation-modal')
            .getByTestId('confirm-button')
        );

        await expect.element(marker()).not.toBeInTheDocument();
        expect(calls.deletes).toEqual([
          `/api/v1/lineage/table/${ROOT.id}/table/${TARGET.id}`,
        ]);
      },
      scaled(90_000)
    );

    const ROOT_COLUMN = ROOT.columns?.[0].fullyQualifiedName ?? '';
    const columnMarker = (to: string) =>
      page.getByTestId(`column-edge-${ROOT_COLUMN}-${to}`);

    const turnOnColumnLayer = async () => {
      await userEvent.click(page.getByTestId('lineage-layer-btn'));
      await userEvent.click(page.getByTestId('lineage-layer-column-btn'));
      await userEvent.keyboard('{Escape}');
    };

    /** Removes a column edge through its drawer; the page re-PUTs the edge without it. */
    const removeColumnEdge = async (marker: Locator) => {
      await openEdge(marker);
      await userEvent.click(drawer().getByTestId('edge-drawer-menu'));
      await userEvent.click(page.getByRole('menuitem', { name: 'Delete' }));
      await userEvent.click(
        page
          .getByTestId('delete-edge-confirmation-modal')
          .getByTestId('confirm-button')
      );

      await expect.element(marker).not.toBeInTheDocument();
    };

    /** Adds lineage from the root's first column through its column menu. */
    const addColumnLineage = async (to: LineageDoc, toColumn?: string) => {
      // The column layer lists only columns with lineage; show them all.
      await userEvent.click(node(ROOT).getByTestId('lineage-filter-button'));
      const column = page.getByTestId(`column-${ROOT_COLUMN}`);
      await userEvent.hover(column);
      await userEvent.click(column.getByTestId('lineage-column-menu'));
      await userEvent.click(
        page.getByRole('menuitem', { name: 'Edit Downstream' })
      );
      const popover = page.getByTestId('add-lineage-popover');
      await userEvent.click(
        popover
          .getByTestId('add-lineage-canvas-asset-select')
          .getByRole('button')
      );
      await userEvent.click(
        page.getByRole('listbox').getByRole('option', { name: to.name })
      );
      if (toColumn) {
        await userEvent.click(
          popover.getByTestId('add-lineage-column-select').getByRole('button')
        );
        await userEvent.click(
          page.getByRole('listbox').getByRole('option', { name: toColumn })
        );
      }
      await userEvent.click(popover.getByTestId('add-lineage-submit'));

      await expect.element(popover).not.toBeInTheDocument();
    };

    test(
      'column lineage added from the column menu is saved and drawn, then removed',
      async () => {
        const target = tableWithColumns(42, 'orders_cols', ['id']);
        const toColumn = target.columns?.[0].fullyQualifiedName ?? '';
        const { calls } = await openCanvas({
          downstream: [{ doc: target, depth: 1 }],
        });
        // The popover reads the picked table's columns by its FQN.
        worker.use(
          http.get('/api/v1/tables/name/:fqn', ({ params }) =>
            params.fqn === target.fullyQualifiedName
              ? HttpResponse.json({
                  ...LINEAGE_ROOT,
                  id: target.id,
                  name: target.name,
                  fullyQualifiedName: target.fullyQualifiedName,
                  columns: [
                    {
                      name: 'id',
                      fullyQualifiedName: toColumn,
                      dataType: 'INT',
                    },
                  ],
                })
              : undefined
          )
        );
        await turnOnColumnLayer();

        await addColumnLineage(target, 'id');

        await expect.element(columnMarker(toColumn)).toBeInTheDocument();
        expect(calls.puts.at(-1)?.edge).toMatchObject({
          fromEntity: { id: ROOT.id, type: 'table' },
          toEntity: { id: target.id, type: 'table' },
          lineageDetails: {
            columnsLineage: [{ fromColumns: [ROOT_COLUMN], toColumn }],
          },
        });

        await removeColumnEdge(columnMarker(toColumn));

        expect(calls.puts.at(-1)?.edge.lineageDetails?.columnsLineage).toEqual(
          []
        );
      },
      scaled(90_000)
    );

    test(
      'column lineage to a dashboard chart is drawn from the lineage, then removed',
      async () => {
        const chart = 'pw_superset.orders_chart';
        const dashboard: LineageDoc = {
          id: '00000000-0000-4000-8000-000000000143',
          type: 'dashboard',
          name: 'orders_dashboard',
          fullyQualifiedName: 'pw_superset.orders_dashboard',
          charts: [
            {
              id: '00000000-0000-4000-8000-000000000144',
              type: 'chart',
              name: 'orders_chart',
              fullyQualifiedName: chart,
            },
          ],
        };
        const { calls } = await openCanvas({
          downstream: [{ doc: dashboard, depth: 1 }],
          edges: [
            edgeBetween(ROOT, dashboard, {
              columns: [{ fromColumns: [ROOT_COLUMN], toColumn: chart }],
            }),
          ],
        });
        await turnOnColumnLayer();

        await expect.element(columnMarker(chart)).toBeInTheDocument();

        await removeColumnEdge(columnMarker(chart));

        expect(calls.puts.at(-1)?.edge).toMatchObject({
          toEntity: { id: dashboard.id, type: 'dashboard' },
          lineageDetails: { columnsLineage: [] },
        });
      },
      scaled(90_000)
    );

    test(
      'a metric is its own column endpoint: lineage to it is saved, drawn and listed in impact analysis',
      async () => {
        const metric: LineageDoc = {
          id: '00000000-0000-4000-8000-000000000145',
          type: 'metric',
          name: 'order_total',
          fullyQualifiedName: 'order_total',
        };
        const { calls } = await openCanvas({
          downstream: [{ doc: metric, depth: 1 }],
        });
        const marker = columnMarker(metric.fullyQualifiedName);
        await turnOnColumnLayer();

        await addColumnLineage(metric);

        await expect.element(marker).toBeInTheDocument();
        expect(calls.puts.at(-1)?.edge.lineageDetails?.columnsLineage).toEqual([
          { fromColumns: [ROOT_COLUMN], toColumn: metric.fullyQualifiedName },
        ]);

        // Impact analysis reads the stored lineage, so the edge was saved.
        await userEvent.click(
          page.getByRole('tab', { name: 'Impact Analysis' })
        );
        await userEvent.click(page.getByTestId('impact-on-dropdown'));
        await userEvent.click(
          page.getByRole('menuitemradio', { name: 'Column Level' })
        );

        // The metric is both the impacted asset and the impacted column.
        const metricCells = () =>
          [
            ...(page
              .getByTestId('lineage-card-table')
              .element()
              .querySelector(
                `[data-row-key="${ROOT_COLUMN}->${metric.fullyQualifiedName}"]`
              )
              ?.querySelectorAll('td') ?? []),
          ].filter((cell) => cell.textContent?.trim() === metric.name).length;

        await expect.poll(metricCells).toBe(2);

        // The page's Lineage tab is already selected; this is the canvas's.
        await userEvent.click(
          page.getByRole('tab', { name: 'Lineage', selected: false })
        );

        await expect.element(marker).toBeInTheDocument();

        await removeColumnEdge(marker);

        expect(calls.puts.at(-1)?.edge.lineageDetails?.columnsLineage).toEqual(
          []
        );
      },
      scaled(90_000)
    );
  });
});
