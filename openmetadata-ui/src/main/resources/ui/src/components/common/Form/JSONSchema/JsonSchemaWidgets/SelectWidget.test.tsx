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
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MOCK_SELECT_WIDGET,
  MOCK_TREE_SELECT_WIDGET,
} from '../../../../../mocks/SelectWidget.mock';
import SelectWidget from './SelectWidget';

jest.mock('./TreeSelectWidget', () =>
  jest.fn().mockImplementation(() => <p>TreeSelectWidget</p>)
);

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();

const mockBaseProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
};

const mockSelectProps: WidgetProps = {
  ...mockBaseProps,
  ...MOCK_SELECT_WIDGET,
};

const mockTreeSelectProps: WidgetProps = {
  ...mockBaseProps,
  ...MOCK_TREE_SELECT_WIDGET,
};

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe('Test SelectWidget Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render select component', async () => {
    render(<SelectWidget {...mockSelectProps} />);

    const selectInput = screen.getByTestId(
      'select-widget-root/searchIndexMappingLanguage'
    );
    const treeSelectWidget = screen.queryByText('TreeSelectWidget');

    expect(selectInput).toBeInTheDocument();
    expect(treeSelectWidget).not.toBeInTheDocument();
  });

  it('Should be disabled', async () => {
    render(<SelectWidget {...mockSelectProps} disabled />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('Should call onFocus and onBlur', async () => {
    render(<SelectWidget {...mockSelectProps} />);

    act(() => screen.getByRole('combobox').focus());

    expect(mockOnFocus).toHaveBeenCalled();

    act(() => screen.getByRole('combobox').blur());

    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('Should call onChange', async () => {
    render(<SelectWidget {...mockSelectProps} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByTestId('select-option-EN'));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('Should render TreeSelectWidget component if uiFieldType is treeSelect', async () => {
    render(<SelectWidget {...mockTreeSelectProps} />);

    const selectWidget = screen.queryByTestId(
      'select-widget-root/searchIndexMappingLanguage'
    );
    const treeSelectWidget = screen.getByText('TreeSelectWidget');

    expect(treeSelectWidget).toBeInTheDocument();
    expect(selectWidget).not.toBeInTheDocument();
  });

  it('Should filter options when searching', async () => {
    render(<SelectWidget {...mockSelectProps} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByTestId('select-option-JP')).toBeInTheDocument();
    expect(screen.getByTestId('select-option-RU')).toBeInTheDocument();
    expect(screen.getByTestId('select-option-ZH')).toBeInTheDocument();

    await user.clear(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'EN');

    await waitFor(() =>
      expect(screen.queryByTestId('select-option-JP')).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('select-option-EN')).toBeInTheDocument();
    expect(screen.queryByTestId('select-option-RU')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-option-ZH')).not.toBeInTheDocument();
  });
});
