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
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { NumberInput } from './number-input';

const PercentageField = () => {
  const [value, setValue] = useState(50);

  return (
    <NumberInput
      formatOptions={{ style: 'unit', unit: 'percent' }}
      label="Sample"
      maxValue={100}
      minValue={1}
      value={value}
      onChange={setValue}
    />
  );
};

describe('NumberInput', () => {
  it('parses a percentage without scaling its value and allows clearing it', async () => {
    const user = userEvent.setup();
    render(<PercentageField />);
    const input = screen.getByLabelText(/Sample/, { selector: 'input' });
    expect(input).toHaveValue('50%');

    await user.clear(input);
    await user.type(input, '75%');
    await user.tab();
    expect(input).toHaveValue('75%');

    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue('');
  });

  it('steps with the keyboard and mouse while respecting its bounds', async () => {
    const user = userEvent.setup();
    render(
      <NumberInput defaultValue={2} label="Rows" maxValue={3} minValue={1} />
    );
    const input = screen.getByLabelText(/Rows/, { selector: 'input' });
    await user.click(input);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(input).toHaveValue('3');
    expect(
      screen.getByRole('button', { name: /increase|increment/i })
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: /decrease|decrement/i })
    );
    expect(input).toHaveValue('2');
    await user.click(input);
    await user.keyboard('{Home}{ArrowDown}');
    expect(input).toHaveValue('1');
    expect(
      screen.getByRole('button', { name: /decrease|decrement/i })
    ).toBeDisabled();
  });

  it('forwards its ref and exposes validation and disabled state on the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <NumberInput
        isDisabled
        isInvalid
        hint="Invalid count"
        label="Count"
        ref={ref}
      />
    );
    const input = screen.getByLabelText(/Count/, { selector: 'input' });
    expect(ref.current).toBe(input);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid count')).toBeVisible();
  });
});
