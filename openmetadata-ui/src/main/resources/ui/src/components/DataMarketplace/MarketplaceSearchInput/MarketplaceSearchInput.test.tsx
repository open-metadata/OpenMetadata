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
  onSearchChange: (value: string) => void,
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

const pressEnter = () =>
  act(async () => {
    fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), {
      key: 'Enter',
    });
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
    jest.useFakeTimers();
    mockSearchQuery.mockResolvedValue({ hits: { hits: [domainHit] } });
    mockNlqSearch.mockResolvedValue({ hits: { hits: [domainHit] } });
    setNlq(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('filters the list as the user types', async () => {
    const onSearchChange = jest.fn();
    renderInput(onSearchChange);

    type('finance');
    await settle();

    expect(onSearchChange).toHaveBeenCalledWith('finance');
    expect(mockNlqSearch).not.toHaveBeenCalled();
  });

  it('previews the entities a query also matches, and opens a pick', async () => {
    renderInput(jest.fn());

    type('finance');
    await settle();

    fireEvent.click(screen.getByTestId('search-result-domain-d1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('Finance'),
      expect.objectContaining({ state: { fromMarketplace: true } })
    );
  });

  it('filters only on Enter while NLQ is on', async () => {
    const onSearchChange = jest.fn();
    setNlq(true);
    renderInput(onSearchChange);

    type('who owns finance');
    await settle();

    // Typing must not spend an LLM call.
    expect(onSearchChange).not.toHaveBeenCalled();

    await pressEnter();

    expect(onSearchChange).toHaveBeenCalledWith('who owns finance');
  });

  it('re-runs the list query on Enter when the text is unchanged', async () => {
    const onSearchChange = jest.fn();
    const onRefresh = jest.fn();
    setNlq(true);
    renderInput(onSearchChange, { searchQuery: 'finance', onRefresh });

    await pressEnter();

    expect(onRefresh).toHaveBeenCalled();
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it('does not run a search merely because the NLQ toggle was switched on', async () => {
    renderInput(jest.fn());

    await act(async () => {
      fireEvent.click(screen.getByTestId('marketplace-nlq-toggle'));
    });
    await settle();

    expect(mockNlqSearch).not.toHaveBeenCalled();
  });
});
