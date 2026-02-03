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
import { fireEvent, render, screen } from '@testing-library/react';
import { EntityType } from '../../../../enums/entity.enum';
import { CustomProperty } from '../../../../generated/entity/type';
import CustomPropertiesSection from './CustomPropertiesSection';
import { EntityTypeDetail } from './CustomPropertiesSection.interface';

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
  PropertyValue: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="property-name">PropertyValue</div>
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

const mockEntityTypeDetail: EntityTypeDetail = {
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
  onExtensionUpdate: jest.fn().mockResolvedValue(undefined),
};

describe('CustomPropertiesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render Loader when isEntityDataLoading is true', () => {
      render(<CustomPropertiesSection {...defaultProps} isEntityDataLoading />);

      const loader = screen.getByTestId('loader');

      expect(loader).toBeInTheDocument();
      expect(loader).toHaveAttribute('data-size', 'default');
    });
  });

  describe('Permission Handling', () => {
    it('should show permission error when viewCustomPropertiesPermission is false', () => {
      render(
        <CustomPropertiesSection
          {...defaultProps}
          viewCustomPropertiesPermission={false}
        />
      );

      const errorPlaceholder = screen.getByTestId('error-placeholder');

      expect(errorPlaceholder).toBeInTheDocument();
      expect(errorPlaceholder).toHaveAttribute('data-type', 'PERMISSION');

      const transComponent = screen.getByTestId('trans-component');

      expect(transComponent).toBeInTheDocument();
      expect(transComponent).toHaveTextContent('message.no-access-placeholder');

      expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('property-name')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no custom properties exist', () => {
      const propsWithNoProperties = {
        ...defaultProps,
        entityTypeDetail: { customProperties: [] } as EntityTypeDetail,
      };

      render(<CustomPropertiesSection {...propsWithNoProperties} />);

      const errorPlaceholder = screen.getByTestId('error-placeholder');

      expect(errorPlaceholder).toBeInTheDocument();
      expect(errorPlaceholder).toHaveAttribute('data-type', 'CUSTOM');

      const transComponent = screen.getByTestId('trans-component');

      expect(transComponent).toBeInTheDocument();
      expect(transComponent).toHaveTextContent(
        'message.no-custom-properties-entity'
      );

      expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument();
    });
  });

  describe('Search Bar Rendering', () => {
    it('should render search bar when custom properties exist', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      const searchBar = screen.getByTestId('search-bar');

      expect(searchBar).toBeInTheDocument();

      const searchInput = screen.getByTestId('search-input');

      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute(
        'placeholder',
        'label.search-for-type'
      );
    });
  });

  describe('Search Functionality', () => {
    it('should filter properties by property name', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.name}</div>
        )
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, { target: { value: 'property1' } });

      const properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(1);
      expect(properties[0]).toHaveTextContent('property1');
    });

    it('should filter properties by display name', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.displayName}</div>
        )
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, { target: { value: 'Property 1' } });

      const properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(1);
      expect(properties[0]).toHaveTextContent('Property 1');
    });

    it('should filter properties by property type', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.propertyType.name}</div>
        )
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, { target: { value: 'string' } });

      const properties = screen.getAllByTestId('property-name');

      expect(properties.length).toBeGreaterThan(0);

      properties.forEach((property) => {
        expect(property).toHaveTextContent('string');
      });
    });

    it('should perform case-insensitive search', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.name}</div>
        )
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, { target: { value: 'PROPERTY1' } });

      const properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(1);
      expect(properties[0]).toHaveTextContent('property1');
    });

    it('should show no results message when search returns no matches', () => {
      render(<CustomPropertiesSection {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, {
        target: { value: 'nonexistent-property' },
      });

      expect(screen.queryByTestId('property-name')).not.toBeInTheDocument();

      const noResultsMessage = screen.getByText(
        'message.no-entity-found-for-name'
      );

      expect(noResultsMessage).toBeInTheDocument();

      expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
    });
  });

  describe('Property Rendering', () => {
    it('should render all properties when no search is applied', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.name}</div>
        )
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      const properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(9);
    });

    it('should pass correct props to PropertyValue component', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');

      render(<CustomPropertiesSection {...defaultProps} />);

      expect(PropertyValue).toHaveBeenCalled();

      const firstCall = PropertyValue.mock.calls[0][0];

      expect(firstCall).toHaveProperty('isRenderedInRightPanel', true);
      expect(firstCall).toHaveProperty('extension', mockEntityData.extension);
      expect(firstCall).toHaveProperty('hasEditPermissions', true);
      expect(firstCall).toHaveProperty('property');
      expect(firstCall).toHaveProperty('onExtensionUpdate');
      expect(typeof firstCall.onExtensionUpdate).toBe('function');
    });
  });

  describe('User Interactions', () => {
    it('should update search and filter properties when typing in search input', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.name}</div>
        )
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      let properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(9);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, { target: { value: 'property2' } });

      properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(1);
      expect(properties[0]).toHaveTextContent('property2');
    });

    it('should show all properties when search is cleared', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.name}</div>
        )
      );

      render(<CustomPropertiesSection {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, { target: { value: 'property1' } });

      let properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(1);

      fireEvent.change(searchInput, { target: { value: '' } });

      properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(9);
    });
  });

  describe('Edge Cases', () => {
    it('should render without errors when extension data is empty', () => {
      const propsWithEmptyExtension = {
        ...defaultProps,
        entityData: { extension: {} },
      };

      expect(() =>
        render(<CustomPropertiesSection {...propsWithEmptyExtension} />)
      ).not.toThrow();

      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    it('should render without errors when extension is undefined', () => {
      const propsWithUndefinedExtension = {
        ...defaultProps,
        entityData: {},
      };

      expect(() =>
        render(<CustomPropertiesSection {...propsWithUndefinedExtension} />)
      ).not.toThrow();

      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    it('should handle properties missing optional fields gracefully', () => {
      const propsWithPartialProperties = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [
            {
              name: 'minimal-property',
              propertyType: { id: 'type1', name: 'string', type: 'type' },
            },
          ],
        } as EntityTypeDetail,
      };

      expect(() =>
        render(<CustomPropertiesSection {...propsWithPartialProperties} />)
      ).not.toThrow();

      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    it('should handle search with special characters without errors', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(() => (
        <div data-testid="property-name">PropertyValue</div>
      ));

      render(<CustomPropertiesSection {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      expect(() =>
        fireEvent.change(searchInput, { target: { value: '@#$%^&*()' } })
      ).not.toThrow();

      expect(screen.queryByTestId('property-name')).not.toBeInTheDocument();
    });

    it('should handle undefined entityTypeDetail gracefully', () => {
      const propsWithUndefinedTypeDetail = {
        ...defaultProps,
        entityTypeDetail: undefined,
      };

      expect(() =>
        render(<CustomPropertiesSection {...propsWithUndefinedTypeDetail} />)
      ).not.toThrow();
    });

    it('should handle properties with null/undefined name, displayName, and propertyType in search', () => {
      const {
        PropertyValue,
      } = require('../../../common/CustomPropertyTable/PropertyValue');
      PropertyValue.mockImplementation(
        ({ property }: { property: CustomProperty }) => (
          <div data-testid="property-name">{property.name || 'no-name'}</div>
        )
      );

      const propsWithNullFields = {
        ...defaultProps,
        entityTypeDetail: {
          customProperties: [
            {
              name: null,
              displayName: null,
              propertyType: { name: null },
            },
            {
              name: 'valid-property',
              displayName: 'Valid Property',
              propertyType: { name: 'string' },
            },
          ],
        } as EntityTypeDetail,
      };

      render(<CustomPropertiesSection {...propsWithNullFields} />);

      const searchInput = screen.getByTestId('search-input');

      fireEvent.change(searchInput, { target: { value: 'valid' } });

      const properties = screen.getAllByTestId('property-name');

      expect(properties).toHaveLength(1);
      expect(properties[0]).toHaveTextContent('valid-property');
    });
  });
});
