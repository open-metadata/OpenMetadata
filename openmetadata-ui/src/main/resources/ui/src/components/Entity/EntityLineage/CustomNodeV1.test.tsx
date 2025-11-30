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
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react-test-renderer';
import { ReactFlowProvider } from 'reactflow';
import { ModelType } from '../../../generated/entity/data/table';
import { LineageLayer } from '../../../generated/settings/settings';
import CustomNodeV1Component from './CustomNodeV1.component';

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

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    tracedNodes: [],
    tracedColumns,
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
    columnsHavingLineage: [],
    activeLayer: [
      ...(isColumnLayerActive ? [LineageLayer.ColumnLevelLineage] : []),
      ...(isDataObservabilityLayerActive
        ? [LineageLayer.DataObservability]
        : []),
    ],
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
    columnsInCurrentPages = [];
    tracedColumns = [];
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

  describe('New tests', () => {
    it('should have pagination in column level lineage', () => {
      isColumnLayerActive = true;

      render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      const columnsContainer = screen.getByTestId('column-container');

      const getInsidePageColumns = () => {
        const insidePageContainer = columnsContainer.querySelector(
          '.inside-current-page-items'
        );

        return insidePageContainer
          ? Array.from(
              insidePageContainer.querySelectorAll('.inside-current-page')
            ).map((el) => el.textContent?.trim())
          : [];
      };

      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      let visibleColumns = getInsidePageColumns();

      expect(visibleColumns).toHaveLength(5);
      expect(visibleColumns).toEqual(['col0', 'col1', 'col2', 'col3', 'col4']);

      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((btn) =>
        btn.querySelector('[data-testid="ChevronLeftIcon"]')
      ) as HTMLElement;
      const nextButton = buttons.find((btn) =>
        btn.querySelector('[data-testid="ChevronRightIcon"]')
      ) as HTMLElement;

      expect(prevButton).toBeDisabled();

      fireEvent.click(nextButton);

      expect(screen.getByText('2 / 3')).toBeInTheDocument();

      visibleColumns = getInsidePageColumns();

      expect(visibleColumns).toHaveLength(5);
      expect(visibleColumns).toEqual(['col5', 'col6', 'col7', 'col8', 'col9']);

      fireEvent.click(nextButton);

      expect(screen.getByText('3 / 3')).toBeInTheDocument();

      visibleColumns = getInsidePageColumns();

      expect(visibleColumns).toHaveLength(2);
      expect(visibleColumns).toEqual(['col10', 'col11']);

      expect(nextButton).toBeDisabled();

      fireEvent.click(prevButton);

      expect(screen.getByText('2 / 3')).toBeInTheDocument();

      visibleColumns = getInsidePageColumns();

      expect(visibleColumns).toHaveLength(5);
      expect(visibleColumns).toEqual(['col5', 'col6', 'col7', 'col8', 'col9']);

      fireEvent.click(prevButton);

      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      visibleColumns = getInsidePageColumns();

      expect(visibleColumns).toHaveLength(5);
      expect(visibleColumns).toEqual(['col0', 'col1', 'col2', 'col3', 'col4']);

      expect(prevButton).toBeDisabled();
    });

    it('should select a column when it is clicked', () => {
      isColumnLayerActive = true;

      render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      const column = screen.getByTestId('column-col0');

      fireEvent.click(column);

      expect(onMockColumnClick).toHaveBeenCalledWith('col0');
    });

    it('should render the selected column at the bottom of page when page changes', () => {
      isColumnLayerActive = true;

      const { rerender } = render(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      const col3 = screen.getByTestId('column-col3');

      fireEvent.click(col3);

      expect(onMockColumnClick).toHaveBeenCalledWith('col3');

      tracedColumns = ['col3'];

      rerender(
        <ReactFlowProvider>
          <CustomNodeV1Component {...mockNodeDataProps} />
        </ReactFlowProvider>
      );

      expect(screen.getByTestId('column-col3')).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) =>
        btn.querySelector('[data-testid="ChevronRightIcon"]')
      ) as HTMLElement;

      fireEvent.click(nextButton);

      expect(screen.getByText('2 / 3')).toBeInTheDocument();

      const columnsContainer = screen.getByTestId('column-container');
      const outsidePageContainer = columnsContainer.querySelector(
        '.outside-current-page-items'
      );

      const col3AfterPageChange = screen.getByTestId('column-col3');

      expect(col3AfterPageChange).toBeInTheDocument();

      expect(outsidePageContainer).toContainElement(col3AfterPageChange);

      const insidePageContainer = columnsContainer.querySelector(
        '.inside-current-page-items'
      );
      const insidePageColumns = insidePageContainer
        ? Array.from(
            insidePageContainer.querySelectorAll('.inside-current-page')
          ).map((el) => el.textContent?.trim())
        : [];

      expect(insidePageColumns).toEqual([
        'col5',
        'col6',
        'col7',
        'col8',
        'col9',
      ]);
    });
    it('should keep the traced column(s) visible when columns dropdown is collapsed', () => {});
    it('should show column level lineage when a column is clicked and hide all other edges', () => {});
    it('should keep the traced column(s) visible when page changes', () => {});
    it('should show the edges for columns in current pages only and hide all other column to column edges', () => {});
    it('', () => {});
  });
});
