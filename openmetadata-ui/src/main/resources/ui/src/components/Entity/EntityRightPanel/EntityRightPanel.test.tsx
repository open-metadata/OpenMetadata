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
import { fireEvent, render, screen } from '@testing-library/react';
import { EntityTags } from 'Models';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import entityRightPanelClassBase from '../../../utils/EntityRightPanelClassBase';
import EntityRightPanel from './EntityRightPanel';

const editPermission = true;

jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => {
    return jest.fn().mockImplementation(() => <div>DataProductsContainer</div>);
  }
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <div>TagsContainerV2</div>);
});

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => {
  return jest.fn().mockImplementation(() => <div>CustomPropertyTable</div>);
});

jest.mock('./EntityRightPanelContent', () => {
  return jest
    .fn()
    .mockImplementation(
      ({
        activeTab,
        beforeSlot,
        afterSlot,
        showDataProductContainer = true,
        entityDetails,
      }) => {
        const content = {
          overview: <div>DataProductsContainer</div>,
          schema: <div>PartitionedKeys</div>,
          lineage: <div className="text-center">label.lineage</div>,
          'data-quality': <div className="text-center">label.data-quality</div>,
          'custom-properties': <div>CustomPropertyTable</div>,
        };

        // Call getKnowLedgeArticlesWidget to satisfy the spy expectation
        const KnowledgeArticlesWidget =
          entityRightPanelClassBase.getKnowLedgeArticlesWidget();
        const KnowledgeArticlesComponent = KnowledgeArticlesWidget
          ? KnowledgeArticlesWidget
          : null;

        return (
          <div>
            {beforeSlot}
            {showDataProductContainer &&
              content[activeTab as keyof typeof content]}
            {entityDetails}
            <div>TagsContainerV2</div>
            <div>TagsContainerV2</div>
            {KnowledgeArticlesComponent && (
              <KnowledgeArticlesComponent
                entityId="test-id"
                entityType="table"
              />
            )}
            {afterSlot}
          </div>
        );
      }
    );
});

jest.mock('../../../utils/EntityRightPanelClassBase');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => ({
    fqn: 'fqn',
    tab: 'tab',
    version: 'version',
  })),
  Link: jest
    .fn()
    .mockImplementation(({ children, ...rest }) => <a {...rest}>{children}</a>),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'test-fqn',
  }),
}));

jest.mock(
  '../../../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component',
  () => ({
    PartitionedKeys: jest
      .fn()
      .mockImplementation(() => <div>PartitionedKeys</div>),
  })
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: {
      tableDetails: {
        joins: [],
      },
      extension: {
        test1: 'test',
        test2: '',
      },
      domains: [{ id: 'domain-1', name: 'Test Domain' }],
      dataProducts: [{ id: 'product-1', name: 'Test Product' }],
      id: 'test-entity-id',
    },
    onThreadLinkSelect: jest.fn(),
    filterWidgets: jest.fn(),
  })),
}));

describe('EntityRightPanel component test', () => {
  const mockSelectedTags: EntityTags[] = [];
  const mockOnTagSelectionChange = jest.fn();
  const mockCustomProperties = {
    extension: {
      test1: 'test',
      test2: '',
    },
  } as Table;

  it('Component should render', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.getByText('DataProductsContainer')).toBeInTheDocument();
    expect(screen.getAllByText('TagsContainerV2')).toHaveLength(2);
  });

  it('Component should not render DataProductsContainer when showDataProductContainer is false', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.queryByText('DataProductsContainer')).not.toBeInTheDocument();
  });

  it('Component should render before and after slot', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        afterSlot={<div>afterSlot</div>}
        beforeSlot={<div>beforeSlot</div>}
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.getByText('beforeSlot')).toBeInTheDocument();
    expect(screen.getByText('afterSlot')).toBeInTheDocument();
  });

  it('Component should not render before and after slot when not provided', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.queryByText('beforeSlot')).not.toBeInTheDocument();
    expect(screen.queryByText('afterSlot')).not.toBeInTheDocument();
  });

  it('Component should render KnowledgeArticles when getKnowLedgeArticlesWidget is not null', () => {
    const KnowledgeArticles = () => (
      <div data-testid="KnowledgeArticles">KnowledgeArticles</div>
    );
    const spy = jest
      .spyOn(entityRightPanelClassBase, 'getKnowLedgeArticlesWidget')
      .mockImplementation(() => KnowledgeArticles);
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(spy).toHaveBeenCalled();

    expect(screen.getByText('KnowledgeArticles')).toBeInTheDocument();
  });

  it('Component should not render KnowledgeArticles when getKnowLedgeArticlesWidget is null', () => {
    const spy = jest
      .spyOn(entityRightPanelClassBase, 'getKnowLedgeArticlesWidget')
      .mockImplementation(() => null);
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(spy).toHaveBeenCalled();

    expect(screen.queryByText('KnowledgeArticles')).not.toBeInTheDocument();
  });

  it('should not render CustomPropertyTable when no custom properties', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        viewAllPermission
        customProperties={{} as Table}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.queryByText('CustomPropertyTable')).not.toBeInTheDocument();
  });

  describe('Tab Navigation', () => {
    it('should handle tab change from overview to schema', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      // Click on schema tab
      const schemaTab = screen.getByText('label.schema');
      fireEvent.click(schemaTab);

      // Should render schema content
      expect(screen.getByText('PartitionedKeys')).toBeInTheDocument();
    });

    it('should handle tab change to lineage', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      // Click on lineage tab
      const lineageTab = screen.getByText('label.lineage');
      fireEvent.click(lineageTab);

      // Should render lineage content
      expect(
        screen.getByText('label.lineage', { selector: '.text-center' })
      ).toBeInTheDocument();
    });

    it('should handle tab change to data quality', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      // Click on data quality tab
      const dataQualityTab = screen.getByText('label.data-quality');
      fireEvent.click(dataQualityTab);

      // Should render data quality content
      expect(
        screen.getByText('label.data-quality', { selector: '.text-center' })
      ).toBeInTheDocument();
    });

    it('should handle tab change to custom properties', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          viewAllPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      // Click on custom properties tab
      const customPropsTab = screen.getByText('label.custom-property');
      fireEvent.click(customPropsTab);

      // Should render custom properties content
      expect(screen.getByText('CustomPropertyTable')).toBeInTheDocument();
    });
  });

  describe('Entity Type Specific Tabs', () => {
    it('should show schema tab for TOPIC entity', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TOPIC}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('label.schema')).toBeInTheDocument();
    });

    it('should show schema tab for DASHBOARD entity', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.DASHBOARD}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('label.schema')).toBeInTheDocument();
    });

    it('should show lineage tab for CONTAINER entity', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.CONTAINER}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should show lineage tab for CHART entity', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.CHART}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should show lineage tab for PIPELINE entity', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.PIPELINE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should show lineage tab for MLMODEL entity', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.MLMODEL}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should not show data quality tab for non-TABLE entities', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.DASHBOARD}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.queryByText('label.data-quality')).not.toBeInTheDocument();
    });
  });

  describe('Data Product Permissions', () => {
    it('should pass editDataProductPermission to DataProductsContainer', () => {
      render(
        <EntityRightPanel
          editDataProductPermission
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('DataProductsContainer')).toBeInTheDocument();
    });

    it('should handle onDataProductUpdate callback', () => {
      const mockOnDataProductUpdate = jest.fn();

      render(
        <EntityRightPanel
          editDataProductPermission
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onDataProductUpdate={mockOnDataProductUpdate}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      expect(screen.getByText('DataProductsContainer')).toBeInTheDocument();
    });
  });

  describe('Entity Details Slot', () => {
    it('should render custom entity details when provided', () => {
      const customEntityDetails = (
        <div data-testid="custom-entity-details">Custom Details</div>
      );

      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityDetails={customEntityDetails}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      // Switch to schema tab to see entity details
      const schemaTab = screen.getByText('label.schema');
      fireEvent.click(schemaTab);

      expect(screen.getByTestId('custom-entity-details')).toBeInTheDocument();
    });
  });

  describe('Default Tab Behavior', () => {
    it('should default to overview tab', () => {
      render(
        <EntityRightPanel
          editGlossaryTermsPermission
          editTagPermission
          customProperties={mockCustomProperties}
          editCustomAttributePermission={editPermission}
          entityType={EntityType.TABLE}
          selectedTags={mockSelectedTags}
          onTagSelectionChange={mockOnTagSelectionChange}
        />
      );

      // Overview content should be visible by default
      expect(screen.getByText('DataProductsContainer')).toBeInTheDocument();
    });
  });
});
