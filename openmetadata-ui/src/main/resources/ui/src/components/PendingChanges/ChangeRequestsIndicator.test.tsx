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
import ChangeRequestsIndicator from './ChangeRequestsIndicator.component';

jest.mock('../../rest/changeRequestsAPI', () => ({
  getChangeRequestsForEntity: jest.fn(),
  withdrawChangeRequest: jest.fn(),
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

describe('ChangeRequestsIndicator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when no request is open', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({ status: ChangeRequestStatus.Applied }),
    ]);

    await renderIndicator();

    expect(screen.queryByTestId('pending-change-requests')).toBeNull();
  });

  it('shows the request count and lists the open requests in the modal', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({}),
      request({ id: 'cr-2', requestedBy: 'bob' }),
    ]);

    await openModal();

    expect(screen.getByTestId('pending-change-requests')).toHaveTextContent(
      '2'
    );
    expect(screen.getByTestId('pending-changes-modal')).toBeInTheDocument();
    expect(screen.getByTestId('change-request-cr-1')).toBeInTheDocument();
    expect(screen.getByTestId('change-request-cr-2')).toBeInTheDocument();
  });

  it('shows the previous and proposed value of an update and lets the requester withdraw', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([request({})]);
    (withdrawChangeRequest as jest.Mock).mockResolvedValue({});

    await openModal();

    const change = screen.getByTestId('change-description-updated');

    expect(change).toHaveTextContent('Old text');
    expect(change).toHaveTextContent('New text');

    await act(async () => {
      fireEvent.click(screen.getByTestId('withdraw-change-request'));
    });

    expect(withdrawChangeRequest).toHaveBeenCalledWith('cr-1', 2);
    expect(getChangeRequestsForEntity).toHaveBeenCalledTimes(2);
  });

  it("offers no actions on someone else's request", async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({ requestedBy: 'bob', taskId: 'task-1' }),
    ]);

    await openModal();

    expect(screen.queryByTestId('withdraw-change-request')).toBeNull();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
  });

  it('filters the requests by requester or changed field', async () => {
    (getChangeRequestsForEntity as jest.Mock).mockResolvedValue([
      request({}),
      request({ id: 'cr-2', requestedBy: 'bob' }),
    ]);

    await openModal();
    await act(async () => {
      fireEvent.change(screen.getByTestId('pending-changes-search'), {
        target: { value: 'bob' },
      });
    });

    expect(screen.queryByTestId('change-request-cr-1')).toBeNull();
    expect(screen.getByTestId('change-request-cr-2')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByTestId('pending-changes-search'), {
        target: { value: 'owners' },
      });
    });

    expect(screen.queryByTestId('change-request-cr-2')).toBeNull();
    expect(screen.getByText('message.no-match-found')).toBeInTheDocument();
  });
});
