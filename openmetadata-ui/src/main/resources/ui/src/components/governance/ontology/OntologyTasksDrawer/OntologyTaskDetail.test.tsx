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

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityStatus } from '../../../../generated/api/data/ontologyReleaseReview';
import APIClient from '../../../../rest/axiosClient';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyTaskDetail from './OntologyTaskDetail';
import { release, review, task } from './OntologyTasksDrawer.mock';

jest.mock('../../../../rest/axiosClient', () => ({ get: jest.fn() }));
runQueryNotificationsSynchronously();
const props = {
  task,
  release,
  review,
  contentReady: false,
  isWriting: false,
  isRequester: false,
  canPublish: false,
  activationReady: true,
  onApprove: jest.fn(),
  onReject: jest.fn(),
  onApproveAndPublish: jest.fn(),
  onPublish: jest.fn(),
  onComment: jest.fn().mockResolvedValue(true),
  onContentReadyChange: jest.fn(),
  children: null,
};

beforeEach(() => {
  (APIClient.get as jest.Mock).mockImplementation(async (url: string) => ({
    data: url.endsWith('/diff') ? { data: [], paging: { total: 0 } } : release,
  }));
});

it('requires captured readiness and a reason while retaining frozen assignee states', async () => {
  const { rerender } = renderWithQueryClient(<OntologyTaskDetail {...props} />);

  expect(screen.getByRole('button', { name: 'label.approve' })).toBeDisabled();
  expect(
    await screen.findByTestId('ontology-review-panel')
  ).toBeInTheDocument();

  rerender(<OntologyTaskDetail {...props} contentReady />);
  fireEvent.click(screen.getByRole('button', { name: 'label.reject' }));

  expect(
    screen.getByRole('button', { name: 'label.reject-with-comment' })
  ).toBeDisabled();

  fireEvent.change(screen.getByRole('textbox', { name: /label.reason/ }), {
    target: { value: '  Exact reason  ' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'label.reject-with-comment' })
  );

  expect(props.onReject).toHaveBeenCalledWith('  Exact reason  ');
  expect(screen.getByText('label.pending')).toBeInTheDocument();
});

it('shows final publication only with permission and supports approved activation recovery', () => {
  const { rerender } = renderWithQueryClient(
    <OntologyTaskDetail
      {...props}
      contentReady
      review={{ ...review, callerCompletesRule: true }}
    />
  );

  expect(
    screen.queryByTestId('ontology-approve-publish')
  ).not.toBeInTheDocument();

  rerender(
    <OntologyTaskDetail
      {...props}
      canPublish
      contentReady
      review={{ ...review, callerCompletesRule: true }}
    />
  );
  fireEvent.click(screen.getByTestId('ontology-approve-publish'));

  expect(props.onApproveAndPublish).toHaveBeenCalledTimes(1);

  rerender(
    <OntologyTaskDetail
      {...props}
      activationError
      canPublish
      review={{
        ...review,
        status: EntityStatus.Approved,
        callerCanVote: false,
      }}
    />
  );

  expect(
    screen.getByText('message.ontology-review-activation-failed')
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'label.publish' }));

  expect(props.onPublish).toHaveBeenCalledTimes(1);
});

it('keeps the comment multi-line: Enter adds a new line and only the send button posts', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  renderWithQueryClient(<OntologyTaskDetail {...props} />);
  const input = screen.getByRole('textbox', { name: /label.comment/ });

  await user.type(input, 'First line{Enter}Second line');

  expect(input).toHaveValue('First line\nSecond line');
  expect(props.onComment).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'label.add-comment' }));

  expect(props.onComment).toHaveBeenCalledWith('First line\nSecond line');
});

it('shows the requester explanation without actions and posts repeated comments deliberately', async () => {
  renderWithQueryClient(
    <OntologyTaskDetail
      {...props}
      isRequester
      review={{ ...review, callerCanVote: false }}
    />
  );

  expect(
    screen.getByText('message.ontology-review-created-by-you')
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'label.approve' })
  ).not.toBeInTheDocument();

  const input = screen.getByRole('textbox', { name: /label.comment/ });
  for (let count = 1; count <= 2; count++) {
    fireEvent.change(input, { target: { value: 'Same comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'label.add-comment' }));
    await waitFor(() => expect(input).toHaveValue(''));

    expect(props.onComment).toHaveBeenCalledTimes(count);
  }
});

it('tells a caller who cannot publish that only an author or owner can, instead of a disabled button', () => {
  useEnUsTranslations();
  renderWithQueryClient(
    <OntologyTaskDetail
      {...props}
      canPublish={false}
      review={{ ...review, status: EntityStatus.Approved }}
    />
  );

  expect(
    screen.getByTestId('ontology-only-author-publishes')
  ).toHaveTextContent('Only an author or owner can publish.');
  expect(
    screen.queryByRole('button', { name: /publish/i })
  ).not.toBeInTheDocument();

  useKeyEchoTranslations();
});

it('confirms before withdrawing and only offers it to the requester of an open review', () => {
  const onWithdraw = jest.fn();
  const { rerender } = renderWithQueryClient(
    <OntologyTaskDetail {...props} onWithdraw={onWithdraw} />
  );

  expect(
    screen.queryByTestId('ontology-task-withdraw')
  ).not.toBeInTheDocument();

  rerender(
    <OntologyTaskDetail
      {...props}
      isRequester
      review={{ ...review, callerCanVote: false }}
      onWithdraw={onWithdraw}
    />
  );
  fireEvent.click(screen.getByTestId('ontology-task-withdraw'));
  fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

  expect(onWithdraw).not.toHaveBeenCalled();
  expect(
    screen.queryByTestId('ontology-task-withdraw-confirm')
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('ontology-task-withdraw'));
  fireEvent.click(screen.getByTestId('ontology-task-withdraw-submit'));

  expect(onWithdraw).toHaveBeenCalledTimes(1);

  rerender(
    <OntologyTaskDetail
      {...props}
      isRequester
      review={{ ...review, status: EntityStatus.Approved }}
      onWithdraw={onWithdraw}
    />
  );

  expect(
    screen.queryByTestId('ontology-task-withdraw')
  ).not.toBeInTheDocument();
});

it('summarises the release against its base version', async () => {
  (APIClient.get as jest.Mock).mockImplementation(async (url: string) => {
    if (url.endsWith('/diff')) {
      return { data: { data: [], paging: { total: 0 } } };
    }

    return {
      data: url.includes('base-release')
        ? { ...release, id: 'base-release', semanticVersion: '1.3.2' }
        : release,
    };
  });
  renderWithQueryClient(
    <OntologyTaskDetail
      {...props}
      release={{
        ...release,
        baseReleaseId: 'base-release',
        releaseNotes: 'Adds orders',
        changeSummary: { added: 3, changed: 1, removed: 0, deprecated: 1 },
      }}
    />
  );
  const card = screen.getByTestId('ontology-task-release-card');

  expect(await within(card).findByText('label.minor')).toBeInTheDocument();
  expect(card).toHaveTextContent('v1.3.2 → v1.4.0');
  expect(card).toHaveTextContent('+3~2−0');
  expect(screen.getByTestId('ontology-task-release-notes')).toHaveTextContent(
    'Adds orders'
  );
  expect(screen.getByTestId('ontology-task-requested')).toHaveTextContent(
    'message.ontology-task-requested-review'
  );
});
