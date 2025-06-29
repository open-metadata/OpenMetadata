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
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MOCK_FILE_SELECT_WIDGET,
  MOCK_SSL_FILE_CONTENT,
} from '../../../../../mocks/Widgets.mock';
import FileUploadWidget from './FileUploadWidget';

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();

const mockProps: WidgetProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  ...MOCK_FILE_SELECT_WIDGET,
};

describe('Test FileUploadWidget Component', () => {
  it('Should render file selector component', async () => {
    render(<FileUploadWidget {...mockProps} />);

    const fileInput = screen.getByTestId('upload-file-widget');
    const fileInputContent = screen.getByTestId('upload-file-widget-content');

    expect(fileInput).toBeInTheDocument();
    expect(fileInputContent).toBeInTheDocument();
  });

  it('Should be disabled', async () => {
    render(<FileUploadWidget {...mockProps} disabled />);

    const fileInput = screen.getByTestId('upload-file-widget');

    expect(fileInput).not.toBeVisible();
  });

  it('Should call onFocus', async () => {
    render(<FileUploadWidget {...mockProps} />);

    const fileInput = screen.getByTestId('upload-file-widget-content');
    fireEvent.focus(fileInput);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('Should call onChange', async () => {
    const file = new File([MOCK_SSL_FILE_CONTENT], 'ssl-certificate.crt.pem', {
      type: 'text/plain',
    });
    const flushPromises = () => new Promise(setImmediate);

    render(<FileUploadWidget {...mockProps}>ImportTableData</FileUploadWidget>);

    const uploadDragger = screen.getByTestId('upload-file-widget');

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    expect(mockOnChange).toHaveBeenCalled();
  });
});
