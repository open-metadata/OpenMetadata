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

import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  TaskType,
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import DescriptionTask from './DescriptionTask';

const mockProps = {
  taskDetail: {
    id: '9542599e-f2f9-46d1-9fc0-d03620351a0d',
    type: 'Task',
    href: 'http://localhost:8585/api/v1/feed/9542599e-f2f9-46d1-9fc0-d03620351a0d',
    threadTs: 1658319946364,
    about:
      '<#E::table::sample_data.ecommerce_db.shopify.raw_order::description>',
    entityId: '45d6725f-fb62-492d-b7fb-3a37976d0252',
    createdBy: 'alex_pollard9',
    updatedAt: 1658319946365,
    updatedBy: 'anonymous',
    resolved: false,
    message: 'Update description for table',
    postsCount: 0,
    posts: [],
    reactions: [],
    task: {
      id: 5,
      type: 'UpdateDescription',
      assignees: [
        {
          id: 'b76b005d-3540-4f85-86db-197abdcaf351',
          type: 'user',
          name: 'adam_matthews2',
          fullyQualifiedName: 'adam_matthews2',
          displayName: 'Adam Matthews',
          deleted: true,
        },
      ],
      status: 'Open',
      oldValue:
        'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to buid our dim and fact tables',
      suggestion:
        'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to build our dim and fact tables',
    },
  } as Thread,
  isTaskActionEdit: false,
  hasEditAccess: true,
  suggestion:
    'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to build our dim and fact tables',
  currentDescription: '',
  onSuggestionChange: jest.fn(),
};

describe('Test Description Task Component', () => {
  it('Should render the component', async () => {
    render(<DescriptionTask {...mockProps} />);

    const container = await screen.findByTestId('description-task');

    const requestDescription = screen.queryByTestId('request-description');

    const updateDescription = await screen.findByTestId('update-description');

    expect(container).toBeInTheDocument();
    expect(requestDescription).not.toBeInTheDocument();
    expect(updateDescription).toBeInTheDocument();
  });

  it('Should render the request description component', async () => {
    render(
      <DescriptionTask
        {...mockProps}
        taskDetail={{
          ...mockProps.taskDetail,
          task: {
            id: 5,
            assignees: [
              {
                id: 'b76b005d-3540-4f85-86db-197abdcaf351',
                type: 'user',
                name: 'adam_matthews2',
                fullyQualifiedName: 'adam_matthews2',
                displayName: 'Adam Matthews',
                deleted: true,
              },
            ],
            status: ThreadTaskStatus.Open,
            oldValue:
              'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to buid our dim and fact tables',
            suggestion:
              'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to build our dim and fact tables',

            type: TaskType.RequestDescription,
          },
        }}
      />
    );

    const container = await screen.findByTestId('description-task');

    const updateDescription = screen.queryByTestId('update-description');

    const requestDescription = await screen.findByTestId('request-description');

    expect(container).toBeInTheDocument();
    expect(requestDescription).toBeInTheDocument();
    expect(updateDescription).not.toBeInTheDocument();
  });

  it('Should render the update description component', async () => {
    render(
      <DescriptionTask
        {...mockProps}
        taskDetail={{
          ...mockProps.taskDetail,
          task: {
            id: 5,
            assignees: [
              {
                id: 'b76b005d-3540-4f85-86db-197abdcaf351',
                type: 'user',
                name: 'adam_matthews2',
                fullyQualifiedName: 'adam_matthews2',
                displayName: 'Adam Matthews',
                deleted: true,
              },
            ],
            status: ThreadTaskStatus.Open,
            oldValue:
              'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to buid our dim and fact tables',
            suggestion:
              'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to build our dim and fact tables',

            type: TaskType.UpdateDescription,
          },
        }}
      />
    );

    const requestDescription = screen.queryByTestId('request-description');

    const updateDescription = await screen.findByTestId('update-description');

    expect(requestDescription).not.toBeInTheDocument();
    expect(updateDescription).toBeInTheDocument();
  });
});
