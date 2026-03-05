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
import { useLineageStore } from '../../../hooks/useLineageStore';
import CustomNodeV1Component from './CustomNodeV1.component';

interface PaginationAssertionParams {
  columnsContainer: HTMLElement;
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
  expectedColumns,
  direction,
  shouldBeDisabled,
}: PaginationAssertionParams): void => {
  const prevButton = within(columnsContainer).getByTestId('column-scroll-up');
  const nextButton = within(columnsContainer).getByTestId('column-scroll-down');
  const button = direction === 'next' ? nextButton : prevButton;

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
  columns: [
    {
      name: 'col0',
      dataType: 'VARCHAR',
      fullyQualifiedName: 'col0',
    },
  ],
  selected: false,
  isConnectable: false,
  xPos: 0,
  yPos: 0,
  dragging: true,
  zIndex: 0,
};

const loadChildNodesHandlerMock = jest.fn();

let columnsInCurrentPages: string[] = [];
const setColumnsInCurrentPagesMock = jest.fn((updater) => {
  if (typeof updater === 'function') {
    columnsInCurrentPages = updater(columnsInCurrentPages);
  } else {
    columnsInCurrentPages = updater;
  }
});

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn(() => ({
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
    fetchPipelineStatus: jest.fn(),
    loadChildNodesHandler: loadChildNodesHandlerMock,
  })),
}));

const mockSetSelectedColumn = jest.fn();
const mockSetNodeFilterState = jest.fn();

jest.mock('../../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn(() => ({
    setLineageConfig: jest.fn(),
    setColumnsInCurrentPagesMock: setColumnsInCurrentPagesMock,
    isColumnLevelLineage: false,
    isDQEnabled: false,
    tracedNodes: new Set(),
    tracedColumns: new Set(),
    columnsHavingLineage: new Map([['id', new Set()]]),
    isEditMode: false,
    updateColumnsInCurrentPages: jest.fn(),
    setSelectedColumn: mockSetSelectedColumn,
    nodeFilterState: new Map(),
    setNodeFilterState: mockSetNodeFilterState,
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
      if (key === 'message.only-show-columns-with-lineage') {
        return 'Only show columns with Lineage';
      }

      return key;
    },
  }),
}));

describe('CustomNodeV1', () => {
  it('renders node correctly', () => {
    (useLineageStore as unknown as jest.Mock).mockImplementationOnce(() => ({
      isColumnLevelLineage: true,
      isDQEnabled: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

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

  it('should render breadcrumb for node full path', () => {
    const nodeWithFqn = {
      ...mockNodeDataProps,
      data: {
        node: {
          ...mockNodeDataProps.data.node,
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
        },
      },
    };

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...nodeWithFqn} />
      </ReactFlowProvider>
    );

    const breadcrumbContainer = screen.getByTestId('lineage-breadcrumbs');

    expect(breadcrumbContainer).toBeInTheDocument();

    const breadcrumbItems = within(breadcrumbContainer).getAllByText(
      (_content, element) =>
        element?.classList.contains('lineage-breadcrumb-item') ?? false
    );

    expect(breadcrumbItems).toHaveLength(3);
    expect(breadcrumbItems[0]).toHaveTextContent('sample_data');
    expect(breadcrumbItems[1]).toHaveTextContent('ecommerce_db');
    expect(breadcrumbItems[2]).toHaveTextContent('shopify');

    const separators = breadcrumbContainer.querySelectorAll(
      '.lineage-breadcrumb-item-separator'
    );

    expect(separators).toHaveLength(2);
  });

  it('should render footer only when there are children', () => {
    (useLineageStore as unknown as jest.Mock).mockImplementationOnce(() => ({
      isColumnLevelLineage: true,
      isDQ: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

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
    (useLineageStore as unknown as jest.Mock).mockImplementationOnce(() => ({
      isColumnLevelLineage: true,
      isDQ: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

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

  it('should render searchbar when column layer is applied and node has children', async () => {
    (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
      isColumnLevelLineage: true,
      isDQ: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      updateColumnsInCurrentPages: jest.fn(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    expect(
      await screen.findByTestId('search-column-input')
    ).toBeInTheDocument();
  });

  it('should not remove searchbar from node when no columns are matched while searching', () => {
    (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
      isColumnLevelLineage: true,
      isDQ: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      updateColumnsInCurrentPages: jest.fn(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

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
    (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
      isColumnLevelLineage: true,
      isDQ: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      updateColumnsInCurrentPages: jest.fn(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('column-container')).toBeInTheDocument();
  });

  it('should not render NodeChildren when column layer is applied but there are no columns', () => {
    (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
      isColumnLevelLineage: true,
      isDQ: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      updateColumnsInCurrentPages: jest.fn(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

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
    (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
      isColumnLevelLineage: false,
      isDQEnabled: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      columnsHavingLineage: new Map(),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
      updateColumnsInCurrentPages: jest.fn(),
      setSelectedColumn: mockSetSelectedColumn,
    }));
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const button = screen.getByTestId('children-info-dropdown-btn');

    expect(button).toBeInTheDocument();

    act(() => {
      fireEvent.click(button);
    });

    expect(screen.getByText('col1')).toBeInTheDocument();
    expect(screen.getByText('col2')).toBeInTheDocument();
    expect(screen.getByText('col3')).toBeInTheDocument();

    act(() => {
      fireEvent.click(button);
    });

    expect(screen.queryByText('col1')).not.toBeInTheDocument();
    expect(screen.queryByText('col2')).not.toBeInTheDocument();
    expect(screen.queryByText('col3')).not.toBeInTheDocument();
  });

  it('should have expand and expand all buttons', () => {
    (useLineageStore as unknown as jest.Mock).mockImplementationOnce(() => ({
      isColumnLevelLineage: true,
      isDQEnabled: false,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

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
    (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
      isColumnLevelLineage: true,
      isDQEnabled: true,
      tracedColumns: new Set(),
      tracedNodes: new Set(),
      updateColumnsInCurrentPages: jest.fn(),
      columnsHavingLineage: new Map([['id', new Set()]]),
      isEditMode: false,
      nodeFilterState: new Map(),
      setNodeFilterState: mockSetNodeFilterState,
    }));

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    await act(async () => {
      jest.runAllTimers();
    });

    expect(screen.getAllByTestId('test-passed').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('test-aborted').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('test-failed').length).toBeGreaterThan(0);
  });

  describe('CustomNodeV1 Column Pagination', () => {
    const clickFilterButton = () => {
      const filterButton = screen.getByTestId('lineage-filter-button');
      fireEvent.click(filterButton);
    };

    it('should have pagination in columns', () => {
      (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
        isColumnLevelLineage: true,
        isDQEnabled: false,
        tracedColumns: new Set(),
        tracedNodes: new Set(),
        columnsHavingLineage: new Map([
          ['id', new Set(['col0', 'col2', 'col5', 'col7', 'col10'])],
        ]),
        isEditMode: false,
        updateColumnsInCurrentPages: jest.fn(),
        nodeFilterState: new Map(),
        setNodeFilterState: mockSetNodeFilterState,
      }));

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
        expectedColumns: [
          'col0',
          'col1',
          'col2',
          'col3',
          'col4',
          'col5',
          'col6',
          'col7',
          'col8',
          'col9',
        ],
        direction: 'next',
        shouldBeDisabled: 'prev',
      });

      assertPaginationState({
        columnsContainer,
        expectedColumns: [
          'col2',
          'col3',
          'col4',
          'col5',
          'col6',
          'col7',
          'col8',
          'col9',
          'col10',
          'col11',
        ],
        direction: 'prev',
        shouldBeDisabled: 'next',
      });

      assertPaginationState({
        columnsContainer,
        expectedColumns: [
          'col0',
          'col1',
          'col2',
          'col3',
          'col4',
          'col5',
          'col6',
          'col7',
          'col8',
          'col9',
        ],
        direction: 'next',
        shouldBeDisabled: 'prev',
      });
    });

    it('should select a column when it is clicked', () => {
      (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
        isColumnLevelLineage: true,
        isDQEnabled: false,
        tracedColumns: new Set(),
        tracedNodes: new Set(),
        columnsHavingLineage: new Map([
          ['id', new Set(['col0', 'col2', 'col5', 'col7', 'col10'])],
        ]),
        isEditMode: false,
        updateColumnsInCurrentPages: jest.fn(),
        setSelectedColumn: mockSetSelectedColumn,
        nodeFilterState: new Map(),
        setNodeFilterState: mockSetNodeFilterState,
      }));

      render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      clickFilterButton();

      const column = screen.getByTestId('column-col0');

      fireEvent.click(column);

      expect(mockSetSelectedColumn).toHaveBeenCalledWith('col0');
    });

    it('should keep the traced column visible when page changes', () => {
      let tracedColumns = new Set<string>();
      (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
        isColumnLevelLineage: true,
        isDQEnabled: false,
        tracedColumns,
        tracedNodes: new Set(),
        columnsHavingLineage: new Map([
          [
            'id',
            new Set([
              'col0',
              'col1',
              'col2',
              'col3',
              'col4',
              'col5',
              'col6',
              'col7',
              'col8',
              'col9',
              'col10',
            ]),
          ],
        ]),
        isEditMode: false,
        updateColumnsInCurrentPages: jest.fn(),
        setSelectedColumn: mockSetSelectedColumn,
        nodeFilterState: new Map(),
        setNodeFilterState: mockSetNodeFilterState,
      }));

      const { rerender } = render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      clickFilterButton();

      expect(screen.getByTestId('column-col3')).not.toHaveClass(
        'custom-node-header-column-tracing'
      );

      tracedColumns = new Set(['col10']);

      rerender(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      const nextButton = screen.getByTestId('column-scroll-down');
      act(() => {
        fireEvent.click(nextButton);
      });

      expect(screen.getByTestId('column-col10')).toHaveClass(
        'custom-node-header-column-tracing'
      );
    });
  });

  describe('Only show columns with lineage', () => {
    const clickFilterButton = () => {
      const filterButton = screen.getByTestId('lineage-filter-button');
      fireEvent.click(filterButton);
    };

    it('should render tooltip on hovering filter button in lineage node', async () => {
      (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
        isColumnLevelLineage: true,
        isDQEnabled: false,
        tracedColumns: new Set(),
        tracedNodes: new Set(),
        columnsHavingLineage: new Map([
          ['id', new Set(['col0', 'col2', 'col5'])],
        ]),
        isEditMode: false,
        updateColumnsInCurrentPages: jest.fn(),
        setSelectedColumn: mockSetSelectedColumn,
        nodeFilterState: new Map(),
        setNodeFilterState: mockSetNodeFilterState,
      }));

      render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      const filterButton = screen.getByTestId('lineage-filter-button');

      expect(filterButton).toBeInTheDocument();

      fireEvent.mouseOver(filterButton);

      expect(
        await screen.findByText('Only show columns with Lineage')
      ).toBeInTheDocument();
    });

    describe('Column Filter', () => {
      it('should only render columns with lineage when filter is on', () => {
        let visibleColumns = [];
        const nodeFilterStateMap = new Map([['khjahjfja', false]]);
        const mockSetNodeFilterStateFunc = jest.fn(
          (nodeId: string, isVisible: boolean) => {
            nodeFilterStateMap.set(nodeId, isVisible);
          }
        );

        (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
          isColumnLevelLineage: false,
          isDQEnabled: false,
          tracedColumns: new Set(),
          tracedNodes: new Set(),
          columnsHavingLineage: new Map([
            ['khjahjfja', new Set(['col0', 'col2', 'col5', 'col7', 'col10'])],
          ]),
          isEditMode: false,
          updateColumnsInCurrentPages: jest.fn(),
          setSelectedColumn: mockSetSelectedColumn,
          nodeFilterState: nodeFilterStateMap,
          setNodeFilterState: mockSetNodeFilterStateFunc,
        }));

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
          'col5',
          'col6',
          'col7',
          'col8',
          'col9',
        ]);

        const filterButton = screen.getByTestId('lineage-filter-button');

        expect(filterButton).toBeInTheDocument();
        expect(filterButton).not.toHaveClass('active');

        act(() => {
          fireEvent.click(filterButton);
        });

        expect(mockSetNodeFilterStateFunc).toHaveBeenCalledWith(
          'khjahjfja',
          true
        );
        expect(nodeFilterStateMap.get('khjahjfja')).toBe(true);
      });

      it('should turn on the filter when column layer is applied', () => {
        const nodeFilterStateMap = new Map([['khjahjfja', true]]);
        (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
          isColumnLevelLineage: true,
          isDQEnabled: false,
          tracedColumns: new Set(),
          tracedNodes: new Set(),
          columnsHavingLineage: new Map([
            ['khjahjfja', new Set(['col0', 'col2', 'col5'])],
          ]),
          isEditMode: false,
          updateColumnsInCurrentPages: jest.fn(),
          setSelectedColumn: mockSetSelectedColumn,
          nodeFilterState: nodeFilterStateMap,
          setNodeFilterState: mockSetNodeFilterState,
        }));

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
      });

      it('should maintain filter state when another layer is applied', () => {
        const nodeFilterStateMap = new Map([['khjahjfja', true]]);
        (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
          isColumnLevelLineage: true,
          isDQEnabled: false,
          tracedColumns: new Set(),
          tracedNodes: new Set(),
          columnsHavingLineage: new Map([
            ['khjahjfja', new Set(['col0', 'col2', 'col5'])],
          ]),
          isEditMode: false,
          updateColumnsInCurrentPages: jest.fn(),
          setSelectedColumn: mockSetSelectedColumn,
          nodeFilterState: nodeFilterStateMap,
          setNodeFilterState: mockSetNodeFilterState,
        }));

        const { rerender } = render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...mockNodeDataProps} />
          </ReactFlowProvider>
        );

        const filterButton = screen.getByTestId('lineage-filter-button');

        expect(filterButton).toHaveClass('active');

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

      it('should disable turn off and disable the filter in edit mode', () => {
        const nodeFilterStateMap = new Map([['khjahjfja', false]]);
        (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
          isColumnLevelLineage: false,
          isDQEnabled: false,
          tracedColumns: new Set(),
          tracedNodes: new Set(),
          columnsHavingLineage: new Map([
            ['khjahjfja', new Set(['col0', 'col2', 'col5'])],
          ]),
          isEditMode: true,
          updateColumnsInCurrentPages: jest.fn(),
          setSelectedColumn: mockSetSelectedColumn,
          nodeFilterState: nodeFilterStateMap,
          setNodeFilterState: mockSetNodeFilterState,
        }));

        render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...mockNodeDataProps} />
          </ReactFlowProvider>
        );

        const filterButton = screen.getByTestId('lineage-filter-button');

        expect(filterButton).not.toHaveClass('active');
        expect(filterButton).toBeDisabled();
      });
    });

    describe('Nested Columns Display', () => {
      it('should show full nested columns when filter is activated if any sub-column has lineage', () => {
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
                },
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
                {
                  fullyQualifiedName: 'parent2',
                  name: 'parent2',
                  dataType: 'RECORD',
                  children: [],
                },
                {
                  fullyQualifiedName: 'parent2.child1',
                  name: 'parent2.child1',
                  dataType: 'VARCHAR',
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
        const columnsLineageMap = new Map();
        columnsLineageMap.set('khjahjfja', new Set(['parent1.child2']));
        const nodeFilterStateMap = new Map([['khjahjfja', true]]);
        const mockSetNodeFilterStateFunc = jest.fn(
          (nodeId: string, isVisible: boolean) => {
            nodeFilterStateMap.set(nodeId, isVisible);
          }
        );

        (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
          isColumnLevelLineage: true,
          isDQEnabled: false,
          tracedColumns: new Set(),
          tracedNodes: new Set(),
          columnsHavingLineage: columnsLineageMap,
          isEditMode: false,
          updateColumnsInCurrentPages: jest.fn(),
          setSelectedColumn: mockSetSelectedColumn,
          nodeFilterState: nodeFilterStateMap,
          setNodeFilterState: mockSetNodeFilterStateFunc,
        }));

        render(
          <ReactFlowProvider>
            <CustomNodeV1Component {...nestedColumnsNode} />
          </ReactFlowProvider>
        );

        expect(screen.queryByText('parent1')).not.toBeInTheDocument();
        expect(screen.queryByText('parent1.child1')).not.toBeInTheDocument();
        expect(screen.getByText('parent1.child2')).toBeInTheDocument();
        expect(screen.queryByText('parent2')).not.toBeInTheDocument();
        expect(screen.queryByText('parent2.child1')).not.toBeInTheDocument();
        expect(screen.queryByText('col0')).not.toBeInTheDocument();

        act(() => {
          clickFilterButton();
        });

        expect(mockSetNodeFilterStateFunc).toHaveBeenCalledWith(
          'khjahjfja',
          false
        );
        expect(nodeFilterStateMap.get('khjahjfja')).toBe(false);
      });
    });

    describe('Filter with Search', () => {
      it('should only search among columns with lineage when filter is activated and column is searched', () => {
        const nodeFilterStateMap = new Map([['khjahjfja', true]]);
        (useLineageStore as unknown as jest.Mock).mockImplementation(() => ({
          isColumnLevelLineage: true,
          isDQEnabled: false,
          tracedColumns: new Set(),
          tracedNodes: new Set(),
          columnsHavingLineage: new Map([
            ['khjahjfja', new Set(['col0', 'col2', 'col5', 'col7', 'col10'])],
          ]),
          isEditMode: false,
          updateColumnsInCurrentPages: jest.fn(),
          setSelectedColumn: mockSetSelectedColumn,
          nodeFilterState: nodeFilterStateMap,
          setNodeFilterState: mockSetNodeFilterState,
        }));

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
