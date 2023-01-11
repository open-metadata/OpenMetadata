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
import { getRunHistoryForPipeline } from 'rest/ingestionPipelineAPI';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { IngestionRecentRuns } from './IngestionRecentRuns.component';

jest.mock('rest/ingestionPipelineAPI', () => ({
  getRunHistoryForPipeline: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [
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
      ],
      paging: { total: 4 },
    })
  ),
}));

const mockIngestion = { fullyQualifiedName: 'test' } as IngestionPipeline;

describe('Test IngestionRecentRun component', () => {
  it('should call getRunHistoryForPipeline to fetch all the status', async () => {
    act(() => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    expect(getRunHistoryForPipeline).toHaveBeenCalledWith(
      'test',
      expect.anything()
    );
  });

  it('should render runs when API returns runs', async () => {
    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Success/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });
});
