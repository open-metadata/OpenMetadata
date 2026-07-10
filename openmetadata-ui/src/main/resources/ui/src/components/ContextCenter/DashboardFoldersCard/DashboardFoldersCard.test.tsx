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

import { render, screen } from '@testing-library/react';
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
    render(<DashboardFoldersCard folders={MOCK_FOLDERS} />);

    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the empty state when there are no folders', () => {
    render(<DashboardFoldersCard folders={[]} />);

    expect(screen.getByText('label.no-entity')).toBeInTheDocument();
  });

  it('does not fetch children until a folder is expanded', () => {
    render(<DashboardFoldersCard folders={MOCK_FOLDERS} />);

    expect(listContextFiles).not.toHaveBeenCalled();
  });
});
