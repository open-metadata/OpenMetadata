/*
 *  Copyright 2026 Collate.
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

import { Tooltip } from '@openmetadata/ui-core-components';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { Reason } from '../../../generated/api/context/extractionAvailability';
import {
  ContextFile,
  ProcessingStatus,
} from '../../../generated/entity/data/contextFile';
import { User } from '../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  extractFileMemories,
  getContextFileById,
} from '../../../rest/assetAPI';
import { getExtractionAvailability } from '../../../rest/contextMemoryAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../test/unit/test-utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DocumentPreviewPanel from './DocumentPreviewPanel.component';

jest.mock('../../../rest/assetAPI', () => ({
  ...jest.requireActual('../../../rest/assetAPI'),
  extractFileMemories: jest.fn(),
  getContextFileById: jest.fn(),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getExtractionAvailability: jest.fn(),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      isDisabled,
      isLoading,
      onClick,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      isDisabled?: boolean;
      isLoading?: boolean;
      onClick?: () => void;
      'data-testid'?: string;
    }) => (
      <button
        data-loading={isLoading ? 'true' : undefined}
        data-testid={testId}
        disabled={isDisabled || isLoading}
        onClick={onClick}>
        {children}
      </button>
    )
  ),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  Box: jest.fn(
    ({
      children,
      className,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      className?: string;
      'data-testid'?: string;
    }) => (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    )
  ),
  ButtonUtility: jest.fn(
    ({
      onClick,
      'data-testid': testId,
    }: {
      onClick?: () => void;
      'data-testid'?: string;
    }) => (
      <button data-testid={testId} onClick={onClick}>
        btn
      </button>
    )
  ),
  Card: jest.fn(
    ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>
  ),
  FileIcon: jest.fn(({ type }: { type: string }) => (
    <span data-testid={`file-icon-${type}`} />
  )),
  Typography: jest.fn(
    ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <span data-testid={testId}>{children}</span>
  ),
}));

jest.mock('../../CopyLinkButton/CopyLinkButton.component', () =>
  jest.fn(({ url }: { url: string }) => (
    <button data-testid="copy-link-btn" data-url={url}>
      copy
    </button>
  ))
);

jest.mock('../DocumentStatusBadge/DocumentStatusBadge.component', () =>
  jest.fn(
    ({
      file,
    }: {
      file: { processingError?: string; processingStatus?: string };
    }) => (
      <span
        data-error={file.processingError}
        data-status={file.processingStatus}
        data-testid="status-badge"
      />
    )
  )
);

jest.mock('../ExtractedMemoriesCard/ExtractedMemoriesCard.component', () =>
  jest.fn(
    ({
      sourceId,
      sourceOwners,
      sourceType,
    }: {
      sourceId: string;
      sourceOwners?: { id: string }[];
      sourceType: string;
    }) => (
      <div
        data-owner-ids={sourceOwners?.map((owner) => owner.id).join(',')}
        data-source-id={sourceId}
        data-source-type={sourceType}
        data-testid="extracted-memories-card"
      />
    )
  )
);

runQueryNotificationsSynchronously();

const baseFile: ContextFile = {
  id: 'file-1',
  name: 'report.pdf',
  fileExtension: 'pdf',
  fileSize: 2097152,
};

const fullFile: ContextFile = {
  ...baseFile,
  folder: { id: 'folder-1', type: 'folder', name: 'Reports' },
  updatedBy: 'alice',
  updatedAt: Date.now() - 60000,
};

describe('DocumentPreviewPanel', () => {
  it('renders the preview panel container', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('document-preview-panel')).toBeInTheDocument();
  });

  it('renders the file name', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('preview-file-name')).toHaveTextContent(
      'report.pdf'
    );
  });

  it('prefers displayName over name when rendering the file name', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={{ ...baseFile, displayName: 'Report Display Name' }}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('preview-file-name')).toHaveTextContent(
      'Report Display Name'
    );
  });

  it('renders the file icon based on file extension', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('file-icon-pdf')).toBeInTheDocument();
  });

  it('renders the formatted file size', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('renders folder, updated-by and updated-at rows when present', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={fullFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('does not render folder, updated-by or updated-at rows when absent', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('alice')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    renderWithQueryClient(
      <DocumentPreviewPanel file={baseFile} url="http://x" onClose={onClose} />
    );

    fireEvent.click(screen.getByTestId('close-preview-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the processing status badge for the file', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={{ ...baseFile, processingStatus: ProcessingStatus.Analyzing }}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveAttribute(
      'data-status',
      'Analyzing'
    );
  });

  it('lists the memories extracted from the file', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('extracted-memories-card')).toHaveAttribute(
      'data-source-id',
      'file-1'
    );
  });

  // The card offers the file's owners the approval of its extracted memories.
  it('names the file and its owners to the memories card', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={{
          ...baseFile,
          owners: [{ id: 'user-alice', type: 'user', name: 'alice' }],
        }}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    const card = screen.getByTestId('extracted-memories-card');

    expect(card).toHaveAttribute('data-source-type', 'contextFile');
    expect(card).toHaveAttribute('data-owner-ids', 'user-alice');
  });

  it('shows the processing error for a failed file', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={{
          ...baseFile,
          processingStatus: ProcessingStatus.Failed,
          processingError: 'Object storage is not configured',
        }}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('processing-error')).toHaveTextContent(
      'Object storage is not configured'
    );
  });

  it('does not render an error row when the file processed cleanly', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={{ ...baseFile, processingStatus: ProcessingStatus.Processed }}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByTestId('processing-error')).not.toBeInTheDocument();
  });

  it('renders the copy link button with the given url', () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://example.com/file"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('copy-link-btn')).toHaveAttribute(
      'data-url',
      'http://example.com/file'
    );
  });
});

const OWNER: User = {
  id: 'user-alice',
  name: 'alice',
  email: 'alice@example.com',
};

const notExtractedFile: ContextFile = {
  ...baseFile,
  headContentId: 'content-1',
  neverExtracted: true,
  owners: [{ id: OWNER.id, type: 'user', name: OWNER.name }],
  processingStatus: ProcessingStatus.Processed,
};

const failedFile: ContextFile = {
  ...notExtractedFile,
  neverExtracted: false,
  processingError: 'Header doesn’t contain versioninfo',
  processingStatus: ProcessingStatus.Failed,
};

const httpError = (status: number, message: string) =>
  new AxiosError(message, undefined, undefined, undefined, {
    status,
    data: { code: status, message },
  } as AxiosResponse);

// The availability read settles inside the act, so no assertion runs on a half-rendered panel.
const renderPreview = async (
  file: ContextFile,
  onFileRefreshed = jest.fn()
) => {
  await act(async () => {
    renderWithQueryClient(
      <DocumentPreviewPanel
        file={file}
        url="http://x"
        onClose={jest.fn()}
        onFileRefreshed={onFileRefreshed}
      />
    );
  });
};

const extractionButton = () => screen.getByTestId('memory-extraction-btn');

describe('DocumentPreviewPanel — Extract and Retry', () => {
  beforeEach(() => {
    useApplicationStore.setState({ currentUser: OWNER });
    (getExtractionAvailability as jest.Mock).mockResolvedValue({
      available: true,
    });
  });

  // RTL unmounts after this hook, so the sign-out still re-renders the tree.
  afterEach(() => {
    act(() => {
      useApplicationStore.setState({ currentUser: undefined });
    });
  });

  it('offers Extract beside the status of a file never extracted, to its owner', async () => {
    await renderPreview(notExtractedFile);

    expect(extractionButton()).toHaveTextContent('label.extract');
  });

  it('offers Retry on a failed file to an admin who does not own it', async () => {
    useApplicationStore.setState({
      currentUser: { ...OWNER, id: 'user-root', name: 'root', isAdmin: true },
    });
    await renderPreview(failedFile);

    expect(extractionButton()).toHaveTextContent('label.retry');
  });

  it('offers nothing to a user who neither owns the file nor is an admin', async () => {
    useApplicationStore.setState({
      currentUser: { ...OWNER, id: 'user-bob', name: 'bob' },
    });
    await renderPreview(notExtractedFile);

    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-extraction-btn')
    ).not.toBeInTheDocument();
  });

  it('offers nothing on a file that was extracted', async () => {
    await renderPreview({ ...notExtractedFile, neverExtracted: false });

    expect(
      screen.queryByTestId('memory-extraction-btn')
    ).not.toBeInTheDocument();
  });

  it('disables it with the reason while the AI service is unavailable', async () => {
    (getExtractionAvailability as jest.Mock).mockResolvedValue({
      available: false,
      reason: Reason.ProviderUnavailable,
    });
    await renderPreview(notExtractedFile);

    await waitFor(() =>
      expect(Tooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'message.memory-extraction-service-unavailable',
        }),
        expect.anything()
      )
    );

    expect(extractionButton()).toBeDisabled();
  });

  it('requests the extraction and refreshes the preview with the file the server returns', async () => {
    const queued: ContextFile = {
      ...notExtractedFile,
      neverExtracted: false,
      processingStatus: ProcessingStatus.ExtractingContext,
    };
    (extractFileMemories as jest.Mock).mockResolvedValue(queued);
    const onFileRefreshed = jest.fn();
    await renderPreview(notExtractedFile, onFileRefreshed);

    fireEvent.click(extractionButton());

    await waitFor(() => expect(onFileRefreshed).toHaveBeenCalledWith(queued));

    expect(extractFileMemories).toHaveBeenCalledWith('file-1');
  });

  // The page read extraction as available before it was switched off.
  it('says extraction is off after a 409 that the availability now explains, and refreshes the preview', async () => {
    (getExtractionAvailability as jest.Mock)
      .mockResolvedValueOnce({ available: true })
      .mockResolvedValue({
        available: false,
        reason: Reason.ExtractionDisabled,
      });
    (extractFileMemories as jest.Mock).mockRejectedValue(
      httpError(409, 'Memory extraction is unavailable: ExtractionDisabled')
    );
    (getContextFileById as jest.Mock).mockResolvedValue(notExtractedFile);
    const onFileRefreshed = jest.fn();
    await renderPreview(notExtractedFile, onFileRefreshed);

    fireEvent.click(extractionButton());

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.memory-extraction-off'
      )
    );

    expect(onFileRefreshed).toHaveBeenCalledWith(notExtractedFile);
    expect(extractionButton()).toBeDisabled();
  });

  it('says the run could not be queued after a 503 and refreshes the preview from a fresh read', async () => {
    (extractFileMemories as jest.Mock).mockRejectedValue(
      httpError(503, 'Text extraction queue is full.')
    );
    (getContextFileById as jest.Mock).mockResolvedValue(failedFile);
    const onFileRefreshed = jest.fn();
    await renderPreview(notExtractedFile, onFileRefreshed);

    fireEvent.click(extractionButton());

    await waitFor(() =>
      expect(onFileRefreshed).toHaveBeenCalledWith(failedFile)
    );

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.memory-extraction-not-queued'
    );
    expect(getContextFileById).toHaveBeenCalledWith('file-1');
    expect(extractionButton()).toBeEnabled();
  });
});
