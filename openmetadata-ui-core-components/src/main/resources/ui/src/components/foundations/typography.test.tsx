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
import { afterEach, describe, expect, it, vi } from 'vitest';
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

// `variant` is antd Typography parity: the styling lives in the
// `[data-typography]` block of styles/typography.css (verified against antd
// computed styles in a browser), so these tests pin the DOM contract that
// block keys on — element, data attributes, no prose wrapper.
describe('Typography variant (antd parity)', () => {
  it.each([
    ['text', 'SPAN'],
    ['paragraph', 'DIV'],
    ['link', 'A'],
    ['title', 'H1'],
  ] as const)('renders variant="%s" as a bare <%s>', (variant, tagName) => {
    render(<Typography variant={variant}>Hello</Typography>);

    const el = screen.getByText('Hello');

    expect(el.tagName).toBe(tagName);
    expect(el).toHaveAttribute('data-typography', variant);
    expect(el).toHaveClass('not-prose');
    expect(el).not.toHaveClass('prose');
    expect(el.parentElement).not.toHaveClass('prose');
  });

  it.each([1, 2, 3, 4, 5] as const)(
    'renders title level %s as h%s',
    (level) => {
      render(
        <Typography level={level} variant="title">
          Hello
        </Typography>
      );

      expect(screen.getByText('Hello').tagName).toBe(`H${level}`);
    }
  );

  it('defaults rel on target="_blank" links, like antd Typography.Link', () => {
    render(
      <>
        <Typography href="https://a.test" target="_blank" variant="link">
          External
        </Typography>
        <Typography
          href="https://b.test"
          rel="nofollow"
          target="_blank"
          variant="link">
          Custom
        </Typography>
        <Typography href="/local" variant="link">
          Local
        </Typography>
      </>
    );

    expect(screen.getByText('External')).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
    expect(screen.getByText('Custom')).toHaveAttribute('rel', 'nofollow');
    expect(screen.getByText('Local')).not.toHaveAttribute('rel');
  });

  it('lets `as` override the variant element', () => {
    render(
      <Typography as="article" variant="text">
        Hello
      </Typography>
    );

    expect(screen.getByText('Hello').tagName).toBe('ARTICLE');
  });

  it('exposes color as data-color instead of a utility class', () => {
    render(
      <Typography color="secondary" variant="text">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveAttribute('data-color', 'secondary');
    expect(el.className).not.toMatch(/tw:text-/);
  });

  it('keeps consumer classes, size and weight', () => {
    render(
      <Typography
        className="text-grey-muted"
        size="text-xs"
        variant="text"
        weight="medium">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveClass('text-grey-muted', 'tw:text-xs', 'tw:font-medium');
  });

  it('wraps children in strong inside code, like antd', () => {
    render(
      <Typography code strong variant="text">
        Hello
      </Typography>
    );

    const strong = screen.getByText('Hello');

    expect(strong.tagName).toBe('STRONG');
    expect(strong.parentElement?.tagName).toBe('CODE');
    expect(strong.parentElement?.parentElement).toHaveAttribute(
      'data-typography',
      'text'
    );
  });

  it('marks single-line ellipsis on the element itself', () => {
    render(
      <Typography ellipsis variant="text">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveAttribute('data-ellipsis', 'single');
    expect(el.style.getPropertyValue('-webkit-line-clamp')).toBe('');
    expect(el.parentElement).not.toHaveClass('prose');
  });

  it('clamps multi-row ellipsis through an inline line-clamp', () => {
    render(
      <Typography
        ellipsis={{ rows: 3 }}
        style={{ color: 'red' }}
        variant="paragraph">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveAttribute('data-ellipsis', 'multiple');
    expect(el.style.getPropertyValue('-webkit-line-clamp')).toBe('3');
    expect(el.style.color).toBe('red');
  });

  describe('ellipsis tooltip', () => {
    const LONG = 'A long piece of text';

    const mockOverflow = (overflowing: boolean) => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(
        100
      );
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
        overflowing ? 300 : 100
      );
    };

    const hover = async (text: string) => {
      const user = userEvent.setup();
      fireEvent.mouseMove(document);
      await user.hover(screen.getByText(text));

      return user;
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows the tooltip when the text is truncated', async () => {
      mockOverflow(true);
      render(
        <Typography ellipsis={{ tooltip: 'Full text' }} variant="text">
          {LONG}
        </Typography>
      );

      await hover(LONG);

      await waitFor(() => {
        expect(screen.getByText('Full text')).toBeInTheDocument();
      });
    });

    it('does not show the tooltip when the text fits', async () => {
      mockOverflow(false);
      render(
        <Typography ellipsis={{ tooltip: 'Full text' }} variant="text">
          {LONG}
        </Typography>
      );

      await hover(LONG);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(screen.queryByText('Full text')).not.toBeInTheDocument();
    });

    it('adds no wrapper, no tab stop, and lets clicks reach ancestors', () => {
      const handleAncestorClick = vi.fn();
      render(
        <div onClick={handleAncestorClick}>
          <Typography ellipsis={{ tooltip: true }} variant="text">
            {LONG}
          </Typography>
        </div>
      );

      const el = screen.getByText(LONG);

      expect(el.parentElement?.tagName).toBe('DIV');
      expect(el.closest('button')).toBeNull();
      expect(el).not.toHaveAttribute('tabindex');

      fireEvent.click(el);

      expect(handleAncestorClick).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Typography strong / code without variant', () => {
  it('decorates the default prose rendering too', () => {
    render(<Typography strong>Hello</Typography>);

    expect(screen.getByText('Hello').tagName).toBe('STRONG');
  });
});
