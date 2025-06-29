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

import { Registry } from '@rjsf/utils';
import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOCK_TREE_SELECT_WIDGET } from '../../../../../mocks/SelectWidget.mock';
import TreeSelectWidget from './TreeSelectWidget';

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();

const mockProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  ...MOCK_TREE_SELECT_WIDGET,
};

describe('Test TreeSelectWidget Component', () => {
  it('Should render tree select component', async () => {
    render(<TreeSelectWidget {...mockProps} />);

    const treeSelectWidget = screen.getByTestId('tree-select-widget');

    expect(treeSelectWidget).toBeInTheDocument();
  });

  it('Should be disabled', async () => {
    render(<TreeSelectWidget {...mockProps} disabled />);

    const treeSelectInput = await findByRole(
      screen.getByTestId('tree-select-widget'),
      'combobox'
    );

    expect(treeSelectInput).toBeDisabled();
  });

  it('Should call onFocus', async () => {
    render(<TreeSelectWidget {...mockProps} />);

    const treeSelectInput = screen.getByTestId('tree-select-widget');

    fireEvent.focus(treeSelectInput);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('Should call onBlur', async () => {
    render(<TreeSelectWidget {...mockProps} />);

    const treeSelectInput = screen.getByTestId('tree-select-widget');

    fireEvent.blur(treeSelectInput);

    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('Should call onChange', async () => {
    render(<TreeSelectWidget {...mockProps} />);

    const treeSelectInput = await findByRole(
      screen.getByTestId('tree-select-widget'),
      'combobox'
    );

    await act(async () => {
      userEvent.click(treeSelectInput);
    });

    await waitFor(() => screen.getByText('Table'));

    await act(async () => {
      fireEvent.click(screen.getByText('Table'));
    });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });
});
