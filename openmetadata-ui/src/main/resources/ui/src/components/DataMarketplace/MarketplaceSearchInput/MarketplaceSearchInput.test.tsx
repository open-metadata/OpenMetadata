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

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import MarketplaceSearchInput from './MarketplaceSearchInput.component';

interface ResultsProps {
  onDataProductClick: (dataProduct: DataProduct) => void;
  onDomainClick: (domain: Domain) => void;
}

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useSearchStore', () => ({
  useSearchStore: () => ({
    isNLPEnabled: true,
    isNLPActive: false,
    setNLPActive: jest.fn(),
    initNLP: jest.fn(),
  }),
}));

// `getDomainDetailsPath` reads the store statically, so the mock needs
// `getState` as well as the hook call.
const marketplaceState = {
  dataProductBasePath: '/dataProduct',
  domainBasePath: '/domain',
  isMarketplace: true,
};
jest.mock('../../../hooks/useMarketplaceStore', () => ({
  useMarketplaceStore: Object.assign(() => marketplaceState, {
    getState: () => marketplaceState,
  }),
}));

const dataProduct = {
  id: 'dp1',
  name: 'Customer 360',
  fullyQualifiedName: 'dp.c360',
} as DataProduct;
const domain = {
  id: 'd1',
  name: 'Finance',
  fullyQualifiedName: 'Finance',
} as Domain;

jest.mock('../MarketplaceSearchResults/useMarketplaceEntitySearch', () => ({
  useMarketplaceEntitySearch: () => ({
    dataProducts: [dataProduct],
    domains: [domain],
    isSearching: false,
  }),
}));

// Stand-in for the results list: exposes one button per entity so a click can
// be routed through the real handlers.
jest.mock(
  '../MarketplaceSearchResults/MarketplaceSearchResults.component',
  () => ({
    __esModule: true,
    default: ({ onDataProductClick, onDomainClick }: ResultsProps) => (
      <div>
        <button
          data-testid="pick-data-product"
          onClick={() => onDataProductClick(dataProduct)}>
          dp
        </button>
        <button data-testid="pick-domain" onClick={() => onDomainClick(domain)}>
          domain
        </button>
      </div>
    ),
  })
);

jest.mock('../../discovery/explore/ExploreHeader/ExploreSearchInput', () => ({
  ExploreSearchInput: ({ suggestions }: { suggestions: ReactNode }) => (
    <div>{suggestions}</div>
  ),
}));

const renderInput = (props: {
  searchCriteria: SearchIndex;
  onSearchChange?: (value: string) => void;
}) =>
  render(
    <MemoryRouter>
      <MarketplaceSearchInput showEntityResults {...props} />
    </MemoryRouter>
  );

describe('MarketplaceSearchInput', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens a pick rather than filtering the page list, as Explore does', () => {
    const onSearchChange = jest.fn();
    renderInput({ searchCriteria: SearchIndex.DOMAIN, onSearchChange });

    fireEvent.click(screen.getByTestId('pick-domain'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/domain/Finance',
      expect.objectContaining({ state: { fromMarketplace: true } })
    );
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it('opens every pick on a page with no list', () => {
    renderInput({ searchCriteria: SearchIndex.MARKETPLACE });

    fireEvent.click(screen.getByTestId('pick-domain'));

    expect(mockNavigate).toHaveBeenCalled();
  });
});
