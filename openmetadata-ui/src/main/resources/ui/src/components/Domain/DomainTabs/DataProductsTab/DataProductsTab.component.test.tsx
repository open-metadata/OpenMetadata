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
import { render, screen } from '@testing-library/react';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { searchQuery } from '../../../../rest/searchAPI';
import DataProductsTab from './DataProductsTab.component';

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'Commerce' }),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel }) => firstPanel.children)
);

jest.mock('../../../ExploreV1/ExploreSearchCard/ExploreSearchCard', () =>
  jest
    .fn()
    .mockImplementation(({ hideBreadcrumbs }) => (
      <div data-hide-breadcrumbs={hideBreadcrumbs} data-testid="data-product" />
    ))
);

const mockSearchQuery = searchQuery as jest.Mock;

describe('DataProductsTab', () => {
  beforeEach(() => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'data-product-id',
              name: 'orders',
              fullyQualifiedName: 'Commerce.orders',
              domains: [
                {
                  id: 'domain-id',
                  name: 'Commerce',
                  fullyQualifiedName: 'Commerce',
                  type: 'domain',
                },
              ],
            },
          },
        ],
        total: { value: 1 },
      },
    });
  });

  it('hides redundant domain breadcrumbs in the domain data product list', async () => {
    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        onAddDataProduct={jest.fn()}
      />
    );

    expect(await screen.findByTestId('data-product')).toHaveAttribute(
      'data-hide-breadcrumbs',
      'true'
    );
  });
});
