/*
 *  Copyright 2021 Collate
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
import { Pipeline, StatusType } from '../../generated/entity/data/pipeline';
import PipelineStatusListComponent from './PipelineStatusList.component';

const mockPipelineStatus: Pipeline['pipelineStatus'] = [
  {
    executionDate: 1649669589,
    executionStatus: 'Successful',
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: 'Successful',
      },
      {
        name: 'assert_table_exists',
        executionStatus: 'Successful',
      },
    ],
  },
  {
    executionDate: 1649669474,
    executionStatus: 'Pending',
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: 'Pending',
      },
      {
        name: 'assert_table_exists',
        executionStatus: 'Pending',
      },
    ],
  },
  {
    executionDate: 1649669394,
    executionStatus: 'Failed',
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: 'Successful',
      },
      {
        name: 'assert_table_exists',
        executionStatus: 'Failed',
      },
    ],
  },
  {
    executionDate: 1649669374,
    executionStatus: 'Pending',
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: 'Failed',
      },
      {
        name: 'assert_table_exists',
        executionStatus: 'Pending',
      },
    ],
  },
  {
    executionDate: 1649669274,
    executionStatus: 'Pending',
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: 'Pending',
      },
      {
        name: 'assert_table_exists',
        executionStatus: 'Successful',
      },
    ],
  },
  {
    executionDate: 1649669174,
    executionStatus: 'Failed',
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: 'Failed',
      },
      {
        name: 'assert_table_exists',
        executionStatus: 'Successful',
      },
    ],
  },
  {
    executionDate: 1649582444,
    executionStatus: 'Failed',
    taskStatus: [
      {
        name: 'dim_address_task',
        executionStatus: 'Failed',
      },
      {
        name: 'assert_table_exists',
        executionStatus: 'Failed',
      },
    ],
  },
] as Pipeline['pipelineStatus'];

const mockSelectExec = jest.fn();

jest.mock('../../utils/PipelineDetailsUtils', () => ({
  getModifiedPipelineStatus: jest.fn().mockReturnValue([
    {
      executionDate: 1649669589,
      executionStatus: 'Successful',
      name: 'dim_address_task',
    },
    {
      executionDate: 1649669589,
      executionStatus: 'Successful',
      name: 'assert_table_exists',
    },
    {
      executionDate: 1649669474,
      executionStatus: 'Pending',
      name: 'dim_address_task',
    },
  ]),
  getStatusBadgeIcon: jest.fn().mockImplementation((status: StatusType) => {
    return status;
  }),
  STATUS_OPTIONS: [],
}));

describe('Test PipelineStatus list component', () => {
  it('Should render all child elements', async () => {
    const { findByTestId } = render(
      <PipelineStatusListComponent
        pipelineStatus={mockPipelineStatus}
        selectedExec={mockPipelineStatus?.[0] || {}}
        onSelectExecution={mockSelectExec}
      />
    );

    const filterDropDown = await findByTestId('filter-dropdown');

    const pipelineStatusTable = await findByTestId('pipeline-status-table');

    expect(filterDropDown).toBeInTheDocument();
    expect(pipelineStatusTable).toBeInTheDocument();
  });

  it('Should render no data placeholder if pipelinestatus is undefined', async () => {
    const { findByTestId } = render(
      <PipelineStatusListComponent
        pipelineStatus={undefined}
        selectedExec={{}}
        onSelectExecution={mockSelectExec}
      />
    );

    const noData = await findByTestId('no-data');

    expect(noData).toBeInTheDocument();
  });

  it('Should render no data placeholder if pipelinestatus is empty list', async () => {
    const { findByTestId } = render(
      <PipelineStatusListComponent
        pipelineStatus={[]}
        selectedExec={{}}
        onSelectExecution={mockSelectExec}
      />
    );

    const noData = await findByTestId('no-data');

    expect(noData).toBeInTheDocument();
  });
});
