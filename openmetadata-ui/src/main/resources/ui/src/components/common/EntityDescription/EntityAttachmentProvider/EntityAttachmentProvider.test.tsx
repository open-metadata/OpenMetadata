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
import { render, screen } from '@testing-library/react';
import { EditorView } from '@tiptap/pm/view';
import { AxiosError } from 'axios';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { showErrorToast } from '../../../../utils/ToastUtils';
import imageClassBase from '../../../BlockEditor/Extensions/image/ImageClassBase';
import {
  EntityAttachmentProvider,
  useEntityAttachment,
} from './EntityAttachmentProvider';

// Mock the toast utility
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// Mock the image class base
jest.mock('../../../BlockEditor/Extensions/image/ImageClassBase', () => ({
  __esModule: true,
  default: {
    getBlockEditorAttachmentProps: jest.fn(),
  },
}));

// Test component to access context
const TestComponent = () => {
  const context = useEntityAttachment();

  return (
    <div>
      <div data-testid="entity-type">{context.entityType}</div>
      <div data-testid="entity-fqn">{context.entityFqn}</div>
      <div data-testid="allow-image-upload">
        {context.allowImageUpload.toString()}
      </div>
      <div data-testid="allow-file-upload">
        {context.allowFileUpload.toString()}
      </div>
      <div data-testid="error-message">{context.errorMessage}</div>
    </div>
  );
};

// Wrapper component for testing file upload functionality
const FileUploadTestComponent = ({
  file,
  view,
  position,
  showInlineAlert,
}: {
  file: File;
  view: EditorView;
  position: number;
  showInlineAlert?: boolean;
}) => {
  const context = useEntityAttachment();
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    const uploadFile = async () => {
      try {
        setIsUploading(true);
        await context.handleFileUpload(file, view, position, showInlineAlert);
      } finally {
        setIsUploading(false);
      }
    };
    uploadFile();
  }, [file, view, position, showInlineAlert, context]);

  return (
    <div data-testid="upload-status">{isUploading ? 'uploading' : 'done'}</div>
  );
};

describe('EntityAttachmentProvider', () => {
  const mockOnImageUpload = jest.fn();
  const mockView = {
    state: {
      doc: {
        descendants: jest.fn(),
      },
      schema: {
        nodes: {
          image: {
            create: jest.fn(),
          },
          fileAttachment: {
            create: jest.fn(),
          },
        },
      },
      tr: {
        insert: jest.fn(),
        replaceWith: jest.fn(),
        delete: jest.fn(),
      },
    },
    dispatch: jest.fn(),
  } as unknown as EditorView;

  beforeEach(() => {
    jest.clearAllMocks();
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
    (imageClassBase.getBlockEditorAttachmentProps as jest.Mock).mockReturnValue(
      {
        onImageUpload: mockOnImageUpload,
        allowImageUpload: true,
      }
    );
  });

  it('renders with default props', () => {
    render(
      <EntityAttachmentProvider entityType={EntityType.TABLE}>
        <TestComponent />
      </EntityAttachmentProvider>
    );

    expect(screen.getByTestId('entity-type')).toHaveTextContent(
      EntityType.TABLE
    );
    expect(screen.getByTestId('entity-fqn')).toHaveTextContent('');
    expect(screen.getByTestId('allow-image-upload')).toHaveTextContent('true');
    expect(screen.getByTestId('allow-file-upload')).toHaveTextContent('false');
  });

  it('renders with custom props', () => {
    render(
      <EntityAttachmentProvider
        allowFileUpload
        entityFqn="test.fqn"
        entityType={EntityType.DATABASE}>
        <TestComponent />
      </EntityAttachmentProvider>
    );

    expect(screen.getByTestId('entity-type')).toHaveTextContent(
      EntityType.DATABASE
    );
    expect(screen.getByTestId('entity-fqn')).toHaveTextContent('test.fqn');
    expect(screen.getByTestId('allow-image-upload')).toHaveTextContent('true');
    expect(screen.getByTestId('allow-file-upload')).toHaveTextContent('true');
  });

  it('handles image file upload successfully', async () => {
    const mockUrl = 'https://example.com/image.jpg';
    const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    mockOnImageUpload.mockResolvedValue(mockUrl);

    render(
      <EntityAttachmentProvider entityType={EntityType.TABLE}>
        <FileUploadTestComponent file={mockFile} position={0} view={mockView} />
      </EntityAttachmentProvider>
    );

    // Wait for upload to complete
    await screen.findByText('done');

    expect(mockOnImageUpload).toHaveBeenCalledWith(
      mockFile,
      EntityType.TABLE,
      undefined
    );

    // Verify temporary node creation
    expect(
      mockView.state.schema.nodes.fileAttachment.create
    ).toHaveBeenCalledWith({
      url: '',
      fileName: mockFile.name,
      fileSize: mockFile.size,
      mimeType: mockFile.type,
      isUploading: true,
      uploadProgress: 0,
      tempFile: mockFile,
      isImage: true,
      alt: mockFile.name,
    });

    // Verify final node creation
    expect(
      mockView.state.schema.nodes.fileAttachment.create
    ).toHaveBeenCalledWith({
      url: mockUrl,
      fileName: mockFile.name,
      fileSize: mockFile.size,
      mimeType: mockFile.type,
      isUploading: false,
      uploadProgress: 100,
      isImage: true,
      alt: mockFile.name,
    });
    expect(mockView.dispatch).toHaveBeenCalled();
  });

  it('handles non-image file upload successfully', async () => {
    const mockUrl = 'https://example.com/file.pdf';
    const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    mockOnImageUpload.mockResolvedValue(mockUrl);

    render(
      <EntityAttachmentProvider allowFileUpload entityType={EntityType.TABLE}>
        <FileUploadTestComponent file={mockFile} position={0} view={mockView} />
      </EntityAttachmentProvider>
    );

    // Wait for upload to complete
    await screen.findByText('done');

    expect(mockOnImageUpload).toHaveBeenCalledWith(
      mockFile,
      EntityType.TABLE,
      undefined
    );

    // Verify temporary node creation
    expect(
      mockView.state.schema.nodes.fileAttachment.create
    ).toHaveBeenCalledWith({
      url: '',
      fileName: mockFile.name,
      fileSize: mockFile.size,
      mimeType: mockFile.type,
      isUploading: true,
      uploadProgress: 0,
      tempFile: mockFile,
      isImage: false,
      alt: mockFile.name,
    });

    // Verify final node creation
    expect(
      mockView.state.schema.nodes.fileAttachment.create
    ).toHaveBeenCalledWith({
      url: mockUrl,
      fileName: mockFile.name,
      fileSize: mockFile.size,
      mimeType: mockFile.type,
      isUploading: false,
      uploadProgress: 100,
      isImage: false,
      alt: mockFile.name,
    });
    expect(mockView.dispatch).toHaveBeenCalled();
  });

  it('shows error for non-image file when file upload is not allowed', async () => {
    const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });

    render(
      <EntityAttachmentProvider entityType={EntityType.TABLE}>
        <FileUploadTestComponent file={mockFile} position={0} view={mockView} />
      </EntityAttachmentProvider>
    );

    // Wait for upload to complete
    await screen.findByText('done');

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.only-image-files-supported'
    );
  });

  it('handles upload error with string error', async () => {
    const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const errorMessage = 'Upload failed';
    mockOnImageUpload.mockRejectedValue({
      response: { data: { message: errorMessage } },
    });

    render(
      <EntityAttachmentProvider entityType={EntityType.TABLE}>
        <div>
          <TestComponent />
          <FileUploadTestComponent
            showInlineAlert
            file={mockFile}
            position={0}
            view={mockView}
          />
        </div>
      </EntityAttachmentProvider>
    );

    // Wait for upload to complete
    await screen.findByText('done');

    expect(screen.getByTestId('error-message')).toHaveTextContent(errorMessage);
  });

  it('handles upload error with AxiosError', async () => {
    const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const mockError = new AxiosError('Network error');
    mockOnImageUpload.mockRejectedValue(mockError);

    render(
      <EntityAttachmentProvider entityType={EntityType.TABLE}>
        <FileUploadTestComponent file={mockFile} position={0} view={mockView} />
      </EntityAttachmentProvider>
    );

    // Wait for upload to complete
    await screen.findByText('done');

    expect(showErrorToast).toHaveBeenCalledWith(
      mockError,
      'label.failed-to-upload-file'
    );
  });

  it('does not handle file upload when onImageUpload is not provided', async () => {
    (imageClassBase.getBlockEditorAttachmentProps as jest.Mock).mockReturnValue(
      {
        allowImageUpload: true,
      }
    );

    const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });

    render(
      <EntityAttachmentProvider entityType={EntityType.TABLE}>
        <FileUploadTestComponent file={mockFile} position={0} view={mockView} />
      </EntityAttachmentProvider>
    );

    // Wait for upload to complete
    await screen.findByText('done');

    expect(mockOnImageUpload).not.toHaveBeenCalled();
  });

  it('does not handle image upload when not allowed', async () => {
    (imageClassBase.getBlockEditorAttachmentProps as jest.Mock).mockReturnValue(
      {
        onImageUpload: mockOnImageUpload,
        allowImageUpload: false,
      }
    );

    const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });

    render(
      <EntityAttachmentProvider entityType={EntityType.TABLE}>
        <FileUploadTestComponent file={mockFile} position={0} view={mockView} />
      </EntityAttachmentProvider>
    );

    // Wait for upload to complete
    await screen.findByText('done');

    expect(mockOnImageUpload).not.toHaveBeenCalled();
  });
});
