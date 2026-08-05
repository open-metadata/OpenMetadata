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
import { fireEvent, render } from '@testing-library/react';
import { Edge } from 'reactflow';
import { CanvasLayerWrapper } from './CanvasLayerWrapper';

const CANVAS_EDGE_RENDERER = 'canvas-edge-renderer';
const EDGE_INTERACTION_OVERLAY = 'edge-interaction-overlay';
const DATA_DQ_EDGES = 'data-dq-edges';
const DATA_HOVER_EDGE = 'data-hover-edge';

jest.mock('../../../Entity/EntityLineage/CanvasEdgeRenderer.component', () => ({
  CanvasEdgeRenderer: ({
    dqHighlightedEdges,
    hoverEdge,
    onEdgeClick,
    onEdgeHover,
  }: {
    dqHighlightedEdges: Set<string>;
    hoverEdge: Edge | null;
    onEdgeClick?: (edge: Edge, event: MouseEvent) => void;
    onEdgeHover?: (edge: Edge | null) => void;
  }) => {
    const handleEdgeClick = () =>
      onEdgeClick?.(hoverEdge as Edge, new MouseEvent('click'));

    return (
      <div
        aria-label={hoverEdge?.id}
        data-dq-edges={dqHighlightedEdges.size}
        data-hover-edge={hoverEdge?.id || 'none'}
        data-testid="canvas-edge-renderer"
        role="button"
        tabIndex={0}
        onClick={handleEdgeClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleEdgeClick();
          }
        }}
        onMouseEnter={() => onEdgeHover?.(hoverEdge)}
      />
    );
  },
}));

jest.mock(
  '../../../Entity/EntityLineage/EdgeInteractionOverlay.component',
  () => ({
    EdgeInteractionOverlay: ({
      onPipelineClick,
      onEdgeRemove,
    }: {
      hoveredEdge?: Edge | null;
      onPipelineClick?: () => void;
      onEdgeRemove?: () => void;
    }) => (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div
        data-testid="edge-interaction-overlay"
        onClick={() => {
          onPipelineClick?.();
          onEdgeRemove?.();
        }}
      />
    ),
  })
);

describe('CanvasLayerWrapper', () => {
  const mockEdge: Edge = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
  };

  const defaultProps = {
    dqHighlightedEdges: new Set<string>(),
    onEdgeClick: jest.fn(),
    onEdgeHover: jest.fn(),
    onPipelineClick: jest.fn(),
    onEdgeRemove: jest.fn(),
    hoverEdge: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders CanvasEdgeRenderer component', () => {
    const { getByTestId } = render(<CanvasLayerWrapper {...defaultProps} />);

    expect(getByTestId(CANVAS_EDGE_RENDERER)).toBeInTheDocument();
  });

  it('renders EdgeInteractionOverlay component', () => {
    const { getByTestId } = render(<CanvasLayerWrapper {...defaultProps} />);

    expect(getByTestId(EDGE_INTERACTION_OVERLAY)).toBeInTheDocument();
  });

  it('passes dqHighlightedEdges to CanvasEdgeRenderer', () => {
    const dqHighlightedEdges = new Set(['edge-1', 'edge-2']);

    const { getByTestId } = render(
      <CanvasLayerWrapper
        {...defaultProps}
        dqHighlightedEdges={dqHighlightedEdges}
      />
    );

    const renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_DQ_EDGES, '2');
  });

  it('passes hoverEdge to CanvasEdgeRenderer', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={mockEdge} />
    );

    const renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_HOVER_EDGE, 'edge-1');
  });

  it('passes hoverEdge to canvas-edge-renderer', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={mockEdge} />
    );

    const overlay = getByTestId(CANVAS_EDGE_RENDERER);

    expect(overlay).toHaveAttribute(DATA_HOVER_EDGE, 'edge-1');
  });

  it('passes onEdgeClick callback to CanvasEdgeRenderer', () => {
    const onEdgeClick = jest.fn();

    const { getByTestId } = render(
      <CanvasLayerWrapper
        {...defaultProps}
        hoverEdge={mockEdge}
        onEdgeClick={onEdgeClick}
      />
    );

    const renderer = getByTestId(CANVAS_EDGE_RENDERER);
    renderer.click();

    expect(onEdgeClick).toHaveBeenCalled();
  });

  it('passes onEdgeHover callback to CanvasEdgeRenderer', () => {
    const onEdgeHover = jest.fn();

    const { getByTestId } = render(
      <CanvasLayerWrapper
        {...defaultProps}
        hoverEdge={mockEdge}
        onEdgeHover={onEdgeHover}
      />
    );

    const renderer = getByTestId(CANVAS_EDGE_RENDERER);
    fireEvent.mouseEnter(renderer);

    expect(onEdgeHover).toHaveBeenCalled();
  });

  it('passes onPipelineClick callback to EdgeInteractionOverlay', () => {
    const onPipelineClick = jest.fn();

    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} onPipelineClick={onPipelineClick} />
    );

    const overlay = getByTestId(EDGE_INTERACTION_OVERLAY);
    overlay.click();

    expect(onPipelineClick).toHaveBeenCalled();
  });

  it('passes onEdgeRemove callback to EdgeInteractionOverlay', () => {
    const onEdgeRemove = jest.fn();

    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} onEdgeRemove={onEdgeRemove} />
    );

    const overlay = getByTestId(EDGE_INTERACTION_OVERLAY);
    overlay.click();

    expect(onEdgeRemove).toHaveBeenCalled();
  });

  it('handles null hoverEdge correctly', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={null} />
    );

    const renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_HOVER_EDGE, 'none');
  });

  it('handles empty dqHighlightedEdges set', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} dqHighlightedEdges={new Set()} />
    );

    const renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_DQ_EDGES, '0');
  });

  it('updates when hoverEdge changes', () => {
    const { getByTestId, rerender } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={null} />
    );

    let renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_HOVER_EDGE, 'none');

    rerender(<CanvasLayerWrapper {...defaultProps} hoverEdge={mockEdge} />);

    renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_HOVER_EDGE, 'edge-1');
  });

  it('updates when dqHighlightedEdges changes', () => {
    const { getByTestId, rerender } = render(
      <CanvasLayerWrapper {...defaultProps} dqHighlightedEdges={new Set()} />
    );

    let renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_DQ_EDGES, '0');

    rerender(
      <CanvasLayerWrapper
        {...defaultProps}
        dqHighlightedEdges={new Set(['edge-1', 'edge-2'])}
      />
    );

    renderer = getByTestId(CANVAS_EDGE_RENDERER);

    expect(renderer).toHaveAttribute(DATA_DQ_EDGES, '2');
  });

  it('handles all callbacks being undefined', () => {
    expect(() => {
      render(
        <CanvasLayerWrapper dqHighlightedEdges={new Set()} hoverEdge={null} />
      );
    }).not.toThrow();
  });

  it('renders both components simultaneously', () => {
    const { getByTestId } = render(<CanvasLayerWrapper {...defaultProps} />);

    expect(getByTestId(CANVAS_EDGE_RENDERER)).toBeInTheDocument();
    expect(getByTestId(EDGE_INTERACTION_OVERLAY)).toBeInTheDocument();
  });
});
