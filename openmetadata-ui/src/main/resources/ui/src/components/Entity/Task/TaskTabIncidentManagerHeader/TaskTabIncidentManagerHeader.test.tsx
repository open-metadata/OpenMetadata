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
import {
  queryByTestId,
  queryByText,
  render,
  screen,
} from '@testing-library/react';
import { Thread } from '../../../../generated/entity/feed/thread';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import TaskTabIncidentManagerHeader from './TaskTabIncidentManagerHeader.component';

const mockProps = {
  thread: {
    id: '29569f98-f76e-4e98-8822-7ad8c460d4a2',
    type: 'Task',
    href: 'http://localhost:8585/api/v1/feed/29569f98-f76e-4e98-8822-7ad8c460d4a2',
    threadTs: 1703830298229,
    about:
      '<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals>',
    entityId: '1b748634-d24b-4879-9791-289f2f90fc3c',
    createdBy: 'admin',
    updatedAt: 1703830298304,
    updatedBy: 'admin',
    resolved: false,
    message: 'Test Case Failure Resolution requested for ',
    postsCount: 1,
    posts: [
      {
        id: '3f50e6e1-5c3a-4a2b-865a-19a94d2ad749',
        message: 'Resolved the Task.',
        postTs: 1703830298303,
        from: 'admin',
        reactions: [],
      },
    ],
    task: {
      id: 27,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: 'd75b492b-3b73-449d-922c-14b61bc44b3d',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      status: 'Closed',
      closedBy: 'admin',
      closedAt: 1703830298297,
      newValue: 'Resolution comment',
      testCaseResolutionStatusId: 'b96a6e99-12fa-447b-89ab-480d4c264aa9',
    },
    relativeDay: 'Yesterday',
  } as Thread,
};
const updatedBy = {
  id: '1adc8817-9232-41b3-8712-33f2e0d6deb9',
  type: 'user',
  name: 'admin',
  fullyQualifiedName: 'admin',
  deleted: false,
};
const mockStatus = [
  {
    testCaseResolutionStatusType: 'New',
    updatedBy,
    updatedAt: 1703830297978,
  },
  {
    testCaseResolutionStatusType: 'Ack',
    updatedBy,
    updatedAt: 1703830297997,
  },
  {
    testCaseResolutionStatusType: 'Assigned',
    testCaseResolutionStatusDetails: {
      assignee: {
        id: 'e3b8674e-416e-4851-b2c4-55282db62e51',
        href: null,
        name: 'christopher_campbell7',
        type: 'user',
        deleted: null,
        inherited: null,
        description: null,
        displayName: null,
        fullyQualifiedName: 'christopher_campbell7',
      },
    },
    updatedBy,
    updatedAt: 1703830298032,
  },
  {
    testCaseResolutionStatusType: 'Assigned',
    testCaseResolutionStatusDetails: {
      assignee: {
        id: 'd75b492b-3b73-449d-922c-14b61bc44b3d',
        name: 'aaron_johnson0',
        type: 'user',
        deleted: false,
        displayName: 'Aaron Johnson',
        fullyQualifiedName: 'aaron_johnson0',
      },
    },
    updatedBy,
    updatedAt: 1703830298222,
  },
  {
    testCaseResolutionStatusType: 'Resolved',
    testCaseResolutionStatusDetails: {
      resolvedBy: {
        id: '1adc8817-9232-41b3-8712-33f2e0d6deb9',
        name: 'admin',
        type: 'user',
        deleted: false,
        fullyQualifiedName: 'admin',
      },
      testCaseFailureReason: 'Duplicates',
      testCaseFailureComment: 'Resolution comment',
    },
    updatedBy,
    updatedAt: 1703830298283,
  },
];

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest
      .fn()
      .mockImplementation(() => ({ testCaseResolutionStatus: mockStatus })),
  })
);
jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => {
  return {
    OwnerLabel: jest
      .fn()
      .mockImplementation(() => <div>OwnerLabel.component</div>),
  };
});
jest.mock(
  '../../../DataQuality/IncidentManager/Severity/Severity.component',
  () => {
    return jest.fn().mockImplementation(() => <div>Severity.component</div>);
  }
);
jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>RichTextEditorPreviewer.component</div>);
});

describe('Test TaskTabIncidentManagerHeader component', () => {
  it('should render component', async () => {
    render(<TaskTabIncidentManagerHeader {...mockProps} />);

    expect(
      await screen.findByTestId('incident-manager-task-header-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('task-resolution-steps')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('failure-reason')).toBeInTheDocument();
    expect(await screen.findAllByText('OwnerLabel.component')).toHaveLength(2);
    expect(await screen.findByText('Severity.component')).toBeInTheDocument();
    expect(
      await screen.findByText('RichTextEditorPreviewer.component')
    ).toBeInTheDocument();
  });

  it('should not render failure reason and failure comment if task is not resolved', async () => {
    (useActivityFeedProvider as jest.Mock).mockImplementationOnce(() => ({
      testCaseResolutionStatus: [mockStatus[0]],
    }));
    const { container } = render(
      <TaskTabIncidentManagerHeader {...mockProps} />
    );

    expect(queryByTestId(container, 'failure-reason')).not.toBeInTheDocument();
    expect(
      queryByText(container, 'RichTextEditorPreviewer.component')
    ).not.toBeInTheDocument();
  });
});
