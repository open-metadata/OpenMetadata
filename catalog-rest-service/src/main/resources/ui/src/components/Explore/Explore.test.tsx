/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { findAllByTestId, findByTestId, render } from '@testing-library/react';
import { SearchResponse } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { mockResponse } from './exlore.mock';
import Explore from './Explore.component';
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn().mockImplementation(() => ({ search: '' })),
}));

jest.mock('../../utils/FilterUtils', () => ({
  getFilterString: jest.fn().mockImplementation(() => 'user.address'),
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

const handleSearchText = jest.fn();
const updateTableCount = jest.fn();
const updateTopicCount = jest.fn();
const updateDashboardCount = jest.fn();
const updatePipelineCount = jest.fn();
const handlePathChange = jest.fn();
const fetchData = jest.fn();

const mockSearchResult = {
  resSearchResults: mockResponse as unknown as SearchResponse,
  resAggServiceType: mockResponse as unknown as SearchResponse,
  resAggTier: mockResponse as unknown as SearchResponse,
  resAggTag: mockResponse as unknown as SearchResponse,
};

describe('Test Explore component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <Explore
        error=""
        fetchData={fetchData}
        handlePathChange={handlePathChange}
        handleSearchText={handleSearchText}
        searchQuery=""
        searchResult={mockSearchResult}
        searchText=""
        sortValue=""
        tab=""
        tabCounts={{
          table: 15,
          topic: 2,
          dashboard: 8,
          pipeline: 5,
        }}
        updateDashboardCount={updateDashboardCount}
        updatePipelineCount={updatePipelineCount}
        updateTableCount={updateTableCount}
        updateTopicCount={updateTopicCount}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const pageContainer = await findByTestId(container, 'fluid-container');
    const searchData = await findByTestId(container, 'search-data');
    const wrappedContent = await findByTestId(container, 'wrapped-content');
    const tabs = await findAllByTestId(container, 'tab');

    expect(pageContainer).toBeInTheDocument();
    expect(searchData).toBeInTheDocument();
    expect(wrappedContent).toBeInTheDocument();
    expect(tabs.length).toBe(4);
  });
});
