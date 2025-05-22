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
import { ingestionProps } from '../../../../mocks/Ingestion.mock';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import {
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  triggerIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import Ingestion from './Ingestion.component';

jest.mock('../../../common/SearchBarComponent/SearchBar.component', () => {
  return jest
    .fn()
    .mockImplementation(({ onSearch }) => (
      <button onClick={onSearch}>Searchbar</button>
    ));
});

jest.mock('../../../Modals/EntityDeleteModal/EntityDeleteModal', () => {
  return jest
    .fn()
    .mockImplementation(({ onConfirm }) => (
      <button onClick={onConfirm}>EntityDeleteModal</button>
    ));
});

jest.mock(
  '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>ErrorPlaceHolderIngestion</div>);
  }
);

jest.mock(
  '../../../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal',
  () => {
    return jest.fn().mockImplementation(() => <div>KillIngestionModal</div>);
  }
);

jest.mock('./AddIngestionButton.component', () => {
  return jest.fn().mockImplementation(() => <div>AddIngestionButton</div>);
});

jest.mock('./IngestionRecentRun/IngestionRecentRuns.component', () => ({
  IngestionRecentRuns: jest
    .fn()
    .mockImplementation(() => <p>IngestionRecentRuns</p>),
}));

jest.mock('./IngestionListTable/IngestionListTable', () =>
  jest
    .fn()
    .mockImplementation(
      ({ triggerIngestion, deployIngestion, handleEnableDisableIngestion }) => (
        <div>
          <p>IngestionListTable</p>
          <button onClick={() => triggerIngestion('test-id', 'pipeline-name')}>
            triggerIngestion
          </button>
          <button onClick={() => deployIngestion('test-id', 'pipeline-name')}>
            deployIngestion
          </button>
          <button onClick={() => handleEnableDisableIngestion('test-id')}>
            handleEnableDisableIngestion
          </button>
        </div>
      )
    )
);

jest.mock(
  '../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component',
  () => jest.fn().mockImplementation(() => <div>ButtonSkeleton</div>)
);

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      ingestionPipeline: ENTITY_PERMISSIONS,
    },
  })),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  deleteIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  deployIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  enableDisableIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  triggerIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
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
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('ErrorPlaceHolderIngestion')).toBeInTheDocument();
  });

  it('should render the ButtonSkeleton if airflow status is being fetched', async () => {
    await act(async () => {
      render(
        <Ingestion
          {...ingestionProps}
          airflowInformation={{
            ...ingestionProps.airflowInformation,
            isFetchingStatus: true,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('ButtonSkeleton')).toBeInTheDocument();
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
        {
          wrapper: MemoryRouter,
        }
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
      render(<Ingestion {...ingestionProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });

  it('should call handleSearchChange when searched', async () => {
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const searchBar = screen.getByText('Searchbar');

    fireEvent.click(searchBar);

    expect(ingestionProps.handleSearchChange).toHaveBeenCalledTimes(1);
  });

  it('should call triggerIngestionPipelineById after pipeline triggered', async () => {
    (triggerIngestionPipelineById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({})
    );
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const triggerPipeline = screen.getByText('triggerIngestion');

    fireEvent.click(triggerPipeline);

    expect(triggerIngestionPipelineById).toHaveBeenCalledWith('test-id');
  });

  it('should call deployIngestionPipelineById after pipeline deployed', async () => {
    (deployIngestionPipelineById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({})
    );
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const deployIngestion = screen.getByText('deployIngestion');

    fireEvent.click(deployIngestion);

    expect(deployIngestionPipelineById).toHaveBeenCalledWith('test-id');
  });

  it('should call enableDisableIngestionPipelineById after pipeline deployed', async () => {
    (enableDisableIngestionPipelineById as jest.Mock).mockImplementationOnce(
      () => Promise.resolve({ data: { id: 'test-id', enabled: true } })
    );
    await act(async () => {
      render(<Ingestion {...ingestionProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const handleEnableDisableIngestion = screen.getByText(
      'handleEnableDisableIngestion'
    );

    fireEvent.click(handleEnableDisableIngestion);

    expect(enableDisableIngestionPipelineById).toHaveBeenCalledWith('test-id');
  });
});
