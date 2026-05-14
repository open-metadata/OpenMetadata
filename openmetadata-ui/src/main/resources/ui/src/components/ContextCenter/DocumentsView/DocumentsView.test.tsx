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
import DocumentsView from './DocumentsView.component';
import { DocFile } from './DocumentsView.interface';

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => jest.fn(() => <div data-testid="error-placeholder" />)
);

jest.mock('@openmetadata/ui-core-components', () => ({
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
  Dropdown: {
    Root: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    DotsButton: jest.fn(() => <button>⋯</button>),
    Popover: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    Menu: jest.fn(
      ({
        children,
        onAction,
      }: {
        children: React.ReactNode;
        onAction?: (key: string) => void;
      }) => <div data-onaction={String(onAction)}>{children}</div>
    ),
    Item: jest.fn(({ id, label }: { id: string; label: string }) => (
      <button data-testid={`dropdown-item-${id}`}>{label}</button>
    )),
  },
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockFiles: DocFile[] = [
  {
    id: 'file-1',
    name: 'report.pdf',
    fileType: 'pdf',
    sizeLabel: '2 MB',
    updatedBy: 'alice',
    updatedAt: 1778756959299,
  },
  {
    id: 'file-2',
    name: 'data.csv',
    fileType: 'csv',
    sizeLabel: '500 KB',
  },
];

describe('DocumentsView', () => {
  it('renders the documents view container', () => {
    render(<DocumentsView data={mockFiles} isLoading={false} />);

    expect(screen.getByTestId('documents-view')).toBeInTheDocument();
  });

  it('renders a row for each file when data is provided', () => {
    render(<DocumentsView data={mockFiles} isLoading={false} />);

    expect(screen.getByTestId('document-row-file-1')).toBeInTheDocument();
    expect(screen.getByTestId('document-row-file-2')).toBeInTheDocument();
  });

  it('renders file name and size for each file', () => {
    render(<DocumentsView data={mockFiles} isLoading={false} />);

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
    expect(screen.getByText('data.csv')).toBeInTheDocument();
    expect(screen.getByText('500 KB')).toBeInTheDocument();
  });

  it('renders uploadedBy and uploadedAt when provided', () => {
    render(<DocumentsView data={mockFiles} isLoading={false} />);

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('2 hrs ago')).toBeInTheDocument();
  });

  it('renders the PDF badge label for pdf files', () => {
    render(<DocumentsView data={[mockFiles[0]]} isLoading={false} />);

    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('renders the CSV badge label for csv files', () => {
    render(<DocumentsView data={[mockFiles[1]]} isLoading={false} />);

    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  it('renders the error placeholder when data is empty and not loading', () => {
    render(<DocumentsView data={[]} isLoading={false} />);

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    render(<DocumentsView isLoading data={[]} />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });

  it('calls onDownload when the download button is clicked', () => {
    const onDownload = jest.fn();
    render(
      <DocumentsView
        data={[mockFiles[0]]}
        isLoading={false}
        onDownload={onDownload}
      />
    );

    fireEvent.click(screen.getAllByText('btn')[0]);

    expect(onDownload).toHaveBeenCalledWith(mockFiles[0]);
  });
});
