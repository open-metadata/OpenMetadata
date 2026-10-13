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

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from './breadcrumbs';

const items = [
  { id: 'service', label: 'Service', href: '/service' },
  { id: 'database', label: 'Database', href: '/database' },
  { id: 'schema', label: 'Schema', href: '/schema' },
];

describe('Breadcrumbs', () => {
  it('renders every item with an href as a link', () => {
    render(<Breadcrumbs items={items} />);

    expect(screen.getByRole('link', { name: 'Service' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Database' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schema' })).toHaveAttribute(
      'href',
      '/schema'
    );
  });

  it('renders a last item without an href as the current page', () => {
    render(
      <Breadcrumbs
        items={[...items.slice(0, -1), { id: 'schema', label: 'Schema' }]}
      />
    );

    expect(
      screen.queryByRole('link', { name: 'Schema' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Schema').closest('[aria-current]')
    ).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the last item current when onAction handles earlier items', () => {
    render(
      <Breadcrumbs
        items={[
          { id: 'service', label: 'Service' },
          { id: 'current', label: 'Current' },
        ]}
        onAction={() => undefined}
      />
    );

    expect(screen.getByRole('link', { name: 'Service' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Current' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Current').closest('[aria-current]')
    ).toHaveAttribute('aria-current', 'page');
  });

  describe('autoCollapse', () => {
    const trail = Array.from({ length: 6 }, (_, index) => ({
      id: `crumb-${index}`,
      label: `Crumb ${index}`,
      href: `/crumb-${index}`,
    }));
    const CRUMB_WIDTH = 100;
    const LIST_WIDTH = 350;
    let listWidth: number;
    let resize: (width: number) => void;

    beforeEach(() => {
      listWidth = LIST_WIDTH;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(private readonly callback: ResizeObserverCallback) {}
          observe(target: Element) {
            // react-aria observes its own elements too; only drive the trail's.
            if (!target.querySelector('ol')) {
              return;
            }
            resize = (width) => {
              listWidth = width;
              this.callback(
                [{ contentRect: { width } } as ResizeObserverEntry],
                this as unknown as ResizeObserver
              );
            };
            resize(LIST_WIDTH);
          }
          unobserve() {
            return undefined;
          }
          disconnect() {
            return undefined;
          }
        }
      );
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
        () => listWidth
      );
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
        function (this: HTMLElement) {
          return this.querySelectorAll('li').length * CRUMB_WIDTH;
        }
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('collapses into the ellipsis until the trail fits', () => {
      render(<Breadcrumbs autoCollapse items={trail} />);

      expect(screen.getByRole('link', { name: 'Crumb 0' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Crumb 5' })).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Crumb 1' })
      ).not.toBeInTheDocument();
    });

    // A content-sized container shrinks when the trail collapses; resetting to
    // the full trail on that shrink re-expands it and never settles.
    it('does not re-expand the trail when the container shrinks', () => {
      render(<Breadcrumbs autoCollapse items={trail} />);

      act(() => resize(LIST_WIDTH - 20));

      expect(
        screen.queryByRole('link', { name: 'Crumb 1' })
      ).not.toBeInTheDocument();
    });

    it('re-expands the trail when the container grows', () => {
      render(<Breadcrumbs autoCollapse items={trail} />);

      act(() => resize(trail.length * CRUMB_WIDTH));

      expect(screen.getByRole('link', { name: 'Crumb 1' })).toBeInTheDocument();
    });
  });
});
