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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DISABLED } from '../../../../constants/constants';
import { ingestionProps } from '../../../../mocks/Ingestion.mock';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import Ingestion from './Ingestion.component';

const mockDeleteIngestionPipelineById = jest
  .fn()
  .mockImplementation(() => Promise.resolve({}));
const mockDeployIngestionPipelineById = jest
  .fn()
  .mockImplementation(() => Promise.resolve({}));
const mockEnableDisableIngestionPipelineById = jest
  .fn()
  .mockImplementation(() => Promise.resolve({}));
const mockTriggerIngestionPipelineById = jest
  .fn()
  .mockImplementation(() => Promise.resolve({}));

jest.mock('../../../common/SearchBarComponent/SearchBar.component', () => {
  return jest.fn().mockImplementation(() => <div>Searchbar</div>);
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
  jest.fn().mockImplementation(({ handleDeleteSelection }) => (
    <div>
      <p>IngestionListTable</p>
      <button
        onClick={() =>
          handleDeleteSelection({ id: 'delete-id', name: 'pipeline-name' })
        }>
        handleDeleteSelection
      </button>
    </div>
  ))
);

jest.mock(
  '../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component',
  () => jest.fn().mockImplementation(() => <div>ButtonSkeleton</div>)
);

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => ENTITY_PERMISSIONS),
  })),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  deleteIngestionPipelineById: mockDeleteIngestionPipelineById,
  deployIngestionPipelineById: mockDeployIngestionPipelineById,
  enableDisableIngestionPipelineById: mockEnableDisableIngestionPipelineById,
  triggerIngestionPipelineById: mockTriggerIngestionPipelineById,
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

  it('should not render the AddIngestionButton if displayAddIngestionButton is false', async () => {
    await act(async () => {
      render(
        <Ingestion {...ingestionProps} displayAddIngestionButton={false} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });

  it('should not render the AddIngestionButton if no EditAll permission', async () => {
    await act(async () => {
      render(
        <Ingestion
          {...ingestionProps}
          displayAddIngestionButton={false}
          permissions={{ ...ENTITY_PERMISSIONS, EditAll: false }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });
});
