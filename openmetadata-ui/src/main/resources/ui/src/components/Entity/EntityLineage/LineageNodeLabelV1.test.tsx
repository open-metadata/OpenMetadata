/*
 *  Copyright 2024 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { ModelType } from '../../../generated/entity/data/table';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import LineageNodeLabelV1 from './LineageNodeLabelV1';

jest.mock('../../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn(),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'message.only-show-columns-with-lineage') {
        return 'Only show columns with Lineage';
      }

      return key;
    },
  }),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getServiceIcon: jest.fn(() => <div>ServiceIcon</div>),
  getEntityTypeIcon: jest.fn(() => <div>EntityIcon</div>),
}));

jest.mock('../../../utils/EntityLineageUtils', () => ({
  getEntityChildrenAndLabel: jest.fn((node) => {
    const childrenCount = node.columns?.length ?? node.tasks?.length ?? 0;
    const isPlural = childrenCount !== 1;
    let childrenHeading = 'Columns';

    if (node.entityType === 'pipeline') {
      childrenHeading = isPlural ? 'Tasks' : 'Task';
    } else if (node.entityType === 'table') {
      childrenHeading = isPlural ? 'Columns' : 'Column';
    }

    return {
      children: node.columns ?? node.tasks ?? [],
      childrenHeading,
      childrenCount,
    };
  }),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getBreadcrumbsFromFqn: jest.fn((fqn) => {
    if (!fqn) {
      return [];
    }
    const parts = fqn.split('.');

    return parts.slice(0, -1).map((part) => ({ name: part }));
  }),
  getEntityName: jest.fn((entity) => entity.name || entity.displayName || ''),
}));

const mockToggleColumnsList = jest.fn();
const mockToggleOnlyShowColumnsWithLineageFilterActive = jest.fn();

const mockBasicNode = {
  id: 'test-node-id',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
  name: 'dim_customer',
  entityType: EntityType.TABLE,
  deleted: false,
  columns: [
    { name: 'col1', dataType: 'VARCHAR', fullyQualifiedName: 'col1' },
    { name: 'col2', dataType: 'VARCHAR', fullyQualifiedName: 'col2' },
    { name: 'col3', dataType: 'VARCHAR', fullyQualifiedName: 'col3' },
  ],
};

const mockNodeWithDbt = {
  ...mockBasicNode,
  dataModel: {
    modelType: ModelType.Dbt,
    resourceType: 'model',
  },
};

const mockNodeWithDbtSeed = {
  ...mockBasicNode,
  dataModel: {
    modelType: ModelType.Dbt,
    resourceType: 'seed',
  },
};

const mockDeletedNode = {
  ...mockBasicNode,
  deleted: true,
};

const mockNodeWithTestSuite = {
  ...mockBasicNode,
  testSuite: {
    id: 'test-suite-id',
    name: 'test-suite-name',
    fullyQualifiedName: 'test-suite-fqn',
    type: 'testSuite',
  },
};

const mockNodeWithoutChildren = {
  id: 'test-node-no-children',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.no_children',
  name: 'no_children',
  entityType: EntityType.TABLE,
  deleted: false,
  columns: [],
};

const defaultLineageStore = {
  isDQEnabled: false,
  isEditMode: false,
};

describe('LineageNodeLabelV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLineageStore as unknown as jest.Mock).mockReturnValue(
      defaultLineageStore
    );
    (getTestCaseExecutionSummary as jest.Mock).mockResolvedValue({
      testPassed: 5,
      testFailed: 2,
      testAborted: 1,
    });
  });

  describe('EntityLabel Component', () => {
    it('should render entity label with display name', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
        />
      );

      expect(
        screen.getByTestId('entity-header-display-name')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('entity-header-display-name')
      ).toHaveTextContent('dim_customer');
    });

    it('should render breadcrumbs from fully qualified name', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
        />
      );

      const breadcrumbs = screen.getByTestId('lineage-breadcrumbs');

      expect(breadcrumbs).toBeInTheDocument();

      expect(screen.getByText('sample_data')).toBeInTheDocument();
      expect(screen.getByText('ecommerce_db')).toBeInTheDocument();
      expect(screen.getByText('shopify')).toBeInTheDocument();
    });

    it('should render dbt icon when node has dbt model', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithDbt}
        />
      );

      expect(screen.getByTestId('dbt-icon')).toBeInTheDocument();
    });

    it('should not render dbt icon when node has dbt seed resource type', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithDbtSeed}
        />
      );

      expect(screen.queryByTestId('dbt-icon')).not.toBeInTheDocument();
    });

    it('should render deleted icon when node is deleted', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockDeletedNode}
        />
      );

      expect(screen.getByTestId('node-deleted-icon')).toBeInTheDocument();
    });

    it('should not render dbt icon when node is deleted', () => {
      const deletedNodeWithDbt = {
        ...mockNodeWithDbt,
        deleted: true,
      };

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={deletedNodeWithDbt}
        />
      );

      expect(screen.queryByTestId('dbt-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('node-deleted-icon')).toBeInTheDocument();
    });

    it('should render service icon', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
        />
      );

      expect(screen.getByText('ServiceIcon')).toBeInTheDocument();
    });
  });

  describe('EntityFooter Component', () => {
    it('should render footer when node has columns', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
          toggleColumnsList={mockToggleColumnsList}
        />
      );

      expect(
        screen.getByTestId('children-info-dropdown-btn')
      ).toBeInTheDocument();
      expect(screen.getByText('3 Columns')).toBeInTheDocument();
    });

    it('should not render footer when node has no children', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithoutChildren}
        />
      );

      expect(
        screen.queryByTestId('children-info-dropdown-btn')
      ).not.toBeInTheDocument();
    });

    it('should render entity type chip', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
        />
      );

      expect(screen.getByText('Table')).toBeInTheDocument();
      expect(screen.getByText('EntityIcon')).toBeInTheDocument();
    });

    it('should toggle columns list when dropdown button is clicked', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
          toggleColumnsList={mockToggleColumnsList}
        />
      );

      const dropdownButton = screen.getByTestId('children-info-dropdown-btn');
      fireEvent.click(dropdownButton);

      expect(mockToggleColumnsList).toHaveBeenCalledTimes(1);
    });

    it('should apply expanded class when columns are expanded', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded
          node={mockBasicNode}
          toggleColumnsList={mockToggleColumnsList}
        />
      );

      const dropdownButton = screen.getByTestId('children-info-dropdown-btn');

      expect(dropdownButton).toHaveClass('expanded');
    });

    it('should apply collapsed class when columns are not expanded', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
          toggleColumnsList={mockToggleColumnsList}
        />
      );

      const dropdownButton = screen.getByTestId('children-info-dropdown-btn');

      expect(dropdownButton).toHaveClass('collapsed');
    });

    it('should render filter button', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      expect(screen.getByTestId('lineage-filter-button')).toBeInTheDocument();
    });

    it('should apply active class to filter button when filter is active', () => {
      render(
        <LineageNodeLabelV1
          isOnlyShowColumnsWithLineageFilterActive
          isChildrenListExpanded={false}
          node={mockBasicNode}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      const filterButton = screen.getByTestId('lineage-filter-button');

      expect(filterButton).toHaveClass('active');
    });

    it('should not apply active class when filter is inactive', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      const filterButton = screen.getByTestId('lineage-filter-button');

      expect(filterButton).not.toHaveClass('active');
    });

    it('should toggle filter when filter button is clicked', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      const filterButton = screen.getByTestId('lineage-filter-button');
      fireEvent.click(filterButton);

      expect(
        mockToggleOnlyShowColumnsWithLineageFilterActive
      ).toHaveBeenCalledTimes(1);
    });

    it('should disable filter button in edit mode', () => {
      (useLineageStore as unknown as jest.Mock).mockReturnValue({
        ...defaultLineageStore,
        isEditMode: true,
      });

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      const filterButton = screen.getByTestId('lineage-filter-button');

      expect(filterButton).toBeDisabled();
    });

    it('should show tooltip on filter button hover', async () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      const filterButton = screen.getByTestId('lineage-filter-button');
      fireEvent.mouseOver(filterButton);

      await waitFor(() => {
        expect(
          screen.getByText('Only show columns with Lineage')
        ).toBeInTheDocument();
      });
    });

    it('should stop event propagation when dropdown button is clicked', () => {
      const stopPropagation = jest.fn();

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
          toggleColumnsList={mockToggleColumnsList}
        />
      );

      const dropdownButton = screen.getByTestId('children-info-dropdown-btn');
      const event = new MouseEvent('click', { bubbles: true });
      event.stopPropagation = stopPropagation;

      fireEvent(dropdownButton, event);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it('should stop event propagation when filter button is clicked', () => {
      const stopPropagation = jest.fn();

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      const filterButton = screen.getByTestId('lineage-filter-button');
      const event = new MouseEvent('click', { bubbles: true });
      event.stopPropagation = stopPropagation;

      fireEvent(filterButton, event);

      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('TestSuiteSummaryContainer Component', () => {
    it('should not render test summary when DQ is disabled', () => {
      (useLineageStore as unknown as jest.Mock).mockReturnValue({
        ...defaultLineageStore,
        isDQEnabled: false,
      });

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithTestSuite}
        />
      );

      expect(screen.queryByTestId('test-passed')).not.toBeInTheDocument();
    });

    it('should render test summary when DQ is enabled and node has test suite', async () => {
      (useLineageStore as unknown as jest.Mock).mockReturnValue({
        ...defaultLineageStore,
        isDQEnabled: true,
      });

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithTestSuite}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-passed')).toBeInTheDocument();
      });

      expect(getTestCaseExecutionSummary).toHaveBeenCalledWith('test-suite-id');
    });

    it('should not render test summary when node has no test suite', () => {
      (useLineageStore as unknown as jest.Mock).mockReturnValue({
        ...defaultLineageStore,
        isDQEnabled: true,
      });

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
        />
      );

      expect(screen.queryByTestId('test-passed')).not.toBeInTheDocument();
    });

    it('should handle test suite API error gracefully', async () => {
      (useLineageStore as unknown as jest.Mock).mockReturnValue({
        ...defaultLineageStore,
        isDQEnabled: true,
      });
      (getTestCaseExecutionSummary as jest.Mock).mockRejectedValueOnce(
        new Error('API Error')
      );

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithTestSuite}
        />
      );

      await waitFor(() => {
        expect(getTestCaseExecutionSummary).toHaveBeenCalled();
      });
    });

    it('should not fetch test summary if already fetched', async () => {
      (useLineageStore as unknown as jest.Mock).mockReturnValue({
        ...defaultLineageStore,
        isDQEnabled: true,
      });

      const { rerender } = render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithTestSuite}
        />
      );

      await waitFor(() => {
        expect(getTestCaseExecutionSummary).toHaveBeenCalledTimes(1);
      });

      rerender(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockNodeWithTestSuite}
        />
      );

      expect(getTestCaseExecutionSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle node without fullyQualifiedName', () => {
      const nodeWithoutFqn = {
        ...mockBasicNode,
        fullyQualifiedName: '',
      };

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={nodeWithoutFqn}
        />
      );

      expect(
        screen.getByTestId('entity-header-display-name')
      ).toBeInTheDocument();
    });

    it('should handle node without name', () => {
      const nodeWithoutName = {
        ...mockBasicNode,
        name: '',
      };

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={nodeWithoutName}
        />
      );

      expect(
        screen.getByTestId('entity-header-display-name')
      ).toBeInTheDocument();
    });

    it('should handle callbacks being undefined', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={mockBasicNode}
        />
      );

      const dropdownButton = screen.getByTestId('children-info-dropdown-btn');
      fireEvent.click(dropdownButton);

      expect(mockToggleColumnsList).not.toHaveBeenCalled();
    });

    it('should handle filter toggle callback being undefined', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
        />
      );

      const filterButton = screen.getByTestId('lineage-filter-button');
      fireEvent.click(filterButton);

      expect(
        mockToggleOnlyShowColumnsWithLineageFilterActive
      ).not.toHaveBeenCalled();
    });

    it('should handle node with single column', () => {
      const nodeWithOneColumn = {
        ...mockBasicNode,
        columns: [
          { name: 'col1', dataType: 'VARCHAR', fullyQualifiedName: 'col1' },
        ],
      };

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={nodeWithOneColumn}
        />
      );

      expect(screen.getByText('1 Column')).toBeInTheDocument();
    });

    it('should handle node with multiple entity types', () => {
      const pipelineNode = {
        ...mockBasicNode,
        entityType: 'pipeline',
        tasks: [{ name: 'task1' }, { name: 'task2' }],
        columns: undefined,
      };

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={pipelineNode}
        />
      );

      expect(screen.getByText('2 Tasks')).toBeInTheDocument();
    });

    it('should handle very long breadcrumb names', () => {
      const nodeWithLongFqn = {
        ...mockBasicNode,
        fullyQualifiedName:
          'very_long_service_name.very_long_database_name.very_long_schema_name.very_long_table_name',
      };

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          node={nodeWithLongFqn}
        />
      );

      expect(screen.getByText('very_long_service_name')).toBeInTheDocument();
      expect(screen.getByText('very_long_database_name')).toBeInTheDocument();
      expect(screen.getByText('very_long_schema_name')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('should render complete component with all features enabled', async () => {
      (useLineageStore as unknown as jest.Mock).mockReturnValue({
        isDQEnabled: true,
        isEditMode: false,
      });

      render(
        <LineageNodeLabelV1
          isChildrenListExpanded
          isOnlyShowColumnsWithLineageFilterActive
          node={mockNodeWithTestSuite}
          toggleColumnsList={mockToggleColumnsList}
          toggleOnlyShowColumnsWithLineageFilterActive={
            mockToggleOnlyShowColumnsWithLineageFilterActive
          }
        />
      );

      expect(
        screen.getByTestId('entity-header-display-name')
      ).toBeInTheDocument();
      expect(screen.getByTestId('lineage-breadcrumbs')).toBeInTheDocument();
      expect(
        screen.getByTestId('children-info-dropdown-btn')
      ).toBeInTheDocument();
      expect(screen.getByTestId('lineage-filter-button')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('test-passed')).toBeInTheDocument();
      });
    });

    it('should work correctly with all props set to false/undefined', () => {
      render(
        <LineageNodeLabelV1
          isChildrenListExpanded={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockBasicNode}
        />
      );

      expect(
        screen.getByTestId('entity-header-display-name')
      ).toBeInTheDocument();
      expect(screen.getByTestId('lineage-filter-button')).not.toHaveClass(
        'active'
      );
      expect(screen.getByTestId('children-info-dropdown-btn')).toHaveClass(
        'collapsed'
      );
    });
  });
});
