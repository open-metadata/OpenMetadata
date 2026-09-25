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

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaginationCardWithControls } from './pagination';

describe('PaginationCardWithControls theme roles', () => {
  it('uses shared card surface and border roles with an upward separator shadow', () => {
    const { container } = render(<PaginationCardWithControls />);
    const pagination = container.firstElementChild;

    expect(pagination).toHaveClass('tw:bg-surface', 'tw:border-subtle');
    // The bar sits at the card bottom; its shadow must cast upward (negative
    // y) to separate it from the rows above. shadow-card/shadow-xs cast
    // downward and would be a no-op here, so this keeps the purpose-built value.
    expect(pagination?.className).toMatch(/tw:shadow-\[0_-1px_4px/);
  });
});
