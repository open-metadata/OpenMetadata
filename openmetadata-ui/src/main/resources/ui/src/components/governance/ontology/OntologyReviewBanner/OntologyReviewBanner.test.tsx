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
import { EntityStatus } from '../../../../generated/api/data/ontologyReleaseReview';
import {
  release,
  review,
} from '../OntologyTasksDrawer/OntologyTasksDrawer.mock';
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

  expect(screen.getByRole('alert')).toHaveClass('tw:bg-warning-primary');
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

  expect(screen.getByRole('alert')).toHaveClass('tw:bg-utility-blue-50');
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
