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

  // All icon styling hangs off `data-icon`: `tw:*:data-icon:size-5` and the
  // per-size overrides give the icon its dimensions, and the loading state
  // hides `*:not([data-icon=loading])`. An icon passed as an element used to
  // render without it, so an icon-only button had no size at all - present in
  // the DOM but zero-sized, therefore invisible and unclickable.
  describe('icon data-icon attribute', () => {
    it('stamps data-icon onto an icon passed as an element', () => {
      render(
        <Button
          data-testid="btn"
          iconLeading={<svg data-testid="icon" />}
        />
      );

      expect(screen.getByTestId('icon')).toHaveAttribute('data-icon', 'leading');
    });

    it('stamps data-icon onto a trailing icon passed as an element', () => {
      render(
        <Button data-testid="btn" iconTrailing={<svg data-testid="icon" />} />
      );

      expect(screen.getByTestId('icon')).toHaveAttribute(
        'data-icon',
        'trailing'
      );
    });

    it('still stamps data-icon for an icon passed as a component', () => {
      const Icon = (props: { className?: string }) => (
        <svg {...props} data-testid="icon" />
      );

      render(<Button data-testid="btn" iconLeading={Icon} />);

      expect(screen.getByTestId('icon')).toHaveAttribute('data-icon', 'leading');
    });

    it('preserves a caller-supplied data-icon', () => {
      render(
        <Button
          data-testid="btn"
          iconLeading={<svg data-icon="loading" data-testid="icon" />}
        />
      );

      expect(screen.getByTestId('icon')).toHaveAttribute('data-icon', 'loading');
    });
  });
});
