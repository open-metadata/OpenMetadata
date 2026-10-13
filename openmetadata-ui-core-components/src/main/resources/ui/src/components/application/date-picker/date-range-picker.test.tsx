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
import { DateRangePicker } from './date-range-picker';

describe('DateRangePicker trigger', () => {
  it('is a medium button sized to its dates by default', () => {
    render(<DateRangePicker />);

    const trigger = screen.getByRole('button');

    expect(trigger).toHaveClass('tw:px-3.5', 'tw:py-2.5');
    expect(trigger).not.toHaveClass('tw:w-full');
  });

  it('takes the small button size', () => {
    render(<DateRangePicker size="sm" />);

    const trigger = screen.getByRole('button');

    expect(trigger).toHaveClass('tw:px-3', 'tw:py-2');
    expect(trigger).not.toHaveClass('tw:px-3.5');
  });

  it('stretches across its container with the dates at the start', () => {
    render(<DateRangePicker fullWidth />);

    const trigger = screen.getByRole('button');

    expect(trigger).toHaveClass('tw:w-full', 'tw:justify-start');
    expect(trigger).not.toHaveClass('tw:justify-center');
  });
});
