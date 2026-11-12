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

import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  AssigneeStatus,
  EntityStatus,
  OntologyReleaseReview,
  ReviewVoteDecision,
} from '../../../../generated/api/data/ontologyReleaseReview';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import {
  release,
  review,
} from '../OntologyTasksDrawer/OntologyTasksDrawer.mock';
import OntologyOpenReviewsBanner from './OntologyOpenReviewsBanner';
import OntologyReviewBanner from './OntologyReviewBanner';

it('shows an amber pending review and navigates using the UUID', () => {
  const open = jest.fn();
  render(
    <OntologyReviewBanner
      release={release}
      review={review}
      viewerName="Reviewer"
      onOpenTask={open}
    />
  );

  expect(screen.getByRole('status')).toHaveClass('tw:bg-utility-warning-50');
  expect(screen.getByText(/TASK-00042/)).toHaveTextContent('Commerce');

  fireEvent.click(screen.getByRole('button', { name: 'label.review-now' }));

  expect(open).toHaveBeenCalledWith('task');
});

it('shows the blue requester variant and hides prior voters and decided tasks', () => {
  const { rerender } = render(
    <OntologyReviewBanner
      release={release}
      review={{ ...review, callerCanVote: false }}
      viewerId="author"
      viewerName="Author"
      onOpenTask={jest.fn()}
    />
  );

  expect(screen.getByRole('status')).toHaveClass('tw:bg-utility-brand-50');
  expect(
    screen.getByRole('button', { name: 'label.view-task' })
  ).toBeInTheDocument();

  rerender(
    <OntologyReviewBanner
      release={release}
      review={{ ...review, callerCanVote: false }}
      viewerId="reviewer"
      viewerName="Reviewer"
      onOpenTask={jest.fn()}
    />
  );

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  rerender(
    <OntologyReviewBanner
      release={release}
      review={{ ...review, status: EntityStatus.Approved }}
      viewerId="author"
      viewerName="Author"
      onOpenTask={jest.fn()}
    />
  );

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

describe('decision banner for the requester', () => {
  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  const decided = (status: EntityStatus, reason?: string) => ({
    ...review,
    callerCanVote: false,
    status,
    latestDecision: {
      user: { id: 'reviewer', name: 'Reviewer', type: 'user' },
      decision:
        status === EntityStatus.Approved
          ? ReviewVoteDecision.Approved
          : ReviewVoteDecision.Rejected,
      reason,
      timestamp: 1,
    },
  });

  it('tells the author who approved which version', () => {
    render(
      <OntologyReviewBanner
        release={{ ...release, semanticVersion: '1.5.0' }}
        review={decided(EntityStatus.Approved)}
        viewerId="author"
        viewerName="Author"
        onOpenTask={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('ontology-review-decision-banner')
    ).toHaveTextContent(
      'Reviewer approved v1.5.0. Publish it from Review & publish.'
    );
  });

  it('shows the rejection reason to the author and opens the request', () => {
    const open = jest.fn();
    render(
      <OntologyReviewBanner
        release={{ ...release, semanticVersion: '1.5.0' }}
        review={decided(EntityStatus.Rejected, 'Missing owners')}
        viewerId="author"
        viewerName="Author"
        onOpenTask={open}
      />
    );

    expect(
      screen.getByTestId('ontology-review-decision-banner')
    ).toHaveTextContent('Reviewer rejected v1.5.0: Missing owners');

    fireEvent.click(screen.getByRole('button', { name: 'View request' }));

    expect(open).toHaveBeenCalledWith('task');
  });

  it('does not show a decision to anyone but the requester', () => {
    render(
      <OntologyReviewBanner
        release={release}
        review={decided(EntityStatus.Approved)}
        viewerId="someone-else"
        viewerName="Other"
        onOpenTask={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('ontology-review-decision-banner')
    ).not.toBeInTheDocument();
  });
});

describe('pending banner text', () => {
  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  const alice = { id: 'alice', name: 'alice', type: 'user' };
  const bob = { id: 'bob', name: 'bob', type: 'user' };
  const asRequester = (
    changes: Partial<OntologyReleaseReview>,
    version?: string
  ) => (
    <OntologyReviewBanner
      release={{
        ...release,
        semanticVersion: version,
        changeSummary: { added: 1, changed: 1, removed: 0, deprecated: 0 },
      }}
      review={{ ...review, callerCanVote: false, ...changes }}
      viewerId="author"
      viewerName="Author"
      onOpenTask={jest.fn()}
    />
  );

  it('names the ontology, the version, the reviewers and the task', () => {
    render(
      asRequester(
        {
          assignees: [
            { assignee: alice, status: AssigneeStatus.Pending },
            { assignee: bob, status: AssigneeStatus.Approved },
          ],
        },
        '0.1.0'
      )
    );

    const banner = screen.getByTestId('ontology-review-banner');

    expect(banner).toHaveTextContent('In review · waiting on alice');
    expect(banner).toHaveTextContent(
      'Commerce · v0.1.0 · 2 Changes · Author · TASK-00042'
    );
    expect(banner).not.toHaveTextContent('Unavailable');
  });

  it('calls a release that has no version yet a Draft, never Unavailable', () => {
    render(asRequester({}));

    expect(screen.getByTestId('ontology-review-banner')).toHaveTextContent(
      'Commerce · Draft · 2 Changes'
    );
    expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument();
  });

  it('says who approved when nobody is left to vote', () => {
    render(
      asRequester({
        assignees: [{ assignee: bob, status: AssigneeStatus.Approved }],
      })
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Approved by bob · ready to publish'
    );
  });

  it('says the review can be published when there are no reviewers at all', () => {
    render(asRequester({ assignees: [] }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'In review · ready to publish'
    );
    expect(screen.getByRole('status')).not.toHaveTextContent(/waiting on\s*$/);
  });

  it('says no reviewer is assigned when the ontology lists reviewers but the review has none left', () => {
    render(
      <OntologyReviewBanner
        release={{ ...release, reviewers: [bob] }}
        review={{ ...review, callerCanVote: false, assignees: [] }}
        viewerId="author"
        viewerName="Author"
        onOpenTask={jest.fn()}
      />
    );

    const banner = screen.getByRole('status');

    expect(banner).toHaveTextContent('In review · no reviewer assigned');
    expect(banner).not.toHaveTextContent('ready to publish');
  });

  it('tells the author to withdraw and request review again when no reviewer is left', () => {
    render(
      <OntologyReviewBanner
        release={{ ...release, reviewers: [bob] }}
        review={{ ...review, callerCanVote: false, assignees: [] }}
        viewerId="author"
        viewerName="Author"
        onOpenTask={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('ontology-review-withdraw-hint')
    ).toHaveTextContent(
      "Withdraw this request and request review again to send it to the ontology's current reviewers."
    );
  });

  it('shows no withdraw hint while a reviewer is still pending', () => {
    render(
      asRequester({
        assignees: [{ assignee: alice, status: AssigneeStatus.Pending }],
      })
    );

    expect(
      screen.queryByTestId('ontology-review-withdraw-hint')
    ).not.toBeInTheDocument();
  });

  it('keeps the reviewer-facing title when the viewer can vote', () => {
    render(
      <OntologyReviewBanner
        release={release}
        review={review}
        viewerName="Reviewer"
        onOpenTask={jest.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Reviewer, a release is waiting for your review'
    );
  });
});

describe('open reviews in All ontologies', () => {
  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  const reviewOn = (name: string, taskId: string): OntologyReleaseReview => ({
    ...review,
    ontology: { id: name, name, type: 'ontology' },
    task: { id: 'uuid-' + taskId, type: 'task' },
    taskId,
    assignees: [
      {
        assignee: { id: 'alice', name: 'alice', type: 'user' },
        status: AssigneeStatus.Pending,
      },
    ],
  });

  it('offers a dismiss control only when the host can hide the notice', () => {
    const dismiss = jest.fn();
    const { rerender } = render(
      <OntologyOpenReviewsBanner
        reviews={[reviewOn('Sales', 'TASK-1')]}
        onOpenList={jest.fn()}
        onOpenTask={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('ontology-review-dismiss')
    ).not.toBeInTheDocument();

    rerender(
      <OntologyOpenReviewsBanner
        reviews={[reviewOn('Sales', 'TASK-1')]}
        onDismiss={dismiss}
        onOpenList={jest.fn()}
        onOpenTask={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('ontology-review-dismiss'));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('names the ontology on each line and opens that review', () => {
    const open = jest.fn();
    render(
      <OntologyOpenReviewsBanner
        reviews={[reviewOn('Sales', 'TASK-1'), reviewOn('Finance', 'TASK-2')]}
        onOpenList={jest.fn()}
        onOpenTask={open}
      />
    );

    const lines = within(
      screen.getByTestId('ontology-open-reviews-banner')
    ).getAllByText(/waiting on/);

    expect(lines.map((line) => line.textContent)).toEqual([
      'Sales · In review · waiting on alice · TASK-1',
      'Finance · In review · waiting on alice · TASK-2',
    ]);

    fireEvent.click(screen.getAllByRole('button', { name: 'View task' })[1]);

    expect(open).toHaveBeenCalledWith('uuid-TASK-2');
  });

  it('names a review with no reviewer left instead of calling it ready', () => {
    render(
      <OntologyOpenReviewsBanner
        reviews={[{ ...reviewOn('Sales', 'TASK-1'), assignees: [] }]}
        onOpenList={jest.fn()}
        onOpenTask={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('ontology-open-reviews-banner')
    ).toHaveTextContent('Sales · In review · no reviewer assigned · TASK-1');
  });

  it('shows a count with a link to the list when there are many', () => {
    const openList = jest.fn();
    render(
      <OntologyOpenReviewsBanner
        reviews={['A', 'B', 'C', 'D'].map((name) =>
          reviewOn(name, 'TASK-' + name)
        )}
        onOpenList={openList}
        onOpenTask={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('ontology-open-reviews-banner')
    ).toHaveTextContent('4 reviews in progress');
    expect(screen.queryByText(/waiting on/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View All' }));

    expect(openList).toHaveBeenCalled();
  });

  it('renders nothing when no review is open', () => {
    const { container } = render(
      <OntologyOpenReviewsBanner
        reviews={[]}
        onOpenList={jest.fn()}
        onOpenTask={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
