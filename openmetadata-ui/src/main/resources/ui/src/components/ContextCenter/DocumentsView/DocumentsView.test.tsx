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

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { Reason } from '../../../generated/api/context/extractionAvailability';
import {
  ContextFile,
  FileType,
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
import DocumentsView from './DocumentsView.component';

jest.mock('../../../rest/assetAPI', () => ({
  ...jest.requireActual('../../../rest/assetAPI'),
  extractFileMemories: jest.fn(),
  getContextFileById: jest.fn(),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getExtractionAvailability: jest.fn(),
}));

// The row menu sits inside the people picker the Shared visibility opens; these tests never open it.
jest.mock(
  '../../common/UserSelectableList/UserSelectableList.component',
  () => ({
    UserSelectableList: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  })
);

jest.mock('react-aria-components', () => ({
  Menu: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  MenuItem: jest.fn(
    ({
      children,
      onAction,
      'data-testid': testId,
    }: {
      children: React.ReactNode | (() => React.ReactNode);
      onAction?: () => void;
      'data-testid'?: string;
    }) => (
      <div
        data-testid={testId}
        role="menuitem"
        tabIndex={0}
        onClick={onAction}
        onKeyDown={undefined}>
        {typeof children === 'function' ? children() : children}
      </div>
    )
  ),
  Popover: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  SubmenuTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Text: jest.fn(
    ({ children, slot }: { children: React.ReactNode; slot?: string }) => (
      <span data-slot={slot}>{children}</span>
    )
  ),
}));

// A menu hands its onAction to its items, so pressing an item acts as it does in react-aria.
jest.mock('@openmetadata/ui-core-components', () => {
  const { createContext, useContext } =
    jest.requireActual<typeof import('react')>('react');
  const MenuAction = createContext<((key: string) => void) | undefined>(
    undefined
  );

  return {
    BadgeWithDot: jest.fn(({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
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
    Button: jest.fn(
      ({
        children,
        onClick,
        'data-testid': testId,
      }: {
        children: React.ReactNode;
        onClick?: () => void;
        'data-testid'?: string;
      }) => (
        <button data-testid={testId} onClick={onClick}>
          {children}
        </button>
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
        }) => (
          <MenuAction.Provider value={onAction}>
            <div>{children}</div>
          </MenuAction.Provider>
        )
      ),
      // An item runs its own onAction, then the menu's, as react-aria's useMenuItem does.
      Item: jest.fn(function Item({
        id,
        isDisabled,
        label,
        children,
        onAction,
        'data-testid': testId,
      }: {
        id?: string;
        isDisabled?: boolean;
        label?: string;
        children?: React.ReactNode | (() => React.ReactNode);
        onAction?: () => void;
        'data-testid'?: string;
      }) {
        const onMenuAction = useContext(MenuAction);

        return (
          <button
            data-testid={testId ?? `dropdown-item-${id}`}
            disabled={isDisabled}
            onClick={() => {
              onAction?.();
              if (id) {
                onMenuAction?.(id);
              }
            }}>
            {label ?? (typeof children === 'function' ? children() : children)}
          </button>
        );
      }),
    },
    Dot: jest.fn(() => <span>·</span>),
    EmptyPlaceholder: jest.fn(({ title }: { title?: React.ReactNode }) => (
      <div data-testid="empty-placeholder">{title}</div>
    )),
    Checkbox: jest.fn(
      ({
        onChange,
        'aria-label': ariaLabel,
      }: {
        onChange?: () => void;
        'aria-label'?: string;
      }) => <input aria-label={ariaLabel} type="checkbox" onChange={onChange} />
    ),
    FileIcon: jest.fn(({ type }: { type: string }) => (
      <span data-testid={`file-icon-${type}`} />
    )),
    Skeleton: jest.fn(() => <div data-testid="skeleton" />),
    Tooltip: jest.fn(
      ({ children, title }: { children: React.ReactNode; title?: string }) => (
        <div title={title}>{children}</div>
      )
    ),
    TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    )),
  };
});

runQueryNotificationsSynchronously();

const mockFiles: ContextFile[] = [
  {
    id: 'file-1',
    name: 'report.pdf',
    fileExtension: 'pdf',
    fileType: FileType.PDF,
    fileSize: 2097152,
    updatedBy: 'alice',
    updatedAt: 1778756959299,
  },
  {
    id: 'file-2',
    name: 'data.csv',
    fileExtension: 'csv',
    fileType: FileType.CSV,
    fileSize: 512000,
  },
];

describe('DocumentsView', () => {
  it('renders the documents view container', () => {
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        totalFileCount={mockFiles.length}
      />
    );

    expect(screen.getByTestId('documents-view')).toBeInTheDocument();
  });

  it('renders a row for each file when data is provided', () => {
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        totalFileCount={mockFiles.length}
      />
    );

    expect(screen.getByTestId('document-row-file-1')).toBeInTheDocument();
    expect(screen.getByTestId('document-row-file-2')).toBeInTheDocument();
  });

  it('renders file name and size for each file', () => {
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        totalFileCount={mockFiles.length}
      />
    );

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    expect(screen.getByText('data.csv')).toBeInTheDocument();
    expect(screen.getByText('500.0 KB')).toBeInTheDocument();
  });

  it('renders uploadedBy and uploadedAt when provided', () => {
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        totalFileCount={mockFiles.length}
      />
    );

    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('renders the file icon for pdf files', () => {
    renderWithQueryClient(
      <DocumentsView
        data={[mockFiles[0]]}
        isLoading={false}
        totalFileCount={1}
      />
    );

    expect(screen.getByTestId('file-icon-pdf')).toBeInTheDocument();
  });

  it('renders the file icon for csv files', () => {
    renderWithQueryClient(
      <DocumentsView
        data={[mockFiles[1]]}
        isLoading={false}
        totalFileCount={1}
      />
    );

    expect(screen.getByTestId('file-icon-csv')).toBeInTheDocument();
  });

  it('renders the empty placeholder when data is empty and not loading', () => {
    renderWithQueryClient(
      <DocumentsView data={[]} isLoading={false} totalFileCount={0} />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(screen.getByText('label.no-matching-results')).toBeInTheDocument();
  });

  it('renders the folder-empty placeholder when a folder is selected and has no files', () => {
    renderWithQueryClient(
      <DocumentsView
        data={[]}
        isLoading={false}
        selectedFolderName="Reports"
        totalFileCount={0}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(screen.getByText('label.folder-name-is-empty')).toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    renderWithQueryClient(
      <DocumentsView isLoading data={[]} totalFileCount={0} />
    );

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });

  it('calls onDownload when the download button is clicked', () => {
    const onDownload = jest.fn();
    renderWithQueryClient(
      <DocumentsView
        data={[mockFiles[0]]}
        isLoading={false}
        totalFileCount={1}
        onDownload={onDownload}
      />
    );

    fireEvent.click(screen.getByTestId('download-btn'));

    expect(onDownload).toHaveBeenCalledWith(mockFiles[0]);
  });

  it('calls onOpenPreview when the preview button is clicked', () => {
    const onOpenPreview = jest.fn();
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        totalFileCount={mockFiles.length}
        onOpenPreview={onOpenPreview}
      />
    );

    fireEvent.click(screen.getAllByTestId('preview-btn')[0]);

    expect(onOpenPreview).toHaveBeenCalledWith(mockFiles[0]);
  });

  it('shows the bulk-action bar when files are selected', () => {
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        selectedIds={new Set(['file-1', 'file-2'])}
        totalFileCount={mockFiles.length}
      />
    );

    expect(screen.getByTestId('clear-selection-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-download-btn')).toBeInTheDocument();
    expect(
      screen.queryByTestId('documents-view-file-count')
    ).not.toBeInTheDocument();
  });

  it('calls onClearSelection when the clear button is clicked', () => {
    const onClearSelection = jest.fn();
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        selectedIds={new Set(['file-1', 'file-2'])}
        totalFileCount={mockFiles.length}
        onClearSelection={onClearSelection}
      />
    );

    fireEvent.click(screen.getByTestId('clear-selection-btn'));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('calls onClearSelection even when selectedIds has ghost ids not in data', () => {
    const onClearSelection = jest.fn();
    renderWithQueryClient(
      <DocumentsView
        data={[mockFiles[0]]}
        isLoading={false}
        selectedIds={new Set(['file-1', 'ghost-1', 'ghost-2'])}
        totalFileCount={1}
        onClearSelection={onClearSelection}
      />
    );

    fireEvent.click(screen.getByTestId('clear-selection-btn'));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('falls back to toggling visible selected ids when onClearSelection is not provided', () => {
    const onSelectFile = jest.fn();
    renderWithQueryClient(
      <DocumentsView
        data={mockFiles}
        isLoading={false}
        selectedIds={new Set(['file-1', 'file-2'])}
        totalFileCount={mockFiles.length}
        onSelectFile={onSelectFile}
      />
    );

    fireEvent.click(screen.getByTestId('clear-selection-btn'));

    expect(onSelectFile).toHaveBeenCalledWith('file-1');
    expect(onSelectFile).toHaveBeenCalledWith('file-2');
  });

  it('without onClearSelection, clear only toggles ids present in data', () => {
    const onSelectFile = jest.fn();
    renderWithQueryClient(
      <DocumentsView
        data={[mockFiles[0]]}
        isLoading={false}
        selectedIds={new Set(['file-1', 'ghost-1'])}
        totalFileCount={1}
        onSelectFile={onSelectFile}
      />
    );

    fireEvent.click(screen.getByTestId('clear-selection-btn'));

    expect(onSelectFile).toHaveBeenCalledWith('file-1');
    expect(onSelectFile).not.toHaveBeenCalledWith('ghost-1');
  });
});

const OWNER: User = {
  id: 'user-alice',
  name: 'alice',
  email: 'alice@example.com',
};

const notExtractedFile: ContextFile = {
  id: 'file-1',
  name: 'report.txt',
  fileExtension: 'txt',
  fileType: FileType.Text,
  fileSize: 1024,
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

// The availability read settles inside the act, so no assertion runs on a half-rendered row.
const renderRow = async (
  file: ContextFile,
  {
    canEdit = true,
    onFileRefreshed = jest.fn(),
  }: { canEdit?: boolean; onFileRefreshed?: jest.Mock } = {}
) => {
  await act(async () => {
    renderWithQueryClient(
      <DocumentsView
        canDelete={canEdit}
        canEdit={canEdit}
        data={[file]}
        isLoading={false}
        totalFileCount={1}
        onFileRefreshed={onFileRefreshed}
      />
    );
  });
};

const extractionItem = () => screen.getByTestId('memory-extraction-menu-btn');

describe('DocumentsView — Extract and Retry in the row menu', () => {
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

  it('offers Extract on a file never extracted to its owner', async () => {
    await renderRow(notExtractedFile);

    expect(extractionItem()).toHaveTextContent('label.extract');
  });

  it('offers Retry on a failed file to an admin who does not own it', async () => {
    useApplicationStore.setState({
      currentUser: { ...OWNER, id: 'user-root', name: 'root', isAdmin: true },
    });
    await renderRow(failedFile);

    expect(extractionItem()).toHaveTextContent('label.retry');
  });

  it('offers neither to a user who neither owns the file nor is an admin', async () => {
    useApplicationStore.setState({
      currentUser: { ...OWNER, id: 'user-bob', name: 'bob' },
    });
    await renderRow(notExtractedFile);

    expect(screen.getByTestId('manage-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-extraction-menu-btn')
    ).not.toBeInTheDocument();
  });

  it.each([
    ['was extracted', { ...notExtractedFile, neverExtracted: false }],
    ['failed without content', { ...failedFile, headContentId: undefined }],
  ])('offers nothing on a file that %s', async (_state, file) => {
    await renderRow(file);

    expect(screen.getByTestId('manage-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-extraction-menu-btn')
    ).not.toBeInTheDocument();
  });

  // Extraction is no policy grant: an owner without edit or delete still gets the menu for it.
  it('shows the menu to an owner who may neither edit nor delete', async () => {
    await renderRow(notExtractedFile, { canEdit: false });

    expect(extractionItem()).toHaveTextContent('label.extract');
    expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument();
  });

  it('has no menu for a user with no action on the file', async () => {
    useApplicationStore.setState({
      currentUser: { ...OWNER, id: 'user-bob', name: 'bob' },
    });
    await renderRow(notExtractedFile, { canEdit: false });

    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('disables it with the reason while extraction is off', async () => {
    (getExtractionAvailability as jest.Mock).mockResolvedValue({
      available: false,
      reason: Reason.ExtractionDisabled,
    });
    await renderRow(notExtractedFile);

    await waitFor(() => expect(extractionItem()).toBeDisabled());

    // Shown on the item itself: a disabled menu item takes no hover or keyboard focus.
    expect(
      within(extractionItem()).getByText('message.memory-extraction-off')
    ).toHaveAttribute('data-slot', 'description');
    expect(within(extractionItem()).getByText('label.extract')).toHaveAttribute(
      'data-slot',
      'label'
    );
  });

  it('requests the extraction and replaces the row with the file the server returns', async () => {
    const queued: ContextFile = {
      ...notExtractedFile,
      neverExtracted: false,
      processingStatus: ProcessingStatus.ExtractingContext,
    };
    (extractFileMemories as jest.Mock).mockResolvedValue(queued);
    const onFileRefreshed = jest.fn();
    await renderRow(notExtractedFile, { onFileRefreshed });

    fireEvent.click(extractionItem());

    await waitFor(() => expect(onFileRefreshed).toHaveBeenCalledWith(queued));

    expect(extractFileMemories).toHaveBeenCalledWith('file-1');
    expect(getContextFileById).not.toHaveBeenCalled();
  });

  it.each([
    [
      409,
      'This document’s memories are already queued or being extracted.',
      'message.memory-extraction-cannot-start',
    ],
    [
      503,
      'Memory extraction could not be queued.',
      'message.memory-extraction-not-queued',
    ],
  ])(
    'says why after a %s, in the user’s language, and replaces the row with a fresh read',
    async (status, serverMessage, messageKey) => {
      (extractFileMemories as jest.Mock).mockRejectedValue(
        httpError(status, serverMessage)
      );
      (getContextFileById as jest.Mock).mockResolvedValue(failedFile);
      const onFileRefreshed = jest.fn();
      await renderRow(notExtractedFile, { onFileRefreshed });

      fireEvent.click(extractionItem());

      await waitFor(() =>
        expect(onFileRefreshed).toHaveBeenCalledWith(failedFile)
      );
      await waitFor(() =>
        expect(showErrorToast).toHaveBeenCalledWith(messageKey)
      );

      expect(showErrorToast).toHaveBeenCalledTimes(1);
      expect(getContextFileById).toHaveBeenCalledWith('file-1');
    }
  );

  it('hides it once the server refuses the user with a 403', async () => {
    (extractFileMemories as jest.Mock).mockRejectedValue(
      httpError(403, 'Only the document’s owners or an admin can extract.')
    );
    await renderRow(notExtractedFile);

    fireEvent.click(extractionItem());

    await waitFor(() =>
      expect(
        screen.queryByTestId('memory-extraction-menu-btn')
      ).not.toBeInTheDocument()
    );

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.memory-extraction-owners-or-admins-only'
    );
    expect(getContextFileById).not.toHaveBeenCalled();
  });
});
