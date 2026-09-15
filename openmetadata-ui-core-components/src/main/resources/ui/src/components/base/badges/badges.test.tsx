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
import { Badge, BadgeWithDot } from './badges';

describe('Badge theme roles', () => {
  it('uses shared surface and border roles for a modern badge', () => {
    render(
      <Badge data-testid="badge" type="modern">
        Active
      </Badge>
    );

    expect(screen.getByTestId('badge')).toHaveClass(
      'tw:bg-surface',
      'tw:outline-subtle'
    );
  });

  it('uses theme-aware roles for a modern neutral badge', () => {
    render(
      <BadgeWithDot type="modern">
        <span>Active</span>
      </BadgeWithDot>
    );

    const badge = screen.getByText('Active').parentElement;

    expect(badge).toHaveClass('tw:bg-surface', 'tw:outline-subtle');
    expect(badge?.querySelector('svg')).toHaveClass('tw:text-utility-gray-500');
  });
});
