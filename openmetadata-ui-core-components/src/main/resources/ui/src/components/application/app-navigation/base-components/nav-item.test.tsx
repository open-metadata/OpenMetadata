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
import { NavItemBase, type NavItemSize } from './nav-item';

describe('NavItemBase', () => {
  it.each<[NavItemSize, string]>([
    ['sm', 'tw:pl-9'],
    ['md', 'tw:pl-10'],
  ])(
    'indents a %s collapsible child to line up with its parent label',
    (size, indent) => {
      render(
        <NavItemBase href="/child" size={size} type="collapsible-child">
          Child
        </NavItemBase>
      );

      expect(screen.getByRole('link', { name: 'Child' })).toHaveClass(indent);
    }
  );
});
