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
import { MemoryRouter } from 'react-router-dom';
import { DISABLED } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ServiceAgentSubTabs } from '../../../../enums/service.enum';
import { ingestionProps } from '../../../../mocks/Ingestion.mock';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import Ingestion from './Ingestion.component';

jest.mock(
  '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>ErrorPlaceHolderIngestion</div>);
  }
);

jest.mock('./AddIngestionButton.component', () => {
  return jest.fn().mockImplementation(() => <div>AddIngestionButton</div>);
});

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      ingestionPipeline: ENTITY_PERMISSIONS,
    },
    getEntityPermissionByFqn: jest.fn().mockResolvedValue(ENTITY_PERMISSIONS),
  })),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  deleteIngestionPipelineById: jest.fn().mockResolvedValue({}),
  deployIngestionPipelineById: jest.fn().mockResolvedValue({}),
  enableDisableIngestionPipelineById: jest.fn().mockResolvedValue({}),
  getIngestionPipelineByFqn: jest.fn().mockResolvedValue({}),
  postKillIngestionPipelineById: jest.fn().mockResolvedValue({}),
  triggerIngestionPipelineById: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../hoc/LimitWrapper', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => <>LimitWrapper{children}</>);
});

jest.mock(
  '../../../ServiceAgents/components/DeploymentSummaryCard.component',
  () => jest.fn().mockImplementation(() => <div>DeploymentSummaryCard</div>)
);

describe('Ingestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the error placeHolder if airflow is not available', async () => {
    await act(async () => {
      render(
        <Ingestion
          {...ingestionProps}
          airflowInformation={{
            ...ingestionProps.airflowInformation,
            isAirflowAvailable: false,
          }}
        />,
        { wrapper: MemoryRouter }
      );
    });

    expect(screen.getByText('ErrorPlaceHolderIngestion')).toBeInTheDocument();
  });

  it('should not render the error placeHolder while the airflow status is still being fetched', async () => {
    await act(async () => {
      render(
        <Ingestion
          {...ingestionProps}
          airflowInformation={{
            ...ingestionProps.airflowInformation,
            isAirflowAvailable: false,
            isFetchingStatus: true,
          }}
        />,
        { wrapper: MemoryRouter }
      );
    });

    expect(screen.queryByText('ErrorPlaceHolderIngestion')).toBeNull();
    expect(screen.getByTestId('agent-group-skeleton')).toBeInTheDocument();
  });

  it('should hide the deployment summary card while the agents are loading', async () => {
    await act(async () => {
      render(
        <Ingestion
          {...ingestionProps}
          airflowInformation={{
            ...ingestionProps.airflowInformation,
            isFetchingStatus: true,
          }}
        />,
        { wrapper: MemoryRouter }
      );
    });

    expect(screen.queryByText('DeploymentSummaryCard')).toBeNull();
  });

  it('should render the deployment summary card once the status has settled', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: MemoryRouter });
    });

    expect(screen.getByText('DeploymentSummaryCard')).toBeInTheDocument();
  });

  it('should render the AddIngestionButton when create permission is granted', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: MemoryRouter });
    });

    expect(screen.getByText('AddIngestionButton')).toBeInTheDocument();
  });

  it('should not render the AddIngestionButton if platform is disabled', async () => {
    await act(async () => {
      render(
        <Ingestion
          {...ingestionProps}
          airflowInformation={{
            ...ingestionProps.airflowInformation,
            platform: DISABLED,
          }}
        />,
        { wrapper: MemoryRouter }
      );
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });

  it('should refresh only the visible sub-tab list', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: MemoryRouter });
    });

    fireEvent.click(screen.getByTestId('agent-group-refresh'));

    expect(ingestionProps.refreshAgentsList).toHaveBeenCalledTimes(1);
    expect(ingestionProps.refreshAgentsList).toHaveBeenCalledWith(
      ServiceAgentSubTabs.METADATA
    );
  });

  it('should disable the refresh control while the list is loading', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} isLoading />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('agent-group-refresh')).toBeDisabled();
  });

  it('should not render the AddIngestionButton if no Create ingestion pipeline permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      permissions: {
        ingestionPipeline: {
          ...ENTITY_PERMISSIONS,
          Create: false,
        },
      },
      getEntityPermissionByFqn: jest.fn().mockResolvedValue(ENTITY_PERMISSIONS),
    }));
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: MemoryRouter });
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });
});
