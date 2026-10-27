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
import { RefObject } from 'react';
import { useLastPressedTrigger } from './useLastPressedTrigger';

let captured: RefObject<HTMLElement | null> | undefined;

const Harness = ({ showSecond = true }: { showSecond?: boolean }) => {
  const { containerRef, triggerRef } = useLastPressedTrigger();
  captured = triggerRef;

  return (
    <div ref={containerRef}>
      <button type="button">First</button>
      {showSecond && (
        <span role="button" tabIndex={0}>
          <span>Second</span>
        </span>
      )}
      <p>Not a button</p>
    </div>
  );
};

describe('useLastPressedTrigger', () => {
  it('starts with no trigger', () => {
    render(<Harness />);

    expect(captured?.current).toBeNull();
  });

  it('remembers the button pressed with a pointer', () => {
    render(<Harness />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'First' }));

    expect(captured?.current).toBe(
      screen.getByRole('button', { name: 'First' })
    );
  });

  it('resolves presses on inner nodes to their button and tracks bare clicks and keys', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText('Second'));

    expect(captured?.current).toBe(
      screen.getByRole('button', { name: 'Second' })
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), {
      key: 'Enter',
    });

    expect(captured?.current).toBe(
      screen.getByRole('button', { name: 'First' })
    );
  });

  it('ignores presses that are not on a button', () => {
    render(<Harness />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'First' }));
    fireEvent.pointerDown(screen.getByText('Not a button'));

    expect(captured?.current).toBe(
      screen.getByRole('button', { name: 'First' })
    );
  });

  it('reads null once the remembered button leaves the DOM', () => {
    const { rerender } = render(<Harness />);

    fireEvent.click(screen.getByText('Second'));
    rerender(<Harness showSecond={false} />);

    expect(captured?.current).toBeNull();
  });

  it('removes its capture listeners when the container unmounts', () => {
    const { unmount } = render(<Harness />);
    const container = screen.getByRole('button', { name: 'First' })
      .parentElement as HTMLElement;
    const removeSpy = jest.spyOn(container, 'removeEventListener');

    unmount();

    ['pointerdown', 'keydown', 'click'].forEach((type) =>
      expect(removeSpy).toHaveBeenCalledWith(type, expect.any(Function), true)
    );
  });
});
