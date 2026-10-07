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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  // `.prose` styles descendants through `.prose :not(...)`, and no rule in that
  // block targets `span`/`div`. Dropping the wrapper for those keeps the
  // computed text style identical (the element-level `.prose` layer sets only
  // inherited properties) while restoring inline flow and avoiding invalid
  // `<div>`-inside-`<span>` nesting. Elements the descendant rules *do* target
  // must keep the wrapper or they silently lose their styling.
  describe('prose wrapper', () => {
    it('renders no wrapper for the default span, carrying prose itself', () => {
      render(<Typography>Hello</Typography>);

      const el = screen.getByText('Hello');

      expect(el.tagName).toBe('SPAN');
      expect(el).toHaveClass('prose');
      expect(el.parentElement).not.toHaveClass('prose');
    });

    it('renders no wrapper for as="div"', () => {
      render(<Typography as="div">Hello</Typography>);

      const el = screen.getByText('Hello');

      expect(el.tagName).toBe('DIV');
      expect(el).toHaveClass('prose');
      expect(el.parentElement).not.toHaveClass('prose');
    });

    it.each(['p', 'h1', 'a', 'blockquote', 'li'] as const)(
      'keeps the wrapper for as="%s" so descendant prose rules still match',
      (as) => {
        render(<Typography as={as}>Hello</Typography>);

        const el = screen.getByText('Hello');

        expect(el).not.toHaveClass('prose');
        expect(el.parentElement).toHaveClass('prose');
      }
    );

    it('keeps the wrapper when ellipsis is set', () => {
      render(<Typography ellipsis={{ rows: 2 }}>Hello</Typography>);

      const el = screen.getByText('Hello');

      expect(el).not.toHaveClass('prose');
      expect(el.parentElement).toHaveClass('prose');
    });

    it('keeps the wrapper for a non-default quote variant', () => {
      render(<Typography quoteVariant="centered-quote">Hello</Typography>);

      const el = screen.getByText('Hello');

      expect(el).not.toHaveClass('prose');
      expect(el.parentElement).toHaveClass('prose');
      expect(el.parentElement).toHaveClass('prose-centered-quote');
    });

    it('still forwards other props to an unwrapped element', () => {
      render(<Typography data-testid="unwrapped">Hello</Typography>);

      expect(screen.getByTestId('unwrapped')).toHaveTextContent('Hello');
    });
  });
});

const mockOverflow = (overflowing: boolean) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
    overflowing ? 200 : 100
  );
};

describe('Typography ellipsis tooltip', () => {
  beforeEach(() => mockOverflow(true));

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not show the tooltip when the text is not truncated', async () => {
    mockOverflow(false);
    const user = userEvent.setup();

    render(
      <Typography ellipsis={{ tooltip: 'Full text' }}>Short text</Typography>
    );

    fireEvent.mouseMove(document);
    await user.hover(screen.getByText('Short text'));
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(screen.queryByText('Full text')).not.toBeInTheDocument();
  });

  it('keeps an inline ellipsis in the text flow', () => {
    render(<Typography ellipsis>Inline text</Typography>);

    const wrapper = screen.getByText('Inline text').parentElement;

    expect(wrapper?.tagName).toBe('SPAN');
    expect(wrapper).toHaveClass('tw:inline-block', 'tw:max-w-full');
  });

  it('shows the tooltip when only a block inner element overflows', async () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.tagName === 'P' ? 200 : 100;
      }
    );
    const user = userEvent.setup();

    render(
      <Typography as="p" ellipsis={{ tooltip: 'Full text' }}>
        Clipped paragraph
      </Typography>
    );

    fireEvent.mouseMove(document);
    await user.hover(screen.getByText('Clipped paragraph'));

    await waitFor(() => {
      expect(screen.getByText('Full text')).toBeInTheDocument();
    });
  });

  it('keeps a block wrapper for block elements', () => {
    render(
      <Typography ellipsis as="p">
        Block text
      </Typography>
    );

    expect(screen.getByText('Block text').parentElement?.tagName).toBe('DIV');
  });

  it('renders no nested button inside a link when the trigger is excluded from the tab order', () => {
    render(
      <a href="/target">
        <Typography
          ellipsis={{ tooltip: true, excludeTriggerFromTabOrder: true }}>
          Linked text
        </Typography>
      </a>
    );

    const link = screen.getByRole('link');

    expect(link.querySelector('button')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('still opens the tooltip on hover when the trigger is excluded from the tab order', async () => {
    const user = userEvent.setup();

    render(
      <Typography
        ellipsis={{ tooltip: 'Full text', excludeTriggerFromTabOrder: true }}>
        Clipped text
      </Typography>
    );

    fireEvent.mouseMove(document);
    await user.hover(screen.getByText('Clipped text'));

    await waitFor(() => {
      expect(screen.getByText('Full text')).toBeInTheDocument();
    });
  });

  it('lets a click reach the enclosing link when the trigger is excluded from the tab order', () => {
    const handleLinkClick = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault()
    );

    render(
      <a href="/target" onClick={handleLinkClick}>
        <Typography
          ellipsis={{ tooltip: true, excludeTriggerFromTabOrder: true }}>
          Linked text
        </Typography>
      </a>
    );

    fireEvent.click(screen.getByText('Linked text'));

    expect(handleLinkClick).toHaveBeenCalledTimes(1);
  });

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
  it('keeps the parent text alignment inside the tooltip trigger button', () => {
    render(<Typography ellipsis={{ tooltip: true }}>Left text</Typography>);

    expect(screen.getByText('Left text').closest('button')).toHaveClass(
      'tw:[text-align:inherit]'
    );
  });

  it('lays out an inline ellipsis trigger as inline-flex', () => {
    render(<Typography ellipsis={{ tooltip: true }}>Inline text</Typography>);

    const trigger = screen.getByText('Inline text').closest('button');

    expect(trigger).toHaveClass('tw:inline-flex');
    expect(trigger).not.toHaveClass('tw:inline-block');
  });

  it('marks the root so nested links skip prose link styling', () => {
    render(
      <Typography>
        <a href="/x">Link</a>
      </Typography>
    );

    expect(screen.getByText('Link').parentElement).toHaveClass(
      'prose',
      'prose-typography'
    );
  });
});
