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

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/ExploreV1/ExploreV1.component', () => {
  return jest.fn().mockReturnValue(<p>ExploreV1</p>);
});

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    searchCriteria: '',
  })),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest
    .fn()
    .mockImplementation(() => ({ pathname: 'pathname', search: '' }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => {
    return {
      tab: 'tables',
    };
  }),
  useNavigate: jest.fn(),
}));

const mockProps = {
  pageTitle: 'explore',
};

describe('ExplorePageV1', () => {
  it('renders without crashing', async () => {
    render(<ExplorePageV1 {...mockProps} />);

    expect(await screen.findByText('ExploreV1')).toBeInTheDocument();
  });
});
