import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/base/buttons/button';
import { Dropdown } from './dropdown';

const renderDropdown = () =>
  render(
    <Dropdown.Root>
      <Button>Open</Button>
      <Dropdown.Popover>
        <Dropdown.Menu>
          <Dropdown.Item id="one">One</Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item id="two">Two</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );

describe('Dropdown theme roles', () => {
  it('renders the menu on the overlay surface with raised elevation', () => {
    renderDropdown();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const surface = screen
      .getByRole('menu')
      .closest('.tw\\:bg-overlay-surface');

    expect(surface).not.toBeNull();
    expect(surface).toHaveClass('tw:bg-overlay-surface', 'tw:shadow-raised');
    // Menus share the overlay surface with popovers and modals, not the page background.
    expect(surface).not.toHaveClass('tw:bg-primary');
  });

  it('draws separators with the subtle border role, not a solid gray fill', () => {
    renderDropdown();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const separator = screen
      .getByRole('menu')
      .querySelector('.tw\\:border-subtle');

    expect(separator).not.toBeNull();
    expect(separator).not.toHaveClass('tw:bg-border-secondary');
  });
});
