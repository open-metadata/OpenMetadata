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
import { EmptyPlaceholder } from './empty-placeholder';

describe('EmptyPlaceholder', () => {
  it('renders size="sm" as one in-flow line without the icon tile', () => {
    render(
      <EmptyPlaceholder
        icon={<svg data-testid="icon" />}
        size="sm"
        title="No Workflow History found"
      />
    );

    const placeholder = screen.getByTestId('empty-placeholder');

    expect(placeholder.textContent).toBe('No Workflow History found');
    expect(placeholder.className).not.toContain('tw:absolute');
    expect(screen.queryByTestId('icon')).toBeNull();
  });
});
