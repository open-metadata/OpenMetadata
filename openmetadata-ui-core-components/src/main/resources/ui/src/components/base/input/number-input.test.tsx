/*
 *  Copyright 2025 Collate.
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
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumberInput } from './number-input';

describe('NumberInput', () => {
  it('preserves decimal editing and commits a bounded numeric value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        aria-label="Weight"
        maxValue={100}
        minValue={0}
        step={0.1}
        value={1}
        onChange={onChange}
      />
    );
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '123.4');
    expect(input).toHaveValue(123.4);
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(100);
  });
  it('keeps decimal values when no precision limit is configured', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberInput aria-label="Decimal" value={1} onChange={onChange} />);
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '3.5');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(3.5);
  });

  it('renders a help tooltip without treating it as a stepper', () => {
    render(<NumberInput label="Depth" tooltip="Depth help" value={2} />);
    expect(screen.getByRole('spinbutton', { name: /Depth/ })).toHaveValue(2);
  });

  it('increments a decimal value by the configured step', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        aria-label="Stepped"
        step={1}
        value={3.5}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole('spinbutton'));
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith(4.5);
  });

  it('avoids floating-point drift and duplicate blur notifications', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        aria-label="Fraction"
        step={0.2}
        value={0.1}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole('spinbutton'));
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith(0.3);
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports a cleared value as null rather than NaN or zero', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberInput aria-label="Sample" value={10} onChange={onChange} />);
    await user.clear(screen.getByRole('spinbutton'));
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
