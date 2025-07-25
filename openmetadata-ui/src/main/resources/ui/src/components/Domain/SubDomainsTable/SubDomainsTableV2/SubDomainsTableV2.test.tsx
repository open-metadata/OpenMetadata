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
import { BrowserRouter } from 'react-router-dom';
import { Domain } from '../../../../generated/entity/domains/domain';
import SubDomainsTableV2 from './SubDomainsTableV2.component';

const mockSubDomains: Domain[] = [
  {
    id: '1',
    name: 'test-subdomain-1',
    displayName: 'Test SubDomain 1',
    description: 'Test description for subdomain 1',
    fullyQualifiedName: 'test.subdomain.1',
  },
  {
    id: '2',
    name: 'test-subdomain-2',
    displayName: 'Test SubDomain 2',
    description: 'Test description for subdomain 2',
    fullyQualifiedName: 'test.subdomain.2',
  },
] as Domain[];

const mockPermissions = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

const mockOnAddSubDomain = jest.fn();

const renderComponent = (props = {}) => {
  const defaultProps = {
    subDomains: mockSubDomains,
    isLoading: false,
    permissions: mockPermissions,
    onAddSubDomain: mockOnAddSubDomain,
    ...props,
  };

  return render(
    <BrowserRouter>
      <SubDomainsTableV2 {...defaultProps} />
    </BrowserRouter>
  );
};

jest.mock('../../../common/EntityTable/EntityTable.component', () => {
  return jest.fn(() => (
    <div data-testid="entity-table">Mocked EntityTable</div>
  ));
});

describe('SubDomainsTableV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    renderComponent();

    expect(screen.getByTestId('entity-table')).toBeInTheDocument();
  });

  it('should render with loading state', () => {
    renderComponent({ isLoading: true });

    expect(screen.getByTestId('entity-table')).toBeInTheDocument();
  });

  it('should render with empty subdomains', () => {
    renderComponent({ subDomains: [] });

    expect(screen.getByTestId('entity-table')).toBeInTheDocument();
  });

  it('should handle permissions prop', () => {
    const customPermissions = {
      ...mockPermissions,
      Create: false,
    };

    renderComponent({ permissions: customPermissions });

    expect(screen.getByTestId('entity-table')).toBeInTheDocument();
  });
});
