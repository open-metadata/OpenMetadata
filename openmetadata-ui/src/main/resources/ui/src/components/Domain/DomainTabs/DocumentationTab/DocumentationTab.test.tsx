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
import { MemoryRouter } from 'react-router-dom';
import { MOCK_DOMAIN } from '../../../../mocks/Domains.mock';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import DocumentationTab from './DocumentationTab.component';

// Mock the onUpdate function
const mockOnUpdate = jest.fn();

const defaultProps = {
  domain: MOCK_DOMAIN,
  onUpdate: mockOnUpdate,
  isVersionsView: false,
  permissions: MOCK_PERMISSIONS,
};

jest.mock('../../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>DescriptionV1</div>);
});

jest.mock('../../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<>ProfilePicture</>)
);

jest.mock('../../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    data: MOCK_DOMAIN,
    permissions: {
      ViewAll: true,
      EditAll: true,
    },
  }),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Domain Name'),
}));

jest.mock('../../../../utils/EntityVersionUtils', () => ({
  getEntityVersionByField: jest.fn().mockReturnValue('1'),
}));

jest.mock('../../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockImplementation(() => <div>CustomPropertyTable</div>),
}));

jest.mock('../../../DataAssets/OwnerLabelV2/OwnerLabelV2', () => ({
  OwnerLabelV2: jest.fn().mockImplementation(() => <div>OwnerLabelV2</div>),
}));

jest.mock('../../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock('../../DomainExpertsWidget/DomainExpertWidget', () => ({
  DomainExpertWidget: jest
    .fn()
    .mockImplementation(() => <div>DomainExpertWidget</div>),
}));

jest.mock('../../DomainTypeWidget/DomainTypeWidget', () => ({
  DomainTypeWidget: jest
    .fn()
    .mockImplementation(() => <div>DomainTypeWidget</div>),
}));

describe('DocumentationTab', () => {
  it('should render the initial content', () => {
    render(<DocumentationTab {...defaultProps} />, {
      wrapper: MemoryRouter,
    });
    const description = screen.getByText('DescriptionV1');

    expect(description).toBeInTheDocument();

    expect(screen.getByText('OwnerLabelV2')).toBeInTheDocument();

    expect(screen.getByText('DomainExpertWidget')).toBeInTheDocument();

    expect(screen.getByText('DomainTypeWidget')).toBeInTheDocument();
  });
});
