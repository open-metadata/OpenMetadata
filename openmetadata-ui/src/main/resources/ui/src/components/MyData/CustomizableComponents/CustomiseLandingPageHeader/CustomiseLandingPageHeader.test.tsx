/*
 *  Copyright 2025 Collate.
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
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useSearchStore } from '../../../../hooks/useSearchStore';
import { getRecentlyViewedData } from '../../../../utils/CommonUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import CustomiseLandingPageHeader from './CustomiseLandingPageHeader';

jest.mock('../../../../hooks/useApplicationStore');
jest.mock('../../../../hooks/useSearchStore');
jest.mock('../../../../utils/ServiceUtilClassBase');
jest.mock('../../../../utils/CommonUtils');

// Create typed mocks
const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;
const mockUseSearchStore = useSearchStore as jest.MockedFunction<
  typeof useSearchStore
>;
const mockGetRecentlyViewedData = getRecentlyViewedData as jest.MockedFunction<
  typeof getRecentlyViewedData
>;
const mockServiceUtilClassBase = serviceUtilClassBase as jest.Mocked<
  typeof serviceUtilClassBase
>;

const mockCurrentUser = {
  id: '1',
  name: 'testuser',
  displayName: 'Test User',
  email: 'test@example.com',
};

describe('CustomiseLandingPageHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default mock implementations
    mockUseApplicationStore.mockReturnValue({
      currentUser: mockCurrentUser,
    });

    mockUseSearchStore.mockReturnValue({
      isNLPEnabled: false,
    });

    mockGetRecentlyViewedData.mockReturnValue([]);

    mockServiceUtilClassBase.getServiceTypeLogo.mockReturnValue(
      'test-logo.png'
    );
  });

  it('should render the component', () => {
    render(<CustomiseLandingPageHeader />);

    expect(screen.getByText('label.welcome')).toBeInTheDocument();
    expect(screen.getByTestId('customise-header-btn')).toBeInTheDocument();
    expect(screen.getByTestId('domain-selector')).toBeInTheDocument();
  });

  it('should display welcome message with user name when displayName is not available', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { ...mockCurrentUser, displayName: undefined },
    });

    render(<CustomiseLandingPageHeader />);

    expect(screen.getByText('label.welcome')).toBeInTheDocument();
  });

  it('should render the customise header button', () => {
    render(<CustomiseLandingPageHeader />);

    expect(screen.getByTestId('customise-header-btn')).toBeInTheDocument();
  });

  it('should render the search input with correct placeholder', () => {
    render(<CustomiseLandingPageHeader />);

    const searchInput = screen.getByTestId('customise-searchbox');

    expect(searchInput).toBeInTheDocument();
  });

  it('should render the domain selector', () => {
    render(<CustomiseLandingPageHeader />);

    expect(screen.getByTestId('domain-selector')).toBeInTheDocument();
    expect(screen.getByTestId('domain-icon')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-icon')).toBeInTheDocument();
  });

  it('should hide suggestions icon when NLP is enabled', () => {
    mockUseSearchStore.mockReturnValue({
      isNLPEnabled: true,
    });

    render(<CustomiseLandingPageHeader />);

    expect(screen.queryByTestId('suggestions-icon')).not.toBeInTheDocument();
  });
});
