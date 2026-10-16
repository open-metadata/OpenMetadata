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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { showErrorToast } from '../../utils/ToastUtils';
import UploadFile from './UploadFile';
import { UploadFileProps } from './UploadFile.interface';

jest.mock('../common/Loader/Loader', () => {
  return jest.fn(() => <div data-testid="loader">Loading...</div>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('UploadFile Component', () => {
  const defaultProps: UploadFileProps = {
    fileType: '.csv',
    onCSVUploaded: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the upload component with correct props', async () => {
    render(<UploadFile {...defaultProps} />);

    expect(screen.getByTestId('upload-file-widget')).toBeInTheDocument();

    expect(screen.getByTestId('upload-file-input')).toHaveAttribute(
      'accept',
      '.csv'
    );
    expect(
      screen.getByRole('button', { name: 'label.click-to-browse' })
    ).toBeInTheDocument();
  });

  it('should render with disabled state', () => {
    render(<UploadFile {...defaultProps} disabled />);

    const uploadWidget = screen.getByTestId('upload-file-widget');

    expect(uploadWidget).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('upload-file-input')).toBeDisabled();
  });

  it('should not render with disabled state', () => {
    render(<UploadFile {...defaultProps} />);

    expect(screen.getByTestId('upload-file-input')).not.toBeDisabled();
  });

  it('should render with custom file type', () => {
    render(<UploadFile {...defaultProps} fileType=".json,.xml" />);

    expect(screen.getByTestId('upload-file-input')).toHaveAttribute(
      'accept',
      '.json,.xml'
    );
  });

  it('should call onCSVUploaded when file is uploaded successfully', async () => {
    const mockOnCSVUploaded = jest.fn();

    render(<UploadFile {...defaultProps} onCSVUploaded={mockOnCSVUploaded} />);

    const uploadWidget = screen.getByTestId('upload-file-widget');
    const file = new File(['test,csv,content'], 'test.csv', {
      type: 'text/csv',
    });

    fireEvent.drop(uploadWidget, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mockOnCSVUploaded).toHaveBeenCalled();
    });
  });

  it('should handle file upload error', async () => {
    const mockOnCSVUploaded = jest.fn();

    render(<UploadFile {...defaultProps} onCSVUploaded={mockOnCSVUploaded} />);

    const uploadWidget = screen.getByTestId('upload-file-widget');

    // Create a file that will cause an error when read
    const file = new File(['test content'], 'test.csv', {
      type: 'text/csv',
    });

    // Mock FileReader to throw an error
    const originalFileReader = global.FileReader;
    global.FileReader = jest.fn().mockImplementation(
      () =>
        ({
          readAsText: jest.fn(() => {
            throw new Error('File read error');
          }),
          onerror: null,
        } as unknown as FileReader)
    ) as unknown as typeof FileReader;

    fireEvent.drop(uploadWidget, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalled();
    });

    // Restore original FileReader
    global.FileReader = originalFileReader;
  });

  it('should call beforeUpload when provided', () => {
    const mockBeforeUpload = jest.fn(() => true);
    render(<UploadFile {...defaultProps} beforeUpload={mockBeforeUpload} />);

    const uploadWidget = screen.getByTestId('upload-file-widget');
    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });

    fireEvent.drop(uploadWidget, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(mockBeforeUpload).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array)
    );
  });

  it('should not upload file when beforeUpload returns false', () => {
    const mockBeforeUpload = jest.fn(() => false);
    const mockOnCSVUploaded = jest.fn();

    render(
      <UploadFile
        {...defaultProps}
        beforeUpload={mockBeforeUpload}
        onCSVUploaded={mockOnCSVUploaded}
      />
    );

    const uploadWidget = screen.getByTestId('upload-file-widget');
    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });

    fireEvent.drop(uploadWidget, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(mockBeforeUpload).toHaveBeenCalled();
    expect(mockOnCSVUploaded).not.toHaveBeenCalled();
  });

  it('should handle async beforeUpload function', async () => {
    const mockBeforeUpload = jest.fn().mockResolvedValue(true);
    const mockOnCSVUploaded = jest.fn();

    render(
      <UploadFile
        {...defaultProps}
        beforeUpload={mockBeforeUpload}
        onCSVUploaded={mockOnCSVUploaded}
      />
    );

    const uploadWidget = screen.getByTestId('upload-file-widget');
    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });

    fireEvent.drop(uploadWidget, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mockBeforeUpload).toHaveBeenCalled();
    });
  });

  it('should render browse text correctly', async () => {
    render(<UploadFile {...defaultProps} />);

    expect(
      await screen.findByText(/label.click-to-browse/)
    ).toBeInTheDocument();
  });

  it('should render compact upload variant', async () => {
    render(
      <UploadFile
        {...defaultProps}
        acceptedFileDescription="Accepts .csv up to 10 MB"
        variant="compact"
      />
    );

    expect(screen.getByTestId('upload-file-widget')).toBeInTheDocument();
    expect(
      await screen.findByText(/label.click-to-browse/)
    ).toBeInTheDocument();
    expect(screen.getByText('Accepts .csv up to 10 MB')).toBeInTheDocument();
  });
});
