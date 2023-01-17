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
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { exportGlossaryInCSVFormat } from 'rest/glossaryAPI';
import ExportGlossaryModal from './ExportGlossaryModal';

const mockCancel = jest.fn();
const mockOk = jest.fn();

const mockProps = {
  isModalOpen: true,
  onCancel: mockCancel,
  onOk: mockOk,
  glossaryName: 'Glossary1',
};

jest.mock('rest/glossaryAPI', () => ({
  exportGlossaryInCSVFormat: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
}));

jest.mock('utils/TimeUtils', () => ({
  getCurrentLocaleDate: jest.fn().mockImplementation(() => 'data-string'),
}));

describe('Export Glossary Modal', () => {
  it('Should render the modal content', async () => {
    render(<ExportGlossaryModal {...mockProps} />);

    const container = await screen.getByTestId('export-glossary-modal');
    const title = await screen.getByText('label.export-glossary-terms');
    const input = await screen.getByTestId('file-name-input');

    const cancelButton = await screen.getByText('label.cancel');
    const exportButton = await screen.getByText('label.export');

    expect(cancelButton).toBeInTheDocument();

    expect(exportButton).toBeInTheDocument();

    expect(input).toBeInTheDocument();

    expect(title).toBeInTheDocument();

    expect(container).toBeInTheDocument();
  });

  it('File name change should work', async () => {
    render(<ExportGlossaryModal {...mockProps} />);

    const input = await screen.getByTestId('file-name-input');

    expect(input).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(input, { target: { value: 'my_file_name' } });
    });

    expect(input).toHaveValue('my_file_name');
  });

  it('Export should work', async () => {
    render(<ExportGlossaryModal {...mockProps} />);

    const exportButton = await screen.getByText('label.export');

    expect(exportButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(exportButton);
    });

    expect(exportGlossaryInCSVFormat).toHaveBeenCalledWith('Glossary1');
  });

  it('Cancel should work', async () => {
    render(<ExportGlossaryModal {...mockProps} />);

    const cancelButton = await screen.getByText('label.cancel');

    expect(cancelButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(cancelButton);
    });

    expect(mockCancel).toHaveBeenCalled();
  });
});
