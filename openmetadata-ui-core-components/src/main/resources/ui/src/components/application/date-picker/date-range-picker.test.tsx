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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
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

describe('DateRangePicker apply', () => {
  beforeAll(() => {
    // jsdom has no matchMedia; the range calendar asks for the breakpoint.
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('passes the clicked preset key to onApply', () => {
    const onApply = vi.fn();
    render(<DateRangePicker onApply={onApply} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith('lastMonth');
  });

  it('passes no key when the preset was cancelled', () => {
    const onApply = vi.fn();
    render(<DateRangePicker onApply={onApply} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith(undefined);
  });
});

describe('DateRangePicker apply on small screens', () => {
  beforeAll(() => {
    // Below the md breakpoint the sidebar presets are hidden and the calendar
    // shows its own preset buttons.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('passes the preset key picked in the calendar to onApply', () => {
    const onApply = vi.fn();
    render(<DateRangePicker onApply={onApply} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(
      within(screen.getByRole('application')).getByRole('button', {
        name: 'Last month',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith('lastMonth');
  });
});

describe('DateRangePicker dismiss', () => {
  beforeAll(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('forgets the preset when the picker is dismissed without Apply', () => {
    const onApply = vi.fn();
    render(<DateRangePicker onApply={onApply} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith(undefined);
  });
});
