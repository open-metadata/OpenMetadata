/*
 *  Copyright 2024 Collate.
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

import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../../../generated/entity/policies/accessControl/resourceDescriptor';
import { mockPipelineActionsDropdownProps } from '../../../../../../mocks/IngestionListTable.mock';
import { ENTITY_PERMISSIONS } from '../../../../../../mocks/Permissions.mock';
import PipelineActionsDropdown from './PipelineActionsDropdown';

const RE_DEPLOY_BUTTON = 're-deploy-button';
const DELETE_BUTTON = 'delete-button';
const KILL_BUTTON = 'kill-button';
const EDIT_BUTTON = 'edit-button';
const RUN_BUTTON = 'run-button';
jest.mock(
  '../../../../../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal',
  () =>
    jest
      .fn()
      .mockImplementation(({ onClose }) => (
        <button onClick={onClose}>KillIngestionPipelineModal</button>
      ))
);

const clickOnMoreActions = async () => {
  const moreActions = screen.getByTestId('more-actions');

  fireEvent.click(moreActions);

  // Wait for dropdown menu items to appear
  await screen.findByTestId(EDIT_BUTTON);
};

describe('PipelineActionsDropdown', () => {
  it('should only display edit, kill and delete button when pipeline is not deployed', async () => {
    render(<PipelineActionsDropdown {...mockPipelineActionsDropdownProps} />, {
      wrapper: MemoryRouter,
    });

    await clickOnMoreActions();

    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(KILL_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DELETE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(RUN_BUTTON)).toBeNull();
    expect(screen.queryByTestId(RE_DEPLOY_BUTTON)).toBeNull();
  });

  it('should only display edit, kill and delete button when pipeline is not enabled', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            deployed: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(KILL_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DELETE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(RUN_BUTTON)).toBeNull();
    expect(screen.queryByTestId(RE_DEPLOY_BUTTON)).toBeNull();
  });

  it('should display all action buttons when pipeline is enabled and deployed', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            deployed: true,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(KILL_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DELETE_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(RUN_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(RE_DEPLOY_BUTTON)).toBeInTheDocument();
  });

  it('should hide run button when Trigger permission is absent', async () => {
    const permissions = {
      ...ENTITY_PERMISSIONS,
      [Operation.Trigger]: false,
    } as OperationPermission;

    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            deployed: true,
            enabled: true,
          }}
          ingestionPipelinePermissions={permissions}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    expect(screen.queryByTestId(RUN_BUTTON)).toBeNull();
    expect(screen.getByTestId(RE_DEPLOY_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
  });

  it('should call deployIngestion when clicked on deploy button', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            enabled: true,
            deployed: false,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    const deployButton = screen.getByTestId('deploy-button');

    fireEvent.click(deployButton);

    expect(
      mockPipelineActionsDropdownProps.deployIngestion
    ).toHaveBeenCalledTimes(1);
  });

  it('should call deployIngestion when clicked on re-deploy button', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    const reDeployButton = screen.getByTestId(RE_DEPLOY_BUTTON);

    fireEvent.click(reDeployButton);

    expect(
      mockPipelineActionsDropdownProps.deployIngestion
    ).toHaveBeenCalledTimes(1);
  });

  it('should call triggerIngestion when clicked on run button', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    const runButton = screen.getByTestId(RUN_BUTTON);

    fireEvent.click(runButton);

    expect(
      mockPipelineActionsDropdownProps.triggerIngestion
    ).toHaveBeenCalledTimes(1);
  });

  it('should call handleEditClick when clicked on edit button', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    const editButton = screen.getByTestId(EDIT_BUTTON);

    fireEvent.click(editButton);

    expect(
      mockPipelineActionsDropdownProps.handleEditClick
    ).toHaveBeenCalledTimes(1);
  });

  it('should call handleDeleteSelection when clicked on delete button', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    const deleteButton = screen.getByTestId(DELETE_BUTTON);

    fireEvent.click(deleteButton);

    expect(
      mockPipelineActionsDropdownProps.handleDeleteSelection
    ).toHaveBeenCalledTimes(1);
  });

  it('should open KillIngestionPipelineModal on click of kill button', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    const killButton = screen.getByTestId(KILL_BUTTON);

    fireEvent.click(killButton);

    expect(screen.getByText('KillIngestionPipelineModal')).toBeInTheDocument();
  });

  it('should close KillIngestionPipelineModal on execution for onClose button', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          ingestion={{
            ...mockPipelineActionsDropdownProps.ingestion,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    const killButton = screen.getByTestId(KILL_BUTTON);

    fireEvent.click(killButton);

    expect(screen.getByText('KillIngestionPipelineModal')).toBeInTheDocument();

    const closeModal = screen.getByText('KillIngestionPipelineModal');

    fireEvent.click(closeModal);

    expect(screen.queryByText('KillIngestionPipelineModal')).toBeNull();
  });

  it('should pass the moreActionButtonProps to the more action button', async () => {
    const mockOnClick = jest.fn();

    await act(async () => {
      render(
        <PipelineActionsDropdown
          {...mockPipelineActionsDropdownProps}
          moreActionButtonProps={{
            onClick: mockOnClick,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    expect(mockOnClick).toHaveBeenCalled();
  });
});
