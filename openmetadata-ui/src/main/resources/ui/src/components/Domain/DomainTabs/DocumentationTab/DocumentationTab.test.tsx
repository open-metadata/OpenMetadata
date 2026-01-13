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
import { EntityType } from '../../../../enums/entity.enum';
import { MOCK_DOMAIN } from '../../../../mocks/Domains.mock';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { DocumentationEntity } from './DocumentationTab.interface';

// Mock the onUpdate function
const mockOnUpdate = jest.fn();

const defaultProps = {
  domain: MOCK_DOMAIN,
  onUpdate: mockOnUpdate,
  isVersionsView: false,
  permissions: MOCK_PERMISSIONS,
};

const mockDescriptionV1 = jest
  .fn()
  .mockImplementation(() => <div>DescriptionV1</div>);
jest.mock(
  '../../../common/EntityDescription/DescriptionV1',
  () => mockDescriptionV1
);

jest.mock('../../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<>ProfilePicture</>)
);

jest.mock('../../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    data: MOCK_DOMAIN,
    onUpdate: mockOnUpdate,
    permissions: {
      ViewAll: true,
      EditAll: true,
      ViewCustomFields: true,
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

jest.mock('../../../common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ))
);

// Import after mocks are set up
import DocumentationTab from './DocumentationTab.component';

describe('DocumentationTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('should pass DOMAIN entityType to DescriptionV1 when type is DOMAIN', () => {
    render(<DocumentationTab type={DocumentationEntity.DOMAIN} />, {
      wrapper: MemoryRouter,
    });

    expect(mockDescriptionV1).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: EntityType.DOMAIN,
      }),
      expect.any(Object)
    );
  });

  it('should pass DATA_PRODUCT entityType to DescriptionV1 when type is DATA_PRODUCT', () => {
    render(<DocumentationTab type={DocumentationEntity.DATA_PRODUCT} />, {
      wrapper: MemoryRouter,
    });

    expect(mockDescriptionV1).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: EntityType.DATA_PRODUCT,
      }),
      expect.any(Object)
    );
  });

  it('should default to DOMAIN entityType when no type is provided', () => {
    render(<DocumentationTab />, {
      wrapper: MemoryRouter,
    });

    expect(mockDescriptionV1).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: EntityType.DOMAIN,
      }),
      expect.any(Object)
    );
  });

  describe('ViewCustomFields Permission Tests', () => {
    const mockCustomPropertyTable = jest.requireMock(
      '../../../common/CustomPropertyTable/CustomPropertyTable'
    ).CustomPropertyTable;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should pass hasPermission=true to CustomPropertyTable when ViewCustomFields is true', () => {
      const { useGenericContext } = jest.requireMock(
        '../../../Customization/GenericProvider/GenericProvider'
      );
      useGenericContext.mockReturnValue({
        data: MOCK_DOMAIN,
        onUpdate: mockOnUpdate,
        permissions: {
          ViewAll: true,
          EditAll: true,
          ViewCustomFields: true,
        },
      });

      render(<DocumentationTab type={DocumentationEntity.DATA_PRODUCT} />, {
        wrapper: MemoryRouter,
      });

      expect(mockCustomPropertyTable).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPermission: true,
        }),
        expect.any(Object)
      );
    });

    it('should pass hasPermission=false to CustomPropertyTable when ViewCustomFields is false', () => {
      const { useGenericContext } = jest.requireMock(
        '../../../Customization/GenericProvider/GenericProvider'
      );
      useGenericContext.mockReturnValue({
        data: MOCK_DOMAIN,
        onUpdate: mockOnUpdate,
        permissions: {
          ViewAll: true,
          EditAll: true,
          ViewCustomFields: false,
        },
      });

      render(<DocumentationTab type={DocumentationEntity.DATA_PRODUCT} />, {
        wrapper: MemoryRouter,
      });

      expect(mockCustomPropertyTable).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPermission: false,
        }),
        expect.any(Object)
      );
    });

    it('should pass hasPermission=false when ViewCustomFields is undefined', () => {
      const { useGenericContext } = jest.requireMock(
        '../../../Customization/GenericProvider/GenericProvider'
      );
      useGenericContext.mockReturnValue({
        data: MOCK_DOMAIN,
        onUpdate: mockOnUpdate,
        permissions: {
          ViewBasic: true,
          EditAll: true,
        },
      });

      render(<DocumentationTab type={DocumentationEntity.DATA_PRODUCT} />, {
        wrapper: MemoryRouter,
      });

      expect(mockCustomPropertyTable).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPermission: false,
        }),
        expect.any(Object)
      );
    });

    it('should not render CustomPropertyTable for DOMAIN type regardless of ViewCustomFields', () => {
      const { useGenericContext } = jest.requireMock(
        '../../../Customization/GenericProvider/GenericProvider'
      );
      useGenericContext.mockReturnValue({
        data: MOCK_DOMAIN,
        onUpdate: mockOnUpdate,
        permissions: {
          ViewAll: true,
          EditAll: true,
          ViewCustomFields: true,
        },
      });

      render(<DocumentationTab type={DocumentationEntity.DOMAIN} />, {
        wrapper: MemoryRouter,
      });

      expect(mockCustomPropertyTable).not.toHaveBeenCalled();
    });
  });
});
