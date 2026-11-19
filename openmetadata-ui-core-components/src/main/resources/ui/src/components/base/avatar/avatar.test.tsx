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

describe('Avatar surface', () => {
  it('sits on the gray surface by default when it has no initials', () => {
    render(<Avatar data-testid="avatar" />);

    expect(screen.getByTestId('avatar')).toHaveClass('tw:bg-tertiary');
  });

  it('sits on the page surface when plain, with initials or without', () => {
    render(
      <>
        <Avatar colorVariant="plain" data-testid="icon" />
        <Avatar colorVariant="plain" data-testid="initials" initials="AI" />
      </>
    );

    for (const id of ['icon', 'initials']) {
      expect(screen.getByTestId(id)).toHaveClass('tw:bg-primary');
      expect(screen.getByTestId(id)).not.toHaveClass('tw:bg-tertiary');
    }
    expect(screen.getByTestId('initials')).toHaveClass('tw:text-quaternary');
  });
});
