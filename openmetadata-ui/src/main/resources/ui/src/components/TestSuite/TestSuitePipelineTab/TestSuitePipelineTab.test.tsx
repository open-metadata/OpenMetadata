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
import { render } from '@testing-library/react';
import React from 'react';
import { act } from 'react-test-renderer';
import { Table } from '../../../generated/entity/data/table';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import TestSuitePipelineTab from './TestSuitePipelineTab.component';

const mockTestSuite = {
  id: '6a048962-cd78-4d51-9517-62838720ef97',
  name: 'mySQL.openmetadata_db.openmetadata_db.web_analytic_event.testSuite',
  fullyQualifiedName:
    'mySQL.openmetadata_db.openmetadata_db.web_analytic_event.testSuite',
  tests: [],
  pipelines: [
    {
      id: 'd16c64b6-fb36-4e20-8700-d6f1e2754ef5',
      type: 'ingestionPipeline',
      name: 'web_analytic_event_TestSuite',
      fullyQualifiedName:
        'mySQL.openmetadata_db.openmetadata_db.web_analytic_event.testSuite.web_analytic_event_TestSuite',
      deleted: false,
    },
  ],
  serviceType: 'TestSuite',
  version: 0.1,
  updatedAt: 1692766701920,
  updatedBy: 'admin',
  deleted: false,
  executable: true,
  executableEntityReference: {
    id: 'e926d275-441e-49ee-a073-ad509f625a14',
    type: 'table',
    name: 'web_analytic_event',
    fullyQualifiedName:
      'mySQL.openmetadata_db.openmetadata_db.web_analytic_event',
  },
  summary: {
    success: 0,
    failed: 1,
    aborted: 0,
    total: 1,
  },
  testCaseResultSummary: [],
} as unknown as Table['testSuite'];

jest.mock('../../../rest/ingestionPipelineAPI', () => {
  return {
    getIngestionPipelines: jest
      .fn()
      .mockImplementation(() => Promise.resolve()),
  };
});

describe('TestSuite Pipeline component', () => {
  it('getIngestionPipelines API should call on page load', async () => {
    const mockGetIngestionPipelines = getIngestionPipelines as jest.Mock;
    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    expect(mockGetIngestionPipelines).toHaveBeenCalledWith({
      arrQueryFields: ['owner', 'pipelineStatuses'],
      pipelineType: ['TestSuite'],
      testSuite: mockTestSuite?.fullyQualifiedName,
    });
  });
});
