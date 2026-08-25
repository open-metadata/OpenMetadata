import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('omits focus outline classes only when explicitly requested', () => {
    const { rerender } = render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });

    expect(button).toHaveClass('tw:focus-visible:outline-2');
    expect(button).toHaveClass('tw:focus-visible:outline-offset-2');

    rerender(<Button hideFocusOutline>Click me</Button>);

    expect(button).toHaveClass('tw:outline-none');
    expect(button).not.toHaveClass('tw:outline-brand');
    expect(button).not.toHaveClass('tw:focus-visible:outline-2');
    expect(button).not.toHaveClass('tw:focus-visible:outline-offset-2');
  });

  it('forwards the ref to the underlying <button> element when no href is set', () => {
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Click me</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('forwards the ref to the underlying <a> element when href is set', () => {
    const ref = createRef<HTMLAnchorElement>();

    render(
      <Button href="https://example.com" ref={ref}>
        Click me
      </Button>
    );

    expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
  });
});

describe('Button — tooltip prop', () => {
  it('shows a tooltip on hover when the tooltip prop is set', async () => {
    const user = userEvent.setup();

    // Establish pointer modality so react-aria treats hover as a valid trigger.
    fireEvent.mouseMove(document);

    render(<Button tooltip="Helpful hint">Click me</Button>);

    expect(screen.queryByText('Helpful hint')).not.toBeInTheDocument();

    await user.hover(screen.getByRole('button', { name: 'Click me' }));

    await waitFor(() => {
      expect(screen.getByText('Helpful hint')).toBeInTheDocument();
    });
  });

  it('does not render a tooltip when the tooltip prop is omitted', () => {
    render(<Button>Click me</Button>);

    // The button should not be wrapped in a TooltipTrigger at all.
    const btn = screen.getByRole('button', { name: 'Click me' });

    expect(btn.closest('[data-rac]')).toBe(btn);
  });

  it('disables the tooltip when the button is disabled', () => {
    render(
      <Button isDisabled tooltip="Hint">
        Click me
      </Button>
    );

    // With isDisabled, Tooltip receives isDisabled={true} and should not render
    // the tooltip overlay even when isOpen would normally show it.
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });
});
