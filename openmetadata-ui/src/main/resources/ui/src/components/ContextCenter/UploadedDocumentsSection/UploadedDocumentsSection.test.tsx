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
import { UploadedDocumentItem } from '../UploadedDocumentCard/UploadedDocumentCard.interface';
import UploadedDocumentsSection from './UploadedDocumentsSection.component';

jest.mock('components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div data-testid="error-placeholder" />)
);

jest.mock('../UploadedDocumentCard/UploadedDocumentCard.component', () =>
  jest.fn(
    ({
      document,
      onClick,
    }: {
      document: UploadedDocumentItem;
      onClick?: (d: UploadedDocumentItem) => void;
    }) => (
      <div
        data-testid={`uploaded-doc-card-${document.id}`}
        onClick={() => onClick?.(document)}>
        {document.name}
      </div>
    )
  )
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
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
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockDocuments: UploadedDocumentItem[] = [
  {
    id: 'd1',
    name: 'Report.pdf',
    fileType: 'pdf',
    sizeLabel: '1 MB',
    status: 'processed',
    updatedBy: 'alice',
    updatedAt: 1778756959299,
  },
  {
    id: 'd2',
    name: 'Sheet.xls',
    fileType: 'xls',
    sizeLabel: '200 KB',
    status: 'analyzing',
    updatedBy: 'alice',
    updatedAt: 1778756959299,
  },
];

describe('UploadedDocumentsSection', () => {
  it('renders the section container', () => {
    render(<UploadedDocumentsSection documents={mockDocuments} />);

    expect(
      screen.getByTestId('uploaded-documents-section')
    ).toBeInTheDocument();
  });

  it('renders a card for each documenisLoading', () => {
    render(<UploadedDocumentsSection documents={mockDocuments} />);

    expect(screen.getByTestId('uploaded-doc-card-d1')).toBeInTheDocument();
    expect(screen.getByTestId('uploaded-doc-card-d2')).toBeInTheDocument();
  });

  it('renders the error placeholder when documents list is empty', () => {
    render(<UploadedDocumentsSection documents={[]} />);

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    render(<UploadedDocumentsSection isLoading documents={[]} />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });

  it('shows the view-all button when onViewAll is provided', () => {
    const onViewAll = jest.fn();
    render(
      <UploadedDocumentsSection
        documents={mockDocuments}
        onViewAll={onViewAll}
      />
    );

    expect(screen.getByText(/view-all/i)).toBeInTheDocument();
  });

  it('does not show the view-all button when neither viewAllHref nor onViewAll is provided', () => {
    render(<UploadedDocumentsSection documents={mockDocuments} />);

    expect(screen.queryByText(/view-all/i)).not.toBeInTheDocument();
  });

  it('calls onViewAll when the view-all button is clicked', () => {
    const onViewAll = jest.fn();
    render(
      <UploadedDocumentsSection
        documents={mockDocuments}
        onViewAll={onViewAll}
      />
    );

    fireEvent.click(screen.getByText(/view-all/i));

    expect(onViewAll).toHaveBeenCalled();
  });

  it('calls onDocumentClick when a document card is clicked', () => {
    const onDocumentClick = jest.fn();
    render(
      <UploadedDocumentsSection
        documents={mockDocuments}
        onDocumentClick={onDocumentClick}
      />
    );

    fireEvent.click(screen.getByTestId('uploaded-doc-card-d1'));

    expect(onDocumentClick).toHaveBeenCalledWith(mockDocuments[0]);
  });
});
