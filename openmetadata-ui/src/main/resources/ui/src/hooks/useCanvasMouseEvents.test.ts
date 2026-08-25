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
import { MutableRefObject, RefObject } from 'react';
import { Edge } from 'reactflow';
import { CanvasButton } from '../utils/CanvasButtonUtils';
import { useCanvasMouseEvents } from './useCanvasMouseEvents';

describe('useCanvasMouseEvents', () => {
  let containerRef: RefObject<HTMLDivElement>;
  let getEdgeAtPointRef: RefObject<
    ((x: number, y: number, rect: DOMRect) => Edge | null) | null
  >;
  let getButtonAtPointRef: RefObject<
    | ((
        x: number,
        y: number,
        rect: DOMRect
      ) => { button: CanvasButton; edge: Edge } | null)
    | null
  >;
  let setHoveredButtonRef: RefObject<
    ((button: CanvasButton | null) => void) | null
  >;
  let onEdgeClickRef: RefObject<
    ((edge: Edge, event: MouseEvent) => void) | undefined
  >;
  let onEdgeHoverRef: RefObject<((edge: Edge | null) => void) | undefined>;
  let hoverTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  let isOverPopoverRef: MutableRefObject<boolean>;

  let mockContainer: HTMLDivElement;
  let mockGetEdgeAtPoint: jest.Mock;
  let mockGetButtonAtPoint: jest.Mock;
  let mockSetHoveredButton: jest.Mock;
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
    type: 'pipeline',
  };

  beforeEach(() => {
    jest.useFakeTimers();

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
    mockSetHoveredButton = jest.fn();
    mockOnEdgeClick = jest.fn();
    mockOnEdgeHover = jest.fn();

    containerRef = { current: mockContainer };
    getEdgeAtPointRef = { current: mockGetEdgeAtPoint };
    getButtonAtPointRef = { current: mockGetButtonAtPoint };
    setHoveredButtonRef = { current: mockSetHoveredButton };
    onEdgeClickRef = { current: mockOnEdgeClick };
    onEdgeHoverRef = { current: mockOnEdgeHover };
    hoverTimeoutRef = { current: null };
    isOverPopoverRef = { current: false };
  });

  afterEach(() => {
    jest.useRealTimers();
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
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
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
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
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

  it('does not call click handlers when container is not available', () => {
    const nullContainerRef = { current: null };

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef: nullContainerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
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

  it('sets hovered button on mouse move', () => {
    mockGetButtonAtPoint.mockReturnValue({
      button: mockButton,
      edge: mockEdge,
    });

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
    });

    result.current.handleMouseMove(mockMouseEvent);

    expect(mockSetHoveredButton).toHaveBeenCalledWith(mockButton);
    expect(mockOnEdgeHover).toHaveBeenCalledWith(null);
  });

  it('clears timeout when button is hovered', () => {
    const mockTimeout = setTimeout(() => {}, 100);
    hoverTimeoutRef.current = mockTimeout;

    mockGetButtonAtPoint.mockReturnValue({
      button: mockButton,
      edge: mockEdge,
    });

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
    });

    result.current.handleMouseMove(mockMouseEvent);

    expect(hoverTimeoutRef.current).toBeNull();
  });

  it('sets timeout to clear hover when no button is found', () => {
    mockGetButtonAtPoint.mockReturnValue(null);
    mockGetEdgeAtPoint.mockReturnValue(null);
    isOverPopoverRef.current = false;

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
    });

    result.current.handleMouseMove(mockMouseEvent);

    expect(hoverTimeoutRef.current).not.toBeNull();

    jest.advanceTimersByTime(100);

    expect(mockSetHoveredButton).toHaveBeenCalledWith(null);
  });

  it('does not set timeout when mouse is over popover', () => {
    mockGetButtonAtPoint.mockReturnValue(null);
    mockGetEdgeAtPoint.mockReturnValue(null);
    isOverPopoverRef.current = true;

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
    });

    result.current.handleMouseMove(mockMouseEvent);

    expect(hoverTimeoutRef.current).toBeNull();
  });

  it('sets hovered edge on mouse move when no button is found', () => {
    mockGetButtonAtPoint.mockReturnValue(null);
    mockGetEdgeAtPoint.mockReturnValue(mockEdge);

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    const mockMouseEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
    });

    result.current.handleMouseMove(mockMouseEvent);

    expect(mockOnEdgeHover).toHaveBeenCalledWith(mockEdge);
  });

  it('clears hover state on mouse leave', () => {
    isOverPopoverRef.current = false;

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    result.current.handleMouseLeave();

    expect(mockOnEdgeHover).toHaveBeenCalledWith(null);
    expect(mockSetHoveredButton).toHaveBeenCalledWith(null);
  });

  it('does not clear hover state when mouse is over popover', () => {
    isOverPopoverRef.current = true;

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    result.current.handleMouseLeave();

    expect(mockOnEdgeHover).not.toHaveBeenCalled();
    expect(mockSetHoveredButton).not.toHaveBeenCalled();
  });

  it('clears timeout on mouse leave', () => {
    const mockTimeout = setTimeout(() => {}, 100);
    hoverTimeoutRef.current = mockTimeout;
    isOverPopoverRef.current = false;

    const { result } = renderHook(() =>
      useCanvasMouseEvents({
        containerRef,
        getEdgeAtPointRef,
        getButtonAtPointRef,
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
      })
    );

    result.current.handleMouseLeave();

    expect(hoverTimeoutRef.current).toBeNull();
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
        setHoveredButtonRef,
        onEdgeClickRef,
        onEdgeHoverRef,
        hoverTimeoutRef,
        isOverPopoverRef,
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
