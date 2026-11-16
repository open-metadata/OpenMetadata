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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import SliderWithInput from './SliderWithInput';

const Sampling = () => {
  const [value, setValue] = useState<number | null>(50);

  return (
    <SliderWithInput min={1} value={value ?? undefined} onChange={setValue} />
  );
};

describe('SliderWithInput', () => {
  it('updates the slider from a percentage and clears the configured value', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Sampling />);
    const input = screen.getByTestId('slider-input');
    await user.clear(input);
    await user.type(input, '75%');
    await user.tab();

    expect(screen.getByRole('slider')).toHaveValue('75');

    await user.click(screen.getByTestId('clear-slider-input'));

    expect(input).toHaveValue('');
    expect(screen.getByRole('slider')).toHaveValue('1');
  });
});
