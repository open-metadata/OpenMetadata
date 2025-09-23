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
import { EntityTags } from 'Models';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import entityRightPanelClassBase from '../../../utils/EntityRightPanelClassBase';
import EntityRightPanelContent from './EntityRightPanelContent';
import { EntityRightPanelTab } from './EntityRightPanelVerticalNav';

// Mock all dependencies
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'test-fqn',
  }),
}));

jest.mock('../../../utils/EntityRightPanelClassBase');

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    data: {
      domains: [{ id: 'domain-1', name: 'Test Domain' }],
      dataProducts: [{ id: 'product-1', name: 'Test Product' }],
      id: 'test-entity-id',
    },
  }),
}));

jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => {
    return jest.fn().mockImplementation(({ hasPermission, onSave }) => (
      <div data-testid="data-products-container">
        DataProductsContainer
        {hasPermission && (
          <span data-testid="data-products-has-permission">Has Permission</span>
        )}
        {onSave && (
          <span data-testid="has-save-callback">Has Save Callback</span>
        )}
      </div>
    ));
  }
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest
    .fn()
    .mockImplementation(({ tagType, permission, onSelectionChange }) => (
      <div data-testid={`tags-container-${tagType}`}>
        TagsContainerV2 - {tagType}
        {permission && (
          <span data-testid={`${tagType}-has-permission`}>Has Permission</span>
        )}
        {onSelectionChange && (
          <span data-testid={`${tagType}-has-selection-callback`}>
            Has Selection Callback
          </span>
        )}
      </div>
    ));
});

jest.mock(
  '../../../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component',
  () => ({
    PartitionedKeys: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="partitioned-keys">PartitionedKeys</div>
      )),
  })
);

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => {
  return {
    CustomPropertyTable: jest
      .fn()
      .mockImplementation(({ hasEditAccess, hasPermission }) => (
        <div data-testid="custom-property-table">
          CustomPropertyTable
          {hasEditAccess && (
            <span data-testid="has-edit-access">Has Edit Access</span>
          )}
          {hasPermission && (
            <span data-testid="custom-property-has-permission">
              Has Permission
            </span>
          )}
        </div>
      )),
  };
});

describe('EntityRightPanelContent', () => {
  const mockSelectedTags: EntityTags[] = [];
  const mockOnTagSelectionChange = jest.fn();
  const mockOnDataProductUpdate = jest.fn();
  const mockCustomProperties = {
    extension: {
      test1: 'test',
      test2: '',
    },
  } as Table;

  const defaultProps = {
    activeTab: EntityRightPanelTab.OVERVIEW,
    entityType: EntityType.TABLE,
    selectedTags: mockSelectedTags,
    editTagPermission: true,
    editGlossaryTermsPermission: true,
    onTagSelectionChange: mockOnTagSelectionChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<EntityRightPanelContent {...defaultProps} />);

      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
    });

    it('should render with correct CSS class', () => {
      const { container } = render(
        <EntityRightPanelContent {...defaultProps} />
      );

      expect(
        container.querySelector('.entity-right-panel-content')
      ).toBeInTheDocument();
    });
  });

  describe('Overview Tab Content', () => {
    it('should render overview content by default', () => {
      render(<EntityRightPanelContent {...defaultProps} />);

      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
      expect(
        screen.getByTestId('tags-container-Classification')
      ).toBeInTheDocument();
      expect(screen.getByTestId('tags-container-Glossary')).toBeInTheDocument();
    });

    it('should render DataProductsContainer with correct props', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editDataProductPermission
          onDataProductUpdate={mockOnDataProductUpdate}
        />
      );

      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
      expect(
        screen.getByTestId('data-products-has-permission')
      ).toBeInTheDocument();
      expect(screen.getByTestId('has-save-callback')).toBeInTheDocument();
    });

    it('should not render DataProductsContainer when showDataProductContainer is false', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          showDataProductContainer={false}
        />
      );

      expect(
        screen.queryByTestId('data-products-container')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('tags-container-Classification')
      ).toBeInTheDocument();
      expect(screen.getByTestId('tags-container-Glossary')).toBeInTheDocument();
    });

    it('should render TagsContainerV2 for Classification tags with correct props', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editTagPermission
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      const classificationContainer = screen.getByTestId(
        'tags-container-Classification'
      );

      expect(classificationContainer).toBeInTheDocument();
      expect(classificationContainer).toHaveTextContent('Classification');
      expect(
        screen.getByTestId('Classification-has-permission')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('Classification-has-selection-callback')
      ).toBeInTheDocument();
    });

    it('should render TagsContainerV2 for Glossary tags with correct props', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editGlossaryTermsPermission
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      const glossaryContainer = screen.getByTestId('tags-container-Glossary');

      expect(glossaryContainer).toBeInTheDocument();
      expect(glossaryContainer).toHaveTextContent('Glossary');
    });

    it('should render KnowledgeArticles when available', () => {
      const mockKnowledgeArticles = jest
        .fn()
        .mockImplementation(({ entityId, entityType }) => (
          <div data-testid="knowledge-articles">
            KnowledgeArticles - {entityId} - {entityType}
          </div>
        ));

      (
        entityRightPanelClassBase.getKnowLedgeArticlesWidget as jest.Mock
      ).mockReturnValue(mockKnowledgeArticles);

      render(<EntityRightPanelContent {...defaultProps} />);

      expect(screen.getByTestId('knowledge-articles')).toBeInTheDocument();
      expect(
        screen.getByText('KnowledgeArticles - test-entity-id - table')
      ).toBeInTheDocument();
    });

    it('should not render KnowledgeArticles when not available', () => {
      (
        entityRightPanelClassBase.getKnowLedgeArticlesWidget as jest.Mock
      ).mockReturnValue(null);

      render(<EntityRightPanelContent {...defaultProps} />);

      expect(
        screen.queryByTestId('knowledge-articles')
      ).not.toBeInTheDocument();
    });

    it('should render before and after slots', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          afterSlot={<div data-testid="after-slot">After Slot</div>}
          beforeSlot={<div data-testid="before-slot">Before Slot</div>}
        />
      );

      expect(screen.getByTestId('before-slot')).toBeInTheDocument();
      expect(screen.getByTestId('after-slot')).toBeInTheDocument();
    });
  });

  describe('Schema Tab Content', () => {
    it('should render schema content with PartitionedKeys by default', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.SCHEMA}
        />
      );

      expect(screen.getByTestId('partitioned-keys')).toBeInTheDocument();
    });

    it('should render custom entity details when provided', () => {
      const customEntityDetails = (
        <div data-testid="custom-entity-details">Custom Entity Details</div>
      );

      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.SCHEMA}
          entityDetails={customEntityDetails}
        />
      );

      expect(screen.getByTestId('custom-entity-details')).toBeInTheDocument();
      expect(screen.queryByTestId('partitioned-keys')).not.toBeInTheDocument();
    });

    it('should render with correct CSS class', () => {
      const { container } = render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.SCHEMA}
        />
      );

      expect(
        container.querySelector('.entity-right-panel-tab-content')
      ).toBeInTheDocument();
    });
  });

  describe('Lineage Tab Content', () => {
    it('should render lineage content', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.LINEAGE}
        />
      );

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.LINEAGE}
        />
      );

      const tabContent = container.querySelector(
        '.entity-right-panel-tab-content'
      );
      const lineageText = container.querySelector(
        '.text-center.text-grey-muted.p-lg'
      );

      expect(tabContent).toBeInTheDocument();
      expect(lineageText).toBeInTheDocument();
    });
  });

  describe('Data Quality Tab Content', () => {
    it('should render data quality content', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.DATA_QUALITY}
        />
      );

      expect(screen.getByText('label.data-quality')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.DATA_QUALITY}
        />
      );

      const tabContent = container.querySelector(
        '.entity-right-panel-tab-content'
      );
      const dataQualityText = container.querySelector(
        '.text-center.text-grey-muted.p-lg'
      );

      expect(tabContent).toBeInTheDocument();
      expect(dataQualityText).toBeInTheDocument();
    });
  });

  describe('Custom Properties Tab Content', () => {
    it('should render custom properties content when customProperties are provided', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editCustomAttributePermission
          viewAllPermission
          activeTab={EntityRightPanelTab.CUSTOM_PROPERTIES}
          customProperties={mockCustomProperties}
        />
      );

      expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
      expect(screen.getByTestId('has-edit-access')).toBeInTheDocument();
      expect(
        screen.getByTestId('custom-property-has-permission')
      ).toBeInTheDocument();
    });

    it('should not render custom properties content when customProperties are not provided', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.CUSTOM_PROPERTIES}
        />
      );

      expect(
        screen.queryByTestId('custom-property-table')
      ).not.toBeInTheDocument();
    });

    it('should render CustomPropertyTable with correct props', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.CUSTOM_PROPERTIES}
          customProperties={mockCustomProperties}
          editCustomAttributePermission={false}
          viewAllPermission={false}
        />
      );

      expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
      expect(screen.queryByTestId('has-edit-access')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('custom-property-has-permission')
      ).not.toBeInTheDocument();
    });

    it('should render with correct CSS class', () => {
      const { container } = render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.CUSTOM_PROPERTIES}
          customProperties={mockCustomProperties}
        />
      );

      expect(
        container.querySelector('.entity-right-panel-tab-content')
      ).toBeInTheDocument();
    });
  });

  describe('Tab Switching', () => {
    it('should render overview content when activeTab is OVERVIEW', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.OVERVIEW}
        />
      );

      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
      expect(
        screen.getByTestId('tags-container-Classification')
      ).toBeInTheDocument();
    });

    it('should render schema content when activeTab is SCHEMA', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.SCHEMA}
        />
      );

      expect(screen.getByTestId('partitioned-keys')).toBeInTheDocument();
      expect(
        screen.queryByTestId('data-products-container')
      ).not.toBeInTheDocument();
    });

    it('should render lineage content when activeTab is LINEAGE', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.LINEAGE}
        />
      );

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
      expect(
        screen.queryByTestId('data-products-container')
      ).not.toBeInTheDocument();
    });

    it('should render data quality content when activeTab is DATA_QUALITY', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.DATA_QUALITY}
        />
      );

      expect(screen.getByText('label.data-quality')).toBeInTheDocument();
      expect(
        screen.queryByTestId('data-products-container')
      ).not.toBeInTheDocument();
    });

    it('should render custom properties content when activeTab is CUSTOM_PROPERTIES', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={EntityRightPanelTab.CUSTOM_PROPERTIES}
          customProperties={mockCustomProperties}
        />
      );

      expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
      expect(
        screen.queryByTestId('data-products-container')
      ).not.toBeInTheDocument();
    });

    it('should default to overview content for unknown tab', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          activeTab={'UNKNOWN' as EntityRightPanelTab}
        />
      );

      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
    });
  });

  describe('Permission Handling', () => {
    it('should pass correct permissions to DataProductsContainer', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editDataProductPermission
          onDataProductUpdate={mockOnDataProductUpdate}
        />
      );

      expect(
        screen.getByTestId('data-products-has-permission')
      ).toBeInTheDocument();
      expect(screen.getByTestId('has-save-callback')).toBeInTheDocument();
    });

    it('should pass correct permissions to TagsContainerV2 for Classification', () => {
      render(<EntityRightPanelContent {...defaultProps} editTagPermission />);

      expect(
        screen.getByTestId('Classification-has-permission')
      ).toBeInTheDocument();
    });

    it('should pass correct permissions to TagsContainerV2 for Glossary', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editGlossaryTermsPermission
        />
      );

      expect(screen.getByTestId('Glossary-has-permission')).toBeInTheDocument();
    });

    it('should pass correct permissions to CustomPropertyTable', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editCustomAttributePermission
          viewAllPermission
          activeTab={EntityRightPanelTab.CUSTOM_PROPERTIES}
          customProperties={mockCustomProperties}
        />
      );

      expect(screen.getByTestId('has-edit-access')).toBeInTheDocument();
      expect(
        screen.getByTestId('custom-property-has-permission')
      ).toBeInTheDocument();
    });
  });

  describe('Context Data Usage', () => {
    it('should use domains and dataProducts from context', () => {
      render(<EntityRightPanelContent {...defaultProps} />);

      // The mock DataProductsContainer should receive the context data
      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
    });

    it('should use entityFQN from useFqn hook', () => {
      render(<EntityRightPanelContent {...defaultProps} />);

      // The mock TagsContainerV2 should receive the entityFQN
      expect(
        screen.getByTestId('tags-container-Classification')
      ).toBeInTheDocument();
    });

    it('should use entityId from context for KnowledgeArticles', () => {
      const mockKnowledgeArticles = jest
        .fn()
        .mockImplementation(({ entityId }) => (
          <div data-testid="knowledge-articles">Entity ID: {entityId}</div>
        ));

      (
        entityRightPanelClassBase.getKnowLedgeArticlesWidget as jest.Mock
      ).mockReturnValue(mockKnowledgeArticles);

      render(<EntityRightPanelContent {...defaultProps} />);

      expect(screen.getByText('Entity ID: test-entity-id')).toBeInTheDocument();
    });
  });

  describe('Entity Type Handling', () => {
    it('should pass entityType to TagsContainerV2 components', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          entityType={EntityType.DASHBOARD}
        />
      );

      expect(
        screen.getByTestId('tags-container-Classification')
      ).toBeInTheDocument();
      expect(screen.getByTestId('tags-container-Glossary')).toBeInTheDocument();
    });

    it('should pass entityType to KnowledgeArticles', () => {
      const mockKnowledgeArticles = jest
        .fn()
        .mockImplementation(({ entityType }) => (
          <div data-testid="knowledge-articles">Entity Type: {entityType}</div>
        ));

      (
        entityRightPanelClassBase.getKnowLedgeArticlesWidget as jest.Mock
      ).mockReturnValue(mockKnowledgeArticles);

      render(
        <EntityRightPanelContent
          {...defaultProps}
          entityType={EntityType.DASHBOARD}
        />
      );

      expect(screen.getByText('Entity Type: dashboard')).toBeInTheDocument();
    });
  });

  describe('Callback Functions', () => {
    it('should pass onTagSelectionChange to TagsContainerV2 components', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(
        screen.getByTestId('Classification-has-selection-callback')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('Glossary-has-selection-callback')
      ).toBeInTheDocument();
    });

    it('should pass onDataProductUpdate to DataProductsContainer', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          onDataProductUpdate={mockOnDataProductUpdate}
        />
      );

      expect(screen.getByTestId('has-save-callback')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing context data gracefully', () => {
      const { useGenericContext } = jest.requireMock(
        '../../Customization/GenericProvider/GenericProvider'
      );
      useGenericContext.mockReturnValue({ data: null });

      render(<EntityRightPanelContent {...defaultProps} />);

      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
    });

    it('should handle missing fqn gracefully', () => {
      const { useFqn } = jest.requireMock('../../../hooks/useFqn');
      useFqn.mockReturnValue({ fqn: null });

      render(<EntityRightPanelContent {...defaultProps} />);

      expect(
        screen.getByTestId('tags-container-Classification')
      ).toBeInTheDocument();
    });

    it('should handle undefined permissions gracefully', () => {
      render(
        <EntityRightPanelContent
          {...defaultProps}
          editDataProductPermission={false}
          editGlossaryTermsPermission={false}
          editTagPermission={false}
        />
      );

      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
      expect(
        screen.getByTestId('tags-container-Classification')
      ).toBeInTheDocument();
    });
  });
});
