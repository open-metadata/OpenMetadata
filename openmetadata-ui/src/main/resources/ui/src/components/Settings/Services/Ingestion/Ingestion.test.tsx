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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DISABLED } from '../../../../constants/constants';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ServiceAgentSubTabs } from '../../../../enums/service.enum';
import { ingestionProps } from '../../../../mocks/Ingestion.mock';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import Ingestion from './Ingestion.component';

// Ingestion renders MetadataAgentsView, whose useAgentPermissions now derives its
// per-agent flags through useBulkEntityPermissions (React Query) instead of reading
// PermissionProvider's context directly. React Query hooks throw without a client, so
// every render here needs a QueryClientProvider alongside the existing MemoryRouter. A
// fresh client per wrapper keeps cached permissions from leaking between tests.
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
        },
      })
    }>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

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

jest.mock('../../../common/AirflowMessageBanner/AirflowMessageBanner', () =>
  jest
    .fn()
    .mockImplementation(({ unreachableFallbackMessage }) => (
      <div data-fallback={unreachableFallbackMessage}>AirflowMessageBanner</div>
    ))
);

// `Ingestion` takes the status as a prop, but the agent controls below it read the same status from
// the context, so both have to be driven for a case to be realistic.
jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'airflow',
    })),
  })
);

describe('Ingestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'airflow',
    }));
  });

  it('should give the banner a fallback message for a status call that carries no reason', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: TestWrapper });
    });

    // The fallback is opt-in, so a call site that forgets it silently loses the only explanation
    // for why the agent controls below are disabled.
    expect(screen.getByText('AirflowMessageBanner')).toHaveAttribute(
      'data-fallback',
      'message.pipeline-service-unreachable-agent-actions'
    );
  });

  it('should keep listing the agents when the pipeline service is unavailable', async () => {
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: false,
      platform: 'airflow',
    }));
    await act(async () => {
      render(
        <Ingestion
          {...ingestionProps}
          airflowInformation={{
            ...ingestionProps.airflowInformation,
            isAirflowAvailable: false,
          }}
        />,
        { wrapper: TestWrapper }
      );
    });

    expect(screen.getByTestId('metadata-agent-group')).toBeInTheDocument();
    expect(screen.getByText('AirflowMessageBanner')).toBeInTheDocument();
    expect(screen.queryByText('ErrorPlaceHolderIngestion')).toBeNull();
  });

  it('should list the agents while the status call is still in flight', async () => {
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: true,
      platform: 'airflow',
    }));
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
        { wrapper: TestWrapper }
      );
    });

    expect(screen.getByTestId('metadata-agent-group')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-group-skeleton')).toBeNull();
    expect(screen.queryByText('ErrorPlaceHolderIngestion')).toBeNull();
  });

  it('should replace the add-agent control with a placeholder while the status call is in flight', async () => {
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: true,
      platform: 'airflow',
    }));
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: TestWrapper });
    });

    expect(screen.getByTestId('add-agent-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });

  it('should hide the deployment summary card while the agent list is loading', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} isLoading />, {
        wrapper: TestWrapper,
      });
    });

    expect(screen.queryByText('DeploymentSummaryCard')).toBeNull();
  });

  it('should render the deployment summary card once the list has loaded', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: TestWrapper });
    });

    expect(screen.getByText('DeploymentSummaryCard')).toBeInTheDocument();
  });

  it('should render the AddIngestionButton when create permission is granted', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: TestWrapper });
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
        { wrapper: TestWrapper }
      );
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });

  it('should refresh only the visible sub-tab list', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: TestWrapper });
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
        wrapper: TestWrapper,
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
      render(<Ingestion {...ingestionProps} />, { wrapper: TestWrapper });
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });
});
