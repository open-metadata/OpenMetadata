import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { ButtonUtility } from './button-utility';

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

describe('Button — link colors and `boxed`', () => {
  it('renders link colors as inline text by default', () => {
    render(<Button color="link-color">Link</Button>);
    const button = screen.getByRole('button', { name: 'Link' });

    expect(button).toHaveClass('tw:p-0!');
    expect(screen.getByText('Link')).not.toHaveClass('tw:px-0.5');
  });

  it('keeps the size box for link colors when boxed', () => {
    render(
      <Button boxed color="link-color" size="md">
        Link
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Link' });

    expect(button).not.toHaveClass('tw:p-0!');
    expect(button).toHaveClass('tw:px-3.5', 'tw:py-2.5', 'tw:rounded-lg');
    expect(screen.getByText('Link')).toHaveClass('tw:px-0.5');
  });

  it('ignores boxed on non-link colors', () => {
    render(<Button color="secondary">Plain</Button>);
    render(
      <Button boxed color="secondary">
        Boxed
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Boxed' }).className).toBe(
      screen.getByRole('button', { name: 'Plain' }).className
    );
  });
});

describe('Button — antd-compatible DOM contract', () => {
  it('treats the native `disabled` attribute as isDisabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Save' });

    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('lets isDisabled={false} win over a stale disabled attribute', () => {
    render(
      <Button disabled isDisabled={false}>
        Save
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('forwards title to the button and link elements', () => {
    const { rerender } = render(<Button title="Native hint">A</Button>);

    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute(
      'title',
      'Native hint'
    );

    rerender(<Button>A</Button>);

    expect(screen.getByRole('button', { name: 'A' })).not.toHaveAttribute(
      'title'
    );

    render(
      <Button href="/x" title="Link hint">
        L
      </Button>
    );

    expect(screen.getByRole('link', { name: 'L' })).toHaveAttribute(
      'title',
      'Link hint'
    );
  });

  it('still forwards the ref when title is set', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} title="t">
        A
      </Button>
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('passes overlay-trigger handlers and DOM attributes through', async () => {
    const handlers = {
      onBlur: vi.fn(),
      onFocus: vi.fn(),
      onMouseDown: vi.fn(),
      onMouseEnter: vi.fn(),
      onMouseLeave: vi.fn(),
    };
    render(
      <Button aria-label="Open" data-testid="trigger" id="t1" {...handlers}>
        Open
      </Button>
    );
    const button = screen.getByTestId('trigger');

    await userEvent.hover(button);
    await userEvent.click(button);
    await userEvent.unhover(button);
    await userEvent.tab();

    expect(button).toHaveAttribute('id', 't1');
    expect(handlers.onMouseEnter).toHaveBeenCalled();
    expect(handlers.onMouseLeave).toHaveBeenCalled();
    expect(handlers.onMouseDown).toHaveBeenCalled();
    expect(handlers.onFocus).toHaveBeenCalled();
    expect(handlers.onBlur).toHaveBeenCalled();
  });

  it('calls onClick with a React mouse event on pointer and keyboard activation', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });

    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(3);
    expect(onClick.mock.calls[0][0].type).toBe('click');
    expect(typeof onClick.mock.calls[0][0].stopPropagation).toBe('function');
  });

  // react-aria's usePress stops click propagation; antd Buttons let it bubble.
  // The migration spec relies on this: parents that need the click (router
  // <Link>, clickable cards) must move the handler onto the Button.
  it('does not bubble clicks to ancestor onClick handlers', async () => {
    const parentClick = vi.fn();
    const onClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <Button onClick={onClick}>Inner</Button>
      </div>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Inner' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});

describe('Button — form submission', () => {
  it('submits the enclosing form with type="submit"', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Submit</Button>
      </form>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits a form by id through the form attribute', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <>
        <form id="outer-form" onSubmit={onSubmit} />
        <Button form="outer-form" type="submit">
          External
        </Button>
      </>
    );

    await userEvent.click(screen.getByRole('button', { name: 'External' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('defaults to type="button" so it never submits implicitly', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Plain</Button>
      </form>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Plain' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission when onClick calls preventDefault or while loading', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" onClick={(e) => e.preventDefault()}>
          Prevented
        </Button>
        <Button isLoading type="submit">
          Loading
        </Button>
      </form>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Prevented' }));
    await userEvent.click(screen.getByText('Loading'));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ButtonUtility — antd-compatible DOM contract', () => {
  it('treats the native `disabled` attribute as isDisabled', async () => {
    const onClick = vi.fn();
    render(
      <ButtonUtility
        disabled
        aria-label="Edit"
        icon={<svg />}
        onClick={onClick}
      />
    );
    const button = screen.getByRole('button', { name: 'Edit' });

    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards title', () => {
    render(
      <ButtonUtility aria-label="Edit" icon={<svg />} title="Edit hint" />
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'title',
      'Edit hint'
    );
  });
});
