/*
 *  Copyright 2026 Collate.
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
import { useTheme } from '@mui/material';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { Edge } from 'reactflow';
import { CanvasEdgeRenderer } from './CanvasEdgeRenderer.component';

const mockRedraw = jest.fn();
const mockGetEdgeAtPoint = jest.fn();
const mockUseCanvasEdgeRenderer = {
  redraw: mockRedraw,
  getEdgeAtPoint: mockGetEdgeAtPoint,
};

const mockEdges: Edge[] = [
  {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    data: { isColumnLineage: false },
  },
];

const mockUseLineageStore = {
  isEditMode: false,
  columnsInCurrentPages: new Map<string, string[]>(),
};

const mockUseLineageProvider = {
  edges: mockEdges,
};

const mockGetNode = jest.fn();
const mockUseReactFlow = {
  getNode: mockGetNode,
};

const mockViewport = { x: 0, y: 0, zoom: 1 };

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: jest.fn(),
}));

jest.mock('reactflow', () => ({
  ...jest.requireActual('reactflow'),
  useReactFlow: () => mockUseReactFlow,
  useViewport: () => mockViewport,
}));

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: () => mockUseLineageProvider,
}));

jest.mock('../../../hooks/useCanvasEdgeRenderer', () => ({
  useCanvasEdgeRenderer: () => mockUseCanvasEdgeRenderer,
}));

jest.mock('../../../hooks/useLineageStore', () => ({
  useLineageStore: () => mockUseLineageStore,
}));

jest.mock('../../../utils/EdgeStyleUtils', () => ({
  clearEdgeStyleCache: jest.fn(),
}));

jest.mock('../../../utils/PlaywrightUtils', () => ({
  isPlaywrightEnv: jest.fn(() => false),
}));

jest.mock('../../../utils/EdgeMidpointUtils', () => ({
  calculateEdgeMidpoints: jest.fn(() => []),
}));

const mockTheme = {
  palette: {
    primary: { main: '#1890ff' },
  },
};

describe('CanvasEdgeRenderer', () => {
  let reactFlowContainer: HTMLElement;
  let pane: HTMLElement;

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue(mockTheme);
    mockUseLineageStore.isEditMode = false;
    mockGetEdgeAtPoint.mockReturnValue(null);
    mockRedraw.mockClear();

    reactFlowContainer = document.createElement('div');
    reactFlowContainer.className = 'react-flow';
    pane = document.createElement('div');
    pane.className = 'react-flow__pane';
    reactFlowContainer.appendChild(pane);

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
    }));
  });

  afterEach(() => {
    if (reactFlowContainer.parentElement) {
      reactFlowContainer.parentElement.removeChild(reactFlowContainer);
    }
  });

  const defaultProps = {
    dqHighlightedEdges: new Set<string>(),
    hoverEdge: null,
    onEdgeClick: jest.fn(),
    onEdgeHover: jest.fn(),
  };

  const renderInReactFlow = (ui: React.ReactElement) => {
    const wrapper = document.createElement('div');
    reactFlowContainer.appendChild(wrapper);
    document.body.appendChild(reactFlowContainer);

    return render(ui, { container: wrapper });
  };

  it('renders canvas element', () => {
    renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

    const canvas = document.querySelector('canvas');

    expect(canvas).toBeInTheDocument();
  });

  it('renders container with correct styles', () => {
    renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

    const containerDiv = document.querySelector('.lineage-canvas-container');

    expect(containerDiv).toHaveStyle({ pointerEvents: 'none' });
  });

  it('calls redraw on mount', async () => {
    renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

    await waitFor(() => {
      expect(mockRedraw).toHaveBeenCalled();
    });
  });

  it('sets up ResizeObserver', () => {
    renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

    expect(ResizeObserver).toHaveBeenCalled();
  });

  it('handles pane click events when not in edit mode', async () => {
    const onEdgeClick = jest.fn();
    mockGetEdgeAtPoint.mockReturnValue(mockEdges[0]);

    renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} onEdgeClick={onEdgeClick} />
    );

    const currentPane = document.querySelector('.react-flow__pane');

    await waitFor(() => {
      expect(currentPane).toBeInTheDocument();
    });

    const lineageContainer = document.querySelector(
      '.lineage-canvas-container'
    );
    jest
      .spyOn(lineageContainer as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    });

    fireEvent(currentPane!, clickEvent);

    await waitFor(() => {
      expect(mockGetEdgeAtPoint).toHaveBeenCalled();
      expect(onEdgeClick).toHaveBeenCalledWith(
        mockEdges[0],
        expect.any(MouseEvent)
      );
    });
  });

  it('handles click events even in edit mode', async () => {
    const onEdgeClick = jest.fn();
    mockUseLineageStore.isEditMode = true;
    mockGetEdgeAtPoint.mockReturnValue(mockEdges[0]);

    renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} onEdgeClick={onEdgeClick} />
    );

    const lineageContainer = document.querySelector(
      '.lineage-canvas-container'
    );
    jest
      .spyOn(lineageContainer as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    });

    document.querySelector('.react-flow__pane')!.dispatchEvent(clickEvent);

    await waitFor(() => {
      expect(onEdgeClick).toHaveBeenCalledWith(
        mockEdges[0],
        expect.any(MouseEvent)
      );
    });
  });

  it('handles mouse move events', async () => {
    const onEdgeHover = jest.fn();
    mockGetEdgeAtPoint.mockReturnValue(mockEdges[0]);

    renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} onEdgeHover={onEdgeHover} />
    );

    const lineageContainer = document.querySelector(
      '.lineage-canvas-container'
    );
    jest
      .spyOn(lineageContainer as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

    const moveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    });

    fireEvent(document.querySelector('.react-flow__pane')!, moveEvent);

    await waitFor(() => {
      expect(onEdgeHover).toHaveBeenCalled();
    });
  });

  it('handles mouse leave events', async () => {
    const onEdgeHover = jest.fn();

    renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} onEdgeHover={onEdgeHover} />
    );

    const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });

    fireEvent(document.querySelector('.react-flow__pane')!, leaveEvent);

    await waitFor(() => {
      expect(onEdgeHover).toHaveBeenCalledWith(null);
    });
  });

  it('does not call edge handlers when no edge is found', async () => {
    const onEdgeClick = jest.fn();
    mockGetEdgeAtPoint.mockReturnValue(null);

    renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} onEdgeClick={onEdgeClick} />
    );

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    });

    await waitFor(() => {
      document.querySelector('.react-flow__pane')!.dispatchEvent(clickEvent);
    });

    expect(onEdgeClick).not.toHaveBeenCalled();
  });

  it('updates when edges change', async () => {
    const { rerender } = renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} />
    );

    mockUseLineageProvider.edges = [
      ...mockEdges,
      {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-3',
        data: { isColumnLineage: false },
      },
    ];

    rerender(<CanvasEdgeRenderer {...defaultProps} />);

    await waitFor(() => {
      expect(mockRedraw).toHaveBeenCalled();
    });
  });

  it('updates when hoverEdge changes', async () => {
    const { rerender } = renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} />
    );

    rerender(<CanvasEdgeRenderer {...defaultProps} hoverEdge={mockEdges[0]} />);

    await waitFor(() => {
      expect(mockRedraw).toHaveBeenCalled();
    });
  });

  it('updates when dqHighlightedEdges changes', async () => {
    const { rerender } = renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} />
    );

    const newDqHighlightedEdges = new Set(['edge-1']);
    rerender(
      <CanvasEdgeRenderer
        {...defaultProps}
        dqHighlightedEdges={newDqHighlightedEdges}
      />
    );

    await waitFor(() => {
      expect(mockRedraw).toHaveBeenCalled();
    });
  });

  it('cleans up event listeners on unmount', async () => {
    const { unmount } = renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} />
    );

    const currentPane = document.querySelector('.react-flow__pane');
    const removeEventListenerSpy = jest.spyOn(
      currentPane!,
      'removeEventListener'
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mouseleave',
      expect.any(Function)
    );
  });

  it('cleans up ResizeObserver on unmount', () => {
    const disconnectSpy = jest.fn();
    (global.ResizeObserver as jest.Mock).mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: disconnectSpy,
      unobserve: jest.fn(),
    }));

    const { unmount } = renderInReactFlow(
      <CanvasEdgeRenderer {...defaultProps} />
    );
    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('handles container size changes', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    (global.ResizeObserver as jest.Mock).mockImplementation((callback) => {
      resizeCallback = callback;

      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        unobserve: jest.fn(),
      };
    });

    renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

    if (resizeCallback) {
      const mockEntries = [
        {
          contentRect: { width: 800, height: 600 },
          target: document.createElement('div'),
        },
      ] as unknown as ResizeObserverEntry[];

      resizeCallback(mockEntries, {} as ResizeObserver);
    }

    await waitFor(() => {
      expect(mockRedraw).toHaveBeenCalled();
    });
  });

  it('does not crash when pane element is not found', () => {
    const containerWithoutPane = document.createElement('div');
    containerWithoutPane.className = 'react-flow';
    document.body.appendChild(containerWithoutPane);

    expect(() => {
      renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);
    }).not.toThrow();

    document.body.removeChild(containerWithoutPane);
  });

  it('passes correct props to useCanvasEdgeRenderer', () => {
    renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

    expect(mockUseCanvasEdgeRenderer).toBeDefined();
  });

  describe('Playwright Environment', () => {
    const mockIsPlaywrightEnv = require('../../../utils/PlaywrightUtils')
      .isPlaywrightEnv as jest.Mock;
    const mockCalculateEdgeMidpoints =
      require('../../../utils/EdgeMidpointUtils')
        .calculateEdgeMidpoints as jest.Mock;

    beforeEach(() => {
      mockUseLineageProvider.edges = mockEdges;
      mockUseLineageStore.columnsInCurrentPages = new Map<string, string[]>();
      mockIsPlaywrightEnv.mockReturnValue(true);
      mockCalculateEdgeMidpoints.mockReturnValue([
        {
          id: 'edge-1',
          dataTestId: 'edge-midpoint-1',
          canvasX: 100,
          canvasY: 200,
        },
      ]);
    });

    afterEach(() => {
      mockIsPlaywrightEnv.mockReturnValue(false);
      mockCalculateEdgeMidpoints.mockReturnValue([]);
    });

    it('calculates edge midpoints in Playwright environment', () => {
      renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

      expect(mockCalculateEdgeMidpoints).toHaveBeenCalledWith(
        mockEdges,
        mockGetNode,
        mockUseLineageStore.columnsInCurrentPages
      );
    });

    it('renders edge midpoint divs when dataTestId is present', () => {
      renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

      const midpointDiv = document.querySelector(
        '[data-testid="edge-midpoint-1"]'
      );

      expect(midpointDiv).toBeInTheDocument();
      expect(midpointDiv).toHaveStyle({
        width: '10px',
        height: '10px',
      });
    });

    it('does not render edge midpoint divs without dataTestId', () => {
      mockCalculateEdgeMidpoints.mockReturnValue([
        {
          id: 'edge-1',
          canvasX: 100,
          canvasY: 200,
        },
      ]);

      renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

      const midpointDivs = document.querySelectorAll(
        '[data-testid^="edge-midpoint"]'
      );

      expect(midpointDivs).toHaveLength(0);
    });

    it('does not calculate midpoints in non-Playwright environment', () => {
      mockIsPlaywrightEnv.mockReturnValue(false);

      renderInReactFlow(<CanvasEdgeRenderer {...defaultProps} />);

      const midpointDivs = document.querySelectorAll(
        '[data-testid^="edge-midpoint"]'
      );

      expect(midpointDivs).toHaveLength(0);
    });

    it('updates midpoints when edges change', async () => {
      const { rerender } = renderInReactFlow(
        <CanvasEdgeRenderer {...defaultProps} />
      );

      expect(mockCalculateEdgeMidpoints).toHaveBeenCalledTimes(1);

      mockUseLineageProvider.edges = [
        ...mockEdges,
        {
          id: 'edge-2',
          source: 'node-2',
          target: 'node-3',
          data: { isColumnLineage: false },
        },
      ];

      mockCalculateEdgeMidpoints.mockReturnValue([
        {
          id: 'edge-1',
          dataTestId: 'edge-midpoint-1',
          canvasX: 100,
          canvasY: 200,
        },
        {
          id: 'edge-2',
          dataTestId: 'edge-midpoint-2',
          canvasX: 150,
          canvasY: 250,
        },
      ]);

      rerender(<CanvasEdgeRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(mockCalculateEdgeMidpoints).toHaveBeenCalledTimes(2);
      });

      const midpoint1 = document.querySelector(
        '[data-testid="edge-midpoint-1"]'
      );
      const midpoint2 = document.querySelector(
        '[data-testid="edge-midpoint-2"]'
      );

      expect(midpoint1).toBeInTheDocument();
      expect(midpoint2).toBeInTheDocument();
    });

    it('updates midpoints when columnsInCurrentPages changes', async () => {
      const { rerender } = renderInReactFlow(
        <CanvasEdgeRenderer {...defaultProps} />
      );

      expect(mockCalculateEdgeMidpoints).toHaveBeenCalledTimes(1);

      const newColumnsMap = new Map([['node-1', ['col1', 'col2']]]);
      mockUseLineageStore.columnsInCurrentPages = newColumnsMap;

      rerender(<CanvasEdgeRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(mockCalculateEdgeMidpoints).toHaveBeenCalledWith(
          mockEdges,
          mockGetNode,
          newColumnsMap
        );
      });
    });
  });
});
