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
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { LayoutDragHandle, LayoutDropIndicator } from './LayoutDragParts';
import { useLayoutItemDrag, useLayoutReorder } from './useLayoutReorder';

const DRAG_TYPE = 'TEST_LAYOUT_ITEM';
const ITEM_HEIGHT = 40;
const ITEM_WIDTH = 200;
const NAMES = ['a', 'b', 'c'];

type HoverTarget = { index: number; side: 'before' | 'after' };

const Item = ({
  name,
  index,
  axis,
  isDisabled,
  dropSide,
  onHover,
  onDragEnd,
}: {
  name: string;
  index: number;
  axis: 'x' | 'y';
  isDisabled?: boolean;
  dropSide?: 'before' | 'after';
  onHover: (fromIndex: number, target: HoverTarget) => void;
  onDragEnd: () => void;
}) => {
  const { itemRef, handleRef, isDragging } = useLayoutItemDrag<HTMLLIElement>({
    dragType: DRAG_TYPE,
    index,
    axis,
    isDisabled,
    onHover,
    onDragEnd,
  });

  return (
    <li data-dragging={isDragging} data-testid={`item-${name}`} ref={itemRef}>
      <LayoutDragHandle
        dataTestId={`item-${name}-handle`}
        handleRef={handleRef}
        isDisabled={isDisabled}
      />
      {dropSide && <LayoutDropIndicator side={dropSide} width="full" />}
    </li>
  );
};

const List = ({
  axis,
  isDisabled,
  onMove,
}: {
  axis: 'x' | 'y';
  isDisabled?: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
}) => {
  const { dropTarget, handleHover, clearDropTarget, containerRef } =
    useLayoutReorder(DRAG_TYPE, onMove);

  return (
    <ul data-testid="list" ref={containerRef}>
      {NAMES.map((name, index) => (
        <Item
          axis={axis}
          dropSide={dropTarget?.index === index ? dropTarget.side : undefined}
          index={index}
          isDisabled={isDisabled}
          key={name}
          name={name}
          onDragEnd={clearDropTarget}
          onHover={handleHover}
        />
      ))}
    </ul>
  );
};

const renderList = (axis: 'x' | 'y' = 'y', isDisabled = false) => {
  const onMove = jest.fn();

  render(
    <DndProvider backend={HTML5Backend}>
      <List axis={axis} isDisabled={isDisabled} onMove={onMove} />
    </DndProvider>
  );

  return { onMove };
};

// jsdom has no layout: stack items vertically for the y axis and side by
// side for the x axis so a pointer position maps to one half of one item.
const mockItemRects = (axis: 'x' | 'y') =>
  NAMES.forEach((name, index) => {
    const top = axis === 'y' ? index * ITEM_HEIGHT : 0;
    const left = axis === 'x' ? index * ITEM_WIDTH : 0;
    jest
      .spyOn(screen.getByTestId(`item-${name}`), 'getBoundingClientRect')
      .mockReturnValue({
        top,
        left,
        height: ITEM_HEIGHT,
        width: ITEM_WIDTH,
        bottom: top + ITEM_HEIGHT,
        right: left + ITEM_WIDTH,
        x: left,
        y: top,
        toJSON: jest.fn(),
      });
  });

const createDataTransfer = () => ({
  types: [] as string[],
  dropEffect: 'move',
  effectAllowed: 'all',
  setData: jest.fn(),
  getData: jest.fn(),
  setDragImage: jest.fn(),
});

type DataTransferStub = ReturnType<typeof createDataTransfer>;

// jsdom's DataTransfer has read-only fields the HTML5 backend writes to, so
// each drag event carries a plain stub and an explicit pointer position.
const fireDragEvent = (
  type: 'dragStart' | 'dragEnter' | 'dragOver' | 'drop' | 'dragEnd',
  node: HTMLElement,
  dataTransfer: DataTransferStub,
  pointer = { clientX: 0, clientY: 0 }
) => {
  const event = createEvent[type](node);
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientX: { value: pointer.clientX },
    clientY: { value: pointer.clientY },
  });
  fireEvent(node, event);
};

const startDrag = (name: string) => {
  const dataTransfer = createDataTransfer();
  fireDragEvent(
    'dragStart',
    screen.getByTestId(`item-${name}-handle`),
    dataTransfer
  );
  act(() => {
    jest.runOnlyPendingTimers();
  });

  return dataTransfer;
};

const hover = (
  name: string,
  dataTransfer: DataTransferStub,
  pointer: { clientX: number; clientY: number }
) => {
  const target = screen.getByTestId(`item-${name}`);
  fireDragEvent('dragEnter', target, dataTransfer, pointer);
  fireDragEvent('dragOver', target, dataTransfer, pointer);
  act(() => {
    jest.runOnlyPendingTimers();
  });
};

const drop = (name: string, dataTransfer: DataTransferStub) =>
  fireDragEvent('drop', screen.getByTestId(`item-${name}`), dataTransfer);

const indicatorOf = (name: string) =>
  screen
    .getByTestId(`item-${name}`)
    .querySelector('[data-testid="layout-drop-indicator"]');

describe('useLayoutReorder', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks the dragged item and shows where it will land', () => {
    renderList('y');
    mockItemRects('y');

    const dataTransfer = startDrag('a');

    expect(screen.getByTestId('item-a')).toHaveAttribute(
      'data-dragging',
      'true'
    );

    hover('c', dataTransfer, { clientX: 10, clientY: 2 * ITEM_HEIGHT + 30 });

    expect(indicatorOf('c')).toHaveClass('tw:-bottom-1.5');
    expect(indicatorOf('b')).toBeNull();
  });

  it('moves a stacked item below the lower half it is dropped on', () => {
    const { onMove } = renderList('y');
    mockItemRects('y');

    const dataTransfer = startDrag('a');
    hover('c', dataTransfer, { clientX: 10, clientY: 2 * ITEM_HEIGHT + 30 });
    drop('c', dataTransfer);

    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(indicatorOf('c')).toBeNull();
  });

  it('moves a side-by-side item before the left half it is dropped on', () => {
    const { onMove } = renderList('x');
    mockItemRects('x');

    const dataTransfer = startDrag('c');
    hover('a', dataTransfer, { clientX: 20, clientY: 10 });

    expect(indicatorOf('a')).toHaveClass('tw:-top-1.5');

    drop('a', dataTransfer);

    expect(onMove).toHaveBeenCalledWith(2, 0);
  });

  it('ignores a drop that would leave the item where it is', () => {
    const { onMove } = renderList('y');
    mockItemRects('y');

    const dataTransfer = startDrag('a');
    hover('b', dataTransfer, { clientX: 10, clientY: ITEM_HEIGHT + 5 });

    expect(indicatorOf('b')).toBeNull();

    drop('b', dataTransfer);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('clears the drop line when the drag is cancelled', () => {
    const { onMove } = renderList('y');
    mockItemRects('y');

    const dataTransfer = startDrag('a');
    hover('c', dataTransfer, { clientX: 10, clientY: 2 * ITEM_HEIGHT + 30 });

    expect(indicatorOf('c')).not.toBeNull();

    fireDragEvent('dragEnd', screen.getByTestId('item-a-handle'), dataTransfer);

    expect(indicatorOf('c')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not start a drag from a disabled handle', () => {
    renderList('y', true);

    expect(screen.getByTestId('item-a-handle')).toHaveClass(
      'tw:cursor-not-allowed'
    );

    startDrag('a');

    expect(screen.getByTestId('item-a')).toHaveAttribute(
      'data-dragging',
      'false'
    );
  });
});
