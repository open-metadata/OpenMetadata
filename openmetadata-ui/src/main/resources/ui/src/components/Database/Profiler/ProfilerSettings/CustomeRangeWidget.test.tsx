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
import { fireEvent, render } from '@testing-library/react';

import { WidgetProps } from '@rjsf/utils';
import { CustomRangeWidget } from './CustomRangeWidget';
const widgetProps = {
  id: 'custom-range-widget',
  name: 'custom-range',
  value: 50,
  schema: {},
  options: {},
  onChange: jest.fn(),
  onBlur: jest.fn(),
  onFocus: jest.fn(),
  registry: {},
} as unknown as WidgetProps;

describe('Test Custom Range Widget', () => {
  it('renders the CustomRangeWidget with a Slider and InputNumber', () => {
    const { getByTestId } = render(<CustomRangeWidget {...widgetProps} />);
    const slider = getByTestId('percentage-input');
    const inputNumber = getByTestId('slider-input');

    expect(slider).toBeInTheDocument();
    expect(inputNumber).toBeInTheDocument();
  });

  it('updates the value when Slider is changed', () => {
    const { getByTestId } = render(<CustomRangeWidget {...widgetProps} />);
    const slider = getByTestId('slider-input');

    fireEvent.change(slider, { target: { value: 75 } });

    expect(widgetProps.onChange).toHaveBeenCalledWith(75);
  });

  it('updates the value when InputNumber is changed', () => {
    const { getByTestId } = render(<CustomRangeWidget {...widgetProps} />);
    const inputNumber = getByTestId('slider-input');

    fireEvent.change(inputNumber, { target: { value: '30%' } });

    expect(widgetProps.onChange).toHaveBeenCalledWith(30);
  });
});
