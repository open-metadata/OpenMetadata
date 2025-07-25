/*
 *  Copyright 2025 Collate.
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
/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  You may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { useRovingFocus } from './useRovingFocus';

function TestRovingFocus({
  totalItems = 3,
  initialIndex = 0,
  vertical = true,
  onSelect,
}: {
  totalItems?: number;
  initialIndex?: number;
  vertical?: boolean;
  onSelect?: (index: number) => void;
}) {
  const { containerRef, focusedIndex, getItemProps } = useRovingFocus({
    totalItems,
    initialIndex,
    vertical,
    onSelect,
  });

  return (
    <div data-testid="container" ref={containerRef} tabIndex={-1}>
      {Array.from({ length: totalItems }).map((_, i) => (
        <button data-testid={`item-${i}`} key={i} {...getItemProps(i)}>
          Item {i}
        </button>
      ))}
      <div data-testid="focused-index">{focusedIndex}</div>
    </div>
  );
}

describe('useRovingFocus', () => {
  it('should set initial focus index correctly', () => {
    const { getByTestId } = render(
      <TestRovingFocus initialIndex={2} totalItems={5} />
    );

    expect(getByTestId('focused-index').textContent).toBe('2');
    expect(getByTestId('item-2')).toHaveAttribute('tabindex', '0');
  });

  it('should move focus with ArrowDown/ArrowUp (vertical)', () => {
    const { getByTestId } = render(
      <TestRovingFocus vertical initialIndex={1} totalItems={3} />
    );
    let focused = getByTestId('item-1');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowDown' });
    });

    expect(getByTestId('focused-index').textContent).toBe('2');

    focused = getByTestId('item-2');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowUp' });
    });

    expect(getByTestId('focused-index').textContent).toBe('1');
  });

  it('should move focus with ArrowRight/ArrowLeft (horizontal)', () => {
    const { getByTestId } = render(
      <TestRovingFocus initialIndex={1} totalItems={3} vertical={false} />
    );
    let focused = getByTestId('item-1');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowRight' });
    });

    expect(getByTestId('focused-index').textContent).toBe('2');

    focused = getByTestId('item-2');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowLeft' });
    });

    expect(getByTestId('focused-index').textContent).toBe('1');
  });

  it('should not move focus out of bounds', () => {
    const { getByTestId } = render(
      <TestRovingFocus vertical initialIndex={0} totalItems={3} />
    );
    let focused = getByTestId('item-0');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowUp' });
    });

    expect(getByTestId('focused-index').textContent).toBe('0');

    focused = getByTestId('item-0');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowDown' });
    });

    expect(getByTestId('focused-index').textContent).toBe('1');

    focused = getByTestId('item-1');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowDown' });
    });

    expect(getByTestId('focused-index').textContent).toBe('2');

    focused = getByTestId('item-2');
    act(() => {
      fireEvent.keyDown(focused, { key: 'ArrowDown' });
    });

    expect(getByTestId('focused-index').textContent).toBe('2');
  });

  it('should call onSelect with correct index on Enter or Space', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <TestRovingFocus initialIndex={1} totalItems={3} onSelect={onSelect} />
    );
    const focused = getByTestId('item-1');
    act(() => {
      fireEvent.keyDown(focused, { key: 'Enter' });
    });

    expect(onSelect).toHaveBeenCalledWith(1);

    act(() => {
      fireEvent.keyDown(focused, { key: ' ' });
    });

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('should update focus if totalItems changes', () => {
    const { getByTestId, rerender } = render(
      <TestRovingFocus initialIndex={2} totalItems={3} />
    );

    expect(getByTestId('focused-index').textContent).toBe('2');

    rerender(<TestRovingFocus initialIndex={2} totalItems={2} />);

    expect(getByTestId('focused-index').textContent).toBe('1');
  });

  it('should set focus when item receives focus', () => {
    const { getByTestId } = render(
      <TestRovingFocus initialIndex={0} totalItems={3} />
    );
    const item2 = getByTestId('item-2');
    act(() => {
      item2.focus();
      fireEvent.focus(item2);
    });

    expect(getByTestId('focused-index').textContent).toBe('2');
  });
});
