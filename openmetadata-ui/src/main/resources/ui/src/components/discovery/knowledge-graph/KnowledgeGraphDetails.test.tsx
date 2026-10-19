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

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { ThemeProvider } from '../../../context/UntitledUIThemeProvider/theme-provider';
import { Column } from '../../../generated/entity/data/table';
import KnowledgeGraphDetails from './KnowledgeGraphDetails';

jest.mock('../../../utils/EntityLinkUtils', () => ({
  getEntityLinkFromType: jest.fn().mockReturnValue('/test/entity/path'),
}));

const props: ComponentProps<typeof KnowledgeGraphDetails> = {
  drawer: 'columns',
  mode: 'knowledge-graph',
  data: { nodes: [], edges: [] },
  columns: {
    columns: Array.from({ length: 300 }, (_, index) => ({
      name: 'column_' + String(index).padStart(3, '0'),
      dataType: 'VARCHAR',
    })) as Column[],
    total: 300,
    loading: false,
    error: null,
    loadMore: jest.fn(),
  },
  coverage: new Map(),
  onDrawerChange: jest.fn(),
  onSelect: jest.fn(),
  onClose: jest.fn(),
  onRetry: jest.fn(),
};
const openDetails = (changes: Partial<typeof props> = {}) =>
  render(
    <ThemeProvider>
      <KnowledgeGraphDetails {...props} {...changes} />
    </ThemeProvider>
  );

beforeEach(() => jest.useRealTimers());

// TableV2's react-aria row materialisation is heavy for 300 rows in jsdom
// (~15s) — the default 5s Jest timeout is enough in the browser but too tight
// here. The real E2E path is covered by the KG Playwright suite.
it('pages and searches all loaded columns without declaring uninspected columns unmapped', async () => {
  openDetails();
  const grid = screen.getByRole('grid');

  expect(within(grid).getByText('column_000')).toBeVisible();
  expect(within(grid).queryByText('column_040')).not.toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: /label.kg-show-more/ })
  );

  expect(within(grid).getByText('column_040')).toBeVisible();

  await userEvent.type(
    screen.getByRole('textbox', { name: 'label.search' }),
    'column_299'
  );

  expect(within(grid).getByText('column_299')).toBeVisible();
  expect(within(grid).getByText('label.kg-unknown')).toBeVisible();
  expect(within(grid).queryByText('label.kg-unmapped')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /label.kg-show-more/ })
  ).not.toBeInTheDocument();
}, 30_000);

it('lists the gaps first, names what is missing and links to the asset to fix it', async () => {
  openDetails({
    drawer: 'coverage',
    data: {
      nodes: [
        {
          id: 'mapped',
          label: 'orders',
          type: 'table',
          fullyQualifiedName: 'svc.db.sales.orders',
        },
        {
          id: 'gap',
          label: 'customers',
          type: 'table',
          fullyQualifiedName: 'svc.db.sales.customers',
        },
      ],
      edges: [],
    },
    coverage: new Map([
      ['mapped', 'mapped'],
      ['gap', 'unmapped'],
    ]),
  });
  const grid = screen.getByRole('grid');

  expect(within(grid).getByText('customers')).toBeVisible();
  // Mapped assets ('orders') are hidden from the Gaps tab per the designer's
  // review — they are not a gap and belong in Columns.
  expect(within(grid).queryByText('orders')).not.toBeInTheDocument();
  expect(within(grid).getByText('svc.db.sales · label.table')).toBeVisible();
  expect(
    within(grid).getByText('label.kg-missing-glossary-term')
  ).toBeVisible();
  expect(
    within(grid).getByRole('link', { name: 'label.kg-map-glossary-term' })
  ).toHaveAttribute('href', '/test/entity/path');
  // The chip row surfaces only Unmapped + Not explored; there is no All or
  // Mapped chip on the Gaps tab anymore.
  expect(
    screen.queryByRole('button', { name: /label.all/ })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /label.kg-mapped/ })
  ).not.toBeInTheDocument();
});

it('shows actual property types and distinguishes functional declarations from unspecified cardinality', () => {
  openDetails({
    mode: 'ontology',
    data: {
      nodes: [
        { id: 'customer', label: 'Customer', type: 'ontologyConcept' },
        {
          id: 'id',
          label: 'customerId',
          type: 'property',
          ontologyProperty: { range: 'STRING', functional: true },
        },
        {
          id: 'email',
          label: 'emailAddress',
          type: 'property',
          ontologyProperty: {
            range: 'http://www.w3.org/2001/XMLSchema#string',
            functional: false,
          },
        },
      ],
      edges: [
        {
          from: 'id',
          to: 'customer',
          label: 'domain',
          relationType: 'http://www.w3.org/2000/01/rdf-schema#domain',
        },
        {
          from: 'email',
          to: 'customer',
          label: 'domain',
          relationType: 'http://www.w3.org/2000/01/rdf-schema#domain',
        },
      ],
    },
  });
  const grid = screen.getByRole('grid');
  const id = within(grid).getByRole('row', { name: /customerId/ });
  const email = within(grid).getByRole('row', { name: /emailAddress/ });

  expect(id).toHaveTextContent('label.kg-at-most-one');
  expect(email).toHaveTextContent('http://www.w3.org/2001/XMLSchema#string');
  expect(email).toHaveTextContent('label.kg-not-declared');
});

it('navigates to the property returned by the graph', async () => {
  const onSelect = jest.fn();
  openDetails({
    mode: 'ontology',
    onSelect,
    data: {
      nodes: [
        { id: 'person', label: 'Person', type: 'glossaryTerm' },
        { id: 'customer', label: 'Customer', type: 'glossaryTerm' },
        {
          id: 'kg:property:person:birthDate',
          label: 'birthDate',
          type: 'property',
        },
      ],
      edges: [],
    },
  });
  const grid = screen.getByRole('grid');

  await userEvent.click(within(grid).getByRole('row', { name: /birthDate/ }));

  expect(onSelect).toHaveBeenCalledWith('node', 'kg:property:person:birthDate');
});

it('shows tags and glossary terms as chips, capped at five until expanded, without selecting the row', async () => {
  const onSelect = jest.fn();
  const terms = ['Account', 'Branch', 'Customer', 'Employee', 'Testing', 'CLV'];
  openDetails({
    onSelect,
    data: {
      nodes: [
        {
          id: 'col',
          label: 'customer',
          type: 'column',
          fullyQualifiedName: 'svc.db.sales.orders.customer',
        },
      ],
      edges: [],
    },
    columns: {
      ...props.columns,
      columns: [
        {
          name: 'customer',
          fullyQualifiedName: 'svc.db.sales.orders.customer',
          dataType: 'VARCHAR',
          dataTypeDisplay: 'varchar',
          tags: [
            ...terms.map((name) => ({
              tagFQN: 'Glossary.' + name,
              name,
              source: 'Glossary',
            })),
            {
              tagFQN: 'PII.Sensitive',
              name: 'Sensitive',
              source: 'Classification',
            },
          ],
        },
      ] as Column[],
      total: 1,
    },
  });
  const grid = screen.getByRole('grid');

  expect(within(grid).getByText('varchar')).toBeVisible();
  expect(within(grid).getByText('Sensitive')).toBeVisible();
  expect(within(grid).getByText('Testing')).toBeVisible();
  expect(within(grid).queryByText('CLV')).not.toBeInTheDocument();

  await userEvent.click(
    within(grid).getByRole('button', { name: 'label.kg-more-count' })
  );

  expect(within(grid).getByText('CLV')).toBeVisible();
  expect(onSelect).not.toHaveBeenCalled();
});

it('hides the paging footer when every row is already shown', () => {
  openDetails({
    columns: {
      ...props.columns,
      columns: props.columns.columns.slice(0, 3),
      total: 3,
    },
  });

  expect(screen.queryByText('label.kg-list-count')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /label.kg-show-more/ })
  ).not.toBeInTheDocument();
});
