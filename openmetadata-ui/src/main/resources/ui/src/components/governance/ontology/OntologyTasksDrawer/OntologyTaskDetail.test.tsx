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

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { EntityStatus } from '../../../../generated/api/data/ontologyReleaseReview';
import APIClient from '../../../../rest/axiosClient';
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
