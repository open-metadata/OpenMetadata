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
  it('renders the last item as the current page by default', () => {
    render(<Breadcrumbs items={items} />);

    expect(screen.getByRole('link', { name: 'Service' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Database' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Schema' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Schema').closest('[aria-current]')
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders every item as a link when the trail has no current page', () => {
    render(<Breadcrumbs currentItem="none" items={items} />);

    expect(screen.getByRole('link', { name: 'Service' })).toHaveAttribute(
      'href',
      '/service'
    );
    expect(screen.getByRole('link', { name: 'Database' })).toHaveAttribute(
      'href',
      '/database'
    );
    expect(screen.getByRole('link', { name: 'Schema' })).toHaveAttribute(
      'href',
      '/schema'
    );
  });
});
