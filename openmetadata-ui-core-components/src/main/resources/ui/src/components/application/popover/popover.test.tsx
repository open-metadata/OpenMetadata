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
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/base/buttons/button';
import { Popover, PopoverTrigger } from './popover';

describe('Popover surface', () => {
  it('sits on the raised overlay surface and sets its own text colour', () => {
    render(
      <PopoverTrigger>
        <Button>Open</Button>
        <Popover>
          <p>Body copy</p>
        </Popover>
      </PopoverTrigger>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const surface = screen.getByText('Body copy').closest('.tw\\:bg-floating');

    expect(surface).not.toBeNull();
    // Portal content otherwise inherits the body colour, which is black in dark mode.
    // Light keeps inheriting so existing light text is unchanged.
    expect(surface).toHaveClass(
      'tw:dark:text-primary',
      'tw:shadow-raised',
      'tw:outline-secondary_alt'
    );
    expect(surface).not.toHaveClass('tw:bg-overlay-surface');
  });
});
