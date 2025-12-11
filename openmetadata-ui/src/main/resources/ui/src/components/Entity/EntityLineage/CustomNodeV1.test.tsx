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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { ModelType } from '../../../generated/entity/data/table';
import { LineageLayer } from '../../../generated/settings/settings';
import CustomNodeV1Component from './CustomNodeV1.component';

interface PaginationAssertionParams {
  columnsContainer: HTMLElement;
  expectedPageText: string;
  expectedColumns: string[];
  direction: 'next' | 'prev';
  shouldBeDisabled?: 'prev' | 'next';
}

const getColumnsFromContainer = (columnsContainer: HTMLElement): string[] => {
  return Array.from(
    columnsContainer.querySelectorAll('[data-testid^="column-"]')
  ).map((el) => el.textContent?.trim() ?? '');
};

const getColumnsFromCurrentPage = (columnsContainer: HTMLElement): string[] => {
  const insidePageContainer = columnsContainer.querySelector(
    '.inside-current-page-items'
  );

  return insidePageContainer
    ? Array.from(
        insidePageContainer.querySelectorAll('.inside-current-page-item')
      ).map((el) => el.textContent?.trim() ?? '')
    : [];
};

const assertPaginationState = ({
  columnsContainer,
  expectedPageText,
  expectedColumns,
  direction,
  shouldBeDisabled,
}: PaginationAssertionParams): void => {
  const prevButton = within(columnsContainer).getByTestId('prev-btn');
  const nextButton = within(columnsContainer).getByTestId('next-btn');
  const button = direction === 'next' ? nextButton : prevButton;

  expect(screen.getByText(expectedPageText)).toBeInTheDocument();

  const visibleColumns = getColumnsFromCurrentPage(columnsContainer);

  expect(visibleColumns).toEqual(expectedColumns);

  if (shouldBeDisabled === 'prev') {
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  } else if (shouldBeDisabled === 'next') {
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();
  } else {
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  }

  act(() => {
    fireEvent.click(button);
  });
};

const mockNodeDataProps = {
  id: 'node1',
  type: 'table',
  data: {
    node: {
      fullyQualifiedName: 'dim_customer',
      type: 'table',
      entityType: 'table',
      id: 'khjahjfja',
      columns: [...Array(12)].map((_, i) => ({
        fullyQualifiedName: `col${i}`,
        name: `col${i}`,
        dataType: 'VARCHAR',
      })),
      testSuite: {
        deleted: false,
        description: 'This is an executable test suite linked to an entity',
        displayName: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.testSuite',
        id: 'fafada0f-a2e7-4dbe-a65c-8de057a63a7c',
        name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
        type: 'testSuite',
      },
    },
  },
  selected: false,
  isConnectable: false,
  xPos: 0,
  yPos: 0,
  dragging: true,
  zIndex: 0,
};

const mockNodeDataProps2 = {
  id: 'node1',
  type: 'table',
  data: {
    node: {
      fullyQualifiedName: 'dim_customer',
      type: 'table',
      entityType: 'table',
      id: 'khjahjfja',
      columns: [...Array(3)].map((_, i) => ({
        fullyQualifiedName: `col${i}`,
        name: `col${i}`,
        dataType: 'VARCHAR',
      })),
      dataModel: {
        modelType: ModelType.Dbt,
      },
    },
  },
  selected: false,
  isConnectable: false,
  xPos: 0,
  yPos: 0,
  dragging: true,
  zIndex: 0,
};

const onMockColumnClick = jest.fn();
const loadChildNodesHandlerMock = jest.fn();
const updateNodeInternalsMock = jest.fn();
const useUpdateNodeInternalsMock = jest.fn(() => updateNodeInternalsMock);
let columnsInCurrentPages: string[] = [];
const setColumnsInCurrentPagesMock = jest.fn((updater) => {
  if (typeof updater === 'function') {
    columnsInCurrentPages = updater(columnsInCurrentPages);
  } else {
    columnsInCurrentPages = updater;
  }
});
let isColumnLayerActive = false;
let isDataObservabilityLayerActive = false;
let tracedColumns: string[] = [];
let columnsHavingLineage: string[] = [];

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn(() => ({
    tracedNodes: [],
    get tracedColumns() {
      return tracedColumns;
    },
    get columnsHavingLineage() {
      return columnsHavingLineage;
    },
    pipelineStatus: {},
    nodes: [
      {
        mockNodeDataProps,
      },
    ],
    upstreamDownstreamData: {
      upstreamNodes: [],
      downstreamNodes: [],
      upstreamEdges: [],
      downstreamEdges: [],
    },
    get activeLayer() {
      return [
        ...(isColumnLayerActive ? [LineageLayer.ColumnLevelLineage] : []),
        ...(isDataObservabilityLayerActive
          ? [LineageLayer.DataObservability]
          : []),
      ];
    },
    expandAllColumns: true,
    fetchPipelineStatus: jest.fn(),
    onColumnClick: onMockColumnClick,
    loadChildNodesHandler: loadChildNodesHandlerMock,
    useUpdateNodeInternals: useUpdateNodeInternalsMock,
    setColumnsInCurrentPages: setColumnsInCurrentPagesMock,
  })),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn().mockImplementation(() =>
    Promise.resolve({
      testPassed: 5,
      testFailed: 2,
      testAborted: 1,
    })
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'label.slash-symbol') {
        return '/';
      }

      return key;
    },
  }),
}));

describe('CustomNodeV1', () => {
  beforeEach(() => {
    isColumnLayerActive = false;
    isDataObservabilityLayerActive = false;
    tracedColumns = [];
    columnsHavingLineage = [];
    jest.clearAllMocks();
  });

  it('renders node correctly', () => {
    isColumnLayerActive = true;
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('lineage-node-dim_customer')).toBeInTheDocument();
  });

  it('renders node with dbt icon correctly', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps2} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('lineage-node-dim_customer')).toBeInTheDocument();
    expect(screen.getByTestId('dbt-icon')).toBeInTheDocument();
  });

  it('should render footer only when there are children', () => {
    isColumnLayerActive = true;
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    expect(
      screen.getByTestId('children-info-dropdown-btn')
    ).toBeInTheDocument();
  });

  it('should not render footer when there are no children', () => {
    isColumnLayerActive = true;

    const mockNodeDataPropsNoChildren = {
      ...mockNodeDataProps,
      data: {
        node: {
          ...mockNodeDataProps.data.node,
          columns: [],
        },
      },
    };

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataPropsNoChildren} />
      </ReactFlowProvider>
    );

    expect(
      screen.queryByTestId('children-info-dropdown-btn')
    ).not.toBeInTheDocument();
  });

  it('should render searchbar when column layer is applied and node has children', () => {
    isColumnLayerActive = true;

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('search-column-input')).toBeInTheDocument();
  });

  it('should not remove searchbar from node when no columns are matched while searching', () => {
    isColumnLayerActive = true;

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const searchInput = screen.getByTestId(
      'search-column-input'
    ) as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: 'nonExistingColumn' } });

    expect(screen.getByTestId('search-column-input')).toBeInTheDocument();
  });

  it('should render NodeChildren when column layer is applied and there are no columns', () => {
    isColumnLayerActive = true;

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('column-container')).toBeInTheDocument();
  });

  it('should not render NodeChildren when column layer is applied but there are no columns', () => {
    isColumnLayerActive = true;

    const mockNodeDataPropsNoChildren = {
      ...mockNodeDataProps,
      data: {
        node: {
          ...mockNodeDataProps.data.node,
          columns: [],
        },
      },
    };

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataPropsNoChildren} />
      </ReactFlowProvider>
    );

    expect(screen.queryByTestId('column-container')).not.toBeInTheDocument();
  });

  it('should toggle columns list when children dropdown button is clicked', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const button = screen.getByTestId('children-info-dropdown-btn');

    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByText('col1')).toBeInTheDocument();
    expect(screen.getByText('col2')).toBeInTheDocument();
    expect(screen.getByText('col3')).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.queryByText('col1')).not.toBeInTheDocument();
    expect(screen.queryByText('col2')).not.toBeInTheDocument();
    expect(screen.queryByText('col3')).not.toBeInTheDocument();
  });

  it('should have expand and expand all buttons', () => {
    isColumnLayerActive = true;
    isDataObservabilityLayerActive = true;

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const expandBtn = screen.getByTestId('plus-icon');

    expect(expandBtn).toBeInTheDocument();

    fireEvent.mouseOver(expandBtn);

    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
  });

  it('should expand all when expand all button is clicked', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const expandBtn = screen.getByTestId('plus-icon');

    fireEvent.click(expandBtn);

    expect(loadChildNodesHandlerMock).toHaveBeenCalledWith(
      expect.any(Object),
      'Downstream',
      1
    );

    fireEvent.mouseOver(expandBtn);

    const expandAllBtn = screen.getByTestId('lineage-expand-all-btn');

    fireEvent.click(expandAllBtn);

    expect(loadChildNodesHandlerMock).toHaveBeenCalledWith(
      expect.any(Object),
      'Downstream',
      50
    );
  });

  it('should have Test summary widget when observability layer is applied', async () => {
    isDataObservabilityLayerActive = true;
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    await act(async () => {
      jest.runAllTimers(); // or jest.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('test-passed')).toBeInTheDocument();
    expect(screen.getByTestId('test-aborted')).toBeInTheDocument();
    expect(screen.getByTestId('test-failed')).toBeInTheDocument();
  });

  describe('CustomNodeV1 Column Pagination', () => {
    const clickFilterButton = () => {
      const filterButton = screen.getByTestId('lineage-filter-button');
      fireEvent.click(filterButton);
    };

    it('should have pagination in columns', () => {
      isColumnLayerActive = true;
      columnsHavingLineage = ['col0', 'col2', 'col5', 'col7', 'col10'];

      render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      clickFilterButton();

      const columnsContainer = screen.getByTestId('column-container');

      expect(columnsContainer).toBeInTheDocument();

      assertPaginationState({
        columnsContainer,
        expectedPageText: '1 / 3',
        expectedColumns: ['col0', 'col1', 'col2', 'col3', 'col4'],
        direction: 'next',
        shouldBeDisabled: 'prev',
      });

      assertPaginationState({
        columnsContainer,
        expectedPageText: '2 / 3',
        expectedColumns: ['col5', 'col6', 'col7', 'col8', 'col9'],
        direction: 'next',
      });

      assertPaginationState({
        columnsContainer,
        expectedPageText: '3 / 3',
        expectedColumns: ['col10', 'col11'],
        direction: 'prev',
        shouldBeDisabled: 'next',
      });

      assertPaginationState({
        columnsContainer,
        expectedPageText: '2 / 3',
        expectedColumns: ['col5', 'col6', 'col7', 'col8', 'col9'],
        direction: 'prev',
      });

      assertPaginationState({
        columnsContainer,
        expectedPageText: '1 / 3',
        expectedColumns: ['col0', 'col1', 'col2', 'col3', 'col4'],
        direction: 'next',
        shouldBeDisabled: 'prev',
      });
    });

    it('should select a column when it is clicked', () => {
      isColumnLayerActive = true;
      columnsHavingLineage = ['col0', 'col2', 'col5', 'col7', 'col10'];

      render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      clickFilterButton();

      const column = screen.getByTestId('column-col0');

      fireEvent.click(column);

      expect(onMockColumnClick).toHaveBeenCalledWith('col0');
    });

    it('should keep the traced column visible when page changes', () => {
      isColumnLayerActive = true;
      columnsHavingLineage = ['col0', 'col2', 'col3', 'col5', 'col7', 'col10'];

      const { rerender } = render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      clickFilterButton();

      expect(screen.getByText('1 / 3')).toBeVisible();
      expect(screen.getByTestId('column-col3')).not.toHaveClass(
        'custom-node-header-column-tracing'
      );

      tracedColumns = ['col3'];

      rerender(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      const nextButton = screen.getByTestId('next-btn');
      act(() => {
        fireEvent.click(nextButton);
      });

      expect(screen.getByText('2 / 3')).toBeVisible();
      expect(screen.getByTestId('column-col3')).toHaveClass(
        'custom-node-header-column-tracing'
      );
    });
  });

  describe('Only show columns with lineage', () => {
    const clickFilterButton = () => {
      const filterButton = screen.getByTestId('lineage-filter-button');
      fireEvent.click(filterButton);
    };

    describe('Column Filter', () => {
      it('should only render columns with lineage when filter is activated', () => {
        isColumnLayerActive = false;
        let visibleColumns = [];
        columnsHavingLineage = ['col0', 'col2', 'col5', 'col7', 'col10'];

        render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...mockNodeDataProps} />
          </ReactFlowProvider>
        );

        const expandButton = screen.getByTestId('children-info-dropdown-btn');
        act(() => fireEvent.click(expandButton));

        const columnsContainer = screen.getByTestId('column-container');
        visibleColumns = getColumnsFromCurrentPage(columnsContainer);

        expect(visibleColumns).toEqual([
          'col0',
          'col1',
          'col2',
          'col3',
          'col4',
        ]);

        expect(screen.getByText('1 / 3')).toBeInTheDocument();

        const filterButton = screen.getByTestId('lineage-filter-button');

        expect(filterButton).toBeInTheDocument();
        expect(filterButton).not.toHaveClass('active');

        act(() => fireEvent.click(filterButton));

        expect(filterButton).toHaveClass('active');

        visibleColumns = getColumnsFromContainer(columnsContainer);

        expect(visibleColumns).toEqual([
          'col0',
          'col2',
          'col5',
          'col7',
          'col10',
        ]);

        expect(screen.queryByTestId('prev-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('next-btn')).not.toBeInTheDocument();
        expect(screen.queryByText('1 / 3')).not.toBeInTheDocument();
      });

      it('should enable the filter by default for node when column layer is activated', () => {
        isColumnLayerActive = true;
        columnsHavingLineage = ['col0', 'col2', 'col5'];

        render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...mockNodeDataProps} />
          </ReactFlowProvider>
        );

        const filterButton = screen.getByTestId('lineage-filter-button');

        expect(filterButton).toBeInTheDocument();
        expect(filterButton).toHaveClass('active');

        const columnsContainer = screen.getByTestId('column-container');
        const visibleColumns = getColumnsFromContainer(columnsContainer);

        expect(visibleColumns).toEqual(['col0', 'col2', 'col5']);
        expect(screen.queryByTestId('prev-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('next-btn')).not.toBeInTheDocument();
      });

      it('should maintain filter state when another layer is applied', () => {
        isColumnLayerActive = true;
        columnsHavingLineage = ['col0', 'col2', 'col5'];

        const { rerender } = render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...mockNodeDataProps} />
          </ReactFlowProvider>
        );

        const filterButton = screen.getByTestId('lineage-filter-button');

        expect(filterButton).toHaveClass('active');

        isDataObservabilityLayerActive = true;

        rerender(
          <ReactFlowProvider>
            <CustomNodeV1Component {...mockNodeDataProps} />
          </ReactFlowProvider>
        );

        const filterButtonAfterRerender = screen.getByTestId(
          'lineage-filter-button'
        );

        expect(filterButtonAfterRerender).toHaveClass('active');
      });
    });

    describe('Nested Columns Display', () => {
      it('should show full nested columns when filter is activated if any sub-column has lineage', () => {
        isColumnLayerActive = true;

        const nestedColumnsNode = {
          ...mockNodeDataProps,
          data: {
            node: {
              ...mockNodeDataProps.data.node,
              columns: [
                {
                  fullyQualifiedName: 'parent1',
                  name: 'parent1',
                  dataType: 'RECORD',
                  children: [
                    {
                      fullyQualifiedName: 'parent1.child1',
                      name: 'parent1.child1',
                      dataType: 'VARCHAR',
                    },
                    {
                      fullyQualifiedName: 'parent1.child2',
                      name: 'parent1.child2',
                      dataType: 'VARCHAR',
                    },
                  ],
                },
                {
                  fullyQualifiedName: 'parent2',
                  name: 'parent2',
                  dataType: 'RECORD',
                  children: [
                    {
                      fullyQualifiedName: 'parent2.child1',
                      name: 'parent2.child1',
                      dataType: 'VARCHAR',
                    },
                  ],
                },
                {
                  fullyQualifiedName: 'col0',
                  name: 'col0',
                  dataType: 'VARCHAR',
                },
              ],
            },
          },
        };

        columnsHavingLineage = ['parent1.child2'];

        render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...nestedColumnsNode} />
          </ReactFlowProvider>
        );

        /**
         * by default filter is activated when column layer is applied
         * so asserting the activated state that only columns with lineage
         * are visible, rest are hidden
         */
        expect(screen.getByText('parent1')).toBeInTheDocument();
        expect(screen.getByText('parent1.child1')).toBeInTheDocument();
        expect(screen.getByText('parent1.child2')).toBeInTheDocument();
        expect(screen.queryByText('parent2')).not.toBeInTheDocument();
        expect(screen.queryByText('parent2.child1')).not.toBeInTheDocument();
        expect(screen.queryByText('col0')).not.toBeInTheDocument();

        clickFilterButton();
        /**
         * After filter button is deactivated asserting that all columns
         * are visible, none is hidden
         */
        expect(screen.getByText('parent1')).toBeInTheDocument();
        expect(screen.getByText('parent1.child1')).toBeInTheDocument();
        expect(screen.getByText('parent1.child2')).toBeInTheDocument();
        expect(screen.queryByText('parent2')).toBeInTheDocument();
        expect(screen.queryByText('parent2.child1')).toBeInTheDocument();
        expect(screen.queryByText('col0')).toBeInTheDocument();
      });
    });

    describe('Filter with Search', () => {
      it('should only search among columns with lineage when filter is activated and column is searched', () => {
        isColumnLayerActive = true;
        columnsHavingLineage = ['col0', 'col2', 'col5', 'col7', 'col10'];

        render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...mockNodeDataProps} />
          </ReactFlowProvider>
        );

        let columnsContainer = screen.getByTestId('column-container');
        let visibleColumns = getColumnsFromContainer(columnsContainer);

        expect(visibleColumns).toEqual([
          'col0',
          'col2',
          'col5',
          'col7',
          'col10',
        ]);

        const searchInput = screen.getByTestId(
          'search-column-input'
        ) as HTMLInputElement;

        act(() => {
          fireEvent.change(searchInput, { target: { value: 'col1' } });
        });

        columnsContainer = screen.getByTestId('column-container');
        visibleColumns = getColumnsFromContainer(columnsContainer);

        expect(visibleColumns).toEqual(['col10']);
        expect(visibleColumns).not.toContain('col1');
        expect(visibleColumns).not.toContain('col11');
      });
    });
  });
});
