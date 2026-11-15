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

import { fireEvent, render, screen } from '@testing-library/react';
import {
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
    <OntologyReviewBanner release={release} review={review} onOpenTask={open} />
  );

  expect(screen.getByRole('status')).toHaveClass('tw:bg-utility-warning-50');

  fireEvent.click(screen.getByRole('button', { name: 'label.review' }));

  expect(open).toHaveBeenCalledWith('task');
});

it('announces an open review only to a viewer who can still vote on it', () => {
  const { rerender } = render(
    <OntologyReviewBanner
      release={release}
      review={{ ...review, callerCanVote: false }}
      viewerId="author"
      onOpenTask={jest.fn()}
    />
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  rerender(
    <OntologyReviewBanner
      release={release}
      review={{ ...review, callerCanVote: false }}
      viewerId="reviewer"
      onOpenTask={jest.fn()}
    />
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  rerender(
    <OntologyReviewBanner
      release={release}
      review={{ ...review, status: EntityStatus.Approved }}
      viewerId="reviewer"
      onOpenTask={jest.fn()}
    />
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

  it('asks the reviewer in one line, naming who asked and the version', () => {
    render(
      <OntologyReviewBanner
        release={release}
        review={review}
        onOpenTask={jest.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Author asked you to review v1.4.0'
    );
    expect(screen.queryByText(/TASK-00042/)).not.toBeInTheDocument();
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
    callerCanVote: true,
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

  it('names who asked and the ontology for a single review, and opens it', () => {
    const open = jest.fn();
    render(
      <OntologyOpenReviewsBanner
        reviews={[reviewOn('Sales', 'TASK-1')]}
        onOpenList={jest.fn()}
        onOpenTask={open}
      />
    );

    const banner = screen.getByTestId('ontology-open-reviews-banner');

    expect(banner).toHaveTextContent('Author asked you to review Sales');
    expect(banner).toHaveClass('tw:bg-utility-warning-50');

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(open).toHaveBeenCalledWith('uuid-TASK-1');
  });

  it('counts several reviews in one pill whose Review opens the list', () => {
    const openList = jest.fn();
    const open = jest.fn();
    render(
      <OntologyOpenReviewsBanner
        reviews={['A', 'B'].map((name) => reviewOn(name, 'TASK-' + name))}
        onOpenList={openList}
        onOpenTask={open}
      />
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(
      screen.getByTestId('ontology-open-reviews-banner')
    ).toHaveTextContent('2 reviews waiting on you');

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(openList).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
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
