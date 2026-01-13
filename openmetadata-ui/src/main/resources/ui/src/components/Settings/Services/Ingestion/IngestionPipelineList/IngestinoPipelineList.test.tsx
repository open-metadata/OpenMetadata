/*
 *  Copyright 2023 Collate.
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
import userEvent from '@testing-library/user-event';
import { useAirflowStatus } from '../../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { mockIngestionData } from '../../../../../mocks/Ingestion.mock';
import { mockESIngestionData } from '../../../../../mocks/IngestionListTable.mock';
import { deployIngestionPipelineById } from '../../../../../rest/ingestionPipelineAPI';
import { IngestionPipelineList } from './IngestionPipelineList.component';

jest.mock(
  '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion',
  () => {
    return jest.fn().mockImplementation(() => <p>Airflow not available</p>);
  }
);

jest.mock(
  '../../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      isAirflowAvailable: true,
      isFetchingStatus: false,
    })),
  })
);

jest.mock('../../../../common/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>);
});

jest.mock('../IngestionListTable/IngestionListTable', () => {
  return jest.fn().mockImplementation(({ extraTableProps }) => (
    <div>
      IngestionListTable
      <button
        onClick={() =>
          extraTableProps.rowSelection.onChange(
            [
              mockIngestionData.fullyQualifiedName,
              mockESIngestionData.fullyQualifiedName,
            ],
            [mockIngestionData, mockESIngestionData]
          )
        }>
        rowSelection
      </button>
    </div>
  ));
});

jest.mock('../../../../../rest/ingestionPipelineAPI', () => ({
  deployIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getIngestionPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [mockIngestionData, mockESIngestionData],
      paging: { total: 2 },
    })
  ),
}));
const mockLocationPathname = '/mock-path';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

describe('IngestionPipelineList', () => {
  it('should show loader until get status of airflow', () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: true,
    }));

    render(
      <IngestionPipelineList serviceName={ServiceCategory.DASHBOARD_SERVICES} />
    );

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should show error placeholder for airflow not available', () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: false,
    }));

    render(
      <IngestionPipelineList serviceName={ServiceCategory.DASHBOARD_SERVICES} />
    );

    expect(screen.getByText('Airflow not available')).toBeInTheDocument();
  });

  it('should not call deployIngestionPipelineById after bulk deploy button click without pipeline selection', async () => {
    await act(async () => {
      render(
        <IngestionPipelineList
          serviceName={ServiceCategory.DASHBOARD_SERVICES}
        />
      );
    });

    const bulkDeployButton = screen.getByTestId('bulk-re-deploy-button');

    await act(async () => {
      userEvent.click(bulkDeployButton);
    });

    expect(deployIngestionPipelineById).not.toHaveBeenCalled();
  });

  it('should call deployIngestionPipelineById after bulk deploy button click after pipeline selection', async () => {
    await act(async () => {
      render(
        <IngestionPipelineList
          serviceName={ServiceCategory.DASHBOARD_SERVICES}
        />
      );
    });

    const rowSelection = screen.getByText('rowSelection');

    fireEvent.click(rowSelection);

    const bulkDeployButton = screen.getByTestId('bulk-re-deploy-button');

    fireEvent.click(bulkDeployButton);

    expect(deployIngestionPipelineById).toHaveBeenCalledTimes(2);
  });
});
