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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Edge, Viewport } from 'reactflow';
import { StatusType } from '../../../generated/entity/data/pipeline';
import {
  CanvasButton,
  ECanvasButtonType,
} from '../../../utils/CanvasButtonUtils';
import { CanvasButtonPopover } from './CanvasButtonPopover.component';

jest.mock('../../common/PopOverCard/EntityPopOverCard', () => ({
  __esModule: true,
  default: ({
    children,
    entityFQN,
    entityType,
    extraInfo,
  }: {
    children: React.ReactNode;
    entityFQN: string;
    entityType: string;
    extraInfo: React.ReactNode;
  }) => (
    <div data-testid="entity-popover-card">
      <div data-testid="entity-fqn">{entityFQN}</div>
      <div data-testid="entity-type">{entityType}</div>
      <div data-testid="extra-info">{extraInfo}</div>
      {children}
    </div>
  ),
}));

jest.mock('../../../utils/ViewportUtils', () => ({
  getAbsolutePosition: (x: number, y: number, viewport: Viewport) => ({
    position: 'absolute',
    left: `${x * viewport.zoom + viewport.x}px`,
    top: `${y * viewport.zoom + viewport.y}px`,
  }),
}));

describe('CanvasButtonPopover', () => {
  const mockViewport: Viewport = {
    x: 100,
    y: 100,
    zoom: 1,
  };

  const mockHoveredButton: CanvasButton = {
    x: 50,
    y: 50,
    width: 36,
    height: 36,
    edgeId: 'edge-1',
    type: ECanvasButtonType.Pipeline,
    executionStatus: StatusType.Successful,
  };

  const mockHoveredEdge: Edge = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    data: {
      edge: {
        pipeline: {
          fullyQualifiedName: 'test.pipeline',
          pipelineStatus: {
            executionStatus: StatusType.Successful,
          },
        },
        pipelineEntityType: 'pipeline',
      },
    },
  };

  const mockIsOverPopoverRef = { current: false };
  const mockHoverTimeoutRef = { current: null as NodeJS.Timeout | null };
  const mockOnMouseLeave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOverPopoverRef.current = false;
    mockHoverTimeoutRef.current = null;
  });

  it('renders popover with correct position', () => {
    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={mockHoveredEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const popover = screen.getByTestId('entity-popover-card').parentElement;

    expect(popover).toHaveStyle({
      position: 'absolute',
      left: '132px',
      top: '132px',
    });
  });

  it('renders EntityPopOverCard with correct props', () => {
    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={mockHoveredEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    expect(screen.getByTestId('entity-fqn')).toHaveTextContent('test.pipeline');
    expect(screen.getByTestId('entity-type')).toHaveTextContent('pipeline');
  });

  it('renders status tag with correct class', () => {
    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={mockHoveredEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const extraInfo = screen.getByTestId('extra-info');
    const tag = extraInfo.querySelector('.green');

    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent('Successful');
  });

  it('does not render status tag when pipelineStatus is not available', () => {
    const edgeWithoutStatus: Edge = {
      ...mockHoveredEdge,
      data: {
        edge: {
          pipeline: {
            fullyQualifiedName: 'test.pipeline',
          },
          pipelineEntityType: 'pipeline',
        },
      },
    };

    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={edgeWithoutStatus}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const extraInfo = screen.getByTestId('extra-info');

    expect(extraInfo).toBeEmptyDOMElement();
  });

  it('handles mouse enter correctly', async () => {
    const mockTimeout = setTimeout(() => {}, 100);
    mockHoverTimeoutRef.current = mockTimeout;

    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={mockHoveredEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const popover = screen.getByTestId('entity-popover-card').parentElement;

    fireEvent.mouseEnter(popover!);

    expect(mockIsOverPopoverRef.current).toBe(true);
    expect(mockHoverTimeoutRef.current).toBeNull();
  });

  it('handles mouse leave correctly', async () => {
    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={mockHoveredEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const popover = screen.getByTestId('entity-popover-card').parentElement;

    fireEvent.mouseLeave(popover!);

    expect(mockOnMouseLeave).toHaveBeenCalledTimes(1);
  });

  it('renders with failed status color', () => {
    const failedEdge: Edge = {
      ...mockHoveredEdge,
      data: {
        edge: {
          pipeline: {
            fullyQualifiedName: 'test.pipeline',
            pipelineStatus: {
              executionStatus: StatusType.Failed,
            },
          },
          pipelineEntityType: 'pipeline',
        },
      },
    };

    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={failedEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const extraInfo = screen.getByTestId('extra-info');
    const tag = extraInfo.querySelector('.red');

    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent('Failed');
  });

  it('renders with pending status color', () => {
    const pendingEdge: Edge = {
      ...mockHoveredEdge,
      data: {
        edge: {
          pipeline: {
            fullyQualifiedName: 'test.pipeline',
            pipelineStatus: {
              executionStatus: StatusType.Pending,
            },
          },
          pipelineEntityType: 'pipeline',
        },
      },
    };

    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={pendingEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const extraInfo = screen.getByTestId('extra-info');
    const tag = extraInfo.querySelector('.amber');

    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent('Pending');
  });

  it('applies correct z-index and pointer events', () => {
    render(
      <CanvasButtonPopover
        hoverTimeoutRef={mockHoverTimeoutRef}
        hoveredButton={mockHoveredButton}
        hoveredEdge={mockHoveredEdge}
        isOverPopoverRef={mockIsOverPopoverRef}
        viewport={mockViewport}
        onMouseLeave={mockOnMouseLeave}
      />
    );

    const popover = screen.getByTestId('entity-popover-card').parentElement;

    expect(popover).toHaveStyle({
      pointerEvents: 'all',
      zIndex: '1000',
    });
  });
});
