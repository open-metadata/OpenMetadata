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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Typography } from './typography';

describe('Typography', () => {
  it('applies no color class when color is omitted', () => {
    render(<Typography>Hello</Typography>);

    const el = screen.getByText('Hello');

    expect(el.className).not.toMatch(
      /tw:text-(tertiary|error-primary|warning-primary|success-primary)/
    );
  });

  it('applies tw:text-tertiary for color="secondary"', () => {
    render(<Typography color="secondary">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-tertiary');
  });

  it('applies tw:text-success-primary for color="success"', () => {
    render(<Typography color="success">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-success-primary');
  });

  it('applies tw:text-warning-primary for color="warning"', () => {
    render(<Typography color="warning">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-warning-primary');
  });

  it('applies tw:text-error-primary for color="danger"', () => {
    render(<Typography color="danger">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-error-primary');
  });

  it('still applies a consumer className alongside the color class', () => {
    render(
      <Typography className="tw:italic" color="secondary">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveClass('tw:text-tertiary');
    expect(el).toHaveClass('tw:italic');
  });

  it('lets a consumer className override the color class', () => {
    render(
      <Typography className="tw:text-tertiary" color="danger">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveClass('tw:text-tertiary');
    expect(el.className).not.toMatch(/tw:text-error-primary/);
  });
});

describe('Typography ellipsis tooltip', () => {
  it('propagates a click through to an ancestor onClick handler', () => {
    const handleAncestorClick = vi.fn();

    render(
      <div onClick={handleAncestorClick}>
        <Typography ellipsis={{ tooltip: true }}>
          A very long piece of text that gets truncated with an ellipsis
        </Typography>
      </div>
    );

    fireEvent.click(
      screen.getByText(
        'A very long piece of text that gets truncated with an ellipsis'
      )
    );

    // Regression guard: react-aria's `usePress` stops a completed press from
    // propagating to ancestor DOM listeners by default. Typography's
    // ellipsis-tooltip wrapper must opt back into propagation so a click on
    // truncated text still reaches whatever ancestor `onClick` the consumer
    // attached (e.g. a selectable card or a persona-switcher row).
    expect(handleAncestorClick).toHaveBeenCalledTimes(1);
  });

  it('still shows the tooltip on hover', async () => {
    const user = userEvent.setup();

    render(
      <Typography ellipsis={{ tooltip: 'Full text' }}>
        Truncated text
      </Typography>
    );

    expect(screen.queryByText('Full text')).not.toBeInTheDocument();

    // react-aria only treats hover as a tooltip-showing interaction when the
    // current "interaction modality" is pointer (see
    // @react-aria/interactions/useFocusVisible, which falls back to
    // mousemove/mousedown/mouseup listeners in test environments since jsdom
    // has no PointerEvent). A bare hover with no prior mouse movement leaves
    // the modality at its initial `null`, so establish it first.
    fireEvent.mouseMove(document);

    await user.hover(screen.getByText('Truncated text'));

    await waitFor(() => {
      expect(screen.getByText('Full text')).toBeInTheDocument();
    });
  });

  it('still shows the tooltip on keyboard focus', async () => {
    const user = userEvent.setup();

    render(
      <Typography ellipsis={{ tooltip: 'Full text' }}>
        Truncated text
      </Typography>
    );

    expect(screen.queryByText('Full text')).not.toBeInTheDocument();

    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Full text')).toBeInTheDocument();
    });
  });

  it('shows tooltip on hover when tooltip prop is set without ellipsis', async () => {
    const user = userEvent.setup();

    render(<Typography tooltip="Hint text">Plain text</Typography>);

    expect(screen.queryByText('Hint text')).not.toBeInTheDocument();

    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Hint text')).toBeInTheDocument();
    });
  });

  it('does not wrap non-ellipsis Typography in a tooltip trigger', () => {
    const handleAncestorClick = vi.fn();

    render(
      <div onClick={handleAncestorClick}>
        <Typography>Plain text</Typography>
      </div>
    );

    const el = screen.getByText('Plain text');

    expect(el.closest('button')).toBeNull();

    fireEvent.click(el);

    expect(handleAncestorClick).toHaveBeenCalledTimes(1);
  });
});
