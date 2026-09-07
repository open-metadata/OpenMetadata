import { fireEvent, render, screen } from '@testing-library/react';
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
});
