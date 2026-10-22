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
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Tabs, useTabItemState } from './tabs';

const SelectionLabel = ({ name }: { name: string }) => {
  const state = useTabItemState();

  return (
    <span data-testid={`${name}-label`}>
      {name}:{state?.isSelected ? 'selected' : 'idle'}:{state?.variant}
    </span>
  );
};

const renderTabs = (variant?: 'default' | 'card', withActions = false) =>
  render(
    <Tabs defaultSelectedKey="one">
      <Tabs.List
        actions={
          withActions ? <button data-testid="action">Expand</button> : null
        }
        aria-label="Sections"
        type="underline"
        variant={variant}>
        <Tabs.Item id="one">
          <SelectionLabel name="one" />
        </Tabs.Item>
        <Tabs.Item id="two">
          <SelectionLabel name="two" />
        </Tabs.Item>
      </Tabs.List>
      <Tabs.Panel id="one">Panel one</Tabs.Panel>
      <Tabs.Panel id="two">Panel two</Tabs.Panel>
    </Tabs>
  );

describe('Tabs.List card variant', () => {
  it('wraps the tab list and actions in a card', () => {
    renderTabs('card', true);

    const tabList = screen.getByRole('tablist');
    const card = tabList.parentElement;

    expect(card).toHaveClass('tw:bg-surface', 'tw:border-subtle');
    expect(card).toContainElement(screen.getByTestId('action'));
    expect(tabList.className).not.toContain('tw:before:bg-border-secondary');
  });

  it.each(['default', 'card'] as const)(
    'gives %s tabs no z-index so fixed overlays can cover the bar',
    (variant) => {
      renderTabs(variant);

      screen.getAllByRole('tab').forEach((tab) => {
        expect(tab.className).not.toMatch(/tw:z-/);
      });
    }
  );

  it('keeps the underline separator and no card for the default variant', () => {
    renderTabs();

    const tabList = screen.getByRole('tablist');

    expect(tabList.className).toContain('tw:before:bg-border-secondary');
    expect(tabList.parentElement).not.toHaveClass('tw:bg-surface');
  });

  it('renders actions beside the tabs without a card for the default variant', () => {
    renderTabs('default', true);

    const tabList = screen.getByRole('tablist');

    expect(tabList.parentElement).toContainElement(
      screen.getByTestId('action')
    );
    expect(tabList.parentElement).not.toHaveClass('tw:bg-surface');
  });
});

describe('useTabItemState', () => {
  it('exposes selection and variant to custom labels', () => {
    renderTabs('card');

    expect(screen.getByTestId('one-label')).toHaveTextContent(
      'one:selected:card'
    );
    expect(screen.getByTestId('two-label')).toHaveTextContent('two:idle:card');

    fireEvent.click(screen.getByRole('tab', { name: /two/ }));

    expect(screen.getByTestId('two-label')).toHaveTextContent(
      'two:selected:card'
    );
    expect(screen.getByText('Panel two')).toBeInTheDocument();
  });

  it('returns null outside a tab', () => {
    const Probe = () => (
      <span data-testid="probe">{String(useTabItemState())}</span>
    );

    render(<Probe />);

    expect(screen.getByTestId('probe')).toHaveTextContent('null');
  });
});

describe('Tabs.List card overflow', () => {
  // jsdom lays nothing out; give the tab list a fixed width and content width.
  const mockTabListWidths = (scrollWidth: number, clientWidth: number) => {
    const scrollBy = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute('role') === 'tablist' ? scrollWidth : 0;
      }
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute('role') === 'tablist' ? clientWidth : 0;
      }
    );
    HTMLElement.prototype.scrollBy = scrollBy;

    return scrollBy;
  };

  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('adds no scroll controls when every tab fits', () => {
    mockTabListWidths(300, 300);
    renderTabs('card');

    expect(screen.queryByTestId('tab-list-scroll-start')).toBeNull();
    expect(screen.queryByTestId('tab-list-scroll-end')).toBeNull();
  });

  it('shows scroll controls once a tab added after mount makes the list overflow', async () => {
    let contentWidth = 300;
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute('role') === 'tablist' ? contentWidth : 0;
      }
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute('role') === 'tablist' ? 300 : 0;
      }
    );
    const renderList = (tabs: string[]) => (
      <Tabs defaultSelectedKey="one">
        <Tabs.List aria-label="Sections" type="underline" variant="card">
          {tabs.map((id) => (
            <Tabs.Item id={id} key={id}>
              {id}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
    );
    const { rerender } = render(renderList(['one', 'two']));

    expect(screen.queryByTestId('tab-list-scroll-end')).toBeNull();

    contentWidth = 800;
    rerender(renderList(['one', 'two', 'custom-properties']));

    expect(await screen.findByTestId('tab-list-scroll-end')).toBeEnabled();
  });

  it('shows scroll controls when tabs overflow and pages towards the hidden ones', () => {
    const scrollBy = mockTabListWidths(800, 300);
    renderTabs('card');

    const start = screen.getByTestId('tab-list-scroll-start');
    const end = screen.getByTestId('tab-list-scroll-end');

    // At the start of the list there is nothing further left to reveal.
    expect(start).toBeDisabled();
    expect(end).toBeEnabled();

    fireEvent.click(end);

    expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' });
  });
});
