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
import { ThemeProvider } from '../../context/UntitledUIThemeProvider/theme-provider';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Column } from '../../generated/entity/data/table';
import KnowledgeGraphDetails from './KnowledgeGraphDetails';

jest.mock('../../utils/EntityLinkUtils', () => ({
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
  concepts: { terms: [], loading: false, error: null, partial: false },
  coverage: new Map(),
  coverageMode: 'all',
  onCoverageMode: jest.fn(),
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
});

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
  expect(within(grid).queryByText('orders')).not.toBeInTheDocument();
  expect(within(grid).getByText('svc.db.sales · label.table')).toBeVisible();
  expect(within(grid).getByText('label.kg-no-glossary-term')).toBeVisible();
  expect(
    within(grid).getByRole('link', { name: 'label.kg-map-glossary-term' })
  ).toHaveAttribute('href', '/test/entity/path');

  await userEvent.click(screen.getByRole('button', { name: /label.all/ }));

  expect(within(grid).getByText('orders')).toBeVisible();
  expect(within(grid).getByText('label.kg-mapped')).toBeVisible();
});

it('shows actual property types and distinguishes functional declarations from unspecified cardinality', () => {
  openDetails({
    mode: 'ontology',
    concepts: {
      terms: [
        {
          id: 'customer',
          name: 'Customer',
          attributes: [
            {
              id: 'id',
              name: 'customerId',
              dataType: 'STRING',
              isIdentifier: true,
            },
            {
              id: 'email',
              name: 'emailAddress',
              dataType: 'STRING',
              datatypeIri: 'http://www.w3.org/2001/XMLSchema#string',
            },
          ],
        },
      ] as GlossaryTerm[],
      loading: false,
      error: null,
      partial: false,
    },
  });
  const grid = screen.getByRole('grid');
  const id = within(grid).getByRole('row', { name: /customerId/ });
  const email = within(grid).getByRole('row', { name: /emailAddress/ });

  expect(id).toHaveTextContent('label.kg-at-most-one');
  expect(email).toHaveTextContent('http://www.w3.org/2001/XMLSchema#string');
  expect(email).toHaveTextContent('label.kg-not-declared');
});
