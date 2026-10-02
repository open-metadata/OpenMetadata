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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
import { getUserAndTeamSearch } from '../../../rest/miscAPI';
import ContextCenterMemoriesPage from './ContextCenterMemoriesPage';

// Resource-level permission (getResourcePermission(CONTEXT_MEMORY)) — no prior
// test coverage. This suite covers the flagged raw `permissions.EditAll` read
// (now `canEditAll`, wired to MemoriesView/CreateMemoryModal's `canEdit` prop).

const mockGetResourcePermission = jest.fn();

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: mockGetResourcePermission,
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1', name: 'test.user', isAdmin: false },
  }),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getListContextMemories: jest.fn().mockResolvedValue({
    data: [{ id: 'memory-1', title: 'Test Memory' }],
    paging: { total: 1 },
  }),
  getContextMemoryById: jest.fn(),
  getContextMemoryByName: jest.fn(),
  deleteContextMemory: jest.fn(),
  pinContextMemory: jest.fn(),
  unpinContextMemory: jest.fn(),
}));

jest.mock('../../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest
    .fn()
    .mockResolvedValue({ data: { hits: { hits: [] } } }),
}));

jest.mock('../../../utils/ContextCenterClassBase', () => ({
  __esModule: true,
  default: { getContainerClassName: jest.fn().mockReturnValue('') },
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock(
  '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component',
  () => ({
    __esModule: true,
    default: ({ onSearch }: { onSearch: (value: string) => void }) => (
      <input
        aria-label="Search memories"
        data-testid="memory-search"
        onChange={(event) => onSearch(event.target.value)}
      />
    ),
  })
);

jest.mock(
  '../../../components/ContextCenter/MemoriesView/MemoriesView.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ canEdit, canDelete }) => (
        <div
          data-can-delete={String(Boolean(canDelete))}
          data-can-edit={String(Boolean(canEdit))}
          data-testid="memories-view"
        />
      )),
  })
);

jest.mock(
  '../../../components/ContextCenter/CreateMemoryModal/CreateMemoryModal.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ canEdit }) => (
        <div
          data-can-edit={String(Boolean(canEdit))}
          data-testid="create-memory-modal"
        />
      )),
  })
);

jest.mock(
  '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList',
  () => ({
    __esModule: true,
    default: ({
      onChange,
    }: {
      onChange: (value: { id: string; label: string }) => void;
    }) => (
      <button
        aria-label="Select test asset"
        data-testid="mock-asset-select"
        onClick={() => onChange({ id: 'asset-1', label: 'Test Asset' })}
      />
    ),
  })
);

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContextCenterMemoriesPage />
    </MemoryRouter>
  );

describe('ContextCenterMemoriesPage — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires EditAll (via canEditAll) into MemoriesView/CreateMemoryModal canEdit when granted', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('memories-view')).toHaveAttribute(
        'data-can-edit',
        'true'
      );
    });

    expect(screen.getByTestId('create-memory-modal')).toHaveAttribute(
      'data-can-edit',
      'true'
    );
  });

  it('wires EditAll (via canEditAll) into MemoriesView/CreateMemoryModal canEdit when denied', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: false,
    });

    renderPage();

    await waitFor(() => {
      expect(mockGetResourcePermission).toHaveBeenCalled();
    });

    expect(screen.getByTestId('memories-view')).toHaveAttribute(
      'data-can-edit',
      'false'
    );
    expect(screen.getByTestId('create-memory-modal')).toHaveAttribute(
      'data-can-edit',
      'false'
    );
  });

  it('filters by selected statuses while retaining author and sort controls', async () => {
    mockGetResourcePermission.mockResolvedValue({ EditAll: true });
    renderPage();

    await waitFor(() => {
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: 'Approved', offset: 0 })
      );
    });

    fireEvent.click(screen.getByTestId('memory-status-filter'));
    fireEvent.click(await screen.findByText('label.rejected'));

    await waitFor(() => {
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: 'Approved,Rejected', offset: 0 })
      );
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: 'Approved,Rejected',
          limit: 0,
          offset: 0,
        })
      );
    });

    fireEvent.click(screen.getByTestId('memory-count-card-created-by-me'));
    await waitFor(() => {
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: 'Approved,Rejected',
          author: 'user-1',
        })
      );
    });

    fireEvent.change(screen.getByTestId('memory-search'), {
      target: { value: 'missing glossary fact' },
    });
    fireEvent.click(screen.getByTestId('mock-asset-select'));
    await waitFor(() => {
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: 'Approved,Rejected',
          q: 'missing glossary fact',
          assets: 'asset-1',
          author: 'user-1',
        })
      );
    });

    fireEvent.click(screen.getByText(/label.sort/));
    fireEvent.click(await screen.findByText('label.most-used'));
    await waitFor(() => {
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: 'Approved,Rejected',
          q: 'missing glossary fact',
          assets: 'asset-1',
          author: 'user-1',
          sortBy: 'usageCount',
        })
      );
    });
  });

  it('combines the author dropdown with selected statuses', async () => {
    mockGetResourcePermission.mockResolvedValue({ EditAll: true });
    (getUserAndTeamSearch as jest.Mock).mockResolvedValue({
      data: {
        hits: {
          hits: [
            {
              _id: 'other-user',
              _source: { name: 'other-user', displayName: 'Other User' },
            },
          ],
        },
      },
    } as Awaited<ReturnType<typeof getUserAndTeamSearch>>);
    renderPage();

    fireEvent.click(screen.getByTestId('memory-status-filter'));
    fireEvent.click(await screen.findByText('label.rejected'));
    fireEvent.click(screen.getByTestId('memory-count-card-created-by-me'));
    fireEvent.click(screen.getByTestId('author-filter-button'));
    fireEvent.click(await screen.findByText('Other User'));

    await waitFor(() => {
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: 'Approved,Rejected',
          author: 'other-user',
        })
      );
    });
  });
});
