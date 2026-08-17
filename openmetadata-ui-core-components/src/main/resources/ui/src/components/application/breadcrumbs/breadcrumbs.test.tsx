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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
