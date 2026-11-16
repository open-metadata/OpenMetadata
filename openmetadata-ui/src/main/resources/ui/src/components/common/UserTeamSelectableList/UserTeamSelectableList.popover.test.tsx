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
import { render, screen, waitFor } from '@testing-library/react';
import { UserTeamSelectableList } from './UserTeamSelectableList.component';

/**
 * Deliberately does NOT mock `@openmetadata/ui-core-components`.
 *
 * The sibling suite replaces Popover with `({children}) => <div>{children}</div>`
 * and then asserts only that `isOpen: true` was passed to it. That passes
 * whether or not the popover can actually render, because a stub that ignores
 * `isOpen` always renders its children — which is why the bulk-edit grid could
 * regress with the unit tests green.
 *
 * The bulk-edit grid cell editor mounts this with `popoverProps={{ open: true }}`
 * (see CSVUtilsClassBase's owner editor), so the popover is open on its very
 * first render. That is the case these assert against the real component.
 */
jest.mock('../SelectableList/SelectableList.component', () => ({
  SelectableList: jest.fn().mockReturnValue(<div>SelectableList</div>),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [], total: 0 } }),
}));

jest.mock('../../../utils/APIUtils', () => ({
  formatTeamsResponse: jest.fn().mockReturnValue([]),
  formatUsersResponse: jest.fn().mockReturnValue([]),
}));

describe('UserTeamSelectableList with the real popover', () => {
  it('should render the picker when a consumer forces it open on mount', async () => {
    render(
      <UserTeamSelectableList
        hasPermission
        popoverProps={{ open: true }}
        onUpdate={jest.fn()}>
        <span>OwnerCellValue</span>
      </UserTeamSelectableList>
    );

    await waitFor(() => {
      expect(screen.getByTestId('select-owner-tabs')).toBeInTheDocument();
    });
  });

  it('should keep the picker closed when nothing asks for it to be open', async () => {
    render(
      <UserTeamSelectableList hasPermission onUpdate={jest.fn()}>
        <span>OwnerCellValue</span>
      </UserTeamSelectableList>
    );

    await waitFor(() => {
      expect(screen.getByText('OwnerCellValue')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('select-owner-tabs')).not.toBeInTheDocument();
  });
});
