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
import { OntologyApprovalRule } from '../../../../generated/entity/data/ontology';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { TaskType } from '../../../../generated/entity/tasks/task';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import { OntologyState } from '../../../../generated/type/ontologyState';
import type {
  CurrentPublication,
  PublicationRead,
} from '../../../../hooks/governance/ontology/useOntologyPublication.types';
import {
  eligiblePublicationReviewers,
  isReviewableCandidate,
  readReviewLock,
  reusablePublicationCandidate,
} from '../../../../hooks/governance/ontology/useOntologyPublication.utils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getTaskDetailPath } from '../../../../utils/TaskUtils';
import type {
  ReleasePanelView,
  ReleaseStage,
} from './OntologyReleasePanel.types';

export { nextPublicationVersion as nextSemanticVersion } from '../../../../hooks/governance/ontology/useOntologyPublication.utils';

export const isSameWorkingState = (
  first: OntologyState | undefined,
  current: OntologyState | undefined
) => {
  if (!first || !current) {
    return false;
  }

  return [
    current.ontologyId === first.ontologyId,
    current.workingRevision === first.workingRevision,
    current.activationRevision === first.activationRevision,
    current.activeReleaseId === first.activeReleaseId,
    current.lastReleaseRevision === first.lastReleaseRevision,
  ].every(Boolean);
};

const releaseTaskLink = (review: CurrentPublication['review']) => {
  if (!review?.taskId) {
    return undefined;
  }

  return {
    id: review.task.id,
    label: review.taskId,
    href: getTaskDetailPath({
      id: review.task.id,
      taskId: review.taskId,
      type: TaskType.RequestApproval,
      about: review.release,
    }),
  };
};

const rejectionDetails = (
  decision: NonNullable<
    NonNullable<CurrentPublication['review']>['latestDecision']
  >
) => ({
  actor: getEntityName(decision.user),
  reason: decision.reason ?? '',
});

const deriveReleaseStage = (
  current: CurrentPublication
): PublicationRead<ReleaseStage> => {
  const { ontology, candidate, review } = current;
  const stage = ontology.publicationStatus?.latest?.stage ?? Stage.Draft;
  const task = releaseTaskLink(review);
  if (stage === Stage.Draft) {
    return { kind: 'ready', value: { stage, candidate } };
  }
  if (!candidate) {
    return { kind: 'unavailable', reason: 'missing' };
  }
  if (stage === Stage.Published || stage === Stage.Approved) {
    return { kind: 'ready', value: { stage, candidate, task } };
  }
  if (!task) {
    return { kind: 'unavailable', reason: 'missing' };
  }
  if (stage === Stage.InReview) {
    return { kind: 'ready', value: { stage, candidate, task } };
  }
  if (stage === Stage.ChangesRequested && review?.latestDecision) {
    return {
      kind: 'ready',
      value: {
        stage,
        candidate,
        task,
        rejection: rejectionDetails(review.latestDecision),
      },
    };
  }

  return { kind: 'unavailable', reason: 'stale' };
};

const releaseReviewSettings = ({ ontology, review }: CurrentPublication) => ({
  reviewers: review
    ? review.assignees.map(({ assignee }) => assignee)
    : ontology.reviewers ?? [],
  approvalRule:
    review?.approvalRule ??
    ontology.approvalRule ??
    OntologyApprovalRule.AnyReviewer,
});

export const deriveReleasePanelView = (
  current: PublicationRead<CurrentPublication>,
  permissions: {
    canEdit: boolean;
    canWrite: boolean;
    userId?: string;
    userName?: string;
  }
): ReleasePanelView => {
  if (current.kind !== 'ready') {
    return current;
  }
  const stage = deriveReleaseStage(current.value);
  if (stage.kind !== 'ready') {
    return stage;
  }
  const { ontology, review } = current.value;
  const reusable = reusablePublicationCandidate(current.value);
  const lock = readReviewLock(ontology.publicationStatus?.reviewLock);
  const excludedIds = [permissions.userId].filter((id): id is string =>
    Boolean(id)
  );
  const excludedNames = [
    permissions.userName,
    reusable?.reviewAuthor ?? reusable?.sealedBy,
  ].filter((name): name is string => Boolean(name));
  const settings = releaseReviewSettings(current.value);
  const effective = eligiblePublicationReviewers(ontology.reviewers ?? [], {
    ids: excludedIds,
    names: excludedNames,
  });
  const unlocked = lock.kind === 'ready' && !lock.value.inReview;

  return {
    kind: 'ready',
    value: {
      ...stage.value,
      settings,
      lock,
      excludedIds,
      excludedNames,
      assignees: review?.assignees ?? [],
      unpublishedChanges: ontology.publicationStatus?.unpublishedChanges ?? 0,
      canEditSettings: [
        permissions.canEdit,
        permissions.canWrite,
        stage.value.stage === Stage.Draft,
        unlocked,
      ].every(Boolean),
      canRequestReview:
        permissions.canWrite &&
        effective.length > 0 &&
        isReviewableCandidate(current.value),
    },
  };
};

export const releaseChangeCount = (release: OntologyRelease) => {
  const summary = release.changeSummary;
  if (!summary || summary.deprecated === undefined) {
    return undefined;
  }

  return summary.added + summary.changed + summary.removed + summary.deprecated;
};
