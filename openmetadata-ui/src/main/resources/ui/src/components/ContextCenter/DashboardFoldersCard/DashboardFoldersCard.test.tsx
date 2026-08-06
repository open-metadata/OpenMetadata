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
import { Folder } from '../../../generated/entity/data/folder';
import { listContextFiles } from '../../../rest/assetAPI';
import DashboardFoldersCard from './DashboardFoldersCard.component';

jest.mock('../../../rest/assetAPI', () => ({
  listContextFiles: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const MOCK_FOLDERS: Folder[] = [
  {
    id: 'folder-1',
    name: 'Reports',
    displayName: 'Reports',
    childrenCount: 3,
  },
  {
    id: 'folder-2',
    name: 'Archive',
    displayName: 'Archive',
    childrenCount: 0,
  },
];

describe('DashboardFoldersCard', () => {
  it('renders the folder list with children count badges', () => {
    render(
      <DashboardFoldersCard
        folders={MOCK_FOLDERS}
        onOpenFolder={jest.fn()}
      />
    );

    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the empty state when there are no folders', () => {
    render(<DashboardFoldersCard folders={[]} onOpenFolder={jest.fn()} />);

    expect(
      screen.getByText('message.no-folders-yet-create-one')
    ).toBeInTheDocument();
  });

  it('renders the New Folder action with a leading icon and triggers onCreateFolder on click', () => {
    const onCreateFolder = jest.fn();
    render(
      <DashboardFoldersCard
        folders={[]}
        onCreateFolder={onCreateFolder}
        onOpenFolder={jest.fn()}
      />
    );

    const newFolderButton = screen.getByRole('button', {
      name: 'label.new-folder',
    });

    expect(newFolderButton.querySelector('[data-icon]')).toBeInTheDocument();

    fireEvent.click(newFolderButton);

    expect(onCreateFolder).toHaveBeenCalledTimes(1);
  });

  it('does not fetch children until a folder is expanded', () => {
    render(
      <DashboardFoldersCard
        folders={MOCK_FOLDERS}
        onOpenFolder={jest.fn()}
      />
    );

    expect(listContextFiles).not.toHaveBeenCalled();
  });

  it('calls onOpenFolder when the folder name is clicked, without expanding it', () => {
    const onOpenFolder = jest.fn();
    render(
      <DashboardFoldersCard
        folders={MOCK_FOLDERS}
        onOpenFolder={onOpenFolder}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));

    expect(onOpenFolder).toHaveBeenCalledWith('folder-1');
    expect(listContextFiles).not.toHaveBeenCalled();
  });

  it('fetches children when the expand button is clicked, without calling onOpenFolder', () => {
    const onOpenFolder = jest.fn();
    render(
      <DashboardFoldersCard
        folders={MOCK_FOLDERS}
        onOpenFolder={onOpenFolder}
      />
    );

    const folderNameButton = screen.getByRole('button', { name: 'Reports' });
    const folderRow = folderNameButton.closest('[role="row"]') as HTMLElement;
    const rowButtons = Array.from(folderRow.querySelectorAll('button'));
    const expandButton = rowButtons.find((btn) => btn !== folderNameButton);

    expect(expandButton).toBeDefined();

    fireEvent.click(expandButton as HTMLButtonElement);

    expect(onOpenFolder).not.toHaveBeenCalled();
    expect(listContextFiles).toHaveBeenCalledWith({
      folderId: 'folder-1',
      limit: expect.any(Number),
    });
  });
});
