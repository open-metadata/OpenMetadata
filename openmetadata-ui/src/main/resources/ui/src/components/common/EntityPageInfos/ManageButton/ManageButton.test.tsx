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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ManageButton from './ManageButton';

jest.mock('../../../../utils/AnnouncementsUtils', () => ({
  ANNOUNCEMENT_ENTITIES: ['table', 'topic', 'dashboard', 'pipeline'],
}));

jest.mock('../../DeleteWidget/DeleteWidgetModal', () => {
  return jest.fn().mockReturnValue(<div>DeleteWidgetModal</div>);
});

const mockAnnouncementClick = jest.fn();
const mockOnRestoreEntity = jest.fn();

const mockProps = {
  allowSoftDelete: true,
  entityName: 'string',
  entityId: 'string-id',
  canDelete: true,
  entityType: 'table',
  entityFQN: 'x.y.z',
  isRecursiveDelete: true,
  deleteMessage: 'string',
  onAnnouncementClick: mockAnnouncementClick,
  onRestoreEntity: mockOnRestoreEntity,
};

describe('Test manage button component', () => {
  it('Should render manage button component', async () => {
    await act(async () => {
      render(<ManageButton {...mockProps} />);

      const manageButton = await screen.findByTestId('manage-button');

      expect(manageButton).toBeInTheDocument();
    });
  });

  it('Should render dropdown component on click of manage button', async () => {
    await act(async () => {
      render(<ManageButton {...mockProps} />);

      const manageButton = await screen.findByTestId('manage-button');

      expect(manageButton).toBeInTheDocument();

      fireEvent.click(manageButton);

      const deleteOption = await screen.findByTestId('delete-button');
      const announcementOption = await screen.findByTestId(
        'announcement-button'
      );

      expect(deleteOption).toBeInTheDocument();
      expect(announcementOption).toBeInTheDocument();
    });
  });

  it('Should render delete modal component on click of delete option', async () => {
    await act(async () => {
      render(<ManageButton {...mockProps} />);

      const manageButton = await screen.findByTestId('manage-button');

      expect(manageButton).toBeInTheDocument();

      fireEvent.click(manageButton);

      const deleteOption = await screen.findByTestId('delete-button');

      expect(deleteOption).toBeInTheDocument();

      fireEvent.click(deleteOption);

      expect(await screen.findByText('DeleteWidgetModal')).toBeInTheDocument();
    });
  });

  it('Should call announcement callback on click of announcement option', async () => {
    await act(async () => {
      render(<ManageButton {...mockProps} />);

      const manageButton = await screen.findByTestId('manage-button');

      expect(manageButton).toBeInTheDocument();

      fireEvent.click(manageButton);

      const announcementOption = await screen.findByTestId(
        'announcement-button'
      );

      expect(announcementOption).toBeInTheDocument();

      fireEvent.click(announcementOption);

      expect(mockAnnouncementClick).toHaveBeenCalled();
    });
  });

  it('Should call restore callback on click of restore option', async () => {
    await act(async () => {
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
      screen.debug(modalRestoreButton);

      fireEvent.click(modalRestoreButton[1]);

      expect(mockOnRestoreEntity).toHaveBeenCalled();
    });
  });
});
