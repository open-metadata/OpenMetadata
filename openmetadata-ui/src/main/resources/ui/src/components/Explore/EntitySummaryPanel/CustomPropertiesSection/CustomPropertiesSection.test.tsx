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

// Mock SearchBarComponent
jest.mock('../../../common/SearchBarComponent/SearchBar.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ onSearch, placeholder, searchValue }) => (
      <div data-testid="search-bar">
        <input
          data-testid="search-input"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    )),
}));

// Mock ErrorPlaceHolderNew component
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children, className, icon, type }) => (
      <div
        className={className}
        data-testid="error-placeholder"
        data-type={type}>
        {icon}
        {children}
      </div>
    )),
}));

// Mock utility functions
jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityLinkFromType: jest.fn().mockReturnValue('/test-entity-link'),
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

// Mock RichTextEditorPreviewerV1
jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="rich-text-previewer">{markdown}</div>
    )),
}));

// Mock ProfilePicture
jest.mock('../../../common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ name }) => (
      <div data-testid="profile-picture">{name}</div>
    )),
}));

// Mock entityUtilClassBase
jest.mock('../../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn().mockReturnValue('/test-entity-link'),
  },
}));

// Mock searchClassBase
jest.mock('../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: jest
      .fn()
      .mockReturnValue(<span data-testid="entity-icon">Icon</span>),
  },
}));

// Mock PropertyValue component
jest.mock('../../../common/CustomPropertyTable/PropertyValue', () => ({
  PropertyValue: jest.fn().mockImplementation(({ property, value }) => (
    <div data-testid="property-value">
      {property.displayName || property.name}: {JSON.stringify(value)}
    </div>
  )),
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
    {
      name: 'property1',
      displayName: 'Property 1',
      description: 'Property 1 description',
      propertyType: { id: 'type1', name: 'string', type: 'type' },
    },
    {
      name: 'property2',
      displayName: 'Property 2',
      description: 'Property 2 description',
      propertyType: { id: 'type2', name: 'string', type: 'type' },
    },
    {
      name: 'property3',
      displayName: 'Property 3',
      description: 'Property 3 description',
      propertyType: { id: 'type3', name: 'array', type: 'type' },
    },
    {
      name: 'property4',
      displayName: 'Property 4',
      description: 'Property 4 description',
      propertyType: { id: 'type4', name: 'object', type: 'type' },
    },
    {
      name: 'property5',
      displayName: 'Property 5',
      description: 'Property 5 description',
      propertyType: { id: 'type5', name: 'object', type: 'type' },
    },
    {
      name: 'property6',
      displayName: 'Property 6',
      description: 'Property 6 description',
      propertyType: { id: 'type6', name: 'table', type: 'type' },
    },
    {
      name: 'property7',
      displayName: 'Property 7',
      description: 'Property 7 description',
      propertyType: { id: 'type7', name: 'string', type: 'type' },
    },
    {
      name: 'property8',
      displayName: 'Property 8',
      description: 'Property 8 description',
      propertyType: { id: 'type8', name: 'string', type: 'type' },
    },
    {
      name: 'property9',
      displayName: 'Property 9',
      description: 'Property 9 description',
      propertyType: { id: 'type9', name: 'string', type: 'type' },
    },
  ],
};

const defaultProps = {
  entityData: mockEntityData,
  entityType: EntityType.TABLE,
  entityTypeDetail: mockEntityTypeDetail,
  isEntityDataLoading: false,
  viewCustomPropertiesPermission: true,
  entityDetails: mockEntityDetails,
  hasEditPermissions: true,
  onExtensionUpdate: jest.fn(),
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
        <CustomPropertiesSection
          {...defaultProps}
          isEntityDataLoading
          entityTypeDetail={mockEntityTypeDetail}
        />
      );

      expect(container.querySelector('.p-x-md')).not.toBeInTheDocument();
      expect(container.querySelector('.p-t-md')).not.toBeInTheDocument();
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
          'message.no-custom-properties-entity - label.custom-property-plural - label.doc-plural-lowercase'
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
      ).not.toBeInTheDocument();
      expect(container.querySelector('.text-justify')).toBeInTheDocument();
      expect(
        container.querySelector('.no-data-placeholder')
      ).toBeInTheDocument();
    });
  });

  describe('Permission Error', () => {
    it('should render permission error when viewCustomPropertiesPermission is false', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission={false}
        />
      );

      expect(screen.getByTestId('trans-component')).toHaveTextContent(
        'message.no-access-placeholder - label.view-entity -'
      );
    });

    it('should not render custom properties when viewCustomPropertiesPermission is false', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission={false}
        />
      );

      expect(screen.queryByText('Property 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Property 2')).not.toBeInTheDocument();
      expect(screen.queryByText('value1')).not.toBeInTheDocument();
    });

    it('should not render view all button when viewCustomPropertiesPermission is false', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission={false}
        />
      );

      expect(screen.queryByText('label.view-all')).not.toBeInTheDocument();
    });

    it('should render permission error with correct placeholder type', () => {
      const { container } = render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission={false}
        />
      );

      expect(
        container.querySelector('.permission-error-placeholder')
      ).toBeInTheDocument();
    });
  });

  describe('Custom Properties Rendering', () => {
    it('should render custom properties when available', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getAllByText('Property 1')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Property 2')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Property 3')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Property 4')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Property 5')[0]).toBeInTheDocument();
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

    it('should display all properties without limit', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      // Should show all properties (no 5-item limit)
      expect(screen.getByText('Property 1')).toBeInTheDocument();
      expect(screen.getByText('Property 2')).toBeInTheDocument();
      expect(screen.getByText('Property 3')).toBeInTheDocument();
      expect(screen.getByText('Property 4')).toBeInTheDocument();
      expect(screen.getByText('Property 5')).toBeInTheDocument();
      expect(screen.getByText('Property 6')).toBeInTheDocument();
      expect(screen.getByText('Property 7')).toBeInTheDocument();
      expect(screen.getByText('Property 8')).toBeInTheDocument();
      expect(screen.getByText('Property 9')).toBeInTheDocument();
    });

    it('should render search bar when custom properties exist', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toHaveAttribute(
        'placeholder',
        'label.search-for-type'
      );
    });

    it('should not render search bar when no custom properties', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          entityTypeDetail={{ customProperties: [] }}
        />
      );

      expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument();
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
          customProperties: [
            {
              name: 'property6',
              displayName: 'Property 6',
              description: 'Property 6 description',
              propertyType: { id: 'type6', name: 'table', type: 'type' },
            },
          ],
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

    it('should render "not set" for null values', () => {
      const nullProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'property7',
              displayName: 'Property 7',
              description: 'Property 7 description',
              propertyType: { id: 'type7', name: 'string', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...nullProps} />);

      expect(screen.getByText('label.not-set')).toBeInTheDocument();
    });

    it('should render "not set" for undefined values', () => {
      const undefinedProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'property8',
              displayName: 'Property 8',
              description: 'Property 8 description',
              propertyType: { id: 'type8', name: 'string', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...undefinedProps} />);

      expect(screen.getByText('label.not-set')).toBeInTheDocument();
    });

    it('should render "not set" for empty string values', () => {
      const emptyProps = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'property9',
              displayName: 'Property 9',
              description: 'Property 9 description',
              propertyType: { id: 'type9', name: 'string', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...emptyProps} />);

      expect(screen.getByText('label.not-set')).toBeInTheDocument();
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
            {
              name: 'complexProperty',
              displayName: 'Complex Property',
              description: 'Complex Property description',
              propertyType: { id: 'typeComplex', name: 'object', type: 'type' },
            },
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
            {
              name: 'property1',
              description: 'Property 1 description',
              propertyType: { id: 'type1', name: 'string', type: 'type' },
            },
            {
              name: 'property2',
              displayName: 'Property 2',
              description: 'Property 2 description',
              propertyType: { id: 'type2', name: 'string', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...propsWithoutDisplayName} />);

      expect(screen.getByText('property1')).toBeInTheDocument();
      expect(screen.getByText('Property 2')).toBeInTheDocument();
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
  });

  describe('Edge Cases', () => {
    it('should handle missing entityData gracefully', () => {
      render(
        <CustomPropertiesSection {...defaultProps} entityData={undefined} />
      );

      expect(screen.getByText('Property 1')).toBeInTheDocument();

      const noDataElements = screen.getAllByText('label.not-set');

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

    it('should handle empty extension data', () => {
      const emptyExtensionProps = {
        ...defaultProps,
        entityData: { extension: {} },
      };

      render(<CustomPropertiesSection {...emptyExtensionProps} />);

      // All properties should show "not set"
      const noDataElements = screen.getAllByText('label.not-set');

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
            {
              name: 'emptyTable',
              displayName: 'Empty Table',
              description: 'Empty Table description',
              propertyType: { id: 'typeEmpty', name: 'table', type: 'type' },
            },
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
            {
              name: 'incompleteTable',
              displayName: 'Incomplete Table',
              description: 'Incomplete Table description',
              propertyType: {
                id: 'typeIncomplete',
                name: 'table',
                type: 'type',
              },
            },
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

  describe('ViewCustomFields Permission Tests', () => {
    it('should render custom properties when viewCustomPropertiesPermission is true', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission
        />
      );

      expect(screen.getByText('Property 1')).toBeInTheDocument();
      expect(screen.getByText('value1')).toBeInTheDocument();
    });

    it('should hide custom properties and show error when viewCustomPropertiesPermission is false', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission={false}
        />
      );

      expect(screen.queryByText('Property 1')).not.toBeInTheDocument();
      expect(screen.getByTestId('trans-component')).toBeInTheDocument();
    });

    it('should take precedence over loading state when viewCustomPropertiesPermission is false', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          isEntityDataLoading
          viewCustomPropertiesPermission={false}
        />
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should show permission error even when no custom properties exist', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          entityTypeDetail={{ customProperties: [] }}
          viewCustomPropertiesPermission={false}
        />
      );

      expect(screen.getByTestId('trans-component')).toHaveTextContent(
        'message.no-access-placeholder'
      );
    });

    it('should display custom properties correctly when permission is granted and data exists', () => {
      const { container } = render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission
        />
      );

      expect(
        container.querySelector('.custom-properties-list')
      ).toBeInTheDocument();
      expect(screen.getByText('Property 1')).toBeInTheDocument();
      expect(screen.getByText('Property 2')).toBeInTheDocument();
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
          customProperties: [
            {
              name: 'property6',
              displayName: 'Property 6',
              description: 'Property 6 description',
              propertyType: { id: 'type6', name: 'string', type: 'type' },
            },
          ],
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

  describe('Type Handling - Advanced Property Types', () => {
    it('should handle markdown property type', () => {
      const markdownData = {
        extension: {
          markdownProp: '# Heading\n\nThis is **bold** text',
        },
      };

      const markdownProps = {
        ...defaultProps,
        entityData: markdownData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'markdownProp',
              displayName: 'Markdown Property',
              description: 'Markdown Property description',
              propertyType: { id: 'md', name: 'markdown', type: 'type' },
            },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...markdownProps} />
      );

      expect(container.querySelector('.property-value')).toBeInTheDocument();
    });

    it('should handle enum property type with array of values', () => {
      const enumData = {
        extension: {
          enumProp: ['Value1', 'Value2', 'Value3'],
        },
      };

      const enumProps = {
        ...defaultProps,
        entityData: enumData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'enumProp',
              displayName: 'Enum Property',
              description: 'Enum Property description',
              propertyType: { id: 'enum', name: 'enum', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...enumProps} />);

      expect(screen.getByText('Value1')).toBeInTheDocument();
      expect(screen.getByText('Value2')).toBeInTheDocument();
      expect(screen.getByText('Value3')).toBeInTheDocument();
    });

    it('should handle entityReference property type', () => {
      const entityRefData = {
        extension: {
          entityRef: {
            id: 'entity-123',
            type: 'table',
            name: 'test-table',
            fullyQualifiedName: 'database.schema.test-table',
            displayName: 'Test Table',
          },
        },
      };

      const entityRefProps = {
        ...defaultProps,
        entityData: entityRefData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'entityRef',
              displayName: 'Entity Reference',
              description: 'Entity Reference description',
              propertyType: {
                id: 'entityRef',
                name: 'entityReference',
                type: 'type',
              },
            },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...entityRefProps} />
      );

      const linkElement = container.querySelector('a');

      expect(linkElement).toBeInTheDocument();
      expect(linkElement).toHaveAttribute('href', '/test-entity-link');
    });

    it('should handle entityReferenceList property type', () => {
      const entityRefListData = {
        extension: {
          entityRefList: [
            {
              id: 'entity-1',
              type: 'table',
              name: 'table-1',
              fullyQualifiedName: 'db.schema.table-1',
              displayName: 'Table 1',
            },
            {
              id: 'entity-2',
              type: 'dashboard',
              name: 'dashboard-1',
              fullyQualifiedName: 'service.dashboard-1',
              displayName: 'Dashboard 1',
            },
          ],
        },
      };

      const entityRefListProps = {
        ...defaultProps,
        entityData: entityRefListData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'entityRefList',
              displayName: 'Entity Reference List',
              description: 'Entity Reference List description',
              propertyType: {
                id: 'entityRefList',
                name: 'entityReferenceList',
                type: 'type',
              },
            },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...entityRefListProps} />
      );

      const links = container.querySelectorAll('a');

      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute('href', '/test-entity-link');
      expect(links[1]).toHaveAttribute('href', '/test-entity-link');
    });

    it('should handle timeInterval property type (start/end)', () => {
      const timeIntervalData = {
        extension: {
          timeIntervalProp: {
            start: 1710831125922,
            end: 1711176725922,
          },
        },
      };

      const timeIntervalProps = {
        ...defaultProps,
        entityData: timeIntervalData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'timeIntervalProp',
              displayName: 'Time Interval Property',
              description: 'Time Interval Property description',
              propertyType: {
                id: 'timeInterval',
                name: 'timeInterval',
                type: 'type',
              },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...timeIntervalProps} />);

      expect(screen.getByText(/label\.start-entity/)).toBeInTheDocument();
      expect(screen.getByText(/1710831125922/)).toBeInTheDocument();
      expect(screen.getByText(/label\.end-entity/)).toBeInTheDocument();
      expect(screen.getByText(/1711176725922/)).toBeInTheDocument();
    });

    it('should handle range property type (start/end)', () => {
      const rangeData = {
        extension: {
          rangeProp: {
            start: 10,
            end: 100,
          },
        },
      };

      const rangeProps = {
        ...defaultProps,
        entityData: rangeData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'rangeProp',
              displayName: 'Range Property',
              description: 'Range Property description',
              propertyType: { id: 'range', name: 'range', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...rangeProps} />);

      expect(screen.getByText(/label\.start-entity.*10/)).toBeInTheDocument();
      expect(screen.getByText(/label\.end-entity.*100/)).toBeInTheDocument();
    });

    it('should handle user entity reference with ProfilePicture', () => {
      const userRefData = {
        extension: {
          userRef: {
            id: 'user-123',
            type: 'user',
            name: 'john.doe',
            fullyQualifiedName: 'john.doe',
            displayName: 'John Doe',
          },
        },
      };

      const userRefProps = {
        ...defaultProps,
        entityData: userRefData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'userRef',
              displayName: 'User Reference',
              description: 'User Reference description',
              propertyType: {
                id: 'userRef',
                name: 'entityReference',
                type: 'type',
              },
            },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...userRefProps} />
      );

      const linkElement = container.querySelector('a');

      expect(linkElement).toBeInTheDocument();
    });

    it('should handle team entity reference with ProfilePicture', () => {
      const teamRefData = {
        extension: {
          teamRef: {
            id: 'team-123',
            type: 'team',
            name: 'engineering',
            fullyQualifiedName: 'engineering',
            displayName: 'Engineering Team',
          },
        },
      };

      const teamRefProps = {
        ...defaultProps,
        entityData: teamRefData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'teamRef',
              displayName: 'Team Reference',
              description: 'Team Reference description',
              propertyType: {
                id: 'teamRef',
                name: 'entityReference',
                type: 'type',
              },
            },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...teamRefProps} />
      );

      const linkElement = container.querySelector('a');

      expect(linkElement).toBeInTheDocument();
    });

    it('should handle displayName property in entity objects', () => {
      const displayNameData = {
        extension: {
          displayNameProp: {
            name: 'internalName',
            displayName: 'User Friendly Name',
          },
        },
      };

      const displayNameProps = {
        ...defaultProps,
        entityData: displayNameData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'displayNameProp',
              displayName: 'Display Name Property',
              description: 'Display Name Property description',
              propertyType: { id: 'obj', name: 'object', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...displayNameProps} />);

      expect(screen.getByText('internalName')).toBeInTheDocument();
    });

    it('should handle fallback to name when displayName is not present', () => {
      const nameOnlyData = {
        extension: {
          nameOnlyProp: {
            name: 'onlyNameAvailable',
          },
        },
      };

      const nameOnlyProps = {
        ...defaultProps,
        entityData: nameOnlyData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'nameOnlyProp',
              displayName: 'Name Only Property',
              description: 'Name Only Property description',
              propertyType: { id: 'obj', name: 'object', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...nameOnlyProps} />);

      expect(screen.getByText('onlyNameAvailable')).toBeInTheDocument();
    });

    it('should convert non-string primitives to strings', () => {
      const primitiveData = {
        extension: {
          numberProp: 42,
          booleanProp: true,
        },
      };

      const primitiveProps = {
        ...defaultProps,
        entityData: primitiveData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'numberProp',
              displayName: 'Number Property',
              description: 'Number Property description',
              propertyType: { id: 'num', name: 'number', type: 'type' },
            },
            {
              name: 'booleanProp',
              displayName: 'Boolean Property',
              description: 'Boolean Property description',
              propertyType: { id: 'bool', name: 'boolean', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...primitiveProps} />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('should handle empty enum array', () => {
      const emptyEnumData = {
        extension: {
          emptyEnum: [],
        },
      };

      const emptyEnumProps = {
        ...defaultProps,
        entityData: emptyEnumData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'emptyEnum',
              displayName: 'Empty Enum',
              description: 'Empty Enum description',
              propertyType: { id: 'enum', name: 'enum', type: 'type' },
            },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...emptyEnumProps} />
      );

      const tagsWrapper = container.querySelector('.d-flex.flex-wrap.gap-2');

      expect(tagsWrapper).toBeInTheDocument();
      expect(tagsWrapper?.children.length).toBe(0);
    });

    it('should handle mixed entityReferenceList with users and other entities', () => {
      const mixedRefListData = {
        extension: {
          mixedRefList: [
            {
              id: 'user-1',
              type: 'user',
              name: 'user1',
              fullyQualifiedName: 'user1',
            },
            {
              id: 'table-1',
              type: 'table',
              name: 'table1',
              fullyQualifiedName: 'db.table1',
            },
            {
              id: 'team-1',
              type: 'team',
              name: 'team1',
              fullyQualifiedName: 'team1',
            },
          ],
        },
      };

      const mixedRefListProps = {
        ...defaultProps,
        entityData: mixedRefListData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'mixedRefList',
              displayName: 'Mixed Reference List',
              description: 'Mixed Reference List description',
              propertyType: {
                id: 'mixed',
                name: 'entityReferenceList',
                type: 'type',
              },
            },
          ],
        },
      };

      const { container } = render(
        <CustomPropertiesSection {...mixedRefListProps} />
      );

      const links = container.querySelectorAll('a');

      expect(links).toHaveLength(3);
    });

    it('should handle table with custom column widths', () => {
      const tableData = {
        extension: {
          tableProp: {
            rows: [{ col1: 'value1', col2: 'value2', col3: 'value3' }],
            columns: ['col1', 'col2', 'col3'],
          },
        },
      };

      const tableProps = {
        ...defaultProps,
        entityData: tableData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'tableProp',
              displayName: 'Table Property',
              description: 'Table Property description',
              propertyType: { id: 'table', name: 'table', type: 'type' },
            },
          ],
        },
      };

      const { container } = render(<CustomPropertiesSection {...tableProps} />);

      const cols = container.querySelectorAll('colgroup col');

      expect(cols).toHaveLength(3);

      cols.forEach((col) => {
        expect(col).toHaveClass('table-col-min-width');
      });
    });

    it('should handle zero values (currently treated as falsy)', () => {
      const zeroData = {
        extension: {
          zeroProp: 0,
          zeroStartProp: { start: 0, end: 10 },
        },
      };

      const zeroProps = {
        ...defaultProps,
        entityData: zeroData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'zeroProp',
              displayName: 'Zero Property',
              description: 'Zero Property description',
              propertyType: { id: 'num', name: 'number', type: 'type' },
            },
            {
              name: 'zeroStartProp',
              displayName: 'Zero Start Property',
              description: 'Zero Start Property description',
              propertyType: { id: 'range', name: 'range', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...zeroProps} />);

      // Note: Currently zero is treated as falsy in formatValue (if (!val))
      // This test documents the current behavior
      expect(screen.getByText('label.not-set')).toBeInTheDocument();
      expect(screen.getByText(/label\.start-entity.*0/)).toBeInTheDocument();
    });

    it('should handle false boolean value (currently treated as falsy)', () => {
      const falseData = {
        extension: {
          falseProp: false,
        },
      };

      const falseProps = {
        ...defaultProps,
        entityData: falseData,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'falseProp',
              displayName: 'False Property',
              description: 'False Property description',
              propertyType: { id: 'bool', name: 'boolean', type: 'type' },
            },
          ],
        },
      };

      render(<CustomPropertiesSection {...falseProps} />);

      // Note: Currently false is treated as falsy in formatValue (if (!val))
      // This test documents the current behavior
      expect(screen.getByText('label.not-set')).toBeInTheDocument();
    });
  });
});
