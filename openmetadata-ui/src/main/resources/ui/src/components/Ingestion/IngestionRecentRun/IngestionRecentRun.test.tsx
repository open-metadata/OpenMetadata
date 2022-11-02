/*
 *  Copyright 2022 Collate
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-test-renderer';
import * as APIs from '../../../axiosAPIs/ingestionPipelineAPI';
import { getRunHistoryForPipeline } from '../../../axiosAPIs/ingestionPipelineAPI';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { IngestionRecentRuns } from './IngestionRecentRuns.component';

const mockPipelineStatus = [
  {
    runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
    pipelineState: 'success',
    startDate: 1667307722,
    timestamp: 1667307722,
    endDate: 1667307725,
  },
  {
    runId: 'c95cc97b-9ea2-465c-9b5a-255401674324',
    pipelineState: 'success',
    startDate: 1667304123,
    timestamp: 1667304123,
    endDate: 1667304126,
  },
  {
    runId: '60b3e15c-3865-4c81-a1ee-36ff85d2be8e',
    pipelineState: 'success',
    startDate: 1667301533,
    timestamp: 1667301533,
    endDate: 1667301536,
  },
  {
    runId: 'a2c6fbf9-952f-4ddd-9b01-c203bf54f0fe',
    pipelineState: 'success',
    startDate: 1667297370,
    timestamp: 1667297370,
    endDate: 1667297373,
  },
];

const mockIngestion = { fullyQualifiedName: 'test' } as IngestionPipeline;

describe('Test IngestionRecentRun component', () => {
  it('should render loading while making API call', () => {
    render(<IngestionRecentRuns ingestion={mockIngestion} />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should call getRunHistoryForPipeline to fetch all the status', () => {
    jest.spyOn(APIs, 'getRunHistoryForPipeline');

    render(<IngestionRecentRuns ingestion={mockIngestion} />);

    expect(getRunHistoryForPipeline).toBeCalledWith('test', expect.anything());
  });

  it('should render runs when API returns runs', async () => {
    const statusAPI = jest.spyOn(APIs, 'getRunHistoryForPipeline');

    (statusAPI as jest.Mock).mockResolvedValue({
      data: mockPipelineStatus,
      paging: {
        total: 4,
      },
    });

    await act(() => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Success/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(5);
  });
});
