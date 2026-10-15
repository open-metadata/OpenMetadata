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

const Icon = () => <svg data-testid="nav-icon" />;

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

  it.each<[NavItemSize, number]>([
    ['md', 0],
    ['lg', 1],
  ])('shows a %s collapsible child icon %i time(s)', (size, count) => {
    render(
      <NavItemBase
        href="/child"
        icon={Icon}
        size={size}
        type="collapsible-child">
        Child
      </NavItemBase>
    );

    expect(screen.queryAllByTestId('nav-icon')).toHaveLength(count);
  });

  it('fills the current item with the brand colour in the solid variant', () => {
    render(
      <>
        <NavItemBase current href="/a" type="link" variant="solid">
          Current
        </NavItemBase>
        <NavItemBase current href="/b" type="link">
          Default
        </NavItemBase>
        <NavItemBase href="/c" type="link" variant="solid">
          Resting
        </NavItemBase>
      </>
    );

    expect(screen.getByRole('link', { name: 'Resting' })).toHaveClass(
      'tw:bg-transparent'
    );

    expect(screen.getByRole('link', { name: 'Current' })).toHaveClass(
      'tw:bg-brand-solid'
    );
    expect(screen.getByRole('link', { name: 'Default' })).toHaveClass(
      'tw:bg-brand-primary_alt'
    );
  });
});
