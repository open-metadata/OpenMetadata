import { createRef } from 'react';
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
