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
 * The per-entity value flows of playwright/e2e/Pages/CustomProperties.spec.ts:
 * set and update custom property values on an entity's Custom Properties tab,
 * and find, search and edit them in the Explore right panel. Real pages, real
 * editors; only the network is mocked. Each step asserts the `extension` the
 * page sends and what it shows after the round trip.
 *
 * One `CustomPropertyValues.<Type>.browser.test.tsx` per entity type calls
 * `describeCustomPropertyValues`, so Vitest runs the types in parallel.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  EntityLabel,
  EntityLike,
  entityConfig,
  mountEntityPage,
} from '../entity-matrix/entityMatrix';
import {
  customProperty,
  FieldTypeName,
  serveEntityType,
  SPEC_CONFIG,
} from '../fixtures/customProperties';
import { EntityServer, serveEntity } from '../fixtures/entityPage';
import { ADMIN } from '../fixtures/personas';
import { serveSearch } from '../fixtures/search';
import { EMPTY_LIST, worker } from '../msw';
import { renderApp } from '../renderWithApp';
import { expectCardShows, setValue, VALUES } from './customPropertyEditors';

/** The entity type each page's custom properties belong to, and its Explore tab. */
const EXPLORE: Partial<
  Record<EntityLabel, { entityType: string; tab: string }>
> = {
  Table: { entityType: 'table', tab: 'tables' },
  ApiEndpoint: { entityType: 'apiEndpoint', tab: 'apiEndpoint' },
  StoredProcedure: { entityType: 'storedProcedure', tab: 'storedProcedure' },
  Dashboard: { entityType: 'dashboard', tab: 'dashboards' },
  Pipeline: { entityType: 'pipeline', tab: 'pipelines' },
  Topic: { entityType: 'topic', tab: 'topics' },
  MlModel: { entityType: 'mlmodel', tab: 'mlmodels' },
  Container: { entityType: 'container', tab: 'containers' },
  SearchIndex: { entityType: 'searchIndex', tab: 'searchIndexes' },
  DashboardDataModel: {
    entityType: 'dashboardDataModel',
    tab: 'dashboardDataModel',
  },
  Metric: { entityType: 'metric', tab: 'metric' },
  Chart: { entityType: 'chart', tab: 'charts' },
};

/** The property of `type` these flows edit, named as the spec names it. */
const propertyFor = (type: FieldTypeName) =>
  customProperty(type, `cp-${type}`, SPEC_CONFIG[type]);

const extensionOf = (server: EntityServer<EntityLike>) =>
  (server.current() as { extension?: Record<string, unknown> }).extension ?? {};

/** References carry extra fields (e.g. `deleted`); everything else is exact. */
const expectSaved = (actual: unknown, saved: unknown) =>
  typeof saved === 'object'
    ? expect(actual).toMatchObject(saved as object)
    : expect(actual).toEqual(saved);

const card = (name: string) => page.getByTestId(`custom-property-${name}-card`);

/** Sets `value` for `type` on its card and checks the PATCH and the card. */
const setOnCard = async (
  server: EntityServer<EntityLike>,
  type: FieldTypeName,
  step: 0 | 1
) => {
  const property = propertyFor(type);
  const { input, saved } = VALUES[type][step];
  const writes = server.patches.length;

  await setValue(card(property.name), property, input);

  await expect.poll(() => server.patches.length).toBe(writes + 1);

  expectSaved(extensionOf(server)[property.name], saved);
  await expectCardShows(card(property.name), type, input);
};

const panel = () => page.getByCSS('.entity-summary-panel-container');
const panelRow = (name: string) =>
  panel().getByTestId(`custom-property-${name}-row`);

/**
 * Describes the value flows for `label`. `types` are set on the tab (all of
 * them for Table, String elsewhere, as in the spec); `updated` are then
 * changed to their second value.
 */
export const describeCustomPropertyValues = (
  label: EntityLabel,
  types: FieldTypeName[] = ['string'],
  updated: FieldTypeName[] = ['string']
) => {
  const config = entityConfig(label);
  const { entityType, tab } = EXPLORE[label] ?? { entityType: '', tab: '' };
  const properties = types.map(propertyFor);

  describe(`${label} custom property values`, { timeout: 120_000 }, () => {
    test(`set ${
      types.length > 1 ? 'every type' : types[0]
    }, then update ${updated.join(
      ' and '
    )} on the Custom Properties tab`, async () => {
      serveEntityType(entityType, properties);
      const { server } = await mountEntityPage(config, ADMIN);
      await userEvent.click(page.getByTestId('custom_properties'));

      await expect
        .element(page.getByTestId('custom-properties-card'))
        .toBeVisible();

      for (const type of types) {
        await setOnCard(server, type, 0);
      }
      for (const type of updated) {
        await setOnCard(server, type, 1);
      }

      // One card per property, however often its value changed.
      for (const property of properties) {
        expect(
          document.querySelectorAll(
            `[data-testid="custom-property-${property.name}-card"]`
          )
        ).toHaveLength(1);
      }
    });

    test('Explore right panel: lists, searches, names and edits the properties', async () => {
      const [first] = properties;
      serveEntityType(entityType, properties);
      const entity: EntityLike & { fullyQualifiedName?: string } = {
        ...config.make(),
        entityType,
      } as EntityLike;
      const server = serveEntity<EntityLike>(config.endpoint, entity);
      config.serveExtras(server);
      // The page searches `dataAsset` before it settles on the tab's index.
      serveSearch({ [entityType]: [entity], dataAsset: [entity] });
      worker.use(
        // The panel's overview tab: lineage counts and data quality.
        http.get('/api/v1/lineage/getPaginationInfo', () =>
          HttpResponse.json({ upstreamDepthInfo: [], downstreamDepthInfo: [] })
        ),
        http.get('/api/v1/dataQuality/testCases', () =>
          HttpResponse.json(EMPTY_LIST)
        ),
        http.get('/api/v1/dataQuality/testCases/testCaseIncidentStatus', () =>
          HttpResponse.json(EMPTY_LIST)
        )
      );
      await renderApp(`/explore/${tab}`);
      const result = page.getByTestId(
        `table-data-card_${entity.fullyQualifiedName}`
      );

      await expect.element(result, { timeout: 60_000 }).toBeVisible();

      await userEvent.click(result);
      await userEvent.click(
        panel().getByRole('tab', { name: /custom property/i })
      );
      const section = page.getByCSS('.custom-properties-section-container');

      await expect.element(section).toBeVisible();

      for (const property of properties) {
        await expect
          .element(panelRow(property.name).getByTestId('property-name'))
          .toHaveTextContent(property.name);
      }

      const search = section.getByTestId('searchbar');
      await userEvent.fill(search, first.name);

      await expect
        .poll(
          () =>
            section
              .getByTestId('custom-properties-list')
              .getByRole('listitem')
              .all().length
        )
        .toBe(1);

      const { input, saved } =
        VALUES[first.propertyType.name as FieldTypeName][0];
      await setValue(panelRow(first.name), first, input);

      await expect.poll(() => server.patches.length).toBe(1);

      expectSaved(extensionOf(server)[first.name], saved);

      await expect
        .element(panelRow(first.name).getByTestId('property-value'))
        .toHaveTextContent(input);

      await userEvent.clear(search);

      await expect
        .poll(
          () =>
            section
              .getByTestId('custom-properties-list')
              .getByRole('listitem')
              .all().length
        )
        .toBe(properties.length);
    });
  });
};
