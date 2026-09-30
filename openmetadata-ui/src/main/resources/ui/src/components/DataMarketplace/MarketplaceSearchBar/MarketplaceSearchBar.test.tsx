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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { nlqSearch, searchQuery } from '../../../rest/searchAPI';
import MarketplaceSearchBar from './MarketplaceSearchBar.component';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../rest/searchAPI', () => ({
  getNLPEnabledStatus: jest.fn().mockResolvedValue(true),
  nlqSearch: jest.fn(),
  searchQuery: jest.fn(),
}));

const mockAddSearch = jest.fn();
jest.mock('../../../hooks/useMarketplaceRecentSearches', () => ({
  useMarketplaceRecentSearches: () => ({ addSearch: mockAddSearch }),
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

const dataProductHit = {
  _source: {
    id: 'dp1',
    name: 'Orders',
    fullyQualifiedName: 'Orders',
    entityType: 'dataProduct',
  },
};
const domainHit = {
  _source: {
    id: 'd1',
    name: 'Finance',
    fullyQualifiedName: 'Finance',
    entityType: 'domain',
  },
};

const mockSearchQuery = searchQuery as jest.Mock;
const mockNlqSearch = nlqSearch as jest.Mock;

const renderBar = (props: { isEditView?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <MarketplaceSearchBar {...props} />
    </MemoryRouter>
  );

// The testid sits on the Input wrapper, so query the real field by role.
const input = () => screen.getByRole('textbox');

const type = (value: string) =>
  fireEvent.change(input(), { target: { value } });

// Longer than the bar's 400ms debounce, so a search that was going to run has.
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(1000);
  });

const submit = () =>
  act(async () => {
    fireEvent.submit(screen.getByTestId('explore-search-form'));
  });

const setNlq = (isNLPActive: boolean) =>
  useSearchStore.setState({
    isNLPEnabled: true,
    isNLPActive,
    isNLPInitialized: true,
  });

describe('MarketplaceSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [dataProductHit, domainHit] },
    });
    mockNlqSearch.mockResolvedValue({
      hits: { hits: [dataProductHit, domainHit] },
    });
    setNlq(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders Explore search chrome with the marketplace placeholder', () => {
    renderBar();

    expect(screen.getByTestId('explore-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('explore-search-form')).toBeInTheDocument();
  });

  it('shows the NLQ toggle when NLP is enabled', () => {
    renderBar();

    expect(screen.getByTestId('explore-nlp-toggle')).toBeInTheDocument();
  });

  it('shows the Cmd/K hint for the global Ask Collate shortcut', () => {
    renderBar();

    expect(screen.getByTestId('explore-search-shortcut')).toBeInTheDocument();
  });

  it('searches data products and domains as the user types', async () => {
    renderBar();

    type('finance');
    await settle();

    expect(mockSearchQuery).toHaveBeenCalled();
    expect(mockNlqSearch).not.toHaveBeenCalled();
  });

  it('runs NLQ only on submit while the toggle is on', async () => {
    setNlq(true);
    renderBar();

    type('who owns finance');
    await settle();

    // Typing must not spend an LLM call.
    expect(mockNlqSearch).not.toHaveBeenCalled();

    await submit();

    expect(mockNlqSearch).toHaveBeenCalled();
  });

  it('does not run a pending keyword search as NLQ when the toggle flips', async () => {
    renderBar();

    type('finance');

    await act(async () => {
      fireEvent.click(screen.getByTestId('explore-nlp-toggle'));
    });
    await settle();

    expect(mockNlqSearch).not.toHaveBeenCalled();
  });

  it('shows matching results in the popover', async () => {
    renderBar();

    type('finance');
    await settle();

    expect(screen.getByTestId('search-result-dp-dp1')).toBeInTheDocument();
    expect(screen.getByTestId('search-result-domain-d1')).toBeInTheDocument();
  });

  it('opens a data product when its result is picked', async () => {
    renderBar();

    type('orders');
    await settle();

    fireEvent.click(screen.getByTestId('search-result-dp-dp1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('Orders'),
      expect.objectContaining({ state: { fromMarketplace: true } })
    );
  });

  it('opens a domain when its result is picked', async () => {
    renderBar();

    type('finance');
    await settle();

    fireEvent.click(screen.getByTestId('search-result-domain-d1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('Finance'),
      expect.objectContaining({ state: { fromMarketplace: true } })
    );
  });

  it('shows the empty message when nothing matches', async () => {
    mockSearchQuery.mockResolvedValue({ hits: { hits: [] } });
    renderBar();

    type('zzz');
    await settle();

    expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
  });

  it('records the query in recent searches on submit', async () => {
    renderBar();

    type('finance');
    await submit();

    expect(mockAddSearch).toHaveBeenCalledWith('finance');
  });

  it('closes the popover and drops results when cleared', async () => {
    renderBar();

    type('finance');
    await settle();

    expect(screen.getByTestId('search-result-domain-d1')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('explore-clear-search-button'));
    });

    expect(
      screen.queryByTestId('search-result-domain-d1')
    ).not.toBeInTheDocument();
  });

  it('renders read-only in edit view', () => {
    renderBar({ isEditView: true });

    expect(input()).toBeDisabled();
  });

  it('keeps the popover shut while the input is empty', async () => {
    renderBar();

    type('');
    await settle();

    expect(
      screen.queryByTestId('search-result-domain-d1')
    ).not.toBeInTheDocument();
  });

  it('swallows a search failure instead of surfacing it', async () => {
    mockSearchQuery.mockRejectedValue(new Error('boom'));
    renderBar();

    type('finance');
    await settle();

    expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
  });
});
