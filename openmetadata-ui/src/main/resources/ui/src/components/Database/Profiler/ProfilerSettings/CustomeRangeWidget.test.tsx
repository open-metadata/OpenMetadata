/*
 *  Copyright 2023 Collate.
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
import { WidgetProps } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CustomRangeWidget } from './CustomRangeWidget';

const Range = () => {
  const [value, setValue] = useState<number | null>(50);
  const props = {
    id: 'sample',
    name: 'sample',
    label: 'Sample',
    value,
    schema: { minimum: 1 },
    options: {},
    onChange: setValue,
    onBlur: jest.fn(),
    onFocus: jest.fn(),
    registry: {},
  } as unknown as WidgetProps;

  return <CustomRangeWidget {...props} />;
};

describe('CustomRangeWidget', () => {
  it('keeps the slider and input synchronized after editing a percentage', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Range />);
    const input = screen.getByTestId('slider-input');
    await user.clear(input);
    await user.type(input, '75%');
    await user.tab();

    expect(input).toHaveValue('75%');
    expect(screen.getByRole('slider')).toHaveValue('75');
  });

  it('preserves bounds and keyboard slider changes', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Range />);
    const slider = screen.getByRole('slider');
    await user.tab();
    await user.keyboard('{Home}');

    expect(screen.getByTestId('slider-input')).toHaveValue('1%');

    await user.keyboard('{End}');

    expect(screen.getByTestId('slider-input')).toHaveValue('100%');

    await user.keyboard('{ArrowRight}');

    expect(slider).toHaveValue('100');
  });

  it('allows an empty percentage instead of saving NaN', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Range />);
    const input = screen.getByTestId('slider-input');
    await user.clear(input);
    await user.tab();

    expect(input).toHaveValue('');
    expect(screen.getByRole('slider')).toHaveValue('1');
  });
});
