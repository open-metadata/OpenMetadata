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
import MarketplaceSearchInput from './MarketplaceSearchInput.component';

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

const PLACEHOLDER = 'Search marketplace';

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

const renderInput = (
  onSearchChange?: (value: string) => void,
  listProps: { searchQuery?: string; onRefresh?: () => void } = {}
) =>
  render(
    <MemoryRouter>
      <MarketplaceSearchInput
        placeholder={PLACEHOLDER}
        onSearchChange={onSearchChange}
        {...listProps}
      />
    </MemoryRouter>
  );

const type = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
    target: { value },
  });

// Longer than any debounce in the input, so a push that was going to happen has.
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

describe('MarketplaceSearchInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery.mockResolvedValue({ hits: { hits: [domainHit] } });
    mockNlqSearch.mockResolvedValue({ hits: { hits: [domainHit] } });
    setNlq(false);
  });

  it('shows matching entities on the overview as the user types, and opens a pick', async () => {
    renderInput();

    type('fin');
    await settle();

    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'fin' })
    );

    fireEvent.click(screen.getByTestId('search-result-domain-d1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('Finance'),
      { state: { fromMarketplace: true } }
    );
  });

  it('runs an NLQ search on the overview only on Enter', async () => {
    setNlq(true);
    renderInput();

    type('domains owned by finance');
    await settle();

    expect(mockNlqSearch).not.toHaveBeenCalled();

    await submit();

    expect(mockNlqSearch).toHaveBeenCalledTimes(1);
    expect(mockNlqSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'domains owned by finance' })
    );
  });

  it('does not run a search when the NLQ toggle is switched on', async () => {
    renderInput();

    type('fin');
    await settle();

    expect(mockSearchQuery).toHaveBeenCalledTimes(2);

    await act(async () => {
      fireEvent.click(screen.getByTestId('explore-nlp-toggle'));
    });
    await settle();

    expect(mockNlqSearch).not.toHaveBeenCalled();
    expect(mockSearchQuery).toHaveBeenCalledTimes(2);
  });

  it('filters a list page as the user types, with no popover of its own', async () => {
    const onSearchChange = jest.fn();
    renderInput(onSearchChange);

    type('fin');
    await settle();

    expect(onSearchChange).toHaveBeenCalledWith('fin');
    expect(mockSearchQuery).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('search-result-domain-d1')
    ).not.toBeInTheDocument();
  });

  it('filters a list page only on Enter while NLQ is on', async () => {
    setNlq(true);
    const onSearchChange = jest.fn();
    renderInput(onSearchChange);

    type('domains owned by finance');
    await settle();

    expect(onSearchChange).not.toHaveBeenCalled();

    await submit();

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('domains owned by finance');
  });

  it('re-runs the list query on Enter when the text is unchanged', async () => {
    // e.g. the list was filtered by keyword, then NLQ was switched on.
    setNlq(true);
    const onSearchChange = jest.fn();
    const onRefresh = jest.fn();
    renderInput(onSearchChange, { searchQuery: 'finance', onRefresh });

    await submit();

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onSearchChange).not.toHaveBeenCalled();
  });
});
