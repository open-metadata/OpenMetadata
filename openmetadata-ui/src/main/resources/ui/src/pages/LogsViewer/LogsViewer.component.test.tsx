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
import LogsViewer from './LogsViewer.component';
import { mockIngestionPipeline, mockLogsData } from './mocks/LogsViewer.mock';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    logEntityType: 'TestSuite',
    ingestionName: 'ingestion_123456',
  }),
}));

jest.mock(
  'components/common/title-breadcrumb/title-breadcrumb.component',
  () => () => <>TitleBreadcrumb.component</>
);

jest.mock('react-lazylog', () => ({
  LazyLog: jest
    .fn()
    .mockImplementation(() => <div data-testid="logs">LazyLog</div>),
}));

jest.mock('rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineLogById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockLogsData })),
  getIngestionPipelineByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockIngestionPipeline)),
}));

jest.mock(
  'components/Ingestion/IngestionRecentRun/IngestionRecentRuns.component',
  () => ({
    IngestionRecentRuns: jest
      .fn()
      .mockImplementation(() => <p>IngestionRecentRuns</p>),
  })
);

describe('LogsViewer.component', () => {
  it('On initial, component should render', async () => {
    await act(async () => {
      render(<LogsViewer />);

      expect(
        await screen.findByText('TitleBreadcrumb.component')
      ).toBeInTheDocument();
    });

    expect(
      await screen.findByText('test-redshift_metadata_ZeCajs9g')
    ).toBeInTheDocument();

    const logElement = await screen.findByTestId('logs');

    expect(logElement).toBeInTheDocument();
  });
});
