/*
 *  Copyright 2024 Collate.
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
import OMNumberWidget from './OMNumberWidget';
import OMTextWidget from './OMTextWidget';

const baseProps = {
  placeholder: 'Enter value',
  value: '',
  setValue: jest.fn(),
  readonly: false,
  // minimal required props from AbstractWidgetProps
  field: {} as any,
  fieldDefinition: {} as any,
  fieldSrc: 'value',
  operator: 'equal',
  config: {} as any,
  widgetId: 'test',
} as any;

describe('OMTextWidget', () => {
  it('renders an input with the given value', () => {
    render(<OMTextWidget {...baseProps} value="hello" />);

    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('calls setValue when input changes', () => {
    const setValue = jest.fn();
    render(<OMTextWidget {...baseProps} setValue={setValue} />);
    const input = screen.getByPlaceholderText(
      'Enter value'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });

    expect(setValue).toHaveBeenCalledWith('abc');
  });

  it('is disabled when readonly is true', () => {
    render(<OMTextWidget {...baseProps} readonly />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});

describe('OMNumberWidget', () => {
  it('renders a number input', () => {
    render(<OMNumberWidget {...baseProps} value={42} />);

    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });
});
