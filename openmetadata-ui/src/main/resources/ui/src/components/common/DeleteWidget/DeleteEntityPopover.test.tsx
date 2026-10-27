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
import { Button } from '@openmetadata/ui-core-components';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import { deleteEntity } from '../../../rest/miscAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DeleteEntityPopover, {
  DeleteEntityPopoverProps,
} from './DeleteEntityPopover';

const mockOnLogoutHandler = jest.fn();
const mockAfterDeleteAction = jest.fn();

jest.mock('../../../rest/miscAPI', () => ({
  deleteEntity: jest
    .fn()
    .mockResolvedValue({ status: 200, data: { version: 2 } }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(
    (selector: (state: { currentUser: unknown }) => unknown) =>
      selector({ currentUser: mockUserData })
  ),
}));

jest.mock('../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn(() => ({ onLogoutHandler: mockOnLogoutHandler })),
}));

jest.mock('../../../context/AsyncDeleteProvider/AsyncDeleteProvider', () => ({
  useAsyncDeleteProvider: jest.fn(() => ({
    handleOnAsyncEntityDeleteConfirm: jest.fn(),
  })),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const renderPopover = (props: Partial<DeleteEntityPopoverProps> = {}) =>
  render(
    <DeleteEntityPopover
      afterDeleteAction={mockAfterDeleteAction}
      entityId="team-id"
      entityName="Sales"
      entityType={EntityType.TEAM}
      {...props}>
      <Button data-testid="trigger">Delete</Button>
    </DeleteEntityPopover>
  );

const open = () =>
  act(async () => fireEvent.click(screen.getByTestId('trigger')));

const click = (testId: string) =>
  act(async () => fireEvent.click(screen.getByTestId(testId)));

describe('DeleteEntityPopover', () => {
  beforeEach(() => jest.clearAllMocks());

  it('soft-deletes on the default (confirm) action', async () => {
    renderPopover();
    await open();

    expect(screen.getByTestId('delete-entity-popover-title')).toHaveTextContent(
      'label.delete-entity'
    );
    expect(
      screen.getByTestId('delete-entity-popover-confirm')
    ).toHaveTextContent('label.soft-delete');

    await click('delete-entity-popover-confirm');

    expect(deleteEntity).toHaveBeenCalledWith('teams', 'team-id', false, false);
    expect(showSuccessToast).toHaveBeenCalled();
    expect(mockAfterDeleteAction).toHaveBeenCalledWith(true, 2);
    expect(screen.queryByTestId('delete-entity-popover')).toBeNull();
  });

  it('hard-deletes only from the secondary permanent-delete action', async () => {
    renderPopover({ isRecursiveDelete: true });
    await open();

    await click('delete-entity-popover-hard-delete');

    expect(deleteEntity).toHaveBeenCalledWith('teams', 'team-id', true, true);
    expect(mockAfterDeleteAction).toHaveBeenCalledWith(false, 2);
  });

  it('confirms a permanent delete when soft delete is not allowed', async () => {
    renderPopover({ allowSoftDelete: false });
    await open();

    expect(
      screen.queryByTestId('delete-entity-popover-hard-delete')
    ).toBeNull();
    expect(
      screen.getByTestId('delete-entity-popover-confirm')
    ).toHaveTextContent('label.delete');

    await click('delete-entity-popover-confirm');

    expect(deleteEntity).toHaveBeenCalledWith('teams', 'team-id', false, true);
  });

  it('uses a custom description when given one', async () => {
    renderPopover({ description: 'Custom text' });
    await open();

    expect(
      screen.getByTestId('delete-entity-popover-description')
    ).toHaveTextContent('Custom text');
  });

  it('stays open, toasts the error and skips afterDeleteAction when the delete fails', async () => {
    (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    renderPopover();
    await open();

    await click('delete-entity-popover-confirm');

    expect(showErrorToast).toHaveBeenCalled();
    expect(mockAfterDeleteAction).not.toHaveBeenCalled();
    expect(screen.getByTestId('delete-entity-popover')).toBeInTheDocument();
  });

  it('stays open on an unexpected response status', async () => {
    (deleteEntity as jest.Mock).mockResolvedValueOnce({ status: 500 });
    renderPopover();
    await open();

    await click('delete-entity-popover-confirm');

    expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-response');
    expect(screen.getByTestId('delete-entity-popover')).toBeInTheDocument();
  });

  it('logs out when users delete themselves', async () => {
    renderPopover({
      entityId: mockUserData.id,
      entityType: EntityType.USER,
    });
    await open();

    await click('delete-entity-popover-confirm');

    expect(mockOnLogoutHandler).toHaveBeenCalled();
    expect(mockAfterDeleteAction).not.toHaveBeenCalled();
  });
});
