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
import { useQuery } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { applyPatch, Operation } from 'fast-json-patch';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
import { ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY } from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import APIClient from '../../../../rest/axiosClient';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyReleasePanel from './OntologyReleasePanel';

const activationButton = () =>
  screen.queryByTestId('ontology-rollback-release') ??
  screen.getByRole('button', { name: 'label.activate-release' });
jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

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
let activeReleaseRevision = 1;
let reviewMissing = false;
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
  (useIsAiMode as jest.Mock).mockReturnValue(false);
  historical = undefined;
  activeReleaseRevision = 1;
  reviewMissing = false;
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
    if (url === `/ontologyReleases/${id(10)}`) {
      return {
        data: {
          ...release,
          id: id(10),
          releaseRevision: activeReleaseRevision,
          semanticVersion: '1.5.0',
          entityStatus: EntityStatus.Approved,
          baseReleaseId: undefined,
          reviewTask: undefined,
        },
      };
    }
    if (historical && url === `/ontologyReleases/${historical.id}`) {
      return { data: historical };
    }

    return undefined;
  };
  const emptyPage = () => ({ data: { data: [], paging: { total: 0 } } });
  const reviewResponse = () => {
    if (reviewMissing) {
      throw new AxiosError('No open review', '404');
    }

    return { data: review };
  };
  const suffixResponses: [string, () => unknown][] = [
    [
      '/working/diff',
      () => ({ data: { state, data: [], paging: { total: 1 } } }),
    ],
    ['/working/validation', () => ({ data: { valid: true, violations: [] } })],
    ['/state', () => ({ data: state })],
    ['/review', reviewResponse],
    [
      '/structure',
      () => ({
        data: {
          releaseId: release.id,
          contentDigest: release.contentDigest,
          valid: true,
          violationCount: 0,
          violations: [],
        },
      }),
    ],
    ['/events', emptyPage],
    ['/diff', emptyPage],
  ];
  get.mockImplementation(async (url) => {
    const captured = releaseResponse(url);
    if (captured) {
      return captured;
    }
    if (url === `/ontologies/${ontology.id}`) {
      return { data: ontology };
    }
    const respond = suffixResponses.find(([suffix]) =>
      url.endsWith(suffix)
    )?.[1];
    if (!respond) {
      throw new Error(`Unexpected read ${url}`);
    }

    return respond();
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

/** The configured reviewer whose name matches, from the Reviewers card's list. */
const reviewerItem = (name: RegExp) =>
  Array.from(
    screen
      .queryByTestId('ontology-release-reviewer-list')
      ?.querySelectorAll('li') ?? []
  ).find((item) => name.test(item.textContent ?? '')) ?? null;

it('keeps independent reviewer configuration and the review stage available in AI mode', async () => {
  (useIsAiMode as jest.Mock).mockReturnValue(true);
  setStage(Stage.Draft);
  await renderPanel();

  expect(screen.getByTestId('ontology-release-reviewers')).toBeVisible();
  expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
    'label.draft'
  );
});

it('shows the rejection reason and review task in AI mode', async () => {
  (useIsAiMode as jest.Mock).mockReturnValue(true);
  setStage(Stage.ChangesRequested);
  await renderPanel();

  expect(screen.getByTestId('ontology-rejection-reason')).toHaveTextContent(
    'Keep this literal.'
  );
  expect(screen.getByRole('link', { name: 'TASK-00042' })).toHaveAttribute(
    'href',
    `/tasks/${review.task.id}`
  );
  expect(screen.getByTestId('ontology-request-review')).toBeDisabled();
});

it.each([
  [Stage.Draft, 'label.draft'],
  [Stage.InReview, 'label.ontology-in-review'],
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
  expect(screen.getByTestId('ontology-publication-text')).toHaveTextContent(
    'message.ontology-publication-waiting-for'
  );

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

it.each(['no changes', 'only caller'])(
  'does not write with %s',
  async (reason) => {
    if (!ontology.publicationStatus) {
      throw new Error('Missing fixture');
    }
    if (reason === 'no changes') {
      ontology.publicationStatus.unpublishedChanges = 0;
    }
    if (reason === 'only caller') {
      ontology.reviewers = [{ id: id(2), type: 'user', name: 'editor' }];
    }
    await renderPanel();
    const primary = screen.getByTestId(
      reason === 'no changes'
        ? 'ontology-publish-release'
        : 'ontology-request-review'
    );

    expect(primary).toBeDisabled();

    fireEvent.click(primary);

    expect(APIClient.post).not.toHaveBeenCalled();
    expect(APIClient.put).not.toHaveBeenCalled();
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
  const list = within(
    screen.getByTestId('ontology-release-reviewers')
  ).getByRole('list', { name: 'label.reviewers' });
  const remove = await within(
    within(list).getByText('New reviewer').closest('li') as HTMLElement
  ).findByRole('button');
  await act(async () => {
    remove.focus();
    fireEvent.keyDown(remove, { key: 'Enter' });
    fireEvent.keyUp(remove, { key: 'Enter' });
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
    within(screen.getByTestId('ontology-release-reviewer-list')).queryByText(
      'New reviewer'
    )
  ).not.toBeInTheDocument();
});

it('keeps the reviewer list closed after a pick while the addition saves', async () => {
  configureReviewerSearch();
  let finishPatch: () => void = () => undefined;
  (
    APIClient.patch as jest.MockedFunction<typeof APIClient.patch>
  ).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishPatch = () => resolve({ data: ontology });
      })
  );
  await renderPanel();
  const input = await openReviewerSearch();
  fireEvent.change(input, { target: { value: 'new' } });
  const option = await screen.findByRole('option', { name: /New reviewer/ });
  await waitFor(() =>
    expect(option).not.toHaveAttribute('aria-disabled', 'true')
  );
  await act(async () => {
    fireEvent.click(option);
  });

  // Disabling the focused input blurs it, and focus restored after the save
  // reopened the list over the dialog.
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
  expect(input).not.toBeDisabled();
  expect(input).toHaveAttribute('readonly');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

  await act(async () => {
    finishPatch();
  });

  expect(input).toHaveFocus();
  expect(input).not.toHaveAttribute('readonly');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('keeps the reviewer list open from focus until the first search returns', async () => {
  configureReviewerSearch();
  const search = get.getMockImplementation();
  let releaseSearch: () => void = () => undefined;
  const searchGate = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });
  get.mockImplementation(async (url, config) => {
    if (!search) {
      throw new Error('Missing fixture');
    }
    if (url.startsWith('/search/query')) {
      await searchGate;
    }

    return search(url, config);
  });
  await renderPanel();
  const input = screen.getByRole('combobox', { name: /label.add-reviewer/ });
  await act(async () => {
    input.focus();
  });

  // Closing the empty list here raced text typed right after the focus,
  // which then never reopened it.
  expect(screen.getByRole('listbox')).toHaveTextContent('label.loading');

  fireEvent.change(input, { target: { value: 'new' } });
  await act(async () => {
    releaseSearch();
  });

  expect(
    await screen.findByRole('option', { name: /New reviewer/ })
  ).toBeInTheDocument();
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
  expect(reviewerItem(/New reviewer/)).toBeNull();
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
    'label.draft → v0.1.0'
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
    'label.ontology-in-review'
  );
  expect(screen.getByTestId('ontology-publish-release')).toBeDisabled();
  expect(activationButton()).toBeEnabled();
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
    `v${historical.semanticVersion}`
  );
  expect(activationButton()).toBeEnabled();
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
  expect(reviewerItem(/reviewer/)).toBeNull();
});

it('clears retained reviewer names when the panel changes to a denied ontology', async () => {
  const mounted = await renderPanel();

  expect(reviewerItem(/reviewer/)).toBeVisible();

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

  expect(reviewerItem(/reviewer/)).toBeNull();
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
  ).toHaveAttribute('readonly');

  await act(async () => {
    useApplicationStore.setState({
      currentUser: { id: id(90), name: 'other', email: 'other@example.com' },
    });
  });
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: /label.add-reviewer/ })
    ).not.toHaveAttribute('readonly')
  );

  expect(
    screen.getByRole('combobox', { name: /label.add-reviewer/ })
  ).toBeEnabled();

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

  expect(reviewerItem(/New reviewer/)).toBeVisible();
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
    entityStatus: EntityStatus.Approved,
  };
  await renderPanel(true, 'releases');

  expect(
    screen.queryByTestId(`ontology-release-count-${release.id}`)
  ).toHaveTextContent(
    '1 label.added-lowercase · 6 label.changed-lowercase · 3 label.removed-lowercase'
  );

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
    entityStatus: EntityStatus.Approved,
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
    {
      ...release,
      id: id(11),
      releaseRevision: 11,
      semanticVersion: '1.10.0',
      entityStatus: EntityStatus.Approved,
    },
    {
      ...release,
      id: id(10),
      releaseRevision: 10,
      semanticVersion: '1.9.0',
      entityStatus: EntityStatus.Approved,
    },
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

describe('publication state table', () => {
  const text = () => screen.getByTestId('ontology-publication-text');
  const primaryAndSecondary = (testIds: string[]) =>
    testIds.map((testId) => screen.queryByTestId(testId));

  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('no reviewers, changes exist, validation passes: Publish and Save as release draft', async () => {
    ontology.reviewers = [];
    setStage(Stage.Draft);
    await renderPanel();

    expect(screen.getByTestId('ontology-publish-release')).toHaveTextContent(
      'Publish v1.5.0'
    );
    expect(screen.getByTestId('ontology-publish-release')).toBeEnabled();
    expect(screen.getByTestId('ontology-capture-release')).toHaveTextContent(
      'Save as release draft'
    );
    expect(screen.queryByTestId('ontology-request-review')).toBeNull();
    expect(text()).toHaveTextContent(
      'No reviewers set. Publishing makes this version live for everyone.'
    );
  });

  it('no reviewers, validation has errors: Publish is disabled and the first errors are listed', async () => {
    ontology.reviewers = [];
    setStage(Stage.Draft);
    const original = get.getMockImplementation();
    get.mockImplementation(async (url, config) =>
      url.endsWith('/validation') && !url.includes('/working/')
        ? {
            data: {
              releaseId: release.id,
              contentDigest: release.contentDigest,
              baseReleaseId: release.baseReleaseId,
              valid: false,
              logicalCheck: 'NotRun',
              deprecationImpacts: [],
              shacl: {
                violationCount: 0,
                warningCount: 0,
                findings: [],
                truncated: false,
              },
              structure: {
                releaseId: release.id,
                contentDigest: release.contentDigest,
                valid: false,
                violationCount: 2,
                violations: [
                  {
                    violation: { message: 'Customer has no label', path: '/a' },
                  },
                  {
                    violation: { message: 'Order loops on itself', path: '/b' },
                  },
                ],
              },
            },
          }
        : original?.(url, config)
    );
    await renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('ontology-publish-release')).toBeDisabled()
    );

    expect(
      within(screen.getByTestId('ontology-publication-errors'))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Customer has no label', 'Order loops on itself']);
    expect(text()).toHaveTextContent('Fix these to publish.');
    expect(screen.getByTestId('ontology-capture-release')).toBeEnabled();
  });

  it('reviewers set, eligible author: Request review and Save as release draft', async () => {
    setStage(Stage.Draft);
    await renderPanel();

    expect(screen.getByTestId('ontology-request-review')).toHaveTextContent(
      'Request review'
    );
    expect(screen.getByTestId('ontology-request-review')).toBeEnabled();
    expect(screen.getByTestId('ontology-capture-release')).toHaveTextContent(
      'Save as release draft'
    );
    expect(text()).toHaveTextContent(
      'The draft stays editable while the review is open.'
    );
  });

  it('the caller is the only reviewer: Request review is disabled with the sentence', async () => {
    ontology.reviewers = [{ id: id(2), type: 'user', name: 'editor' }];
    setStage(Stage.Draft);
    await renderPanel();

    expect(screen.getByTestId('ontology-request-review')).toBeDisabled();
    expect(screen.getByTestId('ontology-capture-release')).toBeEnabled();
    expect(text()).toHaveTextContent(
      'You are the only reviewer. Add another reviewer, or remove yourself to publish without review.'
    );
  });

  it('review open, caller requested it: Publish is disabled, Withdraw request is offered, progress follows the All rule', async () => {
    setStage(Stage.InReview);
    review.requester = { id: id(2), type: 'user', name: 'editor' };
    await renderPanel();

    expect(screen.getByTestId('ontology-publish-release')).toBeDisabled();
    expect(screen.getByTestId('ontology-withdraw-request')).toHaveTextContent(
      'Withdraw request'
    );
    expect(text()).toHaveTextContent(
      'Waiting for second reviewer. 1 of 2 approved.'
    );
  });

  it('review open, caller did not request it: no Withdraw request', async () => {
    setStage(Stage.InReview);
    await renderPanel();

    expect(screen.getByTestId('ontology-publish-release')).toBeDisabled();
    expect(screen.queryByTestId('ontology-withdraw-request')).toBeNull();
  });

  it('approved, caller can edit: Publish vX.Y.Z and nothing else', async () => {
    setStage(Stage.Approved);
    await renderPanel();

    expect(screen.getByTestId('ontology-publish-release')).toHaveTextContent(
      'Publish v1.5.0'
    );
    expect(screen.getByTestId('ontology-publish-release')).toBeEnabled();
    expect(
      primaryAndSecondary([
        'ontology-capture-release',
        'ontology-request-review',
        'ontology-withdraw-request',
      ])
    ).toEqual([null, null, null]);
    expect(text()).toHaveTextContent('Approved by reviewer.');
  });

  it('approved, caller cannot edit: no action and the sentence', async () => {
    setStage(Stage.Approved);
    await renderPanel(false);

    expect(screen.queryByTestId('ontology-publish-release')).toBeNull();
    expect(text()).toHaveTextContent('Only an author or owner can publish.');
  });

  it('the release in force with nothing newer: no action and the nothing-to-capture line', async () => {
    setStage(Stage.Published);
    if (!ontology.publicationStatus) {
      throw new Error('Missing fixture');
    }
    ontology.publicationStatus.unpublishedChanges = 0;
    await renderPanel();

    expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
      'Published'
    );
    expect(
      primaryAndSecondary([
        'ontology-publish-release',
        'ontology-capture-release',
        'ontology-request-review',
        'ontology-withdraw-request',
      ])
    ).toEqual([null, null, null, null]);
    expect(text()).toHaveTextContent(
      'There are no unpublished changes to capture.'
    );
  });

  it('rejected, nothing changed since: Request review again is disabled and the reviewer and reason show', async () => {
    setStage(Stage.ChangesRequested);
    release.sourceWorkingRevision = state.workingRevision;
    await renderPanel();

    expect(screen.getByTestId('ontology-request-review')).toHaveTextContent(
      'Request review again'
    );
    expect(screen.getByTestId('ontology-request-review')).toBeDisabled();
    expect(screen.getByTestId('ontology-capture-release')).toBeDisabled();
    expect(screen.getByText('Deciding reviewer')).toBeVisible();
    expect(text()).toHaveTextContent(
      'Edit the ontology, then request review again.'
    );
  });

  it('rejected, the ontology changed since: Request review again is enabled', async () => {
    setStage(Stage.ChangesRequested);
    release.sourceWorkingRevision = state.workingRevision - 1;
    await renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('ontology-request-review')).toBeEnabled()
    );
  });

  it('no unpublished changes: Publish and Save as release draft are disabled with the sentence', async () => {
    if (!ontology.publicationStatus) {
      throw new Error('Missing fixture');
    }
    ontology.publicationStatus.unpublishedChanges = 0;
    ontology.reviewers = [];
    setStage(Stage.Draft);
    await renderPanel();

    expect(screen.getByTestId('ontology-publish-release')).toBeDisabled();
    expect(screen.getByTestId('ontology-capture-release')).toBeDisabled();
    expect(text()).toHaveTextContent(
      'There are no unpublished changes to capture.'
    );
  });

  it('caller cannot edit a draft: no action and the role sentence', async () => {
    setStage(Stage.Draft);
    await renderPanel(false);

    expect(
      primaryAndSecondary([
        'ontology-capture-release',
        'ontology-request-review',
        'ontology-publish-release',
      ])
    ).toEqual([null, null, null]);
    expect(text()).toHaveTextContent(
      'You need the OntologyAuthor role to capture or publish a release. An admin can grant it.'
    );
  });
});

describe('publication flows', () => {
  const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
  const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
  const LocationProbe = () => (
    <span data-testid="pathname">{useLocation().pathname}</span>
  );
  let activeVersionOnServer = 'v1.0.0';
  const VersionChipProbe = () => {
    const { data } = useQuery({
      queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
      queryFn: async () => activeVersionOnServer,
    });

    return <span data-testid="chip-probe">{data}</span>;
  };
  const renderInRoute = async (view: 'changes' | 'releases' = 'changes') => {
    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter initialEntries={['/governance/ontology']}>
          <LocationProbe />
          <VersionChipProbe />
          <OntologyReleasePanel canEdit ontology={ontology} view={view} />
        </MemoryRouter>
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId('ontology-release-stage')).toBeInTheDocument()
    );
  };

  beforeEach(() => {
    useEnUsTranslations();
    activeVersionOnServer = 'v1.0.0';
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('stays in Studio after Request review and names the version and reviewers', async () => {
    ontology.reviewers = [
      {
        id: id(3),
        type: 'user',
        name: 'reviewer',
        displayName: 'Rita Reviewer',
      },
    ];
    state = { ...state, workingRevision: 8 };
    post.mockImplementation(async (url) => {
      if (url === `/ontologies/${ontology.id}/releases`) {
        release = {
          ...release,
          id: id(6),
          name: 'release-6',
          fullyQualifiedName: 'Sales.release-6',
          releaseRevision: 6,
          semanticVersion: '1.6.0',
          sourceWorkingRevision: 8,
          reviewAuthor: 'editor',
          contentDigest: 'b'.repeat(64),
        };
        state = { ...state, lastReleaseRevision: 6 };
        if (ontology.publicationStatus) {
          ontology.publicationStatus.latest = {
            releaseId: id(6),
            releaseRevision: 6,
            semanticVersion: '1.6.0',
            stage: Stage.Draft,
          };
        }

        return { data: release };
      }
      release = {
        ...release,
        entityStatus: EntityStatus.InReview,
        reviewTask: id(43),
      };
      review.task = { id: id(43), type: 'task' };
      review.release = { id: id(6), type: 'ontologyRelease' };
      if (ontology.publicationStatus?.latest) {
        ontology.publicationStatus.latest.stage = Stage.InReview;
      }

      return {
        data: {
          id: id(43),
          taskId: 'TASK-00043',
          type: 'RequestApproval',
          about: { id: id(6), type: 'ontologyRelease' },
          reviewers: ontology.reviewers,
        },
      };
    });
    await renderInRoute();
    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-request-review'))
    );

    expect(
      await screen.findByTestId('ontology-publication-notice-requested')
    ).toHaveTextContent('v1.6.0 sent to Rita Reviewer for review');
    expect(
      screen.getByTestId('ontology-publication-notice-requested')
    ).toHaveTextContent(
      "You'll be notified when it's approved. The draft stays editable; new changes go into the next version."
    );
    expect(screen.getByTestId('ontology-view-request')).toHaveAttribute(
      'href',
      `/tasks/${id(43)}`
    );
    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/governance/ontology'
    );
  });

  it('withdraws an open request by closing its task and says the release is a draft again', async () => {
    setStage(Stage.InReview);
    review.requester = { id: id(2), type: 'user', name: 'editor' };
    post.mockImplementation(async () => {
      setStage(Stage.Draft);
      reviewMissing = true;
      release.reviewTask = review.task.id;

      return { data: { id: review.task.id } };
    });
    await renderInRoute();

    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-withdraw-request'))
    );

    expect(post.mock.calls.map(([url]) => url)).toEqual([
      `/tasks/${review.task.id}/close`,
    ]);
    expect(
      await screen.findByTestId('ontology-publication-notice-withdrawn')
    ).toHaveTextContent(
      'Review request for v1.5.0 withdrawn. The release is a draft again.'
    );
    expect(await screen.findByTestId('ontology-request-review')).toBeEnabled();
  });

  it('publishes in one click with no reviewers: saves the draft, activates it, confirms and refreshes the version chip', async () => {
    ontology.reviewers = [];
    setStage(Stage.Draft);
    post.mockImplementation(async () => ({ data: release }));
    put.mockImplementation(async () => {
      activeVersionOnServer = 'v1.5.0';

      return {
        data: { ...state, activeReleaseId: release.id, activationRevision: 4 },
      };
    });
    await renderInRoute();

    expect(screen.getByTestId('chip-probe')).toHaveTextContent('v1.0.0');

    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-publish-release'))
    );

    expect(post.mock.calls.map(([url]) => url)).toEqual([
      `/ontologies/${ontology.id}/releases`,
    ]);
    expect(put.mock.calls.map(([url, body]) => [url, body])).toEqual([
      [
        `/ontologies/${ontology.id}/activation`,
        { releaseId: release.id, expectedActivationRevision: 3 },
      ],
    ]);
    expect(
      await screen.findByTestId('ontology-publication-notice-published')
    ).toHaveTextContent(
      'v1.5.0 published. Everyone using Sales now sees this version.'
    );

    await waitFor(() =>
      expect(screen.getByTestId('chip-probe')).toHaveTextContent('v1.5.0')
    );
  });

  it('shows the existing draft and its notes when a save changes nothing', async () => {
    release.releaseNotes = 'Original notes';
    setStage(Stage.Draft);
    post.mockImplementation(async () => ({ data: release }));
    await renderInRoute();

    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-capture-release'))
    );

    expect(
      await screen.findByTestId('ontology-publication-notice-unchanged')
    ).toHaveTextContent(
      'Nothing changed since v1.5.0 was saved, so this is the same draft.'
    );
    expect(
      screen.getByTestId('ontology-publication-unchanged-notes')
    ).toHaveTextContent('Its release notes: Original notes');
  });

  it('asks before rolling back and names the current and target versions', async () => {
    historical = {
      ...release,
      id: id(4),
      name: 'release-4',
      fullyQualifiedName: 'Sales.release-4',
      releaseRevision: 4,
      reviewTask: undefined,
      semanticVersion: '1.0.0',
      entityStatus: EntityStatus.Approved,
    };
    activeReleaseRevision = 9;
    put.mockResolvedValue({
      data: { ...state, activeReleaseId: id(4), activationRevision: 4 },
    });
    setStage(Stage.Draft);
    await renderInRoute('releases');
    await act(async () =>
      fireEvent.click(
        await screen.findByTestId(`ontology-release-select-${id(4)}`)
      )
    );

    const rollback = await screen.findByTestId('ontology-rollback-release');

    expect(rollback).toHaveTextContent('Roll back to v1.0.0');

    await act(async () => fireEvent.click(rollback));

    expect(
      await screen.findByTestId('ontology-rollback-confirmation')
    ).toHaveTextContent(
      'Sales is on v1.5.0. Rolling back to v1.0.0 makes v1.0.0 the version everyone sees.'
    );
    expect(put).not.toHaveBeenCalled();

    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-rollback-confirm'))
    );

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));

    expect(put.mock.calls.map(([, body]) => body)).toEqual([
      { releaseId: id(4), expectedActivationRevision: 3 },
    ]);
  });
});
