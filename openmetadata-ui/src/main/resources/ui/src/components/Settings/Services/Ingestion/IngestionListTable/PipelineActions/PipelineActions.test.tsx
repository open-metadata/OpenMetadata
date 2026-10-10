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
import { mockPipelineActionsProps } from '../../../../../../mocks/IngestionListTable.mock';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../../../utils/PermissionsUtils';
import PipelineActions from './PipelineActions';

const mockOpenLogs = jest.fn();

jest.mock('../../../../../../hooks/useLogsModal', () => ({
  useLogsModal: () => ({ openLogs: mockOpenLogs, logsModal: null }),
}));

jest.mock('./PipelineActionsDropdown', () =>
  jest.fn().mockImplementation(() => <div>PipelineActionsDropdown</div>)
);

describe('PipelineAction', () => {
  it('should render PipelineActionsDropdown if only editAll permission is present', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
            EditAll: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('PipelineActionsDropdown')).toBeInTheDocument();
  });

  it('should render PipelineActionsDropdown if only delete permission is present', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
            Delete: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('PipelineActionsDropdown')).toBeInTheDocument();
  });

  it('should render PipelineActionsDropdown if only Deploy permission is present', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
            Deploy: true,
          }}
          pipeline={{ ...mockPipelineActionsProps.pipeline, enabled: true }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('PipelineActionsDropdown')).toBeInTheDocument();
  });

  it('should render PipelineActionsDropdown if only Trigger permission is present', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
            Trigger: true,
          }}
          pipeline={{
            ...mockPipelineActionsProps.pipeline,
            deployed: true,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('PipelineActionsDropdown')).toBeInTheDocument();
  });

  it('should not render PipelineActionsDropdown with only Deploy permission when pipeline is disabled', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
            Deploy: true,
          }}
          pipeline={{ ...mockPipelineActionsProps.pipeline, enabled: false }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('PipelineActionsDropdown')).toBeNull();
  });

  it('should not render PipelineActionsDropdown with only Trigger permission when pipeline is not deployed', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
            Trigger: true,
          }}
          pipeline={{
            ...mockPipelineActionsProps.pipeline,
            deployed: false,
            enabled: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('PipelineActionsDropdown')).toBeNull();
  });

  it('should not render PipelineActionsDropdown without an action permission', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={DEFAULT_ENTITY_PERMISSION}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('PipelineActionsDropdown')).toBeNull();
  });

  it('should not render pause or resume button if editStatus permission is not present', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('label.pause')).toBeNull();
    expect(screen.queryByText('label.resume')).toBeNull();
  });

  it('should render pause or resume button if editStatus permission is present', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          ingestionPipelinePermissions={{
            ...DEFAULT_ENTITY_PERMISSION,
            EditIngestionPipelineStatus: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('label.resume')).toBeInTheDocument();
  });

  it('should render pause button if pipeline is enabled', async () => {
    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          pipeline={{ ...mockPipelineActionsProps.pipeline, enabled: true }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('label.pause')).toBeInTheDocument();
  });

  it('should open the logs modal when clicked on logs button', async () => {
    await act(async () => {
      render(<PipelineActions {...mockPipelineActionsProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const logsButton = screen.getByText('label.log-plural');

    fireEvent.click(logsButton);

    expect(mockOpenLogs).toHaveBeenCalledWith({
      logEntityType: 'searchServices',
      fqn: 'OpenMetadata.OpenMetadata_elasticSearchReIndex',
    });
  });

  it('should call handleEnableDisableIngestion when clicked on pause or resume click', async () => {
    await act(async () => {
      render(<PipelineActions {...mockPipelineActionsProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const resumeButton = screen.getByText('label.resume');

    fireEvent.click(resumeButton);

    expect(
      mockPipelineActionsProps.handleEnableDisableIngestion
    ).toHaveBeenCalledWith(mockPipelineActionsProps.pipeline.id);
  });

  it('should disable the resume button while a toggle is in-flight and re-enable it after completion', async () => {
    let resolveToggle: () => void = () => undefined;
    const handleEnableDisableIngestion = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveToggle = resolve;
        })
    );

    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          handleEnableDisableIngestion={handleEnableDisableIngestion}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByTestId('resume-button')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('resume-button'));

    // The button is disabled while the toggle is in-flight so a second click
    // cannot fire a redundant flip of the non-idempotent toggle endpoint.
    expect(handleEnableDisableIngestion).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('resume-button')).toBeDisabled();

    await act(async () => {
      resolveToggle();
    });

    expect(screen.getByTestId('resume-button')).not.toBeDisabled();
    expect(handleEnableDisableIngestion).toHaveBeenCalledTimes(1);
  });

  it('should disable the pause button while a toggle is in-flight and re-enable it after completion', async () => {
    let resolveToggle: () => void = () => undefined;
    const handleEnableDisableIngestion = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveToggle = resolve;
        })
    );

    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          handleEnableDisableIngestion={handleEnableDisableIngestion}
          pipeline={{ ...mockPipelineActionsProps.pipeline, enabled: true }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByTestId('pause-button')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('pause-button'));

    expect(handleEnableDisableIngestion).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('pause-button')).toBeDisabled();

    await act(async () => {
      resolveToggle();
    });

    expect(screen.getByTestId('pause-button')).not.toBeDisabled();
    expect(handleEnableDisableIngestion).toHaveBeenCalledTimes(1);
  });

  it('should re-enable controls and allow a subsequent toggle once the in-flight one completes', async () => {
    let resolveToggle: () => void = () => undefined;
    const handleEnableDisableIngestion = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveToggle = resolve;
        })
    );

    await act(async () => {
      render(
        <PipelineActions
          {...mockPipelineActionsProps}
          handleEnableDisableIngestion={handleEnableDisableIngestion}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    // First toggle fires and disables the control while in-flight.
    fireEvent.click(screen.getByTestId('resume-button'));

    expect(handleEnableDisableIngestion).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('resume-button')).toBeDisabled();

    // Once the first toggle completes the control unblocks and a fresh toggle
    // is accepted (no permanent lock-up regression from the in-flight gate).
    await act(async () => {
      resolveToggle();
    });

    expect(screen.getByTestId('resume-button')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('resume-button'));

    expect(handleEnableDisableIngestion).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveToggle();
    });
  });
});
