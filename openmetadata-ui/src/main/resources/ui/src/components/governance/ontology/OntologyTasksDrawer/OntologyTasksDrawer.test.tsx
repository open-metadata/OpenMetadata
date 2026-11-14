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
import OntologyTasksDrawer from './OntologyTasksDrawer';

// The Inbox task screen has its own tests; here it only has to receive the selected task.
jest.mock(
  '../../../discovery/personal-space/InboxPage/components/TaskDetailPanel',
  () => ({
    __esModule: true,
    default: ({ taskId }: { taskId: string }) => (
      <div data-testid="task-detail-panel">{taskId}</div>
    ),
  })
);

// Paging past the real 40-cursor history takes ~90 renders, too slow under CI coverage.
jest.mock('./OntologyTasksDrawer.utils', () => ({
  ...jest.requireActual('./OntologyTasksDrawer.utils'),
  CURSOR_HISTORY_LIMIT: 5,
}));

jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));
const get = APIClient.get as jest.Mock;
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

it('reopens on Assigned to me with an empty search after closing on Created by me', async () => {
  renderWithQueryClient(<Harness />);
  fireEvent.click(screen.getByTestId('ontology-tasks-trigger'));
  fireEvent.click(
    await screen.findByRole('tab', { name: /label.created-by-me/ })
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'label.search-tasks' }),
    { target: { value: 'commerce' } }
  );

  expect(
    screen.getByRole('tab', { name: /label.created-by-me/ })
  ).toHaveAttribute('aria-selected', 'true');

  fireEvent.click(screen.getByTestId('ontology-tasks-close'));
  fireEvent.click(screen.getByTestId('ontology-tasks-trigger'));

  expect(
    await screen.findByRole('tab', { name: /label.assigned-to-me/ })
  ).toHaveAttribute('aria-selected', 'true');
  expect(
    screen.getByRole('textbox', { name: 'label.search-tasks' })
  ).toHaveValue('');
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
          paging: { total: 8 * 25, after: 'cursor-' + (page + 1) },
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

  expect(await screen.findByText('#PAGE-01')).toBeInTheDocument();

  for (let page = 2; page <= 8; page++) {
    fireEvent.click(pageButton('label.next'));

    expect(await screen.findByText('#' + label(page))).toBeInTheDocument();
  }

  let presses = 0;
  while (presses < 10 && isEnabled(pageButton('label.previous'))) {
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
  ).toEqual(['cursor-5', undefined]);
  expect(screen.getByText('#PAGE-01')).toBeInTheDocument();
});

it('does not invent a zero pending count when paging is unavailable', async () => {
  get.mockResolvedValue({ data: { data: [] } });
  renderWithQueryClient(<Harness />);

  expect(await screen.findByText('label.unavailable')).toBeInTheDocument();
  expect(screen.getByTestId('ontology-tasks-trigger')).not.toHaveTextContent(
    '0'
  );
});

describe('the Studio review banner scope', () => {
  const reviewOf = (ontologyName: string, taskId: string) => ({
    ...review,
    ontology: { id: ontologyName, name: ontologyName, type: 'ontology' },
    task: { id: 'uuid-' + taskId, type: 'task' },
    taskId,
    callerCanVote: true,
    requester: { id: 'reviewer', name: 'reviewer', type: 'user' },
  });
  /** `pending` waits on the viewer's vote; `created` are the viewer's own open requests. */
  const serveOpenReviews = (
    pending: ReturnType<typeof reviewOf>[],
    created: ReturnType<typeof reviewOf>[] = []
  ) => {
    const read = get.getMockImplementation();
    get.mockImplementation(async (url: string, config) => {
      if (url === '/ontologies/reviews') {
        const scoped = (
          config.params.view === 'created' ? created : pending
        ).filter(
          (item) =>
            !config.params.ontologyId ||
            item.ontology.id === config.params.ontologyId
        );

        return { data: { data: scoped, paging: { total: scoped.length } } };
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
    ).toHaveTextContent('reviewer asked you to review v0.1.0');
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
    ).toHaveTextContent('reviewer asked you to review v0.1.0');

    const reviewReads = get.mock.calls
      .filter(([url]) => url === '/ontologies/reviews')
      .map(([, config]) => config.params);

    expect(reviewReads).toEqual(
      expect.arrayContaining([
        { view: 'pending', ontologyId: 'Finance', limit: 100 },
      ])
    );
  });

  it('disables the tasks trigger when the viewer has no tasks', async () => {
    serveOpenReviews([]);
    renderWithQueryClient(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId('ontology-tasks-trigger')).toBeDisabled()
    );
  });

  it('keeps the tasks trigger enabled when the viewer only created tasks', async () => {
    serveOpenReviews([], [reviewOf('Finance', 'TASK-2')]);
    renderWithQueryClient(<Harness />);
    const trigger = await screen.findByTestId('ontology-tasks-trigger');
    await waitFor(() => expect(trigger).toHaveTextContent('0'));
    // While any total is unknown the trigger is enabled regardless, so let
    // every review read settle before asserting.
    await act(async () => {
      await Promise.all(get.mock.results.map(({ value }) => value));
    });

    expect(screen.getByTestId('ontology-tasks-trigger')).toBeEnabled();
  });

  it("does not announce the viewer's own open request", async () => {
    serveOpenReviews([], [reviewOf('Finance', 'TASK-2')]);
    renderWithQueryClient(<Harness ontologyId="Finance" />);

    await waitFor(() =>
      expect(screen.getByTestId('ontology-tasks-trigger')).toHaveTextContent(
        '0'
      )
    );

    expect(
      screen.queryByTestId('ontology-review-banner')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-open-reviews-banner')
    ).not.toBeInTheDocument();
  });

  it('counts several reviews of the ontology in view in one pill', async () => {
    serveOpenReviews([
      reviewOf('Finance', 'TASK-1'),
      reviewOf('Finance', 'TASK-2'),
    ]);
    renderWithQueryClient(<Harness ontologyId="Finance" />);

    expect(
      await screen.findByTestId('ontology-open-reviews-banner')
    ).toHaveTextContent('2 reviews waiting on you');
    expect(
      screen.queryByTestId('ontology-review-banner')
    ).not.toBeInTheDocument();
  });

  it('counts the reviews waiting on the viewer in All ontologies', async () => {
    serveOpenReviews([
      reviewOf('Sales', 'TASK-1'),
      reviewOf('Finance', 'TASK-2'),
    ]);
    renderWithQueryClient(<Harness ontologyId={null} />);

    const banner = await screen.findByTestId('ontology-open-reviews-banner');

    expect(banner).toHaveTextContent('2 reviews waiting on you');
    expect(
      within(banner).getByRole('button', { name: 'Review' })
    ).toBeInTheDocument();
  });

  it('asks the viewer to review by name when one review waits on them', async () => {
    serveOpenReviews([reviewOf('Sales', 'TASK-1')]);
    renderWithQueryClient(<Harness ontologyId={null} />);

    expect(
      await screen.findByTestId('ontology-open-reviews-banner')
    ).toHaveTextContent('reviewer asked you to review Sales');
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

  // The rows are the Inbox's task rows: the task's title, then its short id.
  expect(await screen.findByTestId('inbox-task-task-a')).toHaveTextContent(
    /Review Sales v0\.1\.0.*#00042/
  );
  expect(screen.getByTestId('inbox-task-task-c')).toHaveTextContent(
    /Review Finance v1\.2\.0.*#00043/
  );
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

  // The queue column; the task detail beside it sits in the same tab panel.
  const panel = screen.getByTestId('ontology-tasks-queue');

  expect(
    await within(panel).findByTestId('ontology-tasks-group')
  ).toHaveTextContent('label.pending-approval2');
  expect(within(panel).getByText('Priya Raman')).toBeInTheDocument();

  expect(
    within(screen.getByTestId('ontology-tasks-queue')).queryByRole('button', {
      name: 'label.next',
    })
  ).not.toBeInTheDocument();

  // The selected task opens in the Inbox's own task screen.
  expect(await screen.findByTestId('task-detail-panel')).toHaveTextContent(
    'task-a'
  );

  expect(
    screen.queryByRole('button', { name: 'label.first' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('message.ontology-review-event-window')
  ).not.toBeInTheDocument();

  fireEvent.change(within(panel).getByRole('textbox'), {
    target: { value: 'finance' },
  });

  expect(within(panel).getByTestId('inbox-task-task-c')).toBeInTheDocument();
  expect(
    within(panel).queryByTestId('inbox-task-task-a')
  ).not.toBeInTheDocument();
  expect(within(panel).getByTestId('ontology-tasks-group')).toHaveTextContent(
    'label.pending-approval1'
  );
});
