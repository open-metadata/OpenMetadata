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

import { act, render, screen } from '@testing-library/react';

import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { mockPipelineActionsDropdownProps } from '../../../../../../mocks/IngestionListTable.mock';
import PipelineActionsDropdown from './PipelineActionsDropdown';

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

  await act(async () => {
    userEvent.click(moreActions);
  });
};

describe('PipelineActionsDropdown', () => {
  it('should only display edit, kill and delete button when pipeline is not deployed', async () => {
    await act(async () => {
      render(
        <PipelineActionsDropdown {...mockPipelineActionsDropdownProps} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    await clickOnMoreActions();

    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('kill-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.queryByTestId('run-button')).toBeNull();
    expect(screen.queryByTestId('re-deploy-button')).toBeNull();
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

    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('kill-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.queryByTestId('run-button')).toBeNull();
    expect(screen.queryByTestId('re-deploy-button')).toBeNull();
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

    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('kill-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.getByTestId('run-button')).toBeInTheDocument();
    expect(screen.getByTestId('re-deploy-button')).toBeInTheDocument();
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

    await act(async () => {
      userEvent.click(deployButton);
    });

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

    const reDeployButton = screen.getByTestId('re-deploy-button');

    await act(async () => {
      userEvent.click(reDeployButton);
    });

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

    const runButton = screen.getByTestId('run-button');

    await act(async () => {
      userEvent.click(runButton);
    });

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

    const editButton = screen.getByTestId('edit-button');

    await act(async () => {
      userEvent.click(editButton);
    });

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

    const deleteButton = screen.getByTestId('delete-button');

    await act(async () => {
      userEvent.click(deleteButton);
    });

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

    const killButton = screen.getByTestId('kill-button');

    await act(async () => {
      userEvent.click(killButton);
    });

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

    const killButton = screen.getByTestId('kill-button');

    await act(async () => {
      userEvent.click(killButton);
    });

    expect(screen.getByText('KillIngestionPipelineModal')).toBeInTheDocument();

    const closeModal = screen.getByText('KillIngestionPipelineModal');

    await act(async () => {
      userEvent.click(closeModal);
    });

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
