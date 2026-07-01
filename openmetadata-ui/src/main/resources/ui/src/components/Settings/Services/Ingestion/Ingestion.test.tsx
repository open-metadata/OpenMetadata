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

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DISABLED } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
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

jest.mock('../../../ServiceAgents/hooks/useMetadataAgents', () => ({
  useMetadataAgents: jest.fn().mockReturnValue({ agents: [] }),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      ingestionPipeline: ENTITY_PERMISSIONS,
    },
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

describe('Ingestion', () => {
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

  it('should not render the AddIngestionButton if no Create ingestion pipeline permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      permissions: {
        ingestionPipeline: {
          ...ENTITY_PERMISSIONS,
          Create: false,
        },
      },
    }));
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, { wrapper: MemoryRouter });
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });
});
