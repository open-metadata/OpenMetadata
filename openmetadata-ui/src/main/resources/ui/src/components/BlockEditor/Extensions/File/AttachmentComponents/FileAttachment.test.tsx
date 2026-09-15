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
import { fireEvent, render, screen } from '@testing-library/react';
import { NodeViewProps } from '@tiptap/react';
import { UPLOADED_ASSETS_URL } from '../../../../../constants/BlockEditor.constants';
import { bytesToSize } from '../../../../../utils/StringUtils';
import FileAttachment from './FileAttachment';

const DOWNLOAD_TEST_ID = 'download-file-attachment';
const TEST_FILE_NAME = 'test.pdf';

describe('FileAttachment', () => {
  // Create a minimal mock that only includes what the component needs
  const createMockNode = (attrs: unknown) =>
    ({
      attrs: {
        url: '',
        fileName: '',
        fileSize: 0,
        mimeType: '',
        isUploading: false,
        uploadProgress: 0,
        tempFile: null,
        ...(attrs as NodeViewProps['node']['attrs']),
      },
    } as unknown as NodeViewProps['node']); // Type assertion to avoid TipTap Node type complexity

  const uploadedFileUrl = `${UPLOADED_ASSETS_URL}abc-123`;

  const mockNode = createMockNode({
    url: uploadedFileUrl,
    fileName: TEST_FILE_NAME,
    fileSize: 1024 * 1024, // 1MB
    mimeType: 'application/pdf',
  });

  const mockProps = {
    node: mockNode,
    isFileLoading: false,
    deleteNode: jest.fn(),
    onFileClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders file attachment with correct details', () => {
    render(<FileAttachment {...mockProps} />);

    // Check if file name is displayed
    expect(screen.getByText(TEST_FILE_NAME)).toBeInTheDocument();

    // Check if file size is displayed correctly
    expect(screen.getByText(bytesToSize(1024 * 1024))).toBeInTheDocument();

    // Check if download button is present for an uploaded asset
    expect(screen.getByTestId(DOWNLOAD_TEST_ID)).toBeInTheDocument();
  });

  it('handles file click correctly', () => {
    render(<FileAttachment {...mockProps} />);

    const fileLink = screen.getByText(TEST_FILE_NAME);
    fireEvent.click(fileLink);

    expect(mockProps.onFileClick).toHaveBeenCalled();
  });

  it('handles delete button click correctly', () => {
    render(<FileAttachment {...mockProps} />);

    const deleteButton = screen.getByTestId('delete-icon');
    fireEvent.click(deleteButton);

    expect(mockProps.deleteNode).toHaveBeenCalled();
  });

  it('shows upload progress when file is uploading', () => {
    const uploadingNode = createMockNode({
      ...mockNode.attrs,
      isUploading: true,
      uploadProgress: 50,
    });

    render(<FileAttachment {...mockProps} node={uploadingNode} />);

    // Check if upload progress is displayed
    const progressBar = screen.getByTestId('upload-progress');

    expect(progressBar).toHaveStyle({ width: '50%' });

    // Check if delete button is not present during upload
    expect(screen.queryByTestId('delete-icon')).not.toBeInTheDocument();
  });

  it('disables the download button when isFileLoading is true', () => {
    render(<FileAttachment {...mockProps} isFileLoading />);

    const downloadButton = screen.getByTestId(DOWNLOAD_TEST_ID);

    expect(downloadButton).toBeDisabled();
  });

  it('does not show a download button for a plain external URL', () => {
    const urlOnlyNode = createMockNode({
      ...mockNode.attrs,
      url: 'https://example.com/file.pdf',
    });

    render(<FileAttachment {...mockProps} node={urlOnlyNode} />);

    expect(screen.queryByTestId(DOWNLOAD_TEST_ID)).not.toBeInTheDocument();
  });

  it('renders without throwing when mimeType and tempFile are both empty', () => {
    const noMimeTypeNode = createMockNode({
      ...mockNode.attrs,
      mimeType: null,
      tempFile: null,
    });

    expect(() =>
      render(<FileAttachment {...mockProps} node={noMimeTypeNode} />)
    ).not.toThrow();

    expect(screen.getByText(TEST_FILE_NAME)).toBeInTheDocument();
  });

  it('uses tempFile details when available', () => {
    const tempFileNode = createMockNode({
      ...mockNode.attrs,
      tempFile: {
        name: 'temp.pdf',
        size: 2048 * 1024, // 2MB
        type: 'application/pdf',
      },
      fileName: null,
      fileSize: null,
      mimeType: null,
    });

    render(<FileAttachment {...mockProps} node={tempFileNode} />);

    // Check if temp file name is displayed
    expect(screen.getByText('temp.pdf')).toBeInTheDocument();

    // Check if temp file size is displayed correctly
    expect(screen.getByText(bytesToSize(2048 * 1024))).toBeInTheDocument();
  });
});
