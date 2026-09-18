/*
 *  Copyright 2026 Collate.
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
import { SearchLg } from '@untitledui/icons';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageShell } from './page-shell';
import type { PageShellLabels, SubNavState } from './page-shell.types';

const labels: PageShellLabels = {
  collapseMainNav: 'Collapse main navigation',
  expandMainNav: 'Expand main navigation',
  collapseSubNav: 'Collapse sub navigation',
  expandSubNav: 'Expand sub navigation',
  hideSubNav: 'Hide sub navigation',
  showSubNav: 'Show sub navigation',
};

const renderShell = (props: Record<string, unknown> = {}) =>
  render(
    <PageShell labels={labels} {...props}>
      <PageShell.Nav aria-label="Navigation">
        <PageShell.MainNav>
          <PageShell.NavItem isActive icon={SearchLg} label="Explore" />
        </PageShell.MainNav>
        <PageShell.SubNav>
          <PageShell.NavItem icon={SearchLg} label="Databases" />
        </PageShell.SubNav>
      </PageShell.Nav>
      <PageShell.Canvas>
        <PageShell.CanvasHeader>Toolbar</PageShell.CanvasHeader>
        <PageShell.CanvasBody>Page body</PageShell.CanvasBody>
      </PageShell.Canvas>
    </PageShell>
  );

const subNavRegion = () =>
  document.querySelector('[data-region="sub-nav"]') as HTMLElement;
const mainNavRegion = () =>
  document.querySelector('[data-region="main-nav"]') as HTMLElement;

describe('PageShell', () => {
  it('renders the nav as a named landmark and the body as main', () => {
    renderShell();

    expect(screen.getByRole('complementary')).toHaveAccessibleName(
      'Navigation'
    );
    expect(screen.getByRole('main')).toHaveTextContent('Page body');
  });

  it('collapses the main nav to the rail width and relabels its toggle', async () => {
    const user = userEvent.setup();
    renderShell({ navWidth: 180, railWidth: 44 });

    expect(mainNavRegion().style.width).toBe('180px');

    await user.click(
      screen.getByRole('button', { name: 'Collapse main navigation' })
    );

    expect(mainNavRegion().style.width).toBe('44px');
    expect(
      screen.getByRole('button', { name: 'Expand main navigation' })
    ).toBeInTheDocument();
  });

  it('hides the sub nav to zero width without unmounting it', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole('button', { name: 'Hide sub navigation' })
    );

    const subNav = subNavRegion();

    expect(subNav).toBeInTheDocument();
    expect(subNav.style.width).toBe('0px');
    expect(subNav.dataset.state).toBe('hidden');
  });

  it('takes the hidden sub nav out of the tab order and the a11y tree', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole('button', { name: 'Hide sub navigation' })
    );

    expect(subNavRegion()).toHaveAttribute('aria-hidden', 'true');
    expect(
      subNavRegion().querySelector('button')?.getAttribute('tabindex')
    ).toBe('-1');
  });

  it('restores a hidden sub nav to the width it had, not to expanded', async () => {
    const user = userEvent.setup();
    renderShell({ navWidth: 180, railWidth: 44 });

    await user.click(
      screen.getByRole('button', { name: 'Collapse sub navigation' })
    );

    expect(subNavRegion().style.width).toBe('44px');

    await user.click(
      screen.getByRole('button', { name: 'Hide sub navigation' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Show sub navigation' })
    );

    expect(subNavRegion().style.width).toBe('44px');
    expect(subNavRegion().dataset.state).toBe('collapsed');
  });

  it('reports state changes and defers to the controlled value', async () => {
    const user = userEvent.setup();
    const onSubNavChange = vi.fn();
    renderShell({ subNav: 'expanded' as SubNavState, onSubNavChange });

    await user.click(
      screen.getByRole('button', { name: 'Collapse sub navigation' })
    );

    expect(onSubNavChange).toHaveBeenCalledWith('collapsed');
    // Controlled: the prop still says expanded, so the column must not move.
    expect(subNavRegion().dataset.state).toBe('expanded');
  });

  it('shows nav item labels as text while the column is expanded', () => {
    renderShell();

    const item = screen.getByRole('button', { name: 'Explore' });

    expect(item).toHaveTextContent('Explore');
    expect(item).toHaveAttribute('aria-current', 'page');
    expect(item).not.toHaveAttribute('title');
  });

  it('drops the label to icon-only when the column collapses, keeping the name', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole('button', { name: 'Collapse main navigation' })
    );

    // Still reachable by name, but the text is out of the layout entirely
    // rather than truncated into an unreadable sliver.
    const item = screen.getByRole('button', { name: 'Explore' });

    expect(item).not.toHaveTextContent('Explore');
    expect(item).toHaveAttribute('title', 'Explore');
  });

  it('collapses each column independently', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole('button', { name: 'Collapse sub navigation' })
    );

    // Sub nav is a rail, main nav is not: only the sub-nav item loses its text.
    expect(
      screen.getByRole('button', { name: 'Databases' })
    ).not.toHaveTextContent('Databases');
    expect(screen.getByRole('button', { name: 'Explore' })).toHaveTextContent(
      'Explore'
    );
  });

  it('renders an anchor when href is set', () => {
    render(
      <PageShell labels={labels}>
        <PageShell.Nav aria-label="Navigation">
          <PageShell.MainNav>
            <PageShell.NavItem
              href="/explore"
              icon={SearchLg}
              label="Explore"
            />
          </PageShell.MainNav>
        </PageShell.Nav>
      </PageShell>
    );

    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute(
      'href',
      '/explore'
    );
  });

  it('throws when a region is rendered outside the shell', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<PageShell.SubNav>Orphan</PageShell.SubNav>)).toThrow(
      /must be rendered inside a PageShell/
    );

    spy.mockRestore();
  });
});
