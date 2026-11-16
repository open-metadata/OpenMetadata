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
import type { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import type { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import type { ReviewLock } from '../../../../generated/type/ontologyPublicationStatus';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import type {
  PublicationRead,
  ReviewSettings,
} from '../../../../hooks/governance/ontology/useOntologyPublication.types';

export type ReleaseTaskLink = { id: string; label: string; href: string };
export type ReleaseStage =
  | { stage: Stage.Draft; candidate: OntologyRelease | null }
  | { stage: Stage.InReview; candidate: OntologyRelease; task: ReleaseTaskLink }
  | {
      stage: Stage.ChangesRequested;
      candidate: OntologyRelease;
      task: ReleaseTaskLink;
      rejection: { actor: string; reason: string };
    }
  | {
      stage: Stage.Approved;
      candidate: OntologyRelease;
      task?: ReleaseTaskLink;
    }
  | {
      stage: Stage.Published;
      candidate: OntologyRelease;
      task?: ReleaseTaskLink;
    };
export type ReleasePanelView = PublicationRead<
  ReleaseStage & {
    settings: ReviewSettings;
    lock: PublicationRead<ReviewLock>;
    excludedIds: string[];
    excludedNames: string[];
    assignees: OntologyReleaseReview['assignees'];
    canEditSettings: boolean;
    canRequestReview: boolean;
    hasIndependentReviewer: boolean;
    unpublishedChanges: number;
  }
>;

export type PublicationState =
  | 'published'
  | 'cannotEdit'
  | 'noChanges'
  | 'noReviewers'
  | 'noReviewersInvalid'
  | 'reviewersSet'
  | 'soloReviewer'
  | 'inReview'
  | 'approvedCanPublish'
  | 'approvedCannotPublish'
  | 'rejected';

export type PublicationActionInput = {
  stage: Stage;
  /** The caller holds EditAll on the ontology. */
  canEdit: boolean;
  hasReviewers: boolean;
  /** At least one reviewer other than the caller and the release author. */
  hasIndependentReviewer: boolean;
  hasChanges: boolean;
  changedSinceRejection: boolean;
  /** The captured release failed validation; the first messages. */
  validationErrors: string[];
  /** The working preview, version base and recovery state allow a write. */
  isReady: boolean;
  isRequester: boolean;
  version: string;
};

export type PublicationActionKind =
  | 'publish'
  | 'requestReview'
  | 'requestReviewAgain'
  | 'saveDraft'
  | 'withdraw';

export type PublicationAction = {
  kind: PublicationActionKind;
  isDisabled: boolean;
};

export type PublicationText =
  | 'message.ontology-publication-no-reviewers'
  | 'message.ontology-publication-fix-to-publish'
  | 'message.ontology-publication-draft-stays-editable'
  | 'message.ontology-publication-solo-reviewer'
  | 'message.ontology-publication-waiting-for'
  | 'message.ontology-publication-approved-by'
  | 'message.ontology-publication-only-author-publishes'
  | 'message.ontology-publication-edit-then-request-again'
  | 'message.ontology-publication-no-changes'
  | 'message.ontology-publication-needs-author-role';

export type PublicationActions = {
  state: PublicationState;
  primary: PublicationAction | null;
  secondary: PublicationAction | null;
  text: PublicationText;
  /** Validation messages listed above the text in `noReviewersInvalid`. */
  errors: string[];
};
