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
import { ProcessingStatus } from '../../../generated/entity/data/contextFile';
import UploadedDocumentCard from './UploadedDocumentCard.component';
import { UploadedDocumentItem } from './UploadedDocumentCard.interface';

jest.mock('../DocumentStatusBadge/DocumentStatusBadge.component', () =>
  jest.fn(({ status }: { status?: string }) =>
    status ? <span data-testid="document-status-badge">{status}</span> : null
  )
);

jest.mock('@openmetadata/ui-core-components', () => ({
  ButtonUtility: jest.fn(({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick}>download</button>
  )),
  Card: jest.fn(
    ({
      children,
      onClick,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      'data-testid'?: string;
    }) => (
      <div data-testid={testId} onClick={onClick}>
        {children}
      </div>
    )
  ),
  FileIcon: jest.fn(({ type }: { type: string }) => (
    <span data-testid={`file-icon-${type}`} />
  )),
  Typography: jest.fn(
    ({ children, title }: { children: React.ReactNode; title?: string }) => (
      <span title={title}>{children}</span>
    )
  ),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
}));

const mockDocument: UploadedDocumentItem = {
  id: 'doc-1',
  name: 'MyReport.pdf',
  fileExtension: 'pdf',
  sizeLabel: '1.2 MB',
  status: ProcessingStatus.Processed,
  updatedBy: 'alice',
  updatedAt: 1778756959299,
};

describe('UploadedDocumentCard', () => {
  it('renders the uploaded document card', () => {
    render(<UploadedDocumentCard document={mockDocument} />);

    expect(screen.getByTestId('uploaded-document-card')).toBeInTheDocument();
  });

  it('renders the file name', () => {
    render(<UploadedDocumentCard document={mockDocument} />);

    expect(screen.getByText('MyReport.pdf')).toBeInTheDocument();
  });

  it('renders the size label', () => {
    render(<UploadedDocumentCard document={mockDocument} />);

    expect(screen.getByText('1.2 MB')).toBeInTheDocument();
  });

  it('renders the file type icon for pdf extension', () => {
    render(<UploadedDocumentCard document={mockDocument} />);

    expect(screen.getByTestId('file-icon-pdf')).toBeInTheDocument();
  });

  it('renders the correct file icon for doc extension', () => {
    const docDocument: UploadedDocumentItem = {
      ...mockDocument,
      id: 'doc-2',
      fileExtension: 'doc',
    };
    render(<UploadedDocumentCard document={docDocument} />);

    expect(screen.getByTestId('file-icon-doc')).toBeInTheDocument();
  });

  it('calls onClick with the document when the card is clicked', () => {
    const onClick = jest.fn();
    render(<UploadedDocumentCard document={mockDocument} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('uploaded-document-card'));

    expect(onClick).toHaveBeenCalledWith(mockDocument);
  });

  it('does not throw when onClick is not provided', () => {
    render(<UploadedDocumentCard document={mockDocument} />);

    expect(() =>
      fireEvent.click(screen.getByTestId('uploaded-document-card'))
    ).not.toThrow();
  });

  it('renders title attribute on the name typography', () => {
    render(<UploadedDocumentCard document={mockDocument} />);

    expect(screen.getByTitle('MyReport.pdf')).toBeInTheDocument();
  });

  it('renders the processing status badge with the document status', () => {
    render(<UploadedDocumentCard document={mockDocument} />);

    expect(screen.getByTestId('document-status-badge')).toHaveTextContent(
      ProcessingStatus.Processed
    );
  });
});
