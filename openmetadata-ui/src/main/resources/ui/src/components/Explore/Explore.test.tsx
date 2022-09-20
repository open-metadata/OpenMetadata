/*
 *  Copyright 2021 Collate
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

import { findAllByTestId, findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import Explore from './Explore.component';
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest
    .fn()
    .mockImplementation(() => ({ search: '', pathname: '/explore' })),
}));

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../utils/FilterUtils', () => ({
  getFilterString: jest.fn().mockImplementation(() => 'user.address'),
  getFilterCount: jest.fn().mockImplementation(() => 10),
}));

jest.mock('../../components/searched-data/SearchedData', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="search-data">
        <div data-testid="wrapped-content">{children}</div>
      </div>
    ));
});

jest.mock('../../components/common/facetfilter/FacetFilter', () =>
  jest.fn().mockImplementation(() => <div>FacetFilter</div>)
);

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock(
  '../containers/PageLayoutV1',
  () =>
    ({
      children,
      leftPanel,
      rightPanel,
    }: {
      children: React.ReactNode;
      rightPanel: React.ReactNode;
      leftPanel: React.ReactNode;
    }) =>
      (
        <div data-testid="PageLayoutV1">
          <div data-testid="left-panel-content">{leftPanel}</div>
          <div data-testid="right-panel-content">{rightPanel}</div>
          {children}
        </div>
      )
);

const mockFunction = jest.fn();

describe('Test Explore component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <Explore
        isFilterSelected
        fetchCount={mockFunction}
        handleFilterChange={mockFunction}
        handlePathChange={mockFunction}
        handleSearchText={mockFunction}
        handleTabCounts={mockFunction}
        searchQuery=""
        searchText=""
        showDeleted={false}
        sortValue=""
        tab=""
        tabCounts={{
          table: 15,
          topic: 2,
          dashboard: 8,
          pipeline: 5,
          mlmodel: 2,
        }}
        onShowDeleted={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const pageContainer = await findByTestId(container, 'PageLayoutV1');
    const searchData = await findByTestId(container, 'search-data');
    const wrappedContent = await findByTestId(container, 'wrapped-content');
    const tabs = await findAllByTestId(container, /tab/i);

    expect(pageContainer).toBeInTheDocument();
    expect(searchData).toBeInTheDocument();
    expect(wrappedContent).toBeInTheDocument();
    expect(tabs.length).toBe(5);
  });
});
