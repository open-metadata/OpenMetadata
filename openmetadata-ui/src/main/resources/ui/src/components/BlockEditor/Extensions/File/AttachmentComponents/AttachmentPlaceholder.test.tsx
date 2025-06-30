/*
 *  Copyright 2025 Collate.
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

import { cleanup, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { getFileIcon } from '../../../../../utils/BlockEditorUtils';
import { FileType } from '../../../BlockEditor.interface';
import AttachmentPlaceholder from './AttachmentPlaceholder';

// Mock the translation hook
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

// Mock the getFileIcon utility to return a valid React component
jest.mock('../../../../../utils/BlockEditorUtils', () => ({
  getFileIcon: jest
    .fn()
    .mockReturnValue(() => <div data-testid="mock-file-icon" />),
}));

describe('AttachmentPlaceholder', () => {
  const mockTranslate = jest.fn();

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup translation mock
    (useTranslation as jest.Mock).mockReturnValue({
      t: mockTranslate,
    });

    // Setup getFileIcon mock
    (getFileIcon as jest.Mock).mockReturnValue(() => (
      <div data-testid="mock-file-icon" />
    ));
  });

  afterEach(() => {
    cleanup();
  });

  it('should render the placeholder with correct file type', () => {
    const fileType = FileType.FILE;
    mockTranslate.mockImplementation((key, options) => {
      if (key === 'label.add-an-file-type') {
        return `Add a ${options.fileType} file`;
      }
      if (key === `label.${fileType}`) {
        return fileType;
      }

      return key;
    });

    render(<AttachmentPlaceholder fileType={fileType} />);

    // Verify the placeholder is rendered
    expect(screen.getByTestId('image-placeholder')).toBeInTheDocument();

    // Verify the icon is rendered
    expect(screen.getByTestId('mock-file-icon')).toBeInTheDocument();

    // Verify the translation was called with correct parameters
    expect(mockTranslate).toHaveBeenCalledWith('label.add-an-file-type', {
      fileType: expect.any(String),
    });
  });

  it.each([
    [FileType.FILE, 'file'],
    [FileType.IMAGE, 'image'],
    [FileType.VIDEO, 'video'],
  ])('should render with %s file type', (fileType, expectedText) => {
    mockTranslate.mockImplementation((key, options) => {
      if (key === 'label.add-an-file-type') {
        return `Add a ${options.fileType} file`;
      }
      if (key === `label.${fileType}`) {
        return fileType;
      }

      return key;
    });

    render(<AttachmentPlaceholder fileType={fileType} />);

    expect(screen.getByTestId('image-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('mock-file-icon')).toBeInTheDocument();
    expect(screen.getByText(`Add a ${expectedText} file`)).toBeInTheDocument();
  });

  it('should have contentEditable set to false', () => {
    const fileType = FileType.FILE;
    mockTranslate.mockImplementation((key, options) => {
      if (key === 'label.add-an-file-type') {
        return `Add a ${options.fileType} file`;
      }
      if (key === `label.${fileType}`) {
        return fileType;
      }

      return key;
    });

    render(<AttachmentPlaceholder fileType={fileType} />);

    const placeholder = screen.getByTestId('image-placeholder');

    expect(placeholder).toHaveAttribute('contentEditable', 'false');
  });
});
