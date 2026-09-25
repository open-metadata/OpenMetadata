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
import { Card } from './card';

describe('Card theme roles', () => {
  it('uses shared surface and subtle-border roles', () => {
    render(
      <Card data-testid="card">
        <Card.Content>Content</Card.Content>
        <Card.Footer data-testid="footer">Footer</Card.Footer>
      </Card>
    );

    expect(screen.getByTestId('card')).toHaveClass(
      'tw:bg-surface',
      'tw:border-subtle'
    );
    expect(screen.getByTestId('footer')).toHaveClass('tw:border-subtle');
  });

  it.each(['elevated', 'outlined'] as const)(
    'uses the shared surface for the %s variant',
    (variant) => {
      render(
        <Card data-testid="card" variant={variant}>
          Content
        </Card>
      );

      expect(screen.getByTestId('card')).toHaveClass('tw:bg-surface');
    }
  );
});
