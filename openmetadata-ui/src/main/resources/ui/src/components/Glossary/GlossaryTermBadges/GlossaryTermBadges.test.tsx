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
import { ReferenceBadge } from './GlossaryTermBadges';

describe('ReferenceBadge', () => {
  it.each([
    ['https://example.com/docs', 'https://example.com/docs'],
    ['http://example.com', 'http://example.com/'],
  ])('links to the %s endpoint as %s', (endpoint, href) => {
    render(<ReferenceBadge reference={{ name: 'docs', endpoint }} />);

    expect(screen.getByTestId('reference-link-docs')).toHaveAttribute(
      'href',
      href
    );
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'not a url',
  ])('drops the unsafe %s endpoint from href', (endpoint) => {
    render(<ReferenceBadge reference={{ name: 'docs', endpoint }} />);

    const link = screen.getByTestId('reference-link-docs');

    expect(link).not.toHaveAttribute('href');
    expect(screen.getByText('docs')).toBeInTheDocument();
  });
});
