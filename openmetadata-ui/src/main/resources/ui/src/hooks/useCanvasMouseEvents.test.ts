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
import { renderHook } from '@testing-library/react';
import { RefObject } from 'react';
import { Edge } from 'reactflow';
import {
  CanvasButton,
  CanvasButtonHitData,
  ECanvasButtonType,
} from '../utils/CanvasButtonUtils';
import { useCanvasMouseEvents } from './useCanvasMouseEvents';

describe('useCanvasMouseEvents', () => {
  let containerRef: RefObject<HTMLDivElement>;
  let getEdgeAtPointRef: RefObject<
    ((x: number, y: number, rect: DOMRect) => Edge | null) | null
  >;
  let getButtonAtPointRef: RefObject<
    ((x: number, y: number, rect: DOMRect) => CanvasButtonHitData | null) | null
  >;
  let onEdgeClickRef: RefObject<
    ((edge: Edge, event: MouseEvent) => void) | undefined
  >;
  let onEdgeHoverRef: RefObject<((edge: Edge | null) => void) | undefined>;

  let mockContainer: HTMLDivElement;
  let mockGetEdgeAtPoint: jest.Mock;
  let mockGetButtonAtPoint: jest.Mock;
  let mockOnButtonHover: jest.Mock;
  let mockOnEdgeClick: jest.Mock;
  let mockOnEdgeHover: jest.Mock;

  const mockEdge: Edge = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
  };

  const mockButton: CanvasButton = {
    x: 50,
    y: 50,
    width: 36,
    height: 36,
    edgeId: 'edge-1',
    type: ECanvasButtonType.Pipeline,
  };

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.getBoundingClientRect = jest.fn(() => ({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      toJSON: () => {},
    }));

    mockGetEdgeAtPoint = jest.fn();
    mockGetButtonAtPoint = jest.fn();
    mockOnButtonHover = jest.fn();
    mockOnEdgeClick = jest.fn();
    mockOnEdgeHover = jest.fn();

    containerRef = { current: mockContainer };
    getEdgeAtPointRef = { current: mockGetEdgeAtPoint };
    getButtonAtPointRef = { current: mockGetButtonAtPoint };
    onEdgeClickRef = { current: mockOnEdgeClick };
    onEdgeHoverRef = { current: mockOnEdgeHover };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('handles button click', () => {
    mockGetButtonAtPoint.mockReturnValue({
      button: mockButton,
      edge: mockEdge,
    });

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        onButtonHover: mockOnButtonHover,
        onEdgeClickRef,
        onEdgeHoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('click', {
      clientX: 100,
      clientY: 100,
    });
    Object.defineProperty(mockMouseEvent, 'currentTarget', {
      value: mockMouseEvent.target,
    });

    result.current.handleClick(mockMouseEvent);

    expect(mockGetButtonAtPoint).toHaveBeenCalledWith(
      100,
      100,
      expect.any(Object)
    );
    expect(mockOnEdgeClick).toHaveBeenCalledWith(mockEdge, mockMouseEvent);
  });

  it('handles edge click when no button is found', () => {
    mockGetButtonAtPoint.mockReturnValue(null);
    mockGetEdgeAtPoint.mockReturnValue(mockEdge);

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        onButtonHover: mockOnButtonHover,
        onEdgeClickRef,
        onEdgeHoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('click', {
      clientX: 100,
      clientY: 100,
    });
    Object.defineProperty(mockMouseEvent, 'currentTarget', {
      value: mockMouseEvent.target,
    });

    result.current.handleClick(mockMouseEvent);

    expect(mockGetEdgeAtPoint).toHaveBeenCalledWith(
      100,
      100,
      expect.any(Object)
    );
    expect(mockOnEdgeClick).toHaveBeenCalledWith(mockEdge, mockMouseEvent);
  });

  it('keeps an edge click from reaching the pane click handler', () => {
    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        onButtonHover: mockOnButtonHover,
        onEdgeClickRef,
        onEdgeHoverRef,
      })
    );
    const flowRoot = document.createElement('div');
    const pane = document.createElement('div');
    const onPaneClick = jest.fn();
    flowRoot.appendChild(pane);
    flowRoot.addEventListener('click', onPaneClick);
    pane.addEventListener('click', result.current.handleClick);

    mockGetButtonAtPoint.mockReturnValue(null);
    mockGetEdgeAtPoint.mockReturnValue(mockEdge);
    pane.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(mockOnEdgeClick).toHaveBeenCalledTimes(1);
    expect(onPaneClick).not.toHaveBeenCalled();

    mockGetEdgeAtPoint.mockReturnValue(null);
    pane.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onPaneClick).toHaveBeenCalledTimes(1);
  });

  it('does not call click handlers when container is not available', () => {
    const nullContainerRef = { current: null };

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef: nullContainerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        onButtonHover: mockOnButtonHover,
        onEdgeClickRef,
        onEdgeHoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('click', {
      clientX: 100,
      clientY: 100,
    });

    result.current.handleClick(mockMouseEvent);

    expect(mockGetButtonAtPoint).not.toHaveBeenCalled();
    expect(mockOnEdgeClick).not.toHaveBeenCalled();
  });

  const renderPointerHandlers = () =>
    renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        onButtonHover: mockOnButtonHover,
        onEdgeClickRef,
        onEdgeHoverRef,
      })
    ).result.current;

  const move = (pointerType = 'mouse', buttons = 0) =>
    Object.assign(
      new MouseEvent('pointermove', { clientX: 50, clientY: 50, buttons }),
      { pointerType }
    ) as PointerEvent;

  it('passes a midpoint hit and clears the edge hover', () => {
    const hit = { button: mockButton, edge: mockEdge };
    mockGetButtonAtPoint.mockReturnValue(hit);
    const { handlePointerMove } = renderPointerHandlers();

    handlePointerMove(move());

    expect(mockOnButtonHover).toHaveBeenCalledWith(hit);
    expect(mockOnEdgeHover).toHaveBeenCalledWith(null);
  });

  it('clears the midpoint immediately when hovering the edge stroke', () => {
    mockGetButtonAtPoint.mockReturnValue(null);
    mockGetEdgeAtPoint.mockReturnValue(mockEdge);
    const { handlePointerMove } = renderPointerHandlers();

    handlePointerMove(move());

    expect(mockOnButtonHover).toHaveBeenCalledWith(null);
    expect(mockOnEdgeHover).toHaveBeenCalledWith(mockEdge);
  });

  it('clears both hover hits immediately when the pointer leaves the pane', () => {
    const { handlePointerLeave } = renderPointerHandlers();

    handlePointerLeave();

    expect(mockOnButtonHover).toHaveBeenCalledWith(null);
    expect(mockOnEdgeHover).toHaveBeenCalledWith(null);
  });

  it.each([
    ['touch', 0],
    ['mouse', 1],
  ])('does not hit-test %s movement with buttons=%i', (type, buttons) => {
    const { handlePointerMove } = renderPointerHandlers();

    handlePointerMove(move(type, buttons));

    expect(mockGetButtonAtPoint).not.toHaveBeenCalled();
    expect(mockOnButtonHover).toHaveBeenCalledWith(null);
    expect(mockOnEdgeHover).toHaveBeenCalledWith(null);
  });

  it('does not call handlers when currentTarget does not match target', () => {
    mockGetButtonAtPoint.mockReturnValue({
      button: mockButton,
      edge: mockEdge,
    });

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        onButtonHover: mockOnButtonHover,
        onEdgeClickRef,
        onEdgeHoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('click', {
      clientX: 100,
      clientY: 100,
    });
    Object.defineProperty(mockMouseEvent, 'currentTarget', {
      value: document.createElement('div'),
    });
    Object.defineProperty(mockMouseEvent, 'target', {
      value: document.createElement('span'),
    });

    result.current.handleClick(mockMouseEvent);

    expect(mockOnEdgeClick).not.toHaveBeenCalled();
  });
});
