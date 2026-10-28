import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Edit01 } from '@/icons';
import { Button } from './button';
import { ButtonUtility } from './button-utility';

describe('ButtonUtility activation', () => {
  it('supports pointer and keyboard presses', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<ButtonUtility tooltip="Edit" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Edit' });

    await user.click(button);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onPress.mock.calls.map(([event]) => event.pointerType)).toEqual([
      'mouse',
      'keyboard',
      'keyboard',
    ]);
  });

  it('does not press a disabled button', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<ButtonUtility isDisabled tooltip="Edit" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Edit' });

    expect(button).toBeDisabled();

    await user.click(button);

    expect(onPress).not.toHaveBeenCalled();
  });
});

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

  it('calls onFocus and onBlur as keyboard focus enters and leaves', async () => {
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    render(
      <>
        <Button onBlur={handleBlur} onFocus={handleFocus}>
          Click me
        </Button>
        <Button>Next</Button>
      </>
    );

    await userEvent.tab();

    expect(handleFocus).toHaveBeenCalledTimes(1);

    await userEvent.tab();

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('calls onFocus on the link variant', () => {
    const handleFocus = vi.fn();
    render(
      <Button href="/somewhere" onFocus={handleFocus}>
        Go
      </Button>
    );

    screen.getByRole('link', { name: 'Go' }).focus();

    expect(handleFocus).toHaveBeenCalledTimes(1);
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

describe('Button — link box', () => {
  it('collapses a link button to an inline text box by default', () => {
    render(
      <Button color="link-color" size="md">
        Back
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Back' });

    expect(button).toHaveClass('tw:p-0!');
    expect(screen.getByText('Back')).not.toHaveClass('tw:px-0.5');
  });

  it('keeps the size padding and label padding when boxed', () => {
    render(
      <Button boxed color="link-color" size="lg">
        Back
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Back' });

    expect(button).not.toHaveClass('tw:p-0!');
    expect(button).toHaveClass('tw:px-3.5', 'tw:py-2.5');
    expect(screen.getByText('Back')).toHaveClass('tw:px-0.5');
  });

  it('ignores boxed on non-link colours', () => {
    render(
      <Button boxed color="primary" size="lg">
        Save
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'tw:px-3.5'
    );
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

describe('Button — icon size and color', () => {
  it('sizes compact icons to the 18px leading / 16px trailing frame', () => {
    render(
      <Button iconLeading={Edit01} iconTrailing={Edit01} size="xs">
        Edit
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass(
      'tw:*:data-icon:size-4.5',
      'tw:*:data-icon:p-[0.25px]',
      'tw:*:data-[icon=trailing]:size-4',
      'tw:*:data-[icon=trailing]:p-[0.5px]'
    );
  });

  it.each([
    ['xs', 'tw:py-1.25'],
    ['sm', 'tw:py-1.5'],
    ['md', 'tw:py-2'],
    ['lg', 'tw:py-2.5'],
    ['xl', 'tw:py-2.5'],
  ] as const)('applies the %s height padding', (size, padding) => {
    render(<Button size={size}>Edit</Button>);

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass(padding);
  });

  it('keeps the 20px leading frame and an 18px trailing frame on regular sizes', () => {
    render(
      <Button iconLeading={Edit01} iconTrailing={Edit01} size="md">
        Edit
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Edit' });

    expect(button).toHaveClass(
      'tw:*:data-icon:size-5',
      'tw:*:data-[icon=trailing]:size-4.5'
    );
    expect(button.querySelector('[data-icon="leading"]')).toBeInTheDocument();
    expect(button.querySelector('[data-icon="trailing"]')).toBeInTheDocument();
  });

  it('uses gray-500 icons with a gray-600 hover on neutral buttons', () => {
    render(
      <Button color="secondary" iconLeading={Edit01}>
        Edit
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass(
      'tw:*:data-icon:text-utility-gray-500',
      'tw:hover:*:data-icon:text-utility-gray-600'
    );
  });

  it('uses white icons on primary buttons', () => {
    render(
      <Button color="primary" iconLeading={Edit01}>
        Edit
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass(
      'tw:*:data-icon:text-white'
    );
  });
});

describe('ButtonUtility — icon size and color', () => {
  it.each([
    ['xs', 'tw:p-0.5', 'tw:*:data-icon:size-4', 'tw:*:data-icon:p-[0.5px]'],
    ['sm', 'tw:p-0.75', 'tw:*:data-icon:size-4.5', 'tw:*:data-icon:p-[0.25px]'],
    ['md', 'tw:p-1.25', 'tw:*:data-icon:size-4.5', 'tw:*:data-icon:p-[0.25px]'],
    ['lg', 'tw:p-1.5', 'tw:*:data-icon:size-5', 'tw:p-1.5'],
    ['xl', 'tw:p-2', 'tw:*:data-icon:size-5', 'tw:p-2'],
  ] as const)(
    'applies the %s box padding and icon frame',
    (size, padding, icon, glyphPadding) => {
      render(<ButtonUtility icon={Edit01} size={size} tooltip="Edit" />);

      const button = screen.getByRole('button', { name: 'Edit' });

      expect(button).toHaveClass(padding, icon, glyphPadding);
      expect(button.querySelector('svg[data-icon]')).toBeInTheDocument();
    }
  );

  it.each([
    ['xs', 'tw:rounded-sm'],
    ['sm', 'tw:rounded-md'],
    ['md', 'tw:rounded-md'],
    ['lg', 'tw:rounded-lg'],
    ['xl', 'tw:rounded-lg'],
  ] as const)('rounds the %s size with %s', (size, radius) => {
    render(<ButtonUtility icon={Edit01} size={size} tooltip="Edit" />);

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass(radius);
  });

  it('defaults to the 24px sm size', () => {
    render(<ButtonUtility icon={Edit01} tooltip="Edit" />);

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass(
      'tw:p-0.75',
      'tw:rounded-md'
    );
  });

  it('drops the border at xs', () => {
    const { rerender } = render(
      <ButtonUtility color="secondary" icon={Edit01} size="xs" tooltip="Edit" />
    );
    const button = screen.getByRole('button', { name: 'Edit' });

    expect(button).not.toHaveClass('tw:after:outline-primary', 'tw:bg-surface');

    rerender(
      <ButtonUtility
        color="secondary-destructive"
        icon={Edit01}
        size="xs"
        tooltip="Edit"
      />
    );

    expect(button).not.toHaveClass('tw:after:outline-error_subtle');
    expect(button).toHaveClass('tw:text-error-primary');

    rerender(
      <ButtonUtility color="secondary" icon={Edit01} size="sm" tooltip="Edit" />
    );

    expect(button).toHaveClass('tw:after:outline-primary');
  });

  it('uses gray-500 icons with a gray-600 hover on neutral colors', () => {
    render(<ButtonUtility color="tertiary" icon={Edit01} tooltip="Edit" />);

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass(
      'tw:text-utility-gray-500',
      'tw:hover:text-utility-gray-600'
    );
  });

  it('supports primary and destructive colors', () => {
    const { rerender } = render(
      <ButtonUtility color="primary" icon={Edit01} tooltip="Edit" />
    );
    const button = screen.getByRole('button', { name: 'Edit' });

    expect(button).toHaveClass(
      'tw:bg-brand-solid',
      'tw:*:data-icon:text-white'
    );

    rerender(
      <ButtonUtility
        color="secondary-destructive"
        icon={Edit01}
        tooltip="Edit"
      />
    );

    expect(button).toHaveClass(
      'tw:text-error-primary',
      'tw:*:data-icon:text-fg-error-secondary'
    );
  });
});

describe('ButtonUtility — toggle', () => {
  it('shows a toggle that is on in brand and as pressed', () => {
    render(
      <ButtonUtility isSelected color="tertiary" icon={Edit01} tooltip="Bar" />
    );

    const button = screen.getByRole('button', { name: 'Bar' });

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass(
      'tw:bg-brand-primary',
      'tw:text-brand-secondary'
    );
  });

  // Secondary hovers to bg-raised in dark mode; on, it must stay brand.
  it('keeps a secondary toggle that is on in brand when hovered in dark mode', () => {
    render(
      <ButtonUtility isSelected color="secondary" icon={Edit01} tooltip="Bar" />
    );

    const button = screen.getByRole('button', { name: 'Bar' });

    expect(button).toHaveClass('tw:dark:hover:bg-brand-primary');
    expect(button).not.toHaveClass('tw:dark:hover:bg-raised');
  });

  it('shows a toggle that is off in its resting colour, as not pressed', () => {
    render(
      <ButtonUtility
        color="tertiary"
        icon={Edit01}
        isSelected={false}
        tooltip="Bar"
      />
    );

    const button = screen.getByRole('button', { name: 'Bar' });

    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveClass('tw:bg-brand-primary');
  });

  it('is a plain action, with no pressed state, when isSelected is unset', () => {
    render(<ButtonUtility icon={Edit01} tooltip="Edit" />);

    expect(screen.getByRole('button', { name: 'Edit' })).not.toHaveAttribute(
      'aria-pressed'
    );
  });
});
