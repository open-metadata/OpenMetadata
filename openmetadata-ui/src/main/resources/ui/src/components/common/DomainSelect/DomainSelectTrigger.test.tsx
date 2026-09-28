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
import { Button } from '@openmetadata/ui-core-components';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { DomainSelectTrigger } from './DomainSelectTrigger';

const toggle = jest.fn();

// jsdom's PointerEvent shim drops `pointerType` / `button` when they are passed
// through fireEvent's init object, so build the event and define them directly.
const firePointerDown = (
  el: HTMLElement,
  props: { pointerType?: string; button?: number }
) => {
  const event = createEvent.pointerDown(el);
  Object.entries(props).forEach(([key, value]) =>
    Object.defineProperty(event, key, { value })
  );
  fireEvent(el, event);
};

const renderTrigger = (disabled?: boolean) =>
  render(
    <DomainSelectTrigger disabled={disabled} toggle={toggle}>
      <Button data-testid="edit-domain">Edit</Button>
    </DomainSelectTrigger>
  );

describe('DomainSelectTrigger', () => {
  beforeEach(() => {
    toggle.mockClear();
  });

  it('opens on a mouse pointerdown', () => {
    renderTrigger();
    fireEvent.pointerDown(screen.getByTestId('edit-domain'), { button: 0 });

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('does not toggle again on the click that follows a pointerdown', () => {
    renderTrigger();
    const btn = screen.getByTestId('edit-domain');
    fireEvent.pointerDown(btn, { button: 0 });
    fireEvent.click(btn);

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('opens on Enter when the child is a core Button (react-aria swallows the click)', () => {
    renderTrigger();
    fireEvent.keyDown(screen.getByTestId('edit-domain'), { key: 'Enter' });

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('opens on Space', () => {
    renderTrigger();
    fireEvent.keyDown(screen.getByTestId('edit-domain'), { key: ' ' });

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('opens on a synthetic click with no preceding pointerdown', () => {
    renderTrigger();
    fireEvent.click(screen.getByTestId('edit-domain'));

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('ignores a touch pointerdown so a scroll gesture does not open it', () => {
    renderTrigger();
    firePointerDown(screen.getByTestId('edit-domain'), {
      button: 0,
      pointerType: 'touch',
    });

    expect(toggle).not.toHaveBeenCalled();
  });

  it('opens on the click that follows a touch pointerdown', () => {
    renderTrigger();
    const btn = screen.getByTestId('edit-domain');
    firePointerDown(btn, { button: 0, pointerType: 'touch' });
    fireEvent.click(btn);

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    renderTrigger(true);
    const btn = screen.getByTestId('edit-domain');
    fireEvent.pointerDown(btn, { button: 0 });
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.click(btn);

    expect(toggle).not.toHaveBeenCalled();
  });

  it('ignores secondary mouse buttons', () => {
    renderTrigger();
    firePointerDown(screen.getByTestId('edit-domain'), { button: 2 });

    expect(toggle).not.toHaveBeenCalled();
  });
});
