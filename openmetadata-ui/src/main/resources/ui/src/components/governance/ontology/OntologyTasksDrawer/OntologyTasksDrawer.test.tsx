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
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import APIClient from '../../../../rest/axiosClient';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyTasksDrawer from './OntologyTasksDrawer';

jest.mock('../../../../utils/ToastUtils', () => ({
  ...jest.requireActual('../../../../utils/ToastUtils'),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));
const get = APIClient.get as jest.Mock;
const post = APIClient.post as jest.Mock;
const put = APIClient.put as jest.Mock;
const reviewer = { id: 'reviewer', name: 'reviewer', type: 'user' };
const review = {
  task: { id: 'task-a', type: 'task' },
  taskId: 'TASK-00042',
  release: { id: 'release-a', type: 'ontologyRelease' },
  ontology: { id: 'ontology', name: 'Commerce', type: 'ontology' },
  status: 'In Review',
  approvalRule: 'AllReviewers',
  callerCanVote: true,
  callerCompletesRule: false,
  requester: { id: 'author', name: 'author', type: 'user' },
  assignees: [{ assignee: reviewer, status: 'Pending' }],
};
const task = {
  id: 'task-a',
  name: 'Review Commerce',
  type: 'RequestApproval',
  status: 'Open',
  category: 'Approval',
  about: review.release,
  createdBy: review.requester,
  ontologyReview: {
    entityId: 'release-a',
    ontologyId: 'ontology',
    entityVersion: 0.2,
    contentDigest: 'a'.repeat(64),
    author: 'author',
  },
  availableTransitions: [
    { id: 'approve', label: 'Approve', resolutionType: 'Approved' },
    { id: 'reject', label: 'Reject', resolutionType: 'Rejected' },
  ],
  comments: [],
};
const release = {
  id: 'release-a',
  name: 'Commerce release',
  ontology: review.ontology,
  semanticVersion: '1.4.0',
  entityStatus: 'In Review',
  contentDigest: 'b'.repeat(64),
  version: 0.2,
};

function Harness({
  initialTask,
  ontologyId = 'ontology',
}: {
  initialTask?: string;
  ontologyId?: string | null;
}) {
  const [taskId, setTaskId] = useState(initialTask);

  return (
    <>
      <button onClick={() => setTaskId('task-b')}>Task B</button>
      <OntologyTasksDrawer
        ontologyId={ontologyId ?? undefined}
        taskId={taskId}
        onTaskChange={setTaskId}>
        {({ tasksAction, banner }) => (
          <>
            {tasksAction}
            {banner}
          </>
        )}
      </OntologyTasksDrawer>
    </>
  );
}

runQueryNotificationsSynchronously();

const taskResponse = (url: string, fields?: string) => {
  const id = url.split('/').pop();
  const isSecond = id === 'task-b';
  const releaseId = isSecond ? 'release-b' : 'release-a';

  return {
    data: {
      ...task,
      id,
      name: id === 'task-b' ? 'Review B' : task.name,
      about:
        !fields || fields.split(',').includes('about')
          ? { ...task.about, id: releaseId }
          : undefined,
      ontologyReview: {
        ...task.ontologyReview,
        entityId: releaseId,
      },
    },
  };
};
const reviewResponse = (url: string) => {
  const isSecond = url.includes('release-b');

  return {
    data: {
      ...review,
      task: {
        ...review.task,
        id: isSecond ? 'task-b' : 'task-a',
      },
      release: {
        ...review.release,
        id: isSecond ? 'release-b' : 'release-a',
      },
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  useApplicationStore.setState({
    currentUser: {
      id: 'reviewer',
      name: 'reviewer',
      email: 'reviewer@example.test',
    },
  });
  get.mockImplementation(async (url: string, config) => {
    if (url === '/ontologies/reviews') {
      return {
        data: {
          data: config.params.view === 'pending' ? [review] : [],
          paging: { total: config.params.view === 'pending' ? 42 : 0 },
        },
      };
    }
    if (url.startsWith('/tasks/')) {
      return taskResponse(url, config?.params?.fields);
    }
    if (url.endsWith('/review')) {
      return reviewResponse(url);
    }
    if (['/diff', '/events'].some((suffix) => url.endsWith(suffix))) {
      return { data: { data: [], paging: { total: 0 } } };
    }
    if (url.endsWith('/state')) {
      return { data: { ontologyId: 'ontology', activationRevision: 7 } };
    }
    if (url.startsWith('/permissions/')) {
      return {
        data: { permissions: [{ operation: 'EditAll', access: 'allow' }] },
      };
    }

    return {
      data: {
        ...release,
        id: url.includes('release-b') ? 'release-b' : 'release-a',
      },
    };
  });
});

it('uses pending paging.total and does not fetch detail while closed', async () => {
  renderWithQueryClient(<Harness />);

  expect(await screen.findByText('42')).toBeInTheDocument();
  expect(get.mock.calls.some(([url]) => url.startsWith('/tasks/'))).toBe(false);
});

it('opens a captured review with distinct review-identity and manifest digests', async () => {
  renderWithQueryClient(<Harness initialTask="task-a" />);

  expect(await screen.findByText('Review Commerce')).toBeInTheDocument();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
});

it('keeps one write admitted across close, reopen and task selection', async () => {
  let complete: (value: unknown) => void;
  post.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      })
  );
  renderWithQueryClient(<Harness initialTask="task-a" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.approve' }));
  fireEvent.click(screen.getByTestId('ontology-tasks-close'));
  fireEvent.click(screen.getByRole('button', { name: /label.task-plural/ }));
  fireEvent.click(screen.getByText('Task B'));

  expect(await screen.findByText('Review B')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'label.approve' })).toBeDisabled();
  expect(post).toHaveBeenCalledTimes(1);

  await act(async () =>
    complete({ data: { ...task, availableTransitions: [] } })
  );

  expect(screen.getByText('Review B')).toBeInTheDocument();
});

it('blocks voting when the real diff boundary denies captured content', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) =>
    url.endsWith('/diff')
      ? Promise.reject(new Error('denied'))
      : read?.(url, config)
  );
  renderWithQueryClient(<Harness initialTask="task-a" />);

  expect(
    await screen.findByText('message.ontology-review-unavailable')
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'label.approve' })).toBeDisabled();
});

it('keeps committed approval when activation conflicts and retries activation without voting again', async () => {
  const read = get.getMockImplementation();
  let approved = false;
  let revision = 7;
  get.mockImplementation((url, config) => {
    if (url.endsWith('/review')) {
      return Promise.resolve({
        data: {
          ...review,
          status: approved ? 'Approved' : 'In Review',
          callerCanVote: !approved,
          callerCompletesRule: !approved,
        },
      });
    }
    if (url === '/tasks/task-a') {
      return Promise.resolve({
        data: {
          ...task,
          status: approved ? 'Approved' : 'Open',
          availableTransitions: approved ? [] : task.availableTransitions,
        },
      });
    }
    if (url.startsWith('/permissions/')) {
      return Promise.resolve({
        data: { permissions: [{ operation: 'EditAll', access: 'allow' }] },
      });
    }
    if (url.endsWith('/state')) {
      return Promise.resolve({
        data: { ontologyId: 'ontology', activationRevision: revision },
      });
    }

    return read?.(url, config);
  });
  post.mockImplementation(async () => {
    approved = true;
    revision = 8;

    return { data: { ...task, status: 'Approved', availableTransitions: [] } };
  });
  put.mockRejectedValueOnce(new Error('conflict')).mockResolvedValueOnce({
    data: {
      ontologyId: 'ontology',
      activationRevision: 9,
      activeReleaseId: 'release-a',
    },
  });
  renderWithQueryClient(<Harness initialTask="task-a" />);
  const combined = await screen.findByTestId('ontology-approve-publish');
  await waitFor(() => expect(combined).toBeEnabled());
  fireEvent.click(combined);

  expect(
    await screen.findByText('message.ontology-review-activation-failed')
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('ontology-task-release-card')).getByText(
      'label.approved'
    )
  ).toBeInTheDocument();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.publish' })).toBeEnabled()
  );

  expect(put.mock.calls[0][1]).toEqual({
    releaseId: 'release-a',
    expectedActivationRevision: 7,
  });

  fireEvent.click(screen.getByRole('button', { name: 'label.publish' }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));

  expect(put.mock.calls[1][1]).toEqual({
    releaseId: 'release-a',
    expectedActivationRevision: 8,
  });
  expect(post).toHaveBeenCalledTimes(1);
});

it('requires a rejection reason and preserves its original text in the native payload', async () => {
  post.mockResolvedValue({ data: { ...task, status: 'Rejected' } });
  renderWithQueryClient(<Harness initialTask="task-a" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.reject' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.reject' }));
  const reason = screen.getByRole('textbox', { name: /label.reason/ });
  fireEvent.change(reason, { target: { value: '   ' } });

  expect(
    screen.getByRole('button', { name: 'label.reject-with-comment' })
  ).toBeDisabled();

  fireEvent.change(reason, { target: { value: '  Keep this reason.\n ' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'label.reject-with-comment' })
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/tasks/task-a/resolve', {
      transitionId: 'reject',
      resolutionType: 'Rejected',
      comment: '  Keep this reason.\n ',
    })
  );
});

it('says the approval was recorded, not that the release is approved, when other approvals are still required', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) =>
    url.endsWith('/review')
      ? Promise.resolve({ data: { ...review, callerCompletesRule: false } })
      : read?.(url, config)
  );
  post.mockResolvedValue({ data: { ...task, availableTransitions: [] } });
  renderWithQueryClient(<Harness initialTask="task-a" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.approve' }));

  await waitFor(() =>
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.vote-recorded-waiting-for-other-approvers'
    )
  );

  expect(showSuccessToast).not.toHaveBeenCalledWith(
    'message.ontology-task-approved'
  );
});

it('keeps a successful final vote approved when its reconciliation read fails', async () => {
  const read = get.getMockImplementation();
  let committed = false;
  get.mockImplementation((url, config) => {
    if (url === '/tasks/task-a' && committed) {
      return Promise.reject(new Error('read failed'));
    }
    if (url.endsWith('/review')) {
      return Promise.resolve({
        data: { ...review, callerCompletesRule: true },
      });
    }

    return read?.(url, config);
  });
  post.mockImplementation(async () => {
    committed = true;

    return { data: { ...task, status: 'Approved', availableTransitions: [] } };
  });
  renderWithQueryClient(<Harness initialTask="task-a" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.approve' }));

  expect(
    await within(
      await screen.findByTestId('ontology-task-release-card')
    ).findByText('label.approved')
  ).toBeInTheDocument();
  expect(
    await screen.findByText('message.ontology-review-unavailable')
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'label.approve' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'label.publish' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByTestId('ontology-only-author-publishes')
  ).toHaveTextContent('message.ontology-publication-only-author-publishes');
  expect(showSuccessToast).toHaveBeenCalledWith(
    'message.ontology-task-approved'
  );
});

it('keeps writes disabled after an ambiguous outcome until an authoritative read succeeds', async () => {
  const read = get.getMockImplementation();
  let uncertain = false;
  get.mockImplementation((url, config) =>
    url === '/tasks/task-a' && uncertain
      ? Promise.reject(new Error('offline'))
      : read?.(url, config)
  );
  post.mockImplementation(async () => {
    uncertain = true;

    throw new Error('response lost');
  });
  renderWithQueryClient(<Harness initialTask="task-a" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.approve' }));

  expect(
    await screen.findByText('message.ontology-review-write-uncertain')
  ).toBeInTheDocument();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeDisabled()
  );

  expect(post).toHaveBeenCalledTimes(1);

  uncertain = false;
  fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );

  expect(post).toHaveBeenCalledTimes(1);
});

it('rejects a direct review with another task identity', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) =>
    url.endsWith('/review')
      ? Promise.resolve({
          data: { ...review, task: { id: 'another-task', type: 'task' } },
        })
      : read?.(url, config)
  );
  renderWithQueryClient(<Harness initialTask="task-a" />);

  expect(
    await screen.findByText('message.ontology-review-unavailable')
  ).toBeInTheDocument();
  expect(screen.queryByTestId('ontology-task-detail')).not.toBeInTheDocument();
});

it('says there are no tasks yet when the queue is empty', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) =>
    url === '/ontologies/reviews' && config.params.limit === 25
      ? Promise.resolve({ data: { data: [], paging: { total: 0 } } })
      : read?.(url, config)
  );
  renderWithQueryClient(<Harness />);
  fireEvent.click(screen.getByTestId('ontology-tasks-trigger'));

  expect(await screen.findByTestId('ontology-tasks-empty')).toHaveTextContent(
    'message.ontology-no-tasks-yet'
  );
  expect(screen.getByTestId('ontology-tasks-empty')).toHaveTextContent(
    'message.ontology-tasks-assigned-empty'
  );
});

it('replaces after-only queue pages and resets the cursor when changing tabs', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) => {
    if (url === '/ontologies/reviews' && config.params.limit === 25) {
      const next = Boolean(config.params.after);

      return Promise.resolve({
        data: {
          data: [{ ...review, taskId: next ? 'TASK-NEXT' : 'TASK-FIRST' }],
          paging: { total: 26, after: next ? undefined : 'page-two' },
        },
      });
    }

    return read?.(url, config);
  });
  renderWithQueryClient(<Harness />);
  fireEvent.click(screen.getByTestId('ontology-tasks-trigger'));

  expect(await screen.findByText(/TASK-FIRST/)).toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole('tabpanel')).getByRole('button', {
      name: 'label.next',
    })
  );

  expect(await screen.findByText(/TASK-NEXT/)).toBeInTheDocument();
  expect(screen.queryByText(/TASK-FIRST/)).not.toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole('tabpanel')).getByRole('button', {
      name: 'label.previous',
    })
  );

  expect(await screen.findByText(/TASK-FIRST/)).toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole('tabpanel')).getByRole('button', {
      name: 'label.next',
    })
  );

  expect(await screen.findByText(/TASK-NEXT/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: /label.created-by-me/ }));

  expect(await screen.findByText(/TASK-FIRST/)).toBeInTheDocument();
  expect(
    get.mock.calls
      .filter(
        ([url, config]) =>
          url === '/ontologies/reviews' && config.params.limit === 25
      )
      .map(([, config]) => config.params)
  ).toEqual([
    { view: 'assigned', limit: 25, after: undefined },
    { view: 'assigned', limit: 25, after: 'page-two' },
    { view: 'assigned', limit: 25, after: undefined },
    { view: 'assigned', limit: 25, after: 'page-two' },
    { view: 'created', limit: 25, after: undefined },
  ]);
});

it('returns to page 1 with Previous after paging past the kept cursor history', async () => {
  const read = get.getMockImplementation();
  const label = (page: number) => 'PAGE-' + String(page).padStart(2, '0');
  get.mockImplementation((url, config) => {
    if (url === '/ontologies/reviews' && config.params.limit === 25) {
      const page = config.params.after
        ? Number(config.params.after.replace('cursor-', ''))
        : 1;

      return Promise.resolve({
        data: {
          data: [{ ...review, taskId: label(page) }],
          paging: { total: 45 * 25, after: 'cursor-' + (page + 1) },
        },
      });
    }

    return read?.(url, config);
  });
  const pageButton = (name: string) =>
    within(screen.getByRole('tabpanel')).getByRole<HTMLButtonElement>(
      'button',
      { name }
    );
  const isEnabled = (button: HTMLButtonElement) => !button.disabled;
  renderWithQueryClient(<Harness />);
  fireEvent.click(screen.getByTestId('ontology-tasks-trigger'));

  expect(await screen.findByText(/PAGE-01/)).toBeInTheDocument();

  for (let page = 2; page <= 45; page++) {
    fireEvent.click(pageButton('label.next'));

    expect(
      await screen.findByText(new RegExp(label(page)))
    ).toBeInTheDocument();
  }

  let presses = 0;
  while (presses < 50 && isEnabled(pageButton('label.previous'))) {
    fireEvent.click(pageButton('label.previous'));
    presses++;
    await waitFor(() => expect(pageButton('label.next')).toBeEnabled());
  }

  expect(pageButton('label.previous')).toBeDisabled();
  expect(
    get.mock.calls
      .filter(
        ([url, config]) =>
          url === '/ontologies/reviews' && config.params.limit === 25
      )
      .slice(-2)
      .map(([, config]) => config.params.after)
  ).toEqual(['cursor-7', undefined]);
  expect(screen.getByText(/PAGE-01/)).toBeInTheDocument();
}, 20_000);

it('does not invent a zero pending count when paging is unavailable', async () => {
  get.mockResolvedValue({ data: { data: [] } });
  renderWithQueryClient(<Harness />);

  expect(await screen.findByText('label.unavailable')).toBeInTheDocument();
  expect(screen.getByTestId('ontology-tasks-trigger')).not.toHaveTextContent(
    '0'
  );
});

it('keeps a held write admitted across an account change', async () => {
  let finish: (value: unknown) => void;
  post.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  renderWithQueryClient(<Harness initialTask="task-a" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.approve' }));
  act(() =>
    useApplicationStore.setState({
      currentUser: {
        id: 'other-reviewer',
        name: 'other-reviewer',
        email: 'other@example.com',
      },
    })
  );

  expect(await screen.findByText('Review Commerce')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'label.approve' })).toBeDisabled();

  await act(async () => finish({ data: task }));

  expect(post).toHaveBeenCalledTimes(1);
});

it('ignores an old task read after a different UUID becomes selected', async () => {
  const read = get.getMockImplementation();
  let finish: (value: unknown) => void;
  get.mockImplementation((url, config) =>
    url === '/tasks/task-a'
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : read?.(url, config)
  );
  renderWithQueryClient(<Harness initialTask="task-a" />);
  fireEvent.click(screen.getByText('Task B'));

  expect(await screen.findByText('Review B')).toBeInTheDocument();

  await act(async () => finish({ data: task }));

  expect(screen.queryByText('Review Commerce')).not.toBeInTheDocument();
  expect(screen.getByText('Review B')).toBeInTheDocument();
});

it('revokes readiness after a selected captured member is denied', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) => {
    if (url.endsWith('/diff')) {
      return Promise.resolve({
        data: {
          data: [
            {
              memberKind: 'CONCEPT',
              changeType: 'ADDED',
              entity: {
                id: 'customer',
                name: 'Customer',
                type: 'ontologyConcept',
              },
              afterReleaseId: 'release-a',
            },
          ],
          paging: { total: 1 },
        },
      });
    }
    if (url.includes('/members/')) {
      return Promise.reject(new Error('denied member'));
    }

    return read?.(url, config);
  });
  renderWithQueryClient(<Harness initialTask="task-a" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Customer' }));

  expect(
    await screen.findByText('message.ontology-review-unavailable')
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'label.approve' })).toBeDisabled();
});

it('posts two deliberate equal-text comments as two conversation entries', async () => {
  const read = get.getMockImplementation();
  const comments: {
    id: string;
    createdAt: number;
    author: typeof reviewer;
    message: string;
  }[] = [];
  get.mockImplementation((url, config) =>
    url === '/tasks/task-a'
      ? Promise.resolve({ data: { ...task, comments: [...comments] } })
      : read?.(url, config)
  );
  post.mockImplementation(async (url, body) => {
    expect(url).toBe('/tasks/task-a/comments');

    comments.push({
      id: String(comments.length),
      createdAt: comments.length + 1,
      author: reviewer,
      message: body.message,
    });

    return { data: { ...task, comments: [...comments] } };
  });
  renderWithQueryClient(<Harness initialTask="task-a" />);

  expect(await screen.findByText('Review Commerce')).toBeInTheDocument();

  for (let count = 1; count <= 2; count++) {
    const input = screen.getByRole('textbox', { name: /label.comment/ });
    fireEvent.change(input, { target: { value: 'Same words' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'label.send' })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.send' }));
    await waitFor(() =>
      expect(screen.getAllByText('Same words')).toHaveLength(count)
    );
    await waitFor(() => expect(input).toHaveValue(''));
  }

  expect(post.mock.calls.map(([, payload]) => payload)).toEqual([
    { message: 'Same words' },
    { message: 'Same words' },
  ]);
});

it('keeps approve available but disables combined publication when activation state is unavailable', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) => {
    if (url.endsWith('/review')) {
      return Promise.resolve({
        data: { ...review, callerCompletesRule: true },
      });
    }
    if (url.endsWith('/state')) {
      return Promise.reject(new Error('state unavailable'));
    }

    return read?.(url, config);
  });
  renderWithQueryClient(<Harness initialTask="task-a" />);

  expect(await screen.findByTestId('ontology-approve-publish')).toBeDisabled();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.approve' })).toBeEnabled()
  );
});

describe('the Studio review banner scope', () => {
  const reviewOf = (ontologyName: string, taskId: string) => ({
    ...review,
    ontology: { id: ontologyName, name: ontologyName, type: 'ontology' },
    task: { id: 'uuid-' + taskId, type: 'task' },
    taskId,
    callerCanVote: false,
    requester: { id: 'reviewer', name: 'reviewer', type: 'user' },
    assignees: [
      {
        assignee: { id: 'alice', name: 'alice', type: 'user' },
        status: 'Pending',
      },
    ],
  });
  const serveOpenReviews = (reviews: ReturnType<typeof reviewOf>[]) => {
    const read = get.getMockImplementation();
    get.mockImplementation(async (url: string, config) => {
      if (url === '/ontologies/reviews') {
        const scoped = reviews.filter(
          (item) =>
            !config.params.ontologyId ||
            item.ontology.id === config.params.ontologyId
        );

        return {
          data: {
            data: config.params.view === 'created' ? scoped : [],
            paging: { total: scoped.length },
          },
        };
      }
      if (url.startsWith('/ontologyReleases/')) {
        return { data: { ...release, semanticVersion: '0.1.0' } };
      }

      return read?.(url, config);
    });
  };

  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('announces only the review of the ontology in view', async () => {
    serveOpenReviews([
      reviewOf('Sales', 'TASK-1'),
      reviewOf('Finance', 'TASK-2'),
    ]);
    renderWithQueryClient(<Harness ontologyId="Finance" />);

    expect(
      await screen.findByTestId('ontology-review-banner')
    ).toHaveTextContent('Finance · v0.1.0 · ');
    expect(screen.getByTestId('ontology-review-banner')).toHaveTextContent(
      'TASK-2'
    );
    expect(screen.queryByText(/Sales/)).not.toBeInTheDocument();
  });

  it('shows no banner on an ontology whose only open review is another one', async () => {
    serveOpenReviews([reviewOf('Sales', 'TASK-1')]);
    renderWithQueryClient(<Harness ontologyId="Finance" />);

    await waitFor(() =>
      expect(screen.getByTestId('ontology-tasks-trigger')).toHaveTextContent(
        '1'
      )
    );

    expect(
      screen.queryByTestId('ontology-review-banner')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Sales/)).not.toBeInTheDocument();
  });

  it('asks the server for the ontology in view, so a review past the first 100 is still found', async () => {
    const crowd = Array.from({ length: 150 }, (_, index) =>
      reviewOf('Crowd' + index, 'TASK-C' + index)
    );
    serveOpenReviews([...crowd, reviewOf('Finance', 'TASK-LAST')]);
    renderWithQueryClient(<Harness ontologyId="Finance" />);

    expect(
      await screen.findByTestId('ontology-review-banner')
    ).toHaveTextContent('Finance · v0.1.0 · ');
    expect(screen.getByTestId('ontology-review-banner')).toHaveTextContent(
      'TASK-LAST'
    );

    const reviewReads = get.mock.calls
      .filter(([url]) => url === '/ontologies/reviews')
      .map(([, config]) => config.params);

    expect(reviewReads).toEqual(
      expect.arrayContaining([
        { view: 'pending', ontologyId: 'Finance', limit: 100 },
        { view: 'created', ontologyId: 'Finance', limit: 100 },
      ])
    );
  });

  it('lists one line per open review, naming its ontology, in All ontologies', async () => {
    serveOpenReviews([
      reviewOf('Sales', 'TASK-1'),
      reviewOf('Finance', 'TASK-2'),
    ]);
    renderWithQueryClient(<Harness ontologyId={null} />);

    const banner = await screen.findByTestId('ontology-open-reviews-banner');

    expect(
      within(banner)
        .getAllByText(/waiting on/)
        .map((line) => line.textContent)
    ).toEqual([
      'Sales · In review · waiting on alice · TASK-1',
      'Finance · In review · waiting on alice · TASK-2',
    ]);
  });
});

it('titles each queue row with the task title that names the ontology and version', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) =>
    url === '/ontologies/reviews' && config.params.limit === 25
      ? Promise.resolve({
          data: {
            data: [
              {
                ...review,
                task: { ...review.task, displayName: 'Review Sales v0.1.0' },
              },
              {
                ...review,
                taskId: 'TASK-00043',
                task: {
                  id: 'task-c',
                  type: 'task',
                  displayName: 'Review Finance v1.2.0',
                },
              },
            ],
            paging: { total: 2 },
          },
        })
      : read?.(url, config)
  );
  renderWithQueryClient(<Harness />);
  fireEvent.click(screen.getByTestId('ontology-tasks-trigger'));

  expect(
    await screen.findByRole('button', {
      name: 'TASK-00042 · Review Sales v0.1.0',
    })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'TASK-00043 · Review Finance v1.2.0' })
  ).toBeInTheDocument();
});

it('shows tab counts, a pending group and requester cards that the search narrows, without paging a single page', async () => {
  const read = get.getMockImplementation();
  get.mockImplementation((url, config) => {
    if (url !== '/ontologies/reviews' || config.params.view === 'pending') {
      return read?.(url, config);
    }
    if (config.params.limit === 1) {
      return Promise.resolve({
        data: {
          data: [],
          paging: { total: config.params.view === 'assigned' ? 3 : 5 },
        },
      });
    }

    return Promise.resolve({
      data: {
        data: [
          {
            ...review,
            task: { ...review.task, displayName: 'Review Sales v0.1.0' },
            requester: { id: 'priya', name: 'Priya Raman', type: 'user' },
          },
          {
            ...review,
            taskId: 'TASK-00043',
            task: {
              id: 'task-c',
              type: 'task',
              displayName: 'Review Finance v1.2.0',
            },
          },
        ],
        paging: { total: 2 },
      },
    });
  });
  renderWithQueryClient(<Harness initialTask="task-a" />);

  const assignedTab = await screen.findByRole('tab', {
    name: /label.assigned-to-me/,
  });
  await waitFor(() => expect(assignedTab).toHaveTextContent('3'));

  expect(
    screen.getByRole('tab', { name: /label.created-by-me/ })
  ).toHaveTextContent('5');

  const panel = screen.getByRole('tabpanel');

  expect(
    await within(panel).findByTestId('ontology-tasks-group')
  ).toHaveTextContent('label.pending-approval2');
  expect(within(panel).getByText('Priya Raman')).toBeInTheDocument();

  expect(
    within(panel).queryByRole('button', { name: 'label.next' })
  ).not.toBeInTheDocument();

  await screen.findByText('Review Commerce');

  expect(
    screen.queryByRole('button', { name: 'label.first' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('message.ontology-review-event-window')
  ).not.toBeInTheDocument();

  fireEvent.change(within(panel).getByRole('textbox'), {
    target: { value: 'finance' },
  });

  expect(
    within(panel).getByRole('button', {
      name: 'TASK-00043 · Review Finance v1.2.0',
    })
  ).toBeInTheDocument();
  expect(
    within(panel).queryByRole('button', {
      name: 'TASK-00042 · Review Sales v0.1.0',
    })
  ).not.toBeInTheDocument();
  expect(within(panel).getByTestId('ontology-tasks-group')).toHaveTextContent(
    'label.pending-approval1'
  );
});
