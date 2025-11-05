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
import { EntityType } from '../../../../enums/entity.enum';
import CustomPropertiesSection from './CustomPropertiesSection';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  )),
}));

// Mock Transi18next component
jest.mock('../../../../utils/CommonUtils', () => ({
  Transi18next: jest
    .fn()
    .mockImplementation(({ i18nKey, renderElement, values }) => (
      <div data-testid="trans-component">
        {i18nKey} - {values?.entity} - {values?.docs}
        {renderElement}
      </div>
    )),
}));

// Mock Loader component
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(({ size }) => (
    <div data-size={size} data-testid="loader">
      Loading...
    </div>
  ));
});

// Mock utility functions
jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityLinkFromType: jest.fn().mockReturnValue('/test-entity-link'),
}));

const mockEntityData = {
  extension: {
    property1: 'value1',
    property2: 'value2',
    property3: ['array', 'value'],
    property4: { name: 'object-name' },
    property5: { value: 'object-value' },
    property6: {
      rows: [
        { col1: 'row1-col1', col2: 'row1-col2' },
        { col1: 'row2-col1', col2: 'row2-col2' },
      ],
      columns: ['col1', 'col2'],
    },
    property7: null,
    property8: undefined,
    property9: '',
  },
};

const mockEntityDetails = {
  details: {
    id: 'test-id',
    name: 'test-entity',
    displayName: 'Test Entity',
    fullyQualifiedName: 'test.entity.fqn',
    description: 'Test entity description',
    deleted: false,
    serviceType: 'testService',
  },
};

const mockEntityTypeDetail = {
  customProperties: [
    { name: 'property1', displayName: 'Property 1' },
    { name: 'property2', displayName: 'Property 2' },
    { name: 'property3', displayName: 'Property 3' },
    { name: 'property4', displayName: 'Property 4' },
    { name: 'property5', displayName: 'Property 5' },
    { name: 'property6', displayName: 'Property 6' },
    { name: 'property7', displayName: 'Property 7' },
    { name: 'property8', displayName: 'Property 8' },
    { name: 'property9', displayName: 'Property 9' },
  ],
};

const defaultProps = {
  entityData: mockEntityData,
  entityDetails: mockEntityDetails,
  entityType: EntityType.TABLE,
  entityTypeDetail: mockEntityTypeDetail,
  isEntityDataLoading: false,
};

describe('CustomPropertiesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loader when isEntityDataLoading is true', () => {
      render(<CustomPropertiesSection {...defaultProps} isEntityDataLoading />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(screen.getByTestId('loader')).toHaveAttribute(
        'data-size',
        'default'
      );
    });

    it('should render with correct CSS classes when loading', () => {
      const { container } = render(
        <CustomPropertiesSection {...defaultProps} isEntityDataLoading />
      );

      expect(
        container.querySelector('.entity-summary-panel-tab-content')
      ).toBeInTheDocument();
      expect(container.querySelector('.p-x-md')).toBeInTheDocument();
      expect(container.querySelector('.p-t-md')).toBeInTheDocument();
    });
  });

  describe('No Custom Properties', () => {
    it('should render no custom properties message when customProperties is empty', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          entityTypeDetail={{ customProperties: [] }}
        />
      );

      expect(screen.getByTestId('trans-component')).toBeInTheDocument();
      expect(
        screen.getByText(
          'message.no-custom-properties-entity - Table - label.doc-plural-lowercase'
        )
      ).toBeInTheDocument();
    });

    it('should render documentation link when no custom properties', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          entityTypeDetail={{ customProperties: [] }}
        />
      );

      const docLink = screen.getByTitle('Custom properties documentation');

      expect(docLink).toBeInTheDocument();
      expect(docLink).toHaveAttribute(
        'href',
        'https://docs.open-metadata.org/how-to-guides/guide-for-data-users/custom'
      );
      expect(docLink).toHaveAttribute('target', '_blank');
      expect(docLink).toHaveAttribute('rel', 'noreferrer');
    });

    it('should render with correct CSS classes when no custom properties', () => {
      const { container } = render(
        <CustomPropertiesSection
          {...defaultProps}
          entityTypeDetail={{ customProperties: [] }}
        />
      );

      expect(
        container.querySelector('.entity-summary-panel-tab-content')
      ).toBeInTheDocument();
      expect(container.querySelector('.text-justify')).toBeInTheDocument();
      expect(container.querySelector('.text-grey-muted')).toBeInTheDocument();
    });
  });

  describe('Custom Properties Rendering', () => {
    it('should render custom properties when available', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByText('Property 1')).toBeInTheDocument();
      expect(screen.getByText('Property 2')).toBeInTheDocument();
      expect(screen.getByText('Property 3')).toBeInTheDocument();
      expect(screen.getByText('Property 4')).toBeInTheDocument();
      expect(screen.getByText('Property 5')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(
        <CustomPropertiesSection {...defaultProps} />
      );

      expect(
        container.querySelector('.entity-summary-panel-tab-content')
      ).toBeInTheDocument();
      expect(container.querySelector('.p-x-md')).toBeInTheDocument();
      expect(
        container.querySelector('.custom-properties-list')
      ).toBeInTheDocument();
    });

    it('should limit display to first 5 properties', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      // Should show first 5 properties
      expect(screen.getByText('Property 1')).toBeInTheDocument();
      expect(screen.getByText('Property 2')).toBeInTheDocument();
      expect(screen.getByText('Property 3')).toBeInTheDocument();
      expect(screen.getByText('Property 4')).toBeInTheDocument();
      expect(screen.getByText('Property 5')).toBeInTheDocument();

      // Should not show properties beyond the 5th
      expect(screen.queryByText('Property 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Property 7')).not.toBeInTheDocument();
    });

    it('should show view all button when more than 5 properties', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByText('label.view-all')).toBeInTheDocument();
    });

    it('should not show view all button when 5 or fewer properties', () => {
      const limitedProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: mockEntityTypeDetail.customProperties.slice(0, 5),
        },
      };

      render(<CustomPropertiesSection {...limitedProps} />);

      expect(screen.queryByText('label.view-all')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Property Value Formatting', () => {
    it('should render string values correctly', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByText('value1')).toBeInTheDocument();
      expect(screen.getByText('value2')).toBeInTheDocument();
    });

    it('should render array values as comma-separated string', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByText('array, value')).toBeInTheDocument();
    });

    it('should render object with name property', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByText('object-name')).toBeInTheDocument();
    });

    it('should render object with value property', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByText('object-value')).toBeInTheDocument();
    });

    it('should render table-type custom properties', () => {
      const tableProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [{ name: 'property6', displayName: 'Property 6' }],
        },
      };

      const { container } = render(<CustomPropertiesSection {...tableProps} />);

      const table = container.querySelector('.custom-property-table table');

      expect(table).toBeInTheDocument();
      expect(table).toHaveClass('ant-table', 'ant-table-small');

      // Check table headers
      expect(screen.getByText('col1')).toBeInTheDocument();
      expect(screen.getByText('col2')).toBeInTheDocument();

      // Check table data
      expect(screen.getByText('row1-col1')).toBeInTheDocument();
      expect(screen.getByText('row1-col2')).toBeInTheDocument();
      expect(screen.getByText('row2-col1')).toBeInTheDocument();
      expect(screen.getByText('row2-col2')).toBeInTheDocument();
    });

    it('should render "no data found" for null values', () => {
      const nullProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [{ name: 'property7', displayName: 'Property 7' }],
        },
      };

      render(<CustomPropertiesSection {...nullProps} />);

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('should render "no data found" for undefined values', () => {
      const undefinedProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [{ name: 'property8', displayName: 'Property 8' }],
        },
      };

      render(<CustomPropertiesSection {...undefinedProps} />);

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('should render "no data found" for empty string values', () => {
      const emptyProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [{ name: 'property9', displayName: 'Property 9' }],
        },
      };

      render(<CustomPropertiesSection {...emptyProps} />);

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('should render JSON string for complex objects', () => {
      const complexObjectData = {
        extension: {
          complexProperty: { nested: { value: 'test' }, other: 'data' },
        },
      };

      const complexObjectProps = {
        ...defaultProps,
        entityData: complexObjectData,
        entityTypeDetail: {
          customProperties: [
            { name: 'complexProperty', displayName: 'Complex Property' },
          ],
        },
      };

      render(<CustomPropertiesSection {...complexObjectProps} />);

      expect(
        screen.getByText('{"nested":{"value":"test"},"other":"data"}')
      ).toBeInTheDocument();
    });
  });

  describe('Property Names', () => {
    it('should use displayName when available', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByText('Property 1')).toBeInTheDocument();
      expect(screen.getByText('Property 2')).toBeInTheDocument();
    });

    it('should fallback to name when displayName is not available', () => {
      const propsWithoutDisplayName = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [
            { name: 'property1' }, // No displayName
            { name: 'property2', displayName: 'Property 2' },
          ],
        },
      };

      render(<CustomPropertiesSection {...propsWithoutDisplayName} />);

      expect(screen.getByText('property1')).toBeInTheDocument();
      expect(screen.getByText('Property 2')).toBeInTheDocument();
    });
  });

  describe('View All Button', () => {
    it('should render view all button with correct props', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      const viewAllButton = screen.getByText('label.view-all');

      expect(viewAllButton).toHaveTextContent('label.view-all');
      expect(viewAllButton).toHaveClass('text-primary');
    });

    it('should call getEntityLinkFromType with correct parameters', () => {
      const { getEntityLinkFromType } = jest.requireMock(
        '../../../../utils/EntityUtils'
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      expect(getEntityLinkFromType).toHaveBeenCalledWith(
        'test.entity.fqn',
        EntityType.TABLE
      );
    });
  });

  describe('Entity Type Handling', () => {
    it('should render with different entity types', () => {
      const dashboardProps = {
        ...defaultProps,
        entityType: EntityType.DASHBOARD,
      };

      render(<CustomPropertiesSection {...dashboardProps} />);

      expect(screen.getByText('Property 1')).toBeInTheDocument();
    });

    it('should pass correct entity type to getEntityLinkFromType', () => {
      const { getEntityLinkFromType } = jest.requireMock(
        '../../../../utils/EntityUtils'
      );

      const topicProps = {
        ...defaultProps,
        entityType: EntityType.TOPIC,
      };

      render(<CustomPropertiesSection {...topicProps} />);

      expect(getEntityLinkFromType).toHaveBeenCalledWith(
        'test.entity.fqn',
        EntityType.TOPIC
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing entityData gracefully', () => {
      render(
        <CustomPropertiesSection {...defaultProps} entityData={undefined} />
      );

      expect(screen.getByText('Property 1')).toBeInTheDocument();

      const noDataElements = screen.getAllByText('label.no-data-found');

      expect(noDataElements.length).toBeGreaterThan(0);
    });

    it('should handle missing entityTypeDetail gracefully', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          entityTypeDetail={undefined}
        />
      );

      expect(screen.getByTestId('trans-component')).toBeInTheDocument();
    });

    it('should handle missing entityDetails gracefully', () => {
      const propsWithoutViewAll = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [{ name: 'property1', displayName: 'Property 1' }],
        },
      };

      render(
        <CustomPropertiesSection
          {...propsWithoutViewAll}
          entityDetails={undefined}
        />
      );

      expect(screen.getByText('Property 1')).toBeInTheDocument();
    });

    it('should handle empty extension data', () => {
      const emptyExtensionProps = {
        ...defaultProps,
        entityData: { extension: {} },
      };

      render(<CustomPropertiesSection {...emptyExtensionProps} />);

      // All properties should show "no data found"
      const noDataElements = screen.getAllByText('label.no-data-found');

      expect(noDataElements.length).toBeGreaterThan(0);
    });

    it('should handle table with empty rows', () => {
      const emptyTableData = {
        extension: {
          emptyTable: {
            rows: [],
            columns: ['col1', 'col2'],
          },
        },
      };

      const emptyTableProps = {
        ...defaultProps,
        entityData: emptyTableData,
        entityTypeDetail: {
          customProperties: [
            { name: 'emptyTable', displayName: 'Empty Table' },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...emptyTableProps} />
      );
      const table = container.querySelector('.custom-property-table table');

      expect(table).toBeInTheDocument();

      const col1Elements = screen.getAllByText('col1');

      expect(col1Elements.length).toBeGreaterThan(0);

      const col2Elements = screen.getAllByText('col2');

      expect(col2Elements.length).toBeGreaterThan(0);
    });

    it('should handle table with missing column data', () => {
      const incompleteTableData = {
        extension: {
          incompleteTable: {
            rows: [
              { col1: 'row1-col1' }, // Missing col2
              { col2: 'row2-col2' }, // Missing col1
            ],
            columns: ['col1', 'col2'],
          },
        },
      };

      const incompleteTableProps = {
        ...defaultProps,
        entityData: incompleteTableData,
        entityTypeDetail: {
          customProperties: [
            { name: 'incompleteTable', displayName: 'Incomplete Table' },
          ],
        },
      };

      render(<CustomPropertiesSection {...incompleteTableProps} />);

      expect(screen.getByText('row1-col1')).toBeInTheDocument();
      expect(screen.getByText('row2-col2')).toBeInTheDocument();

      const dashElements = screen.getAllByText('-');

      expect(dashElements.length).toBeGreaterThan(0); // Missing data placeholder
    });
  });

  describe('CSS Classes and Structure', () => {
    it('should render with correct CSS classes for custom property items', () => {
      const { container } = render(
        <CustomPropertiesSection {...defaultProps} />
      );

      const propertyItems = container.querySelectorAll('.custom-property-item');

      expect(propertyItems.length).toBeGreaterThan(0);

      propertyItems.forEach((item) => {
        expect(item.querySelector('.property-name')).toBeInTheDocument();
        expect(item.querySelector('.property-value')).toBeInTheDocument();
      });
    });

    it('should render Typography components with correct props', () => {
      const { container } = render(
        <CustomPropertiesSection {...defaultProps} />
      );

      const strongElements = container.querySelectorAll('.property-name');

      expect(strongElements.length).toBeGreaterThan(0);

      const textElements = container.querySelectorAll('.property-value');

      expect(textElements.length).toBeGreaterThan(0);
    });

    it('should render table with correct structure', () => {
      const tableProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [{ name: 'property6', displayName: 'Property 6' }],
        },
      };

      const { container } = render(<CustomPropertiesSection {...tableProps} />);

      const table = container.querySelector('.custom-property-table table');

      expect(table).toBeInTheDocument();

      const colgroup = table?.querySelector('colgroup');

      expect(colgroup).toBeInTheDocument();

      const thead = table?.querySelector('thead');

      expect(thead).toBeInTheDocument();

      const tbody = table?.querySelector('tbody');

      expect(tbody).toBeInTheDocument();
    });
  });
});
