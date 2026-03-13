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
  }) => (
    <div
      data-dq-edges={dqHighlightedEdges.size}
      data-hover-edge={hoverEdge?.id || 'none'}
      data-testid="canvas-edge-renderer"
      onClick={() => onEdgeClick?.(hoverEdge!, new MouseEvent('click'))}
      onMouseEnter={() => onEdgeHover?.(hoverEdge)}
    />
  ),
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

    expect(getByTestId('canvas-edge-renderer')).toBeInTheDocument();
  });

  it('renders EdgeInteractionOverlay component', () => {
    const { getByTestId } = render(<CanvasLayerWrapper {...defaultProps} />);

    expect(getByTestId('edge-interaction-overlay')).toBeInTheDocument();
  });

  it('passes dqHighlightedEdges to CanvasEdgeRenderer', () => {
    const dqHighlightedEdges = new Set(['edge-1', 'edge-2']);

    const { getByTestId } = render(
      <CanvasLayerWrapper
        {...defaultProps}
        dqHighlightedEdges={dqHighlightedEdges}
      />
    );

    const renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-dq-edges', '2');
  });

  it('passes hoverEdge to CanvasEdgeRenderer', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={mockEdge} />
    );

    const renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-hover-edge', 'edge-1');
  });

  it('passes hoverEdge to canvas-edge-renderer', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={mockEdge} />
    );

    const overlay = getByTestId('canvas-edge-renderer');

    expect(overlay).toHaveAttribute('data-hover-edge', 'edge-1');
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

    const renderer = getByTestId('canvas-edge-renderer');
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

    const renderer = getByTestId('canvas-edge-renderer');
    fireEvent.mouseEnter(renderer);

    expect(onEdgeHover).toHaveBeenCalled();
  });

  it('passes onPipelineClick callback to EdgeInteractionOverlay', () => {
    const onPipelineClick = jest.fn();

    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} onPipelineClick={onPipelineClick} />
    );

    const overlay = getByTestId('edge-interaction-overlay');
    overlay.click();

    expect(onPipelineClick).toHaveBeenCalled();
  });

  it('passes onEdgeRemove callback to EdgeInteractionOverlay', () => {
    const onEdgeRemove = jest.fn();

    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} onEdgeRemove={onEdgeRemove} />
    );

    const overlay = getByTestId('edge-interaction-overlay');
    overlay.click();

    expect(onEdgeRemove).toHaveBeenCalled();
  });

  it('handles null hoverEdge correctly', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={null} />
    );

    const renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-hover-edge', 'none');
  });

  it('handles empty dqHighlightedEdges set', () => {
    const { getByTestId } = render(
      <CanvasLayerWrapper {...defaultProps} dqHighlightedEdges={new Set()} />
    );

    const renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-dq-edges', '0');
  });

  it('updates when hoverEdge changes', () => {
    const { getByTestId, rerender } = render(
      <CanvasLayerWrapper {...defaultProps} hoverEdge={null} />
    );

    let renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-hover-edge', 'none');

    rerender(<CanvasLayerWrapper {...defaultProps} hoverEdge={mockEdge} />);

    renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-hover-edge', 'edge-1');
  });

  it('updates when dqHighlightedEdges changes', () => {
    const { getByTestId, rerender } = render(
      <CanvasLayerWrapper {...defaultProps} dqHighlightedEdges={new Set()} />
    );

    let renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-dq-edges', '0');

    rerender(
      <CanvasLayerWrapper
        {...defaultProps}
        dqHighlightedEdges={new Set(['edge-1', 'edge-2'])}
      />
    );

    renderer = getByTestId('canvas-edge-renderer');

    expect(renderer).toHaveAttribute('data-dq-edges', '2');
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

    expect(getByTestId('canvas-edge-renderer')).toBeInTheDocument();
    expect(getByTestId('edge-interaction-overlay')).toBeInTheDocument();
  });
});
