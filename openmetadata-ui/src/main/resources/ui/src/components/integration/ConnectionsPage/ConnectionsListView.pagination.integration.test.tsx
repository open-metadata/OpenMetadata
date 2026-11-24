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

import { PaginationCardWithControls } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import { PAGINATION_BORDER_SUPPRESSOR } from './ConnectionsListView';

// Deliberately does NOT mock @openmetadata/ui-core-components. The sibling ConnectionsListView spec
// does, and its mock drops `className` entirely — so a class assertion there would pass no matter
// what we pass, or whether the real component even merges it. This drives the real component.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('the pagination bar inside the connections card', () => {
  it('draws no border of its own, so the card border is not doubled', () => {
    render(
      <div data-testid="card">
        <PaginationCardWithControls
          className={PAGINATION_BORDER_SUPPRESSOR}
          page={1}
          pageSize={12}
          pageSizeOptions={[12, 24]}
          total={3}
        />
      </div>
    );

    const nav = screen.getByTestId('card').querySelector('nav');

    // The component's own classes are `border-x border-b`. They only disappear because it merges
    // consumer classes through twMerge — a plain string concat would leave both in place and the
    // doubled edge would still render.
    expect(nav).toBeInTheDocument();
    expect(nav?.className).not.toMatch(/(^|\s)tw:border-x(\s|$)/);
    expect(nav?.className).not.toMatch(/(^|\s)tw:border-b(\s|$)/);
    expect(nav?.className).toContain(PAGINATION_BORDER_SUPPRESSOR);
  });

  it('keeps the shadow that separates it from the rows above', () => {
    render(
      <div data-testid="card">
        <PaginationCardWithControls
          className={PAGINATION_BORDER_SUPPRESSOR}
          page={1}
          pageSize={12}
          pageSizeOptions={[12, 24]}
          total={3}
        />
      </div>
    );

    // Removing the border is only safe because the top separation was never a border.
    expect(screen.getByTestId('card').querySelector('nav')?.className).toMatch(
      /tw:shadow-\[/
    );
  });
});
