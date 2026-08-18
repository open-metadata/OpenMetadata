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
import {
  deployIngestionPipelineById,
  getIngestionPipelines,
} from '../../../../../rest/ingestionPipelineAPI';
import { IngestionPipelineList } from './IngestionPipelineList.component';

jest.mock('../../../../common/AirflowMessageBanner/AirflowMessageBanner', () =>
  jest
    .fn()
    .mockImplementation(({ unreachableFallbackMessage }) => (
      <p data-fallback={unreachableFallbackMessage}>AirflowMessageBanner</p>
    ))
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
  beforeEach(() => {
    jest.clearAllMocks();
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: true,
      isFetchingStatus: false,
    }));
  });

  it.each([
    [
      'is still being fetched',
      { isAirflowAvailable: false, isFetchingStatus: true },
    ],
    [
      'reports it unavailable',
      { isAirflowAvailable: false, isFetchingStatus: false },
    ],
  ])(
    'should list the pipelines while the airflow status %s',
    async (_label, status) => {
      (useAirflowStatus as jest.Mock).mockImplementation(() => status);

      await act(async () => {
        render(
          <IngestionPipelineList
            serviceName={ServiceCategory.DASHBOARD_SERVICES}
          />
        );
      });

      expect(screen.getByText('IngestionListTable')).toBeInTheDocument();
      expect(getIngestionPipelines).toHaveBeenCalled();
    }
  );

  it('should disable the bulk re-deploy button when the pipeline service is unreachable', async () => {
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: false,
    }));

    await act(async () => {
      render(
        <IngestionPipelineList
          serviceName={ServiceCategory.DASHBOARD_SERVICES}
        />
      );
    });

    fireEvent.click(screen.getByText('rowSelection'));

    expect(screen.getByTestId('bulk-re-deploy-button')).toBeDisabled();
    // The fallback is opt-in — without it a thrown status call leaves the disabled button
    // unexplained.
    expect(screen.getByText('AirflowMessageBanner')).toHaveAttribute(
      'data-fallback',
      'message.pipeline-service-unreachable-agent-actions'
    );
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
