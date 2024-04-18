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

import { Registry, WidgetProps } from '@rjsf/utils';
import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
  waitForElement,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MOCK_SELECT_WIDGET } from '../../../../../mocks/SelectWidget.mock';
import SelectWidget from './SelectWidget';

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();

const mockProps: WidgetProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  ...MOCK_SELECT_WIDGET,
};

describe('Test SelectWidget Component', () => {
  it('Should render select component', async () => {
    render(<SelectWidget {...mockProps} />);

    const selectInput = screen.getByTestId('select-widget');

    expect(selectInput).toBeInTheDocument();
  });

  it('Should be disabled', async () => {
    render(<SelectWidget {...mockProps} disabled />);

    const selectInput = await findByRole(
      screen.getByTestId('select-widget'),
      'combobox'
    );

    expect(selectInput).toBeDisabled();
  });

  it('Should call onFocus', async () => {
    render(<SelectWidget {...mockProps} />);

    const selectInput = screen.getByTestId('select-widget');

    fireEvent.focus(selectInput);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('Should call onBlur', async () => {
    render(<SelectWidget {...mockProps} />);

    const selectInput = screen.getByTestId('select-widget');

    fireEvent.blur(selectInput);

    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('Should call onChange', async () => {
    render(<SelectWidget {...mockProps} />);

    const selectInput = await findByRole(
      screen.getByTestId('select-widget'),
      'combobox'
    );

    await act(async () => {
      userEvent.click(selectInput);
    });

    await waitForElement(() => screen.getByTestId('select-option-JP'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-option-EN'));
    });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });
});
