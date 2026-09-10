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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

  it('explains when no asset realizes the concept', () => {
    render(<OntologyConceptRealization realizations={[]} />);

    expect(screen.getByTestId('ontology-realizations')).toHaveTextContent(
      'message.no-concept-realization'
    );
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
    fireEvent.change(
      within(screen.getByTestId('realization-asset-input')).getByRole(
        'textbox'
      ),
      { target: { value: 'fact' } }
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('realization-candidate-fact_orders')
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('realization-candidate-fact_orders'));
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
