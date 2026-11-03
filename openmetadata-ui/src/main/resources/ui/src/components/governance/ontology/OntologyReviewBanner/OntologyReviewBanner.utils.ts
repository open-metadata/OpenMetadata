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
  AssigneeStatus,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import { getEntityName } from '../../../../utils/EntityNameUtils';

const namesWithStatus = (
  review: OntologyReleaseReview,
  status: AssigneeStatus
) =>
  review.assignees
    .filter((entry) => entry.status === status)
    .map((entry) => getEntityName(entry.assignee))
    .join(', ');

/**
 * What a review is waiting on: the reviewers who have not voted, else who
 * approved it, else that it can be published. An empty reviewer list must
 * never leave the sentence dangling after "waiting on".
 */
export const getReviewStatusMessage = (review: OntologyReleaseReview) => {
  const pending = namesWithStatus(review, AssigneeStatus.Pending);
  if (pending) {
    return {
      key: 'message.ontology-review-waiting-on',
      values: { names: pending },
    };
  }
  const approved = namesWithStatus(review, AssigneeStatus.Approved);

  return approved
    ? {
        key: 'message.ontology-review-approved-by',
        values: { names: approved },
      }
    : { key: 'message.ontology-review-ready-to-publish', values: {} };
};
