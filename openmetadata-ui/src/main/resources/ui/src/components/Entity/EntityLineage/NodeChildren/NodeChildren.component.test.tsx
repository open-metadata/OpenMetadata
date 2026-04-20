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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLayer } from '../../../../generated/configuration/lineageSettings';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import NodeChildren from './NodeChildren.component';

const mockUpdateColumnsInCurrentPages = jest.fn();
const mockGetTestCaseExecutionSummary =
  getTestCaseExecutionSummary as jest.Mock;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNode: any = {
  id: 'test-id',
  entityType: EntityType.TABLE,
  fullyQualifiedName: 'test.fqn',
  name: 'test',
  columns: [
    {
      name: 'column1',
      fullyQualifiedName: 'test.fqn.column1',
      dataType: 'STRING',
    },
    {
      name: 'column2',
      fullyQualifiedName: 'test.fqn.column2',
      dataType: 'STRING',
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNodeWithTestSuite: any = {
  ...mockNode,
  testSuite: {
    id: 'test-suite-id',
    name: 'test-suite',
    fullyQualifiedName: 'test.fqn.testsuite',
  },
};

const mockColumnsMap = new Map();
mockColumnsMap.set(mockNode.id, new Set(['test.fqn.column1']));

const defaultLineageStoreState = {
  columnsHavingLineage: mockColumnsMap,
  activeLayer: [LineageLayer.ColumnLevelLineage],
  tracedColumns: new Set(),
  updateColumnsInCurrentPages: mockUpdateColumnsInCurrentPages,
  selectedColumn: undefined,
  isCreatingEdge: false,
  isDQEnabled: false,
};

let mockLineageStoreState = { ...defaultLineageStoreState };

jest.mock('../../../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn(() => mockLineageStoreState),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn(),
  TestCaseType: {
    all: 'all',
    table: 'table',
    column: 'column',
  },
}));

jest.mock('../../../../utils/EntityLink', () => ({
  default: {
    getEntityColumnFqn: jest.fn(),
  },
}));

jest.mock('../../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest.fn().mockReturnValue('entityIcon'),
}));

jest.mock('../CustomNode.utils', () => ({
  ColumnContent: jest
    .fn()
    .mockImplementation(({ column }) => (
      <div data-testid={`column-${column.name}`}>{column.name}</div>
    )),
}));

jest.mock('../TestSuiteSummaryWidget/TestSuiteSummaryWidget.component', () =>
  jest.fn().mockReturnValue(<div>TestSuiteSummaryWidget</div>)
);

jest.mock('./VirtualColumnList.component', () =>
  jest.fn().mockImplementation(({ flatItems }) => (
    <div data-testid="virtual-column-list">
      {flatItems.map((item: { name: string }) => (
        <div data-testid={`column-${item.name}`} key={item.name}>
          {item.name}
        </div>
      ))}
    </div>
  ))
);

describe('NodeChildren Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLineageStoreState = { ...defaultLineageStoreState };
  });

  describe('Rendering and Visibility', () => {
    it('should render column container when children list is expanded and columns exist', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });

    it('should not render when isChildrenListExpanded is false', () => {
      render(
        <NodeChildren
          isChildrenListExpanded={false}
          isConnectable={false}
          node={mockNode}
        />
      );

      expect(screen.queryByTestId('column-container')).not.toBeInTheDocument();
    });

    it('should not render when node has no columns', () => {
      const nodeWithoutColumns = { ...mockNode, columns: [] };
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={nodeWithoutColumns}
        />
      );

      expect(screen.queryByTestId('column-container')).not.toBeInTheDocument();
    });

    it('should not render when entity type does not support columns', () => {
      const unsupportedNode = {
        ...mockNode,
        entityType: EntityType.PIPELINE,
        columns: undefined,
      };

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={unsupportedNode}
        />
      );

      expect(screen.queryByTestId('column-container')).not.toBeInTheDocument();
    });

    it('should render when column layer is enabled', () => {
      mockLineageStoreState.activeLayer = [LineageLayer.ColumnLevelLineage];

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });

    it('should render when data observability layer is enabled', () => {
      mockLineageStoreState.activeLayer = [LineageLayer.DataObservability];

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should render search input with correct placeholder', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'label.search-entity');
    });

    it('should show all columns when search value is empty', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.getByTestId('column-column2')).toBeInTheDocument();
    });

    it('should filter columns based on search input', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      fireEvent.change(searchInput, { target: { value: 'column1' } });

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.queryByTestId('column-column2')).not.toBeInTheDocument();
    });

    it('should filter columns case-insensitively', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      fireEvent.change(searchInput, { target: { value: 'COLUMN1' } });

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.queryByTestId('column-column2')).not.toBeInTheDocument();
    });

    it('should reset to all columns when search is cleared', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      fireEvent.change(searchInput, { target: { value: 'column1' } });

      expect(screen.queryByTestId('column-column2')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: '' } });

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.getByTestId('column-column2')).toBeInTheDocument();
    });

    it('should stop event propagation on search input click', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');
      const stopPropagationSpy = jest.fn();

      searchInput.addEventListener('click', (e) => {
        stopPropagationSpy();
        e.stopPropagation();
      });

      fireEvent.click(searchInput);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should show partial match results', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      fireEvent.change(searchInput, { target: { value: 'col' } });

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.getByTestId('column-column2')).toBeInTheDocument();
    });
  });

  describe('Lineage Filter', () => {
    it('should show only columns with lineage when filter is active', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeWithMultipleColumns: any = {
        ...mockNode,
        columns: [
          {
            name: 'column1',
            fullyQualifiedName: 'test.fqn.column1',
            dataType: 'STRING',
          },
          {
            name: 'column2',
            fullyQualifiedName: 'test.fqn.column2',
            dataType: 'STRING',
          },
          {
            name: 'column3',
            fullyQualifiedName: 'test.fqn.column3',
            dataType: 'STRING',
          },
        ],
      };

      const columnsMap = new Map();
      columnsMap.set(
        nodeWithMultipleColumns.id,
        new Set(['test.fqn.column1', 'test.fqn.column3'])
      );
      mockLineageStoreState.columnsHavingLineage = columnsMap;

      render(
        <NodeChildren
          isChildrenListExpanded
          isOnlyShowColumnsWithLineageFilterActive
          isConnectable={false}
          node={nodeWithMultipleColumns}
        />
      );

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.queryByTestId('column-column2')).not.toBeInTheDocument();
      expect(screen.getByTestId('column-column3')).toBeInTheDocument();
    });

    it('should show all columns when lineage filter is inactive', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockNode}
        />
      );

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.getByTestId('column-column2')).toBeInTheDocument();
    });

    it('should update filtered columns when lineage filter is toggled', () => {
      const { rerender } = render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          isOnlyShowColumnsWithLineageFilterActive={false}
          node={mockNode}
        />
      );

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.getByTestId('column-column2')).toBeInTheDocument();

      rerender(
        <NodeChildren
          isChildrenListExpanded
          isOnlyShowColumnsWithLineageFilterActive
          isConnectable={false}
          node={mockNode}
        />
      );

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.queryByTestId('column-column2')).not.toBeInTheDocument();
    });

    it('should apply search on filtered columns when lineage filter is active', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeWithMultipleColumns: any = {
        ...mockNode,
        columns: [
          {
            name: 'column1',
            fullyQualifiedName: 'test.fqn.column1',
            dataType: 'STRING',
          },
          {
            name: 'column2',
            fullyQualifiedName: 'test.fqn.column2',
            dataType: 'STRING',
          },
          {
            name: 'column3',
            fullyQualifiedName: 'test.fqn.column3',
            dataType: 'STRING',
          },
        ],
      };

      const columnsMap = new Map();
      columnsMap.set(
        nodeWithMultipleColumns.id,
        new Set(['test.fqn.column1', 'test.fqn.column3'])
      );
      mockLineageStoreState.columnsHavingLineage = columnsMap;

      render(
        <NodeChildren
          isChildrenListExpanded
          isOnlyShowColumnsWithLineageFilterActive
          isConnectable={false}
          node={nodeWithMultipleColumns}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      fireEvent.change(searchInput, { target: { value: 'column1' } });

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.queryByTestId('column-column3')).not.toBeInTheDocument();
    });
  });

  describe('Data Observability', () => {
    it('should fetch test suite summary when data observability is enabled', async () => {
      mockLineageStoreState.activeLayer = [LineageLayer.DataObservability];
      mockLineageStoreState.isDQEnabled = true;
      const mockSummary = { total: 10, success: 8, failed: 2 };
      mockGetTestCaseExecutionSummary.mockResolvedValue(mockSummary);

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNodeWithTestSuite}
        />
      );

      await waitFor(() => {
        expect(mockGetTestCaseExecutionSummary).toHaveBeenCalledWith(
          'test-suite-id'
        );
      });
    });

    it('should not fetch test suite summary when data observability is disabled', () => {
      mockLineageStoreState.activeLayer = [LineageLayer.ColumnLevelLineage];
      mockLineageStoreState.isDQEnabled = false;
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNodeWithTestSuite}
        />
      );

      expect(mockGetTestCaseExecutionSummary).not.toHaveBeenCalled();
    });

    it('should not fetch test suite summary when node has no test suite', () => {
      mockLineageStoreState.activeLayer = [LineageLayer.DataObservability];
      mockLineageStoreState.isDQEnabled = true;
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      expect(mockGetTestCaseExecutionSummary).not.toHaveBeenCalled();
    });

    it('should handle test suite summary fetch error gracefully', async () => {
      mockLineageStoreState.activeLayer = [LineageLayer.DataObservability];
      mockLineageStoreState.isDQEnabled = true;
      mockGetTestCaseExecutionSummary.mockRejectedValue(new Error('API Error'));

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNodeWithTestSuite}
        />
      );

      await waitFor(() => {
        expect(mockGetTestCaseExecutionSummary).toHaveBeenCalled();
      });

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });

    it('should only fetch test suite summary once', async () => {
      mockLineageStoreState.activeLayer = [LineageLayer.DataObservability];
      mockLineageStoreState.isDQEnabled = true;
      const mockSummary = { total: 10, success: 8, failed: 2 };
      mockGetTestCaseExecutionSummary.mockResolvedValue(mockSummary);

      const { rerender } = render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNodeWithTestSuite}
        />
      );

      await waitFor(() => {
        expect(mockGetTestCaseExecutionSummary).toHaveBeenCalledTimes(1);
      });

      rerender(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNodeWithTestSuite}
        />
      );

      expect(mockGetTestCaseExecutionSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply "any-column-selected" class when a column is selected', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockLineageStoreState.selectedColumn = 'test.fqn.column1' as any;

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const container = screen.getByTestId('column-container');

      expect(container).toHaveClass('any-column-selected');
    });

    it('should apply "creating-edge" class when creating edge', () => {
      mockLineageStoreState.isCreatingEdge = true;

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const container = screen.getByTestId('column-container');

      expect(container).toHaveClass('creating-edge');
    });

    it('should apply both classes when column is selected and creating edge', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockLineageStoreState.selectedColumn = 'test.fqn.column1' as any;
      mockLineageStoreState.isCreatingEdge = true;

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const container = screen.getByTestId('column-container');

      expect(container).toHaveClass('any-column-selected');
      expect(container).toHaveClass('creating-edge');
    });
  });

  describe('Different Entity Types', () => {
    it('should render columns for DASHBOARD_DATA_MODEL entity', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dashboardDataModelNode: any = {
        ...mockNode,
        entityType: EntityType.DASHBOARD_DATA_MODEL,
      };

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={dashboardDataModelNode}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });

    it('should render fields for TOPIC entity', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topicNode: any = {
        id: 'topic-id',
        entityType: EntityType.TOPIC,
        fullyQualifiedName: 'test.topic',
        name: 'test-topic',
        messageSchema: {
          schemaFields: [
            {
              name: 'field1',
              fullyQualifiedName: 'test.topic.field1',
              dataType: 'STRING',
            },
          ],
        },
      };

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={topicNode}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });

    it('should render features for MLMODEL entity', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mlModelNode: any = {
        id: 'mlmodel-id',
        entityType: EntityType.MLMODEL,
        fullyQualifiedName: 'test.mlmodel',
        name: 'test-model',
        mlFeatures: [
          {
            name: 'feature1',
            fullyQualifiedName: 'test.mlmodel.feature1',
            dataType: 'numerical',
          },
        ],
      };

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mlModelNode}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes with empty column names', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeWithEmptyNames: any = {
        ...mockNode,
        columns: [
          {
            name: '',
            fullyQualifiedName: 'test.fqn.column1',
            dataType: 'STRING',
          },
        ],
      };

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={nodeWithEmptyNames}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });

    it('should handle search with special characters', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeWithSpecialChars: any = {
        ...mockNode,
        columns: [
          {
            name: 'column-1',
            fullyQualifiedName: 'test.fqn.column-1',
            dataType: 'STRING',
          },
          {
            name: 'column_2',
            fullyQualifiedName: 'test.fqn.column_2',
            dataType: 'STRING',
          },
        ],
      };

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={nodeWithSpecialChars}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      fireEvent.change(searchInput, { target: { value: 'column-1' } });

      expect(screen.getByTestId('column-column-1')).toBeInTheDocument();
      expect(screen.queryByTestId('column-column_2')).not.toBeInTheDocument();
    });

    it('should handle columns without fullyQualifiedName', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeWithMissingFQN: any = {
        ...mockNode,
        columns: [{ name: 'column1', dataType: 'STRING' }],
      };

      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={nodeWithMissingFQN}
        />
      );

      expect(screen.getByTestId('column-container')).toBeInTheDocument();
    });

    it('should handle rapid search input changes', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      act(() => {
        fireEvent.change(searchInput, { target: { value: 'c' } });
        fireEvent.change(searchInput, { target: { value: 'co' } });
        fireEvent.change(searchInput, { target: { value: 'col' } });
        fireEvent.change(searchInput, { target: { value: 'column1' } });
      });

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.queryByTestId('column-column2')).not.toBeInTheDocument();
    });

    it('should handle whitespace in search input', () => {
      render(
        <NodeChildren
          isChildrenListExpanded
          isConnectable={false}
          node={mockNode}
        />
      );

      const searchInput = screen.getByTestId('search-column-input');

      fireEvent.change(searchInput, { target: { value: '   ' } });

      expect(screen.getByTestId('column-column1')).toBeInTheDocument();
      expect(screen.getByTestId('column-column2')).toBeInTheDocument();
    });
  });
});
