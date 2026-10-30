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
import { applyPatch, Operation } from 'fast-json-patch';
import { MemoryRouter } from 'react-router-dom';
import {
  AssigneeStatus,
  OntologyReleaseReview,
  ReviewVoteDecision,
} from '../../../../generated/api/data/ontologyReleaseReview';
import {
  Ontology,
  OntologyApprovalRule,
} from '../../../../generated/entity/data/ontology';
import {
  EncodingVersion,
  EntityStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import { OntologyState } from '../../../../generated/type/ontologyState';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import APIClient from '../../../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyReleasePanel from './OntologyReleasePanel';

jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let ontology: Ontology;
let state: OntologyState;
let release: OntologyRelease;
let review: OntologyReleaseReview;
let historical: OntologyRelease | undefined;
const renderPanel = async (
  canEdit = true,
  view: 'changes' | 'releases' = 'changes'
) => {
  let result: ReturnType<typeof renderWithQueryClient> | undefined;
  await act(async () => {
    result = renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleasePanel
          canEdit={canEdit}
          ontology={ontology}
          view={view}
        />
      </MemoryRouter>
    );
  });
  if (!result) {
    throw new Error('Panel did not render');
  }
  await waitFor(() =>
    expect(screen.queryByTestId('ontology-release-stage')).toBeInTheDocument()
  );

  return result;
};
runQueryNotificationsSynchronously();

beforeEach(() => {
  historical = undefined;
  get.mockReset();
  (APIClient.post as jest.MockedFunction<typeof APIClient.post>).mockReset();
  (APIClient.patch as jest.MockedFunction<typeof APIClient.patch>).mockReset();
  (APIClient.put as jest.MockedFunction<typeof APIClient.put>).mockReset();
  sessionStorage.clear();
  useApplicationStore.setState({
    currentUser: { id: id(2), name: 'editor', email: 'editor@example.com' },
  });
  state = {
    ontologyId: id(1),
    workingRevision: 7,
    activationRevision: 3,
    lastReleaseRevision: 5,
    activeReleaseId: id(10),
  };
  ontology = {
    id: id(1),
    name: 'Sales',
    fullyQualifiedName: 'Sales',
    iri: 'urn:sales',
    namespace: 'urn:sales:',
    version: 0.1,
    reviewers: [{ id: id(3), type: 'user', name: 'reviewer' }],
    approvalRule: OntologyApprovalRule.AnyReviewer,
    publicationStatus: {
      unpublishedChanges: 1,
      reviewLock: {},
      latest: {
        releaseId: id(5),
        releaseRevision: 5,
        semanticVersion: '1.5.0',
        stage: Stage.Draft,
      },
      active: { releaseId: id(10), releaseRevision: 1 },
    },
  };
  release = {
    id: id(5),
    name: 'release-5',
    fullyQualifiedName: 'Sales.release-5',
    ontology: { id: id(1), type: 'ontology' },
    releaseRevision: 5,
    semanticVersion: '1.5.0',
    entityStatus: EntityStatus.Draft,
    sourceWorkingRevision: 7,
    sealedAt: 1,
    sealedBy: 'author',
    reviewAuthor: 'author',
    memberCount: 1,
    totalBytes: 100,
    ontologyIri: 'urn:sales',
    versionIri: 'urn:sales:5',
    baseReleaseId: id(10),
    contentDigest: 'a'.repeat(64),
    logicalCheck: LogicalCheck.NotRun,
    encodingVersion: EncodingVersion.OntologyReleaseV1,
    changeSummary: { added: 1, changed: 2, removed: 3, deprecated: 4 },
  };
  review = {
    ontology: { id: id(1), type: 'ontology' },
    release: { id: id(5), type: 'ontologyRelease' },
    task: { id: id(42), type: 'task' },
    taskId: 'TASK-00042',
    status: EntityStatus.InReview,
    approvalRule: OntologyApprovalRule.AllReviewers,
    assignees: [
      {
        assignee: { id: id(3), type: 'user', name: 'reviewer' },
        status: AssigneeStatus.Approved,
      },
      {
        assignee: { id: id(4), type: 'user', name: 'second reviewer' },
        status: AssigneeStatus.Pending,
      },
    ],
    callerCanVote: false,
    callerCompletesRule: false,
  };
  const releaseResponse = (url: string) => {
    if (url.endsWith('/releases')) {
      return {
        data: {
          data: ontology.publicationStatus?.latest
            ? [release, ...(historical ? [historical] : [])]
            : [],
          paging: { total: ontology.publicationStatus?.latest ? 1 : 0 },
        },
      };
    }
    if (url === `/ontologyReleases/${release.id}`) {
      return { data: release };
    }
    if (historical && url === `/ontologyReleases/${historical.id}`) {
      return { data: historical };
    }

    return undefined;
  };
  get.mockImplementation(async (url) => {
    const captured = releaseResponse(url);
    if (captured) {
      return captured;
    }
    if (url === `/ontologies/${ontology.id}`) {
      return { data: ontology };
    }
    if (url.endsWith('/working/diff')) {
      return { data: { state, data: [], paging: { total: 1 } } };
    }
    if (url.endsWith('/state')) {
      return { data: state };
    }
    if (url.endsWith('/review')) {
      return { data: review };
    }
    if (url.endsWith('/structure')) {
      return {
        data: {
          releaseId: release.id,
          contentDigest: release.contentDigest,
          valid: true,
          violationCount: 0,
          violations: [],
        },
      };
    }
    if (url.endsWith('/events') || url.endsWith('/diff')) {
      return { data: { data: [], paging: { total: 0 } } };
    }

    throw new Error(`Unexpected read ${url}`);
  });
});

const setStage = (stage: Stage) => {
  if (!ontology.publicationStatus?.latest) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.latest.stage = stage;
  const statusByStage = {
    [Stage.InReview]: EntityStatus.InReview,
    [Stage.ChangesRequested]: EntityStatus.Rejected,
    [Stage.Draft]: EntityStatus.Draft,
    [Stage.Approved]: EntityStatus.Approved,
    [Stage.Published]: EntityStatus.Approved,
  };
  release.entityStatus = statusByStage[stage];
  review.status = release.entityStatus;
  if ([Stage.InReview, Stage.ChangesRequested].includes(stage)) {
    release.reviewTask = review.task.id;
  }
  if (stage === Stage.ChangesRequested) {
    review.latestDecision = {
      user: { id: id(3), type: 'user', displayName: 'Deciding reviewer' },
      reason: '<b>Keep this literal.</b>\n  Fix “Customer”; preserve spaces.',
      timestamp: 1,
      decision: ReviewVoteDecision.Rejected,
    };
  }
  if (stage === Stage.Published) {
    state.activeReleaseId = release.id;
    ontology.publicationStatus.active = {
      releaseId: release.id,
      releaseRevision: release.releaseRevision,
    };
  }
};

it.each([
  [Stage.Draft, 'label.draft'],
  [Stage.InReview, 'label.in-review'],
  [Stage.ChangesRequested, 'label.changes-requested'],
  [Stage.Approved, 'label.approved'],
  [Stage.Published, 'label.published'],
])('renders the coherent %s stage', async (stage, label) => {
  setStage(stage as Stage);
  await renderPanel();

  expect(screen.queryByTestId('ontology-release-stage')).toHaveTextContent(
    label
  );
});

it('shows the human task label, UUID route and frozen All decisions while publication remains disabled', async () => {
  setStage(Stage.InReview);
  await renderPanel();

  expect(screen.queryByRole('link', { name: 'TASK-00042' })).toHaveAttribute(
    'href',
    `/tasks/${review.task.id}`
  );
  expect(screen.queryByTestId('ontology-publish-release')).toBeDisabled();

  const reviewers = screen.getByTestId('ontology-release-reviewers');

  expect(
    within(reviewers).getByRole('button', { name: /label.all/ })
  ).toBeDisabled();
  expect(within(reviewers).getByText('label.approved')).toBeVisible();
  expect(within(reviewers).getByText('label.pending')).toBeVisible();
});

it('publishes the captured server version and never uses the editable next-version preview', async () => {
  setStage(Stage.Approved);
  (
    APIClient.put as jest.MockedFunction<typeof APIClient.put>
  ).mockResolvedValue({
    data: { ...state, activeReleaseId: release.id, activationRevision: 4 },
  });
  await renderPanel();
  const publish = screen.getByTestId('ontology-publish-release');

  expect(publish).toHaveTextContent('1.5.0');
  expect(publish).not.toHaveTextContent('1.6.0');

  await act(async () => {
    fireEvent.click(publish);
  });

  expect(
    (APIClient.put as jest.MockedFunction<typeof APIClient.put>).mock.calls.map(
      ([, body]) => body
    )
  ).toEqual([{ releaseId: release.id, expectedActivationRevision: 3 }]);
});

it('renders the deciding actor and exact escaped rejection without permitting an unedited resubmission', async () => {
  setStage(Stage.ChangesRequested);
  await renderPanel();
  const reason = screen.getByTestId('ontology-rejection-reason');

  expect(reason.textContent).toBe(review.latestDecision?.reason);
  expect(reason.querySelector('b')).toBeNull();
  expect(reason).toHaveClass('tw:whitespace-pre-wrap');
  expect(screen.getByText('Deciding reviewer')).toBeVisible();
  expect(screen.getByTestId('ontology-request-review')).toBeDisabled();
  expect(APIClient.post).not.toHaveBeenCalled();
});

it.each([undefined, null, { unexpected: true }])(
  'does not treat an unusable lock (%s) as unlocked',
  async (lock) => {
    if (!ontology.publicationStatus) {
      throw new Error('Missing fixture');
    }
    Object.assign(ontology.publicationStatus, { reviewLock: lock });
    await renderPanel();

    expect(
      screen.getByRole('combobox', { name: /label.add-reviewer/ })
    ).toBeDisabled();
    expect(
      screen.getByText('message.ontology-review-lock-unavailable')
    ).toBeVisible();
  }
);

it('locks the latest Draft settings using an older open review from the owner projection', async () => {
  if (!ontology.publicationStatus) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.reviewLock = {
    inReview: {
      releaseId: id(4),
      releaseRevision: 4,
      semanticVersion: '1.4.0',
    },
  };
  await renderPanel();

  expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
    'label.draft'
  );
  expect(
    screen.getByRole('combobox', { name: /label.add-reviewer/ })
  ).toBeDisabled();
  expect(
    screen.getByText('message.ontology-review-settings-locked')
  ).toBeVisible();
});

it.each(['no changes', 'no reviewers', 'only caller', 'read only'])(
  'does not write with %s',
  async (reason) => {
    if (!ontology.publicationStatus) {
      throw new Error('Missing fixture');
    }
    if (reason === 'no changes') {
      ontology.publicationStatus.unpublishedChanges = 0;
    }
    if (reason === 'no reviewers') {
      ontology.reviewers = [];
    }
    if (reason === 'only caller') {
      ontology.reviewers = [{ id: id(2), type: 'user', name: 'editor' }];
    }
    await renderPanel(reason !== 'read only');

    expect(screen.getByTestId('ontology-request-review')).toBeDisabled();

    fireEvent.click(screen.getByTestId('ontology-request-review'));

    expect(APIClient.post).not.toHaveBeenCalled();
  }
);

it.each([false, true])(
  'uses the prospective review author when working content changed: %s',
  async (changed) => {
    ontology.reviewers = [{ id: id(3), type: 'user', name: 'author' }];
    state = { ...state, workingRevision: changed ? 8 : 7 };
    const original = { ...release };
    const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
    post.mockImplementation(async (url) => {
      if (url === `/ontologies/${ontology.id}/releases`) {
        release = {
          ...original,
          id: id(6),
          name: 'release-6',
          fullyQualifiedName: 'Sales.release-6',
          releaseRevision: 6,
          semanticVersion: '1.6.0',
          sourceWorkingRevision: 8,
          sealedBy: 'editor',
          reviewAuthor: 'editor',
          contentDigest: 'b'.repeat(64),
        };

        return { data: release };
      }
      if (url === '/tasks') {
        return {
          data: {
            id: id(43),
            taskId: 'TASK-00043',
            type: 'RequestApproval',
            about: { id: id(6), type: 'ontologyRelease' },
          },
        };
      }

      throw new Error(`Unexpected write ${url}`);
    });
    await renderPanel();
    const request = screen.getByTestId('ontology-request-review');
    if (!changed) {
      expect(request).toBeDisabled();

      fireEvent.click(request);

      expect(post).not.toHaveBeenCalled();

      return;
    }

    expect(request).toBeEnabled();

    await act(async () => fireEvent.click(request));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));

    expect(post.mock.calls.map(([url]) => url)).toEqual([
      `/ontologies/${ontology.id}/releases`,
      '/tasks',
    ]);
    expect(post.mock.calls[0][1]).toMatchObject({
      expectedWorkingRevision: 8,
      expectedActivationRevision: 3,
      expectedLatestReleaseRevision: 5,
      versionBump: 'minor',
    });
    expect(post.mock.calls[1][1]).toMatchObject({
      about: '<#E::ontologyRelease::Sales.release-6>',
      type: 'RequestApproval',
    });
    expect(release.reviewAuthor).toBe('editor');
    expect(original.reviewAuthor).toBe('author');
  }
);

const configureReviewerSearch = () => {
  const previous = get.getMockImplementation();
  get.mockImplementation(async (url, config) => {
    if (url.startsWith('/search/query')) {
      const teams =
        (config?.params as { index?: string } | undefined)?.index === 'team';
      const entries = teams
        ? [
            {
              id: id(8),
              name: 'review-team',
              displayName: 'Review team',
              teamType: 'Group',
            },
          ]
        : [
            { id: id(2), name: 'editor', displayName: 'Current editor' },
            { id: id(3), name: 'reviewer', displayName: 'Existing reviewer' },
            { id: id(6), name: 'author', displayName: 'Capture author' },
            { id: id(7), name: 'new-reviewer', displayName: 'New reviewer' },
          ];

      return {
        data: {
          hits: {
            hits: entries.map((entry) => ({ _source: entry })),
            total: { value: entries.length },
          },
        },
      };
    }
    if (!previous) {
      throw new Error('Missing fixture');
    }

    return previous(url, config);
  });
};

const openReviewerSearch = async () => {
  const input = screen.getByRole('combobox', { name: /label.add-reviewer/ });
  await act(async () => {
    input.focus();
  });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'ArrowDown' });
  });

  return input;
};

it('excludes caller, capture author, existing reviewers and teams when users are selected', async () => {
  configureReviewerSearch();
  await renderPanel();
  await openReviewerSearch();

  expect(
    await screen.findByRole('option', { name: /New reviewer/ })
  ).toBeVisible();
  expect(
    screen.queryByRole('option', {
      name: /Current editor|Capture author|Existing reviewer|Review team/,
    })
  ).not.toBeInTheDocument();
});

it('persists user addition and keyboard removal with the current ontology version test', async () => {
  configureReviewerSearch();
  const patch = APIClient.patch as jest.MockedFunction<typeof APIClient.patch>;
  patch.mockImplementation(async (_url, operations) => {
    ontology = {
      ...applyPatch(
        ontology,
        JSON.parse(JSON.stringify(operations)) as Operation[],
        true,
        false
      ).newDocument,
      version: (ontology.version ?? 0) + 0.1,
    };

    return { data: ontology };
  });
  const mounted = await renderPanel();
  await openReviewerSearch();
  await act(async () => {
    fireEvent.click(
      await screen.findByRole('option', { name: /New reviewer/ })
    );
  });

  expect(patch.mock.calls.map(([, body]) => body)).toEqual([
    [
      { op: 'test', path: '/version', value: 0.1 },
      {
        op: 'add',
        path: '/reviewers',
        value: [
          { id: id(3), type: 'user', name: 'reviewer' },
          {
            id: id(7),
            type: 'user',
            name: 'new-reviewer',
            displayName: 'New reviewer',
          },
        ],
      },
      {
        op: 'add',
        path: '/approvalRule',
        value: OntologyApprovalRule.AnyReviewer,
      },
    ],
  ]);

  await waitFor(() =>
    expect(ontology.reviewers?.map((entry) => entry.id)).toEqual([id(3), id(7)])
  );
  const tags = within(
    screen.getByTestId('ontology-release-reviewers')
  ).getByRole('grid', { name: 'label.reviewers' });
  const row = within(tags).getByRole('row', { name: /New reviewer/ });
  await waitFor(() => expect(row).not.toHaveAttribute('aria-disabled', 'true'));
  await act(async () => {
    row.focus();
    fireEvent.keyDown(row, { key: 'Delete' });
  });
  await waitFor(() => expect(ontology.reviewers).toHaveLength(1));

  expect((patch.mock.calls[1][1] as Operation[])[0]).toEqual({
    op: 'test',
    path: '/version',
    value: 0.2,
  });

  mounted.unmount();
  await renderPanel();

  expect(
    within(screen.getByTestId('ontology-release-reviewers')).queryByRole(
      'row',
      { name: /New reviewer/ }
    )
  ).not.toBeInTheDocument();
});

it('allows one group team with All and disables adding another entry', async () => {
  ontology.reviewers = [];
  configureReviewerSearch();
  (
    APIClient.patch as jest.MockedFunction<typeof APIClient.patch>
  ).mockImplementation(async (_url, operations) => {
    ontology = {
      ...applyPatch(
        ontology,
        JSON.parse(JSON.stringify(operations)) as Operation[],
        true,
        false
      ).newDocument,
      version: 0.2,
    };

    return { data: ontology };
  });
  await renderPanel();
  await openReviewerSearch();
  await act(async () => {
    fireEvent.click(await screen.findByRole('option', { name: /Review team/ }));
  });

  await waitFor(() =>
    expect(ontology.reviewers?.map((entry) => entry.id)).toEqual([id(8)])
  );

  expect(
    screen.getByRole('combobox', { name: /label.add-reviewer/ })
  ).toBeDisabled();
  expect(screen.getByText('message.ontology-one-team-reviewer')).toBeVisible();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /label.any-one/ }));
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole('option', { name: 'label.all' }));
  });

  expect(ontology.approvalRule).toBe(OntologyApprovalRule.AllReviewers);
  expect(ontology.reviewers).toHaveLength(1);
  expect(ontology.reviewers?.[0].type).toBe('team');
});

it('refreshes and shows an inline conflict when another editor locks settings during PATCH', async () => {
  configureReviewerSearch();
  (
    APIClient.patch as jest.MockedFunction<typeof APIClient.patch>
  ).mockImplementation(async () => {
    if (!ontology.publicationStatus) {
      throw new Error('Missing fixture');
    }
    ontology.publicationStatus.reviewLock = {
      inReview: {
        releaseId: id(4),
        releaseRevision: 4,
        semanticVersion: '1.4.0',
      },
    };

    throw { isAxiosError: true, response: { status: 409 } };
  });
  await renderPanel();
  await openReviewerSearch();
  await act(async () => {
    fireEvent.click(
      await screen.findByRole('option', { name: /New reviewer/ })
    );
  });

  expect(
    screen.getByText('message.ontology-review-settings-conflict')
  ).toBeVisible();
  expect(
    screen.getByRole('combobox', { name: /label.add-reviewer/ })
  ).toBeDisabled();
  expect(
    within(screen.getByTestId('ontology-release-reviewers')).queryByRole(
      'row',
      { name: /New reviewer/ }
    )
  ).not.toBeInTheDocument();
  expect(ontology.reviewers).toHaveLength(1);
});

it('shows a failed reviewer search and retries without treating it as an empty result', async () => {
  configureReviewerSearch();
  const previous = get.getMockImplementation();
  let denied = true;
  get.mockImplementation(async (url, config) => {
    if (denied && url.startsWith('/search/query')) {
      throw new Error('Search unavailable');
    }
    if (!previous) {
      throw new Error('Missing fixture');
    }

    return previous(url, config);
  });
  await renderPanel();
  await openReviewerSearch();
  const reviewers = screen.getByTestId('ontology-release-reviewers');

  expect(within(reviewers).getByRole('alert')).toHaveTextContent(
    'message.ontology-reviewer-search-unavailable'
  );
  expect(
    screen.queryByRole('option', { name: /New reviewer/ })
  ).not.toBeInTheDocument();

  denied = false;
  await act(async () => {
    fireEvent.click(
      within(reviewers).getByRole('button', { name: 'label.retry' })
    );
  });
  await openReviewerSearch();

  expect(
    await screen.findByRole('option', { name: /New reviewer/ })
  ).toBeVisible();
  expect(APIClient.patch).not.toHaveBeenCalled();
});

it('does not select retained search results while the next input is pending', async () => {
  configureReviewerSearch();
  await renderPanel();
  const input = await openReviewerSearch();

  expect(
    await screen.findByRole('option', { name: /New reviewer/ })
  ).toBeVisible();

  fireEvent.change(input, { target: { value: 'new term' } });
  const retained = screen.getByRole('option', { name: /New reviewer/ });

  expect(retained).toHaveAttribute('aria-disabled', 'true');

  fireEvent.click(retained);

  expect(APIClient.patch).not.toHaveBeenCalled();
});

it('renders a fresh working Draft and the initial semantic version without a captured candidate', async () => {
  ontology.publicationStatus = { unpublishedChanges: 1, reviewLock: {} };
  state = {
    ontologyId: ontology.id,
    workingRevision: 1,
    activationRevision: 0,
    lastReleaseRevision: 0,
  };
  await renderPanel();

  expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
    'label.draft'
  );
  expect(screen.getByTestId('ontology-version-preview')).toHaveTextContent(
    '0.0.0 → 1.0.0'
  );
  expect(screen.getByTestId('ontology-request-review')).toBeEnabled();
  expect(screen.queryByText('label.loading')).not.toBeInTheDocument();
});

it('keeps the current InReview footer when an older Approved release is selected for rollback', async () => {
  setStage(Stage.InReview);
  historical = {
    ...release,
    id: id(4),
    releaseRevision: 4,
    semanticVersion: '1.4.0',
    entityStatus: EntityStatus.Approved,
    reviewTask: undefined,
  };
  const { queryClient } = await renderPanel(true, 'releases');
  await act(async () => {
    fireEvent.click(screen.getByTestId(`ontology-release-select-${id(4)}`));
  });

  expect(
    await screen.findByTestId('ontology-release-definition')
  ).toBeVisible();
  expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
    'label.in-review'
  );
  expect(screen.getByTestId('ontology-publish-release')).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'label.activate-release' })
  ).toBeEnabled();
  expect(screen.getByRole('link', { name: 'TASK-00042' })).toHaveAttribute(
    'href',
    `/tasks/${review.task.id}`
  );
  expect(
    screen.queryByRole('button', { name: 'label.request-approval' })
  ).not.toBeInTheDocument();

  release = {
    ...release,
    id: id(6),
    name: 'release-6',
    releaseRevision: 6,
    entityStatus: EntityStatus.Draft,
    reviewTask: undefined,
  };
  state = { ...state, lastReleaseRevision: 6, workingRevision: 8 };
  if (!ontology.publicationStatus) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.latest = {
    releaseId: release.id,
    releaseRevision: 6,
    semanticVersion: release.semanticVersion,
    stage: Stage.Draft,
  };
  await act(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['ontology-publication', ontology.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['ontology-state', ontology.id],
      }),
    ]);
  });

  expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
    'label.draft'
  );
  expect(
    screen.getByTestId(`ontology-release-select-${id(4)}`)
  ).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTestId('ontology-release-definition')).toHaveTextContent(
    historical.name
  );
  expect(
    screen.getByRole('button', { name: 'label.activate-release' })
  ).toBeEnabled();
});

it('clears visible reviewers and assignees when another user cannot read this ontology', async () => {
  setStage(Stage.InReview);
  await renderPanel();

  expect(screen.getAllByText('second reviewer').length).toBeGreaterThan(0);

  get.mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
  await act(async () => {
    useApplicationStore.setState({
      currentUser: { id: id(90), name: 'other', email: 'other@example.com' },
    });
  });

  expect(screen.queryAllByText('second reviewer')).toHaveLength(0);
  expect(
    screen.queryByRole('row', { name: /reviewer/ })
  ).not.toBeInTheDocument();
});

it('clears retained reviewer names when the panel changes to a denied ontology', async () => {
  const mounted = await renderPanel();

  expect(screen.getByRole('row', { name: /reviewer/ })).toBeVisible();

  get.mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
  await act(async () => {
    mounted.rerender(
      <MemoryRouter>
        <OntologyReleasePanel
          canEdit
          ontology={{ ...ontology, id: id(90) }}
          view="changes"
        />
      </MemoryRouter>
    );
  });

  expect(
    screen.queryByRole('row', { name: /reviewer/ })
  ).not.toBeInTheDocument();
});

it.each(['projection', 'review'])(
  'clears protected reviewer details after same-scope %s denial and restores fresh data on retry',
  async (deniedRead) => {
    setStage(Stage.InReview);
    if (!ontology.publicationStatus) {
      throw new Error('Missing fixture');
    }
    ontology.publicationStatus.reviewLock = {
      inReview: {
        releaseId: release.id,
        releaseRevision: release.releaseRevision,
        semanticVersion: '1.5.0',
      },
    };
    const mounted = await renderPanel();
    const reviewers = screen.getByTestId('ontology-release-reviewers');

    expect(
      within(reviewers).getAllByText('second reviewer').length
    ).toBeGreaterThan(0);
    expect(within(reviewers).getByText('label.approved')).toBeVisible();
    expect(within(reviewers).getAllByText('reviewer').length).toBeGreaterThan(
      0
    );

    const originalGet = get.getMockImplementation();
    let denied = true;
    get.mockImplementation(async (url, ...args) => {
      if (
        denied &&
        (deniedRead === 'projection'
          ? url === `/ontologies/${ontology.id}`
          : url.endsWith('/review'))
      ) {
        throw { isAxiosError: true, response: { status: 403 } };
      }

      return originalGet?.(url, ...args);
    });
    await act(async () => {
      await mounted.queryClient.invalidateQueries({
        queryKey: [
          deniedRead === 'projection'
            ? 'ontology-publication'
            : 'ontology-release-review',
          ontology.id,
        ],
      });
    });

    await waitFor(() =>
      expect(
        screen.getAllByText('message.ontology-review-unavailable').length
      ).toBeGreaterThan(0)
    );

    expect(screen.queryAllByText('second reviewer')).toHaveLength(0);
    expect(
      screen.queryByTestId('ontology-release-reviewers')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('message.ontology-review-settings-unavailable')
    ).toBeVisible();
    expect(APIClient.patch).not.toHaveBeenCalled();

    denied = false;
    ontology.reviewers = [{ id: id(6), type: 'user', name: 'new-reviewer' }];
    review.assignees = [
      {
        assignee: { id: id(6), type: 'user', name: 'new-reviewer' },
        status: AssigneeStatus.Pending,
      },
    ];
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', { name: 'label.retry' })[0]
      );
    });
    await waitFor(() =>
      expect(
        within(screen.getByTestId('ontology-release-reviewers')).getAllByText(
          'new-reviewer'
        ).length
      ).toBeGreaterThan(0)
    );

    expect(screen.queryAllByText('second reviewer')).toHaveLength(0);
    expect(APIClient.patch).not.toHaveBeenCalled();
  }
);

it('clears a pending reviewer search after same-scope denial', async () => {
  configureReviewerSearch();
  const mounted = await renderPanel();
  const picker = screen.getByRole('combobox', { name: /label.add-reviewer/ });
  fireEvent.change(picker, { target: { value: 'private search' } });

  expect(picker).toHaveValue('private search');

  const originalGet = get.getMockImplementation();
  let denied = true;
  get.mockImplementation(async (url, ...args) => {
    if (denied && url === `/ontologies/${ontology.id}`) {
      throw { isAxiosError: true, response: { status: 403 } };
    }

    return originalGet?.(url, ...args);
  });
  await act(async () => {
    await mounted.queryClient.invalidateQueries({
      queryKey: ['ontology-publication', ontology.id],
    });
  });
  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-release-reviewers')
    ).not.toBeInTheDocument()
  );
  denied = false;
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'label.retry' })[0]);
  });
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: /label.add-reviewer/ })
    ).toHaveValue('')
  );
});

it('does not transfer an old settings failure or pending search to a new user', async () => {
  configureReviewerSearch();
  let rejectPatch: ((reason: unknown) => void) | undefined;
  (
    APIClient.patch as jest.MockedFunction<typeof APIClient.patch>
  ).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectPatch = reject;
      })
  );
  await renderPanel();
  await openReviewerSearch();
  await act(async () => {
    fireEvent.click(screen.getByRole('option', { name: /New reviewer/ }));
  });

  expect(
    screen.getByRole('combobox', { name: /label.add-reviewer/ })
  ).toBeDisabled();

  await act(async () => {
    useApplicationStore.setState({
      currentUser: { id: id(90), name: 'other', email: 'other@example.com' },
    });
  });
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: /label.add-reviewer/ })
    ).toBeEnabled()
  );
  await act(async () => {
    rejectPatch?.({ isAxiosError: true, response: { status: 403 } });
  });

  expect(
    screen.queryByText('message.ontology-review-settings-unavailable')
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: /label.add-reviewer/ })
  ).toHaveValue('');
});

it('reconciles a lost settings response from the fresh stored settings without a second PATCH', async () => {
  configureReviewerSearch();
  const patch = APIClient.patch as jest.MockedFunction<typeof APIClient.patch>;
  patch.mockImplementation(async (_url, operations) => {
    ontology = {
      ...applyPatch(
        ontology,
        JSON.parse(JSON.stringify(operations)) as Operation[],
        true,
        false
      ).newDocument,
      version: 0.2,
    };

    throw new Error('Response lost after commit');
  });
  await renderPanel();
  await openReviewerSearch();
  await act(async () => {
    fireEvent.click(screen.getByRole('option', { name: /New reviewer/ }));
  });

  await waitFor(() =>
    expect(ontology.reviewers?.map((entry) => entry.id)).toEqual([id(3), id(7)])
  );

  expect(screen.getByRole('row', { name: /New reviewer/ })).toBeVisible();
  expect(
    screen.queryByText('message.ontology-review-settings-unavailable')
  ).not.toBeInTheDocument();
  expect(patch.mock.calls.length).toBe(1);
  expect(
    screen.getByRole('combobox', { name: /label.add-reviewer/ })
  ).toBeEnabled();
});

it('shows validation unavailable without disabling the approved current stage', async () => {
  setStage(Stage.Approved);
  await renderPanel();

  expect(
    screen.getByText('message.ontology-validation-unavailable')
  ).toBeVisible();
  expect(screen.getByTestId('ontology-publish-release')).toBeEnabled();
});

it('counts only disjoint top-level changes and distinguishes latest from active', async () => {
  historical = {
    ...release,
    id: id(10),
    releaseRevision: 1,
    semanticVersion: '1.0.0',
    memberCount: 999,
  };
  await renderPanel(true, 'releases');

  expect(
    screen.queryByTestId(`ontology-release-count-${release.id}`)
  ).toHaveTextContent('10 label.change-plural');

  const currentRow = screen
    .getByTestId(`ontology-release-select-${release.id}`)
    .closest('li');
  const activeRow = screen
    .getByTestId(`ontology-release-select-${historical.id}`)
    .closest('li');
  if (!currentRow || !activeRow) {
    throw new Error('Missing release row');
  }

  expect(within(currentRow).getByText('label.latest')).toBeVisible();
  expect(
    within(currentRow).queryByText('label.active')
  ).not.toBeInTheDocument();
  expect(within(activeRow).getByText('label.active')).toBeVisible();
  expect(within(activeRow).queryByText('label.latest')).not.toBeInTheDocument();
  expect(within(activeRow).queryByText(/999/)).not.toBeInTheDocument();
});

it.each(['absent', 'missing-deprecated'])(
  'shows an unavailable history count for an old %s summary',
  async (kind) => {
    release.changeSummary =
      kind === 'absent' ? undefined : { added: 1, changed: 2, removed: 3 };
    await renderPanel(true, 'releases');

    expect(
      screen.queryByTestId(`ontology-release-count-${release.id}`)
    ).toHaveTextContent('message.ontology-change-summary-unavailable');
  }
);

it('never labels an old first history row Latest when the current candidate is absent from that page', async () => {
  historical = {
    ...release,
    id: id(4),
    releaseRevision: 4,
    semanticVersion: '1.4.0',
  };
  const previous = get.getMockImplementation();
  get.mockImplementation(async (url, config) => {
    if (url.endsWith('/releases')) {
      return { data: { data: [historical], paging: { total: 1 } } };
    }
    if (!previous) {
      throw new Error('Missing fixture');
    }

    return previous(url, config);
  });
  await renderPanel(true, 'releases');

  expect(screen.getByTestId(`ontology-release-select-${id(4)}`)).toBeVisible();
  expect(screen.queryByText('label.latest')).not.toBeInTheDocument();
});

it('preserves numeric server revision order for unversioned, 1.10, 1.9 and rejected history', async () => {
  const rows = [
    { ...release, id: id(12), releaseRevision: 12, semanticVersion: undefined },
    { ...release, id: id(11), releaseRevision: 11, semanticVersion: '1.10.0' },
    { ...release, id: id(10), releaseRevision: 10, semanticVersion: '1.9.0' },
    {
      ...release,
      id: id(9),
      releaseRevision: 9,
      semanticVersion: '1.8.0',
      entityStatus: EntityStatus.Rejected,
    },
  ];
  release = rows[0];
  state.lastReleaseRevision = 12;
  if (!ontology.publicationStatus) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.latest = {
    releaseId: release.id,
    releaseRevision: 12,
    stage: Stage.Draft,
  };
  const previous = get.getMockImplementation();
  get.mockImplementation(async (url, config) => {
    if (url.endsWith('/releases')) {
      return { data: { data: rows, paging: { total: 4 } } };
    }
    if (!previous) {
      throw new Error('Missing fixture');
    }

    return previous(url, config);
  });
  await renderPanel(true, 'releases');
  const history = screen.getByTestId('ontology-release-history');

  expect(
    within(history)
      .getAllByTestId(/^ontology-release-select-/)
      .map((entry) => entry.getAttribute('data-testid'))
  ).toEqual(rows.map((entry) => `ontology-release-select-${entry.id}`));
});

it.each(['user', 'ontology'])(
  'resets version and release notes when the editor %s changes',
  async (scope) => {
    const mounted = await renderPanel();
    fireEvent.change(
      screen.getByRole('textbox', { name: /label.release-notes/ }),
      { target: { value: 'Original private notes' } }
    );
    fireEvent.click(screen.getByRole('radio', { name: /label.version-patch/ }));
    await act(async () => {
      if (scope === 'user') {
        useApplicationStore.setState({
          currentUser: {
            id: id(90),
            name: 'other',
            email: 'other@example.com',
          },
        });
      } else {
        ontology = { ...ontology, id: id(90) };
        state = { ...state, ontologyId: ontology.id };
        release = {
          ...release,
          ontology: { id: ontology.id, type: 'ontology' },
        };
        mounted.rerender(
          <MemoryRouter>
            <OntologyReleasePanel canEdit ontology={ontology} view="changes" />
          </MemoryRouter>
        );
      }
    });

    expect(
      screen.getByRole('textbox', { name: /label.release-notes/ })
    ).toHaveValue('');
    expect(
      screen.getByRole('radio', { name: /label.version-patch/ })
    ).not.toBeChecked();
  }
);
