/*
 *  Copyright 2024 Collate.
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
import React from 'react';
import ExplorePageV1 from './ExplorePageV1.component';

jest.mock(
  '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="advance-search-provider-mock">{children}</div>
    ),
    useAdvanceSearch: jest.fn().mockImplementation(() => ({
      toggleModal: jest.fn(),
      sqlQuery: '',
      onResetAllFilters: jest.fn(),
    })),
  })
);

jest.mock('../../components/ExploreV1/ExploreV1.component', () => {
  return jest.fn().mockReturnValue(<p>ExploreV1</p>);
});

jest.mock('../../components/GlobalSearchProvider/GlobalSearchProvider', () => ({
  useGlobalSearchProvider: jest.fn().mockImplementation(() => ({
    searchCriteria: '',
  })),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({ push: jest.fn(), listen: jest.fn() }),
  useLocation: jest.fn().mockReturnValue({ pathname: 'pathname', search: '' }),
  useParams: jest.fn().mockImplementation(() => {
    return {
      tab: 'tables',
    };
  }),
}));

describe('ExplorePageV1', () => {
  it('renders without crashing', () => {
    render(<ExplorePageV1 />);

    expect(screen.getByText('ExploreV1')).toBeInTheDocument();
  });
});
