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

import { fireEvent, render, screen } from '@testing-library/react';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import DocumentPreviewPanel from './DocumentPreviewPanel.component';

jest.mock('@openmetadata/ui-core-components', () => ({
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
    render(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('document-preview-panel')).toBeInTheDocument();
  });

  it('renders the file name', () => {
    render(
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
    render(
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
    render(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('file-icon-pdf')).toBeInTheDocument();
  });

  it('renders the formatted file size', () => {
    render(
      <DocumentPreviewPanel
        file={baseFile}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('renders folder, updated-by and updated-at rows when present', () => {
    render(
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
    render(
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
    render(
      <DocumentPreviewPanel file={baseFile} url="http://x" onClose={onClose} />
    );

    fireEvent.click(screen.getByTestId('close-preview-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the copy link button with the given url', () => {
    render(
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
