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
import { Avatar } from './avatar';

const Icon = ({ className }: { className?: string }) => (
  <svg className={className} />
);

describe('Avatar placeholderIconColor', () => {
  it('tints the surface behind the placeholder icon', () => {
    render(
      <Avatar
        data-testid="avatar"
        placeholderIcon={Icon}
        placeholderIconColor="brand"
      />
    );

    expect(screen.getByTestId('avatar')).toHaveClass(
      'tw:bg-utility-brand-50',
      'tw:text-utility-brand-600'
    );
  });

  it('keeps the gray surface when no color is set', () => {
    render(<Avatar data-testid="avatar" placeholderIcon={Icon} />);

    expect(screen.getByTestId('avatar')).toHaveClass('tw:bg-tertiary');
  });

  it('ignores the tint once an image is shown', () => {
    render(
      <Avatar
        data-testid="avatar"
        placeholderIcon={Icon}
        placeholderIconColor="brand"
        src="/logo.png"
      />
    );

    expect(screen.getByTestId('avatar')).not.toHaveClass(
      'tw:bg-utility-brand-50'
    );
  });
});
