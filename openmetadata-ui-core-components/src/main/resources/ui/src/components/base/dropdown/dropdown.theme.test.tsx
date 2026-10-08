import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('tints the selected item and its addon with the brand roles', () => {
    render(
      <Dropdown.Root>
        <Button>Open</Button>
        <Dropdown.Popover>
          <Dropdown.Menu defaultSelectedKeys={['one']}>
            <Dropdown.Item addon="12" id="one" label="One" />
            <Dropdown.Item addon="34" id="two" label="Two" />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByText('One').parentElement).toHaveClass(
      'tw:bg-brand-primary'
    );
    expect(screen.getByText('12')).toHaveClass(
      'tw:text-brand-secondary',
      'tw:outline-utility-brand-200'
    );
    expect(screen.getByText('34')).toHaveClass(
      'tw:text-quaternary',
      'tw:outline-secondary'
    );
  });

  it('opens nested submenus three levels deep, marking submenu items with a chevron', async () => {
    render(
      <Dropdown.Root>
        <Button>Open</Button>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Level 1" selectionMode="none">
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item id="settings" label="Settings" />
              <Dropdown.Popover placement="end top">
                <Dropdown.Menu aria-label="Level 2" selectionMode="none">
                  <Dropdown.SubmenuTrigger>
                    <Dropdown.Item id="appearance" label="Appearance" />
                    <Dropdown.Popover placement="end top">
                      <Dropdown.Menu
                        aria-label="Level 3"
                        defaultSelectedKeys={['light']}>
                        <Dropdown.Item id="light" label="Light" />
                        <Dropdown.Item id="dark" label="Dark" />
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.SubmenuTrigger>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
            <Dropdown.Item id="help" label="Help" />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(
      screen.getByRole('menuitem', { name: 'Settings' }).querySelector('svg')
    ).not.toBeNull();
    expect(
      screen.getByRole('menuitem', { name: 'Help' }).querySelector('svg')
    ).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Appearance' })
    );

    expect(
      await screen.findByRole('menuitemradio', { name: 'Light' })
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Light').parentElement).toHaveClass(
      'tw:bg-brand-primary'
    );
  });
});
