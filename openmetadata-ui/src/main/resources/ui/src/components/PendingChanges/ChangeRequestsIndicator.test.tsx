/*
 *  Copyright 2026 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import {
  ChangeRequest,
  ChangeRequestOrigin,
  ChangeRequestStatus,
  ChangeRevisionStatus,
  MutationOpType,
} from '../../generated/governance/changeRequest/changeRequest';
import {
  getChangeRequestsForEntity,
  withdrawChangeRequest,
} from '../../rest/changeRequestsAPI';
import { getTaskById, resolveTask } from '../../rest/tasksAPI';
import ChangeRequestsIndicator from './ChangeRequestsIndicator.component';

jest.mock('../../rest/changeRequestsAPI', () => ({
  getChangeRequestsForEntity: jest.fn(),
  withdrawChangeRequest: jest.fn(),
  getChangeRequestRevisions: jest.fn().mockResolvedValue([]),
  getChangeRequestDecisions: jest.fn().mockResolvedValue([]),
  getChangeRequestEvents: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../rest/tasksAPI', () => ({
  getTaskById: jest.fn(),
  resolveTask: jest.fn().mockResolvedValue({}),
}));

const mockGetEntity = jest.fn();

jest.mock('../../utils/Assets/AssetsUtils', () => ({
  getEntityAPIfromSource: () => mockGetEntity,
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'user-alice', name: 'alice' },
  }),
}));

jest.mock('../common/ProfilePicture/ProfilePicture', () => jest.fn(() => null));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const request = (overrides: Partial<ChangeRequest>): ChangeRequest => ({
  id: 'cr-1',
  entityType: 'glossary',
  entityId: 'entity-1',
  entityFullyQualifiedName: 'g1',
  requestedBy: 'alice',
  origin: ChangeRequestOrigin.Intercepted,
  workflowDefinitionId: 'wf-1',
  status: ChangeRequestStatus.Pending,
  activeRevisionId: 'rev-2',
  activeRevisionNumber: 2,
  createdAt: 1,
  updatedAt: 1,
  activeRevision: {
    id: 'rev-2',
    changeRequestId: 'cr-1',
    revisionNumber: 2,
    digest: 'd',
    status: ChangeRevisionStatus.Active,
    createdBy: 'alice',
    createdAt: 1,
    ops: [
      {
        op: MutationOpType.Set,
        field: 'description',
        value: JSON.stringify('<p>New text</p>'),
        baseValue: JSON.stringify('<p>Old text</p>'),
      },
    ],
  },
  ...overrides,
});

const renderIndicator = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <ChangeRequestsIndicator entityId="entity-1" />
      </MemoryRouter>
    );
  });
};

const openModal = async () => {
  await renderIndicator();
  await act(async () => {
    fireEvent.click(screen.getByTestId('pending-change-requests'));
  });
};

const task = (assignees: string[]) => ({
  data: {
    id: 'task-1',
    taskId: 'TASK-00022',
    createdBy: { id: 'user-bob', type: 'user', name: 'bob' },
    assignees: assignees.map((name) => ({
      id: `user-${name}`,
      type: 'user',
      name,
    })),
  },
});

describe('ChangeRequestsIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntity.mockResolvedValue({ tags: [] });
  });

  it('shows no count when no request is open', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({ status: ChangeRequestStatus.Applied }),
    ]);

    await renderIndicator();

    expect(screen.getByTestId('pending-change-requests')).not.toHaveTextContent(
      '1'
    );
  });

  it('opens the review of every pending change, grouped by field', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({}),
      request({ id: 'cr-2', requestedBy: 'bob' }),
    ]);

    await openModal();

    expect(
      screen.getByTestId('review-pending-changes-modal')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('suggestion-cr-1|2|description')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('suggestion-cr-2|2|description')
    ).toBeInTheDocument();
  });

  it('shows the request count and an empty review when the asset has none', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([]);

    await openModal();

    expect(
      screen.getByText('message.no-pending-changes-on-asset')
    ).toBeInTheDocument();
  });

  it('lets the requester withdraw their own request', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([request({})]);
    (withdrawChangeRequest as jest.Mock).mockResolvedValue({});

    await openModal();
    await act(async () => {
      fireEvent.click(screen.getByTestId('withdraw-cr-1|2|description'));
    });

    expect(withdrawChangeRequest).toHaveBeenCalledWith('cr-1', 2);
    expect(getChangeRequestsForEntity).toHaveBeenCalledTimes(2);
  });

  it("offers no decision on a request whose task is not the user's", async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({ requestedBy: 'bob', taskId: 'task-1' }),
    ]);
    (getTaskById as jest.Mock).mockResolvedValue(task(['carol']));

    await openModal();

    expect(
      screen.queryByTestId('withdraw-cr-1|2|description')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('accept-cr-1|2|description')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('reject-cr-1|2|description')
    ).not.toBeInTheDocument();
  });

  it("resolves an assigned reviewer's task with the changes they accepted", async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({ requestedBy: 'bob', taskId: 'task-1' }),
    ]);
    (getTaskById as jest.Mock).mockResolvedValue(task(['alice']));

    await openModal();

    expect(screen.getByTestId('task-cr-1')).toHaveTextContent(
      'label.task-number'
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('accept-cr-1|2|description'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-review'));
    });

    expect(resolveTask).toHaveBeenCalledWith('task-1', {
      resolutionType: 'Approved',
      changeRequestRevision: 2,
      changeDecisions: [
        { field: 'description', key: undefined, decision: 'Approve' },
      ],
    });
  });

  it('lets an owner decide when the glossary has no reviewers', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({ requestedBy: 'bob', taskId: 'task-1' }),
    ]);
    (getTaskById as jest.Mock).mockResolvedValue(task(['carol']));
    mockGetEntity.mockResolvedValue({
      owners: [{ id: 'user-alice', type: 'user', name: 'alice' }],
      reviewers: [],
    });

    await openModal();

    expect(screen.getByTestId('accept-cr-1|2|description')).toBeInTheDocument();
  });

  it('leaves the decision to the reviewers of a glossary that has them', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({ requestedBy: 'bob', taskId: 'task-1' }),
    ]);
    (getTaskById as jest.Mock).mockResolvedValue(task(['carol']));
    mockGetEntity.mockResolvedValue({
      owners: [{ id: 'user-alice', type: 'user', name: 'alice' }],
      reviewers: [{ id: 'user-carol', type: 'user', name: 'carol' }],
    });

    await openModal();

    expect(
      screen.queryByTestId('accept-cr-1|2|description')
    ).not.toBeInTheDocument();
  });
});
