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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../base/buttons/button';
import { Popover, PopoverTrigger } from './popover';

// react-aria ignores hover until it has seen a real pointer move.
const setupPointerModality = () => fireEvent.mouseMove(document);

const HoverCard = () => (
  <PopoverTrigger closeDelay={50} delay={0} trigger="hover">
    <Button data-testid="anchor">Open</Button>
    <Popover>
      <button data-testid="inner-action">Follow</button>
    </Popover>
  </PopoverTrigger>
);

describe('PopoverTrigger — hover', () => {
  it('opens when the pointer rests on the trigger', async () => {
    const user = userEvent.setup();
    render(<HoverCard />);
    setupPointerModality();

    await user.hover(screen.getByTestId('anchor'));

    await waitFor(() =>
      expect(screen.getByTestId('inner-action')).toBeInTheDocument()
    );
  });

  // The reason this component exists: the panel is portalled, so it cannot
  // inherit hover by containment. If the handlers are not re-attached there,
  // leaving the trigger closes the panel the pointer is travelling to and the
  // content can never be clicked.
  it('stays open when the pointer moves from the trigger into the panel', async () => {
    const user = userEvent.setup();
    render(<HoverCard />);
    setupPointerModality();

    await user.hover(screen.getByTestId('anchor'));
    const action = await screen.findByTestId('inner-action');

    await user.unhover(screen.getByTestId('anchor'));
    await user.hover(action);

    // Past the 50ms closeDelay the pending close must have been cancelled.
    await new Promise((r) => setTimeout(r, 120));

    expect(screen.getByTestId('inner-action')).toBeInTheDocument();
  });

  it('closes once the pointer has left both', async () => {
    const user = userEvent.setup();
    render(<HoverCard />);
    setupPointerModality();

    await user.hover(screen.getByTestId('anchor'));
    await screen.findByTestId('inner-action');

    await user.unhover(screen.getByTestId('anchor'));

    await waitFor(() =>
      expect(screen.queryByTestId('inner-action')).not.toBeInTheDocument()
    );
  });

  // Hover-only content would be unreachable without a pointer. Press still
  // works in hover mode, so tabbing to the trigger and hitting Enter opens
  // it — checked with the keyboard rather than a click, because a click that
  // follows a hover is a toggle and would close what the hover just opened.
  it('opens from the keyboard, so hover content is not pointer-only', async () => {
    const user = userEvent.setup();
    render(<HoverCard />);

    await user.tab();

    expect(screen.getByTestId('anchor')).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByTestId('inner-action')).toBeInTheDocument()
    );
  });

  // A trigger that is also a link must still navigate; DialogTrigger's press
  // handling does not swallow the click.
  it('lets a link trigger still fire its own click', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <PopoverTrigger closeDelay={50} delay={500} trigger="hover">
        <a data-testid="lnk" href="#x" onClick={onClick}>
          go
        </a>
        <Popover>
          <span data-testid="panel">panel</span>
        </Popover>
      </PopoverTrigger>
    );
    setupPointerModality();

    await user.click(screen.getByTestId('lnk'));

    expect(onClick).toHaveBeenCalled();
  });
});

describe('PopoverTrigger — press (default, unchanged)', () => {
  it('does not open on hover', async () => {
    const user = userEvent.setup();
    render(
      <PopoverTrigger>
        <Button data-testid="anchor">Open</Button>
        <Popover>
          <span data-testid="panel">Panel</span>
        </Popover>
      </PopoverTrigger>
    );
    setupPointerModality();

    await user.hover(screen.getByTestId('anchor'));
    await new Promise((r) => setTimeout(r, 150));

    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
  });

  it('opens on click', async () => {
    const user = userEvent.setup();
    render(
      <PopoverTrigger>
        <Button data-testid="anchor">Open</Button>
        <Popover>
          <span data-testid="panel">Panel</span>
        </Popover>
      </PopoverTrigger>
    );

    await user.click(screen.getByTestId('anchor'));

    await waitFor(() =>
      expect(screen.getByTestId('panel')).toBeInTheDocument()
    );
  });
});
