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
import { getRecentlyViewedData } from '../../../../utils/CommonUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import CustomiseLandingPageHeader from './CustomiseLandingPageHeader';

jest.mock('../../../../hooks/useApplicationStore');
jest.mock('../../../../utils/ServiceUtilClassBase');
jest.mock('../../../../utils/CommonUtils');

// Create typed mocks
const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
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

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({
    pathname: '/explore',
    search: '',
    state: undefined,
    key: '',
    hash: '',
  }),
  useNavigate: () => mockNavigate,
}));

describe('CustomiseLandingPageHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default mock implementations
    mockUseApplicationStore.mockReturnValue({
      currentUser: mockCurrentUser,
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
    expect(screen.getByTestId('domain-dropdown')).toBeInTheDocument();
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

  it('should render the domain selector', () => {
    render(<CustomiseLandingPageHeader />);

    expect(screen.getByTestId('domain-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('domain-icon')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-icon')).toBeInTheDocument();
  });

  it('should render recently viewed data when available', () => {
    const mockRecentlyViewedData = [
      {
        id: '1',
        displayName: 'Test Table',
        entityType: 'table',
        fqn: 'test.table',
        timestamp: Date.now(),
        service: { displayName: 'Test Service' },
      },
    ];

    mockGetRecentlyViewedData.mockReturnValue(mockRecentlyViewedData);

    render(<CustomiseLandingPageHeader />);

    expect(screen.getByText('Test Table')).toBeInTheDocument();
  });

  it('should not render recently viewed data when empty', () => {
    mockGetRecentlyViewedData.mockReturnValue([]);

    render(<CustomiseLandingPageHeader />);

    expect(screen.queryByText('Test Table')).not.toBeInTheDocument();
  });

  it('should hide customise button when hideCustomiseButton is true', () => {
    render(<CustomiseLandingPageHeader hideCustomiseButton />);

    expect(
      screen.queryByTestId('customise-header-btn')
    ).not.toBeInTheDocument();
  });

  it('should show customise button when hideCustomiseButton is false', () => {
    render(<CustomiseLandingPageHeader hideCustomiseButton={false} />);

    expect(screen.getByTestId('customise-header-btn')).toBeInTheDocument();
  });
});
