/*
 *  Copyright 2023 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { MOCK_DOMAIN } from '../../../../mocks/Domains.mock';
import DocumentationTab from './DocumentationTab.component';

// Mock the onUpdate function
const mockOnUpdate = jest.fn();

const defaultProps = {
  domain: MOCK_DOMAIN,
  onUpdate: mockOnUpdate,
  isVersionsView: false,
};

jest.mock('../../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>DescriptionV1</div>);
});

jest.mock('../../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<>ProfilePicture</>)
);

jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

describe('DocumentationTab', () => {
  it('should render the initial content', () => {
    const { getByTestId } = render(<DocumentationTab {...defaultProps} />, {
      wrapper: MemoryRouter,
    });
    const description = screen.getByText('DescriptionV1');

    expect(description).toBeInTheDocument();

    const editOwnerButton = getByTestId('edit-owner');

    expect(editOwnerButton).toBeInTheDocument();

    const ownerName = getByTestId('domain-owner-name');

    expect(ownerName).toHaveTextContent('Aaron Singh');

    const addExpertButton = getByTestId('label.add');

    expect(addExpertButton).toBeInTheDocument();

    const domainTypeLabel = getByTestId('domain-type-label');

    expect(domainTypeLabel).toHaveTextContent('Aggregate');
  });
});
