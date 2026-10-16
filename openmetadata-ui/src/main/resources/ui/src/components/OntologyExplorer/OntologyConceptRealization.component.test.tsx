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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AssetRealization,
  RealizationRole,
} from '../../generated/type/assetRealization';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import { searchQuery } from '../../rest/searchAPI';
import { OntologyConceptRealization } from './OntologyConceptRealization.component';

jest.mock('../../rest/glossaryAPI', () => ({
  patchGlossaryTerm: jest.fn().mockResolvedValue({ id: 'term-1' }),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockPatch = patchGlossaryTerm as jest.MockedFunction<
  typeof patchGlossaryTerm
>;
const TERM_ID = 'aa11bb22-0000-0000-0000-000000000009';

const REALIZATIONS: AssetRealization[] = [
  {
    id: 'realization-1',
    asset: {
      id: 'c1d2e3f4-0000-0000-0000-000000000001',
      type: 'table',
      name: 'customers',
    },
    role: RealizationRole.PrimaryStore,
  },
  {
    id: 'realization-2',
    asset: {
      id: 'c1d2e3f4-0000-0000-0000-000000000002',
      type: 'table',
      name: 'dim_customer',
      displayName: 'Customer Dimension',
    },
    role: RealizationRole.Derived,
  },
];

describe('OntologyConceptRealization', () => {
  it('lists each realizing asset with its role', () => {
    render(<OntologyConceptRealization realizations={REALIZATIONS} />);

    expect(
      screen.getByTestId('concept-realization-customers')
    ).toHaveTextContent('label.primary-store');
    expect(
      screen.getByTestId('concept-realization-dim_customer')
    ).toHaveTextContent('label.derived-copy');
  });

  it('prefers the asset display name when one is set', () => {
    render(<OntologyConceptRealization realizations={REALIZATIONS} />);

    expect(
      screen.getByTestId('concept-realization-dim_customer')
    ).toHaveTextContent('Customer Dimension');
  });

  it('leaves the section out when nothing realizes the concept and it cannot be edited', () => {
    render(<OntologyConceptRealization realizations={[]} />);

    expect(
      screen.queryByTestId('ontology-realizations')
    ).not.toBeInTheDocument();
  });

  it('still offers to add the first realization while editing', () => {
    render(
      <OntologyConceptRealization
        isEditMode
        realizations={[]}
        termId="term-1"
      />
    );

    expect(screen.getByTestId('ontology-realizations')).toHaveTextContent(
      'label.realized-in'
    );
    expect(screen.getByTestId('add-realization')).toBeInTheDocument();
  });

  it('treats a realization with no explicit role as the primary store', () => {
    const withoutRole: AssetRealization[] = [
      { asset: { id: 'asset-1', type: 'table', name: 'orders' } },
    ];

    render(<OntologyConceptRealization realizations={withoutRole} />);

    expect(screen.getByTestId('concept-realization-orders')).toHaveTextContent(
      'label.primary-store'
    );
  });

  it('offers no authoring controls outside edit mode', () => {
    render(
      <OntologyConceptRealization
        realizations={REALIZATIONS}
        termId={TERM_ID}
      />
    );

    expect(screen.queryByTestId('add-realization')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('remove-realization-customers')
    ).not.toBeInTheDocument();
  });

  it('lists tables as soon as the form opens, before anything is typed', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'asset-1',
              name: 'customers',
              fullyQualifiedName: 'svc.db.sch.customers',
            },
          },
        ],
      },
    } as never);

    render(
      <OntologyConceptRealization
        isEditMode
        realizations={[]}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-realization'));

    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ query: '' })
      )
    );

    fireEvent.click(screen.getByTestId('realization-asset-input'));

    expect(await screen.findByText('customers')).toBeInTheDocument();
    expect(
      screen.getByText('svc / db / sch · label.table')
    ).toBeInTheDocument();
  });

  it('adds a searched asset with the chosen role', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'asset-9',
              name: 'fact_orders',
              fullyQualifiedName: 'svc.db.sch.fact_orders',
            },
          },
        ],
      },
    } as never);

    render(
      <OntologyConceptRealization
        isEditMode
        realizations={[]}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-realization'));
    fireEvent.click(screen.getByTestId('realization-asset-input'));
    fireEvent.change(await screen.findByPlaceholderText('label.search'), {
      target: { value: 'fact' },
    });

    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: '*fact*' })
      )
    );

    fireEvent.click(await screen.findByText('fact_orders'));

    expect(screen.getByTestId('realization-asset-input')).toHaveTextContent(
      'fact_orders'
    );

    fireEvent.click(
      screen.getByTestId(`realization-role-${RealizationRole.Derived}`)
    );
    fireEvent.click(screen.getByTestId('save-realization'));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());

    const [, patch] = mockPatch.mock.calls[0];
    const operation = patch[0];

    expect(operation).toMatchObject({ op: 'add', path: '/realizedIn' });

    if (operation.op !== 'add') {
      throw new Error(`Expected add operation, received ${operation.op}`);
    }

    expect(operation.value).toEqual([
      {
        asset: {
          id: 'asset-9',
          type: 'table',
          name: 'fact_orders',
          fullyQualifiedName: 'svc.db.sch.fact_orders',
        },
        role: RealizationRole.Derived,
      },
    ]);
  });

  it('keeps the chosen asset as a full row after searching for another', async () => {
    mockSearchQuery.mockImplementation(
      async (request) =>
        ({
          hits: {
            hits: [
              {
                _source:
                  request.query === '*work*'
                    ? {
                        id: 'asset-2',
                        name: 'work',
                        fullyQualifiedName: 'svc.db.sch.work',
                      }
                    : {
                        id: 'asset-1',
                        name: 'categories',
                        fullyQualifiedName: 'svc.db.sch.categories',
                      },
              },
            ],
          },
        } as never)
    );

    render(
      <OntologyConceptRealization
        isEditMode
        realizations={[]}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-realization'));
    fireEvent.click(screen.getByTestId('realization-asset-input'));
    fireEvent.click(await screen.findByText('categories'));

    fireEvent.click(screen.getByTestId('realization-asset-input'));
    fireEvent.change(await screen.findByPlaceholderText('label.search'), {
      target: { value: 'work' },
    });

    expect(await screen.findByText('work')).toBeInTheDocument();
    expect(screen.getAllByText('svc / db / sch · label.table')).toHaveLength(2);
  });

  it('removes a realization by patching the remaining list', async () => {
    render(
      <OntologyConceptRealization
        isEditMode
        realizations={REALIZATIONS}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('remove-realization-customers'));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());

    const [, patch] = mockPatch.mock.calls[0];
    const operation = patch[0];

    if (operation.op !== 'add') {
      throw new Error(`Expected add operation, received ${operation.op}`);
    }

    expect(operation.value).toHaveLength(REALIZATIONS.length - 1);
  });
});
