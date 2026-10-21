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
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('card overflow fade', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    const mockScrollBox = (scrollWidth: number, clientWidth: number) => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          disconnect() {}
        }
      );
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
        scrollWidth
      );
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
        clientWidth
      );
    };

    it('fades the end edge while tabs overflow it', () => {
      mockScrollBox(1000, 600);
      renderTabs('card');

      const { maskImage } = screen.getByRole('tablist').style;

      expect(maskImage).toContain('linear-gradient(to right, #000');
      expect(maskImage).toMatch(/transparent\)$/);
    });

    it('keeps the caller style alongside the fade', () => {
      mockScrollBox(1000, 600);
      render(
        <Tabs defaultSelectedKey="one">
          <Tabs.List
            aria-label="Sections"
            style={{ marginTop: 4 }}
            type="underline"
            variant="card">
            <Tabs.Item id="one">One</Tabs.Item>
            <Tabs.Item id="two">Two</Tabs.Item>
          </Tabs.List>
        </Tabs>
      );
      const tabList = screen.getByRole('tablist');

      expect(tabList.style.marginTop).toBe('4px');
      expect(tabList.style.maskImage).toContain('transparent');
    });

    it('leaves the list unmasked when every tab fits', () => {
      mockScrollBox(600, 600);
      renderTabs('card');

      expect(screen.getByRole('tablist').style.maskImage).toBe('');
    });
  });
});
