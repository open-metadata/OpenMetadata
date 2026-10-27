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
 * User-level steps on the Explore page's advanced search modal (the
 * react-awesome-query-builder canvas), shared by the advanced search and
 * custom property browser tests. Each step confirms its own effect.
 */
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';
import { Locator, page, userEvent } from 'vitest/browser';
import '../entity-matrix/entityMatrix';
import { SearchCorpus, serveSearch } from '../fixtures/search';
import { EntityStatus } from '../../../generated/entity/data/searchIndex';
import { EMPTY_LIST, worker } from '../msw';
import { renderApp } from '../renderWithApp';

export const modal = () => page.getByTestId('advanced-search-modal');
export const rule = (index: number) =>
  page.getByTestId(`query-builder-rule-${index}`);

/** Opens the modal from the Explore toolbar's Tools menu. */
export const openAdvancedSearch = async () => {
  await userEvent.click(page.getByRole('button', { name: 'Tools' }));
  await userEvent.click(
    page.getByRole('menuitemradio', { name: 'Advanced Search' })
  );

  await expect.element(modal()).toBeVisible();
};

/** The listbox a combobox controls, once its popup is open. */
const listboxOf = (input: Locator) => {
  const id = input.query()?.getAttribute('aria-controls');

  return id ? page.getByCSS(`[role="listbox"][id="${id}"]`) : undefined;
};

/**
 * Picks `label` in the react-aria ComboBox inside `control`: types it as a
 * filter (or, with `filter: false`, opens the full list), clicks the option
 * and confirms the box now shows it.
 */
export const pickOption = async (
  control: Locator,
  label: string,
  { filter = true }: { filter?: boolean } = {}
) => {
  const input = control.getByRole('combobox');

  if (filter) {
    await userEvent.fill(input, label);
  }
  if (!listboxOf(input)?.query()) {
    await userEvent.click(
      control.getByRole('button', { name: 'Show options' })
    );
  }

  await expect.poll(() => Boolean(listboxOf(input)?.query())).toBe(true);

  await userEvent.click(
    (listboxOf(input) as Locator).getByRole('option', {
      name: label,
      exact: true,
    })
  );

  await expect.element(input).toHaveValue(label);

  // A builder re-render can reopen the popup under the click; it would then
  // cover the next control. Click the dialog title to dismiss it.
  if (listboxOf(input)?.query()) {
    await userEvent.click(
      modal().getByRole('heading', { includeHidden: true }).first()
    );
  }

  await expect.poll(() => Boolean(listboxOf(input)?.query())).toBe(false);
};

/** Picks `label` in a core Select (a button trigger, no text input). */
export const pickSelect = async (control: Locator, label: string) => {
  await userEvent.click(control.getByRole('button').first());
  await userEvent.click(page.getByRole('option', { name: label, exact: true }));

  await expect.element(control).toHaveTextContent(label);
};

/** The field select of rule `index` at `depth` (nested groups add levels). */
export const fieldSelect = (index: number, depth = 0) =>
  rule(index).getByTestId(
    depth
      ? `advanced-search-field-select-${depth}`
      : 'advanced-search-field-select'
  );

/**
 * Picks a field, then (for nested groups such as Custom Properties) each
 * sub-level, starting at `from`.
 */
export const pickField = async (index: number, path: string[], from = 0) => {
  for (const [offset, label] of path.entries()) {
    await pickOption(fieldSelect(index, from + offset), label);
  }
};

export const pickOperator = (index: number, operator: string) =>
  pickOption(
    rule(index).getByTestId('advanced-search-operator-select'),
    operator,
    {
      filter: false,
    }
  );

export interface Explore {
  /** Every search the page sent, in order. */
  searches: URLSearchParams[];
  /** Every aggregate (value suggestion) request, in order. */
  aggregates: URLSearchParams[];
}

/**
 * Serves what Explore and its advanced search call: the search itself
 * (`corpus`), value suggestions (`values`, filtered by the `value` regex the
 * widget sends, as a terms aggregation with an `include` would; every field
 * draws on the same values, so a test picks distinct ones per field) and the
 * custom property summary (`customProperties`). Explore opens its first
 * result in the summary panel, so the panel's reads are served too.
 */
export const serveExplore = ({
  corpus = {},
  values = [],
  customProperties = {},
}: {
  corpus?: SearchCorpus;
  values?: string[];
  customProperties?: Record<string, unknown[]>;
} = {}): Explore => {
  const explore: Explore = { searches: serveSearch(corpus), aggregates: [] };

  worker.use(
    http.get('/api/v1/search/aggregate', ({ request }) => {
      const params = new URL(request.url).searchParams;
      explore.aggregates.push(params);
      const field = params.get('field') ?? '';
      const include = new RegExp(`^${params.get('value') ?? '.*'}$`, 'i');

      return HttpResponse.json({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: {
          [`sterms#${field}`]: {
            buckets: values
              .filter((key) => include.test(key))
              .map((key) => ({ key, doc_count: 1 })),
          },
        },
      });
    }),
    http.get('/api/v1/metadata/types/customProperties', () =>
      HttpResponse.json(customProperties)
    ),
    // The Status field's values: every data asset type has every status.
    http.get('/api/v1/metadata/types/lifecycleStages', () =>
      HttpResponse.json({
        stages: Object.values(EntityStatus),
        entityTypes: ['table', 'topic', 'dashboard'].map((entityType) => ({
          entityType,
          stages: Object.values(EntityStatus),
          stageWorkflows: [],
          transitions: [],
        })),
      })
    ),
    // The summary panel on the first result: the entity, lineage and data quality.
    http.get('/api/v1/tables/name/:fqn', ({ params }) => {
      const doc = Object.values(corpus)
        .flat()
        .find((d) => d?.fullyQualifiedName === params.fqn);

      return doc
        ? HttpResponse.json(doc)
        : HttpResponse.json({ code: 404 }, { status: 404 });
    }),
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

  return explore;
};

/** Opens Explore (all data assets) and waits for its toolbar. */
export const openExplore = async (url = '/explore') => {
  const screen = await renderApp(url);

  await expect
    .element(page.getByRole('button', { name: 'Tools' }), { timeout: 60_000 })
    .toBeVisible();

  return screen;
};

const valueCell = (index: number) =>
  rule(index).getByTestId('advanced-search-value');

/** Picks `value` among the suggestions the value combobox fetched for it. */
const pickSuggestion = async (scope: Locator, value: string) => {
  const input = scope.getByRole('combobox');
  await userEvent.fill(input, value);

  await expect.poll(() => Boolean(listboxOf(input)?.query())).toBe(true);

  const option = (listboxOf(input) as Locator).getByCSS(
    `[role="option"][data-key="${value}"]`
  );
  await userEvent.click(option, { timeout: 10_000 });
};

/**
 * Fills rule `index`: its field, its operator and (unless the operator takes
 * none) its value — typed for text operators, picked from the suggestions
 * otherwise, and confirmed in the widget either way.
 */
export const fillRule = async (
  index: number,
  {
    field,
    operator,
    value,
  }: { field: string; operator: string; value?: string }
) => {
  await pickField(index, [field]);
  await pickOperator(index, operator);
  if (value === undefined) {
    return;
  }
  const cell = valueCell(index);
  const text = cell.getByTestId('advanced-search-value-text');
  const multi = cell.getByTestId('advanced-search-value-multiselect');

  if (text.query()) {
    await userEvent.fill(text, value);

    await expect.element(text).toHaveValue(value);
  } else if (multi.query()) {
    await pickSuggestion(multi, value);

    await expect
      .element(
        multi
          .getByTestId('autocomplete-selected-item')
          .filter({ hasText: value })
      )
      .toBeVisible();
  } else {
    await pickSuggestion(cell, value);
  }
  // Leave no popup open over the next control.
  await userEvent.click(
    modal().getByRole('heading', { includeHidden: true }).first()
  );
};

/** The `query_filter` of the result search a `search` sent, parsed. */
export const queryFilterOf = (search: URLSearchParams) =>
  JSON.parse(search.get('query_filter') ?? '{}');

/** A results search (not a count): the one whose filter the results follow. */
const isResultsSearch = (search: URLSearchParams) =>
  search.get('size') !== '0' && search.has('query_filter');

/**
 * Applies the advanced search and returns the `query_filter` of the results
 * search it triggered.
 */
export const applyAdvancedSearch = async (explore: Explore) => {
  const from = explore.searches.length;
  await userEvent.click(page.getByTestId('apply-btn'));

  await expect.element(modal()).not.toBeInTheDocument();
  await expect
    .poll(() => explore.searches.slice(from).some(isResultsSearch))
    .toBe(true);

  return queryFilterOf(
    explore.searches
      .slice(from)
      .filter(isResultsSearch)
      .at(-1) as URLSearchParams
  );
};

/** Clears the applied advanced search from the filter summary. */
export const clearAdvancedSearch = async () => {
  await userEvent.click(page.getByTestId('advance-search-clear-btn'));

  await expect
    .element(page.getByTestId('advance-search-filter-container'))
    .not.toBeInTheDocument();
};
