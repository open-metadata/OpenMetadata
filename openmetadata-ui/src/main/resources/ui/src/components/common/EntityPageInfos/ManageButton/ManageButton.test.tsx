/*
 *  Copyright 2022 Collate.
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
import { EntityType } from '../../../../enums/entity.enum';
import { DeleteType } from '../../DeleteWidget/DeleteWidget.interface';
import ManageButton from './ManageButton';

const mockHandleOnAsyncEntityDeleteConfirm = jest.fn();
const mockHardDeleteEntity = jest.fn().mockResolvedValue(true);

jest.mock('../../../../utils/AnnouncementsUtils', () => ({
  ANNOUNCEMENT_ENTITIES: ['table', 'topic', 'dashboard', 'pipeline'],
}));

jest.mock(
  '../../../../context/AsyncDeleteProvider/AsyncDeleteProvider',
  () => ({
    useAsyncDeleteProvider: () => ({
      handleOnAsyncEntityDeleteConfirm: mockHandleOnAsyncEntityDeleteConfirm,
    }),
  })
);

jest.mock('../../../../utils/DeleteWidget/DeleteWidgetUtils', () => ({
  hardDeleteEntity: (...args: unknown[]) => mockHardDeleteEntity(...args),
}));

jest.mock('../../DeleteWidget/DeleteEntityModal', () => {
  return jest.fn().mockReturnValue(<div>DeleteEntityModal</div>);
});

jest.mock('../../DeleteModal/DeleteModal', () => {
  return jest.fn().mockImplementation(({ onDelete }) => (
    <div>
      <span>DeleteModal</span>
      <button data-testid="confirm-delete-button" onClick={onDelete}>
        confirm
      </button>
    </div>
  ));
});

const mockAnnouncementClick = jest.fn();
const mockOnRestoreEntity = jest.fn();

const mockProps = {
  allowSoftDelete: true,
  entityName: 'string',
  entityId: 'string-id',
  canDelete: true,
  entityType: EntityType.TABLE,
  entityFQN: 'x.y.z',
  isRecursiveDelete: true,
  deleteMessage: 'string',
  onAnnouncementClick: mockAnnouncementClick,
  onRestoreEntity: mockOnRestoreEntity,
};

describe('Test manage button component', () => {
  it('Should render manage button component', async () => {
    render(<ManageButton {...mockProps} />);

    const manageButton = await screen.findByTestId('manage-button');

    expect(manageButton).toBeInTheDocument();
  });

  it('Should render dropdown component on click of manage button', async () => {
    render(<ManageButton {...mockProps} />);

    const manageButton = await screen.findByTestId('manage-button');

    expect(manageButton).toBeInTheDocument();

    fireEvent.click(manageButton);

    const deleteOption = await screen.findByTestId('delete-button');
    const announcementOption = await screen.findByTestId('announcement-button');

    expect(deleteOption).toBeInTheDocument();
    expect(announcementOption).toBeInTheDocument();
  });

  it('Should render delete modal component on click of delete option', async () => {
    render(<ManageButton {...mockProps} />);

    const manageButton = await screen.findByTestId('manage-button');

    expect(manageButton).toBeInTheDocument();

    fireEvent.click(manageButton);

    const deleteOption = await screen.findByTestId('delete-button');

    expect(deleteOption).toBeInTheDocument();

    fireEvent.click(deleteOption);

    expect(await screen.findByText('DeleteEntityModal')).toBeInTheDocument();
  });

  it('Should render the simple DeleteModal when allowSoftDelete is false', async () => {
    render(<ManageButton {...mockProps} allowSoftDelete={false} />);

    const manageButton = await screen.findByTestId('manage-button');

    fireEvent.click(manageButton);

    const deleteOption = await screen.findByTestId('delete-button');

    fireEvent.click(deleteOption);

    expect(await screen.findByText('DeleteModal')).toBeInTheDocument();
    expect(screen.queryByText('DeleteEntityModal')).not.toBeInTheDocument();
  });

  it('Should route hard-delete through the async provider when isAsyncDelete is set', async () => {
    mockHandleOnAsyncEntityDeleteConfirm.mockClear();
    mockHardDeleteEntity.mockClear();

    render(
      <ManageButton {...mockProps} isAsyncDelete allowSoftDelete={false} />
    );

    fireEvent.click(await screen.findByTestId('manage-button'));
    fireEvent.click(await screen.findByTestId('delete-button'));
    fireEvent.click(await screen.findByTestId('confirm-delete-button'));

    await waitFor(() =>
      expect(mockHandleOnAsyncEntityDeleteConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ deleteType: DeleteType.HARD_DELETE })
      )
    );

    expect(mockHardDeleteEntity).not.toHaveBeenCalled();
  });

  it('Should use the sync hard-delete when isAsyncDelete is not set', async () => {
    mockHandleOnAsyncEntityDeleteConfirm.mockClear();
    mockHardDeleteEntity.mockClear();

    render(<ManageButton {...mockProps} allowSoftDelete={false} />);

    fireEvent.click(await screen.findByTestId('manage-button'));
    fireEvent.click(await screen.findByTestId('delete-button'));
    fireEvent.click(await screen.findByTestId('confirm-delete-button'));

    await waitFor(() => expect(mockHardDeleteEntity).toHaveBeenCalledTimes(1));

    expect(mockHandleOnAsyncEntityDeleteConfirm).not.toHaveBeenCalled();
  });

  it('Should call announcement callback on click of announcement option', async () => {
    render(<ManageButton {...mockProps} />);

    const manageButton = await screen.findByTestId('manage-button');

    expect(manageButton).toBeInTheDocument();

    fireEvent.click(manageButton);

    const announcementOption = await screen.findByTestId('announcement-button');

    expect(announcementOption).toBeInTheDocument();

    fireEvent.click(announcementOption);

    expect(mockAnnouncementClick).toHaveBeenCalled();
  });

  it('Should call restore callback on click of restore option', async () => {
    const mockPropsData = { ...mockProps, deleted: true };
    render(<ManageButton {...mockPropsData} />);

    const manageButton = await screen.findByTestId('manage-button');

    expect(manageButton).toBeInTheDocument();

    fireEvent.click(manageButton);

    const restoreOption = await screen.findByTestId('restore-button');

    expect(restoreOption).toBeInTheDocument();

    fireEvent.click(restoreOption);

    const modalBody = await screen.findByTestId('restore-modal-body');

    expect(modalBody).toBeInTheDocument();

    const modalRestoreButton = await screen.findAllByText('label.restore');
    fireEvent.click(modalRestoreButton[1]);

    expect(mockOnRestoreEntity).toHaveBeenCalled();
  });

  it('should gate restore on canRestore independently of canDelete', async () => {
    const mockPropsData = {
      ...mockProps,
      deleted: true,
      canDelete: true,
      canRestore: false,
    };
    render(<ManageButton {...mockPropsData} />);

    const manageButton = await screen.findByTestId('manage-button');
    fireEvent.click(manageButton);

    const restoreOption = await screen.findByTestId('restore-button');
    fireEvent.click(restoreOption);

    expect(screen.queryByTestId('restore-modal-body')).not.toBeInTheDocument();
    expect(mockOnRestoreEntity).not.toHaveBeenCalled();
  });
});
