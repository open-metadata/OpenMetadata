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
import React from 'react';
import { MemoryRouter } from 'react-router';
import ExplorePage from './index';
import { mockResponse } from './index.mock';
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => ({ searchQuery: '' })),
  useLocation: jest.fn().mockImplementation(() => ({ search: '' })),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockResponse })),
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

jest.mock('../../hooks/useToastContext', () => {
  return () => jest.fn();
});

describe('Test Explore page', () => {
  it('Component should render', async () => {
    const { container } = render(<ExplorePage />, {
      wrapper: MemoryRouter,
    });
    const searchData = await findByTestId(container, 'search-data');
    const wrappedContent = await findByTestId(container, 'wrapped-content');
    const tabs = await findAllByTestId(container, 'tab');

    expect(searchData).toBeInTheDocument();
    expect(wrappedContent).toBeInTheDocument();
    expect(tabs.length).toBe(4);
  });
});
