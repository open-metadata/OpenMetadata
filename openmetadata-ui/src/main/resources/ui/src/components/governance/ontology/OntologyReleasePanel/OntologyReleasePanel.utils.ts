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
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import { OntologyApprovalRule } from '../../../../generated/entity/data/ontology';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
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
import {
  countChangesByKind,
  flattenConceptChanges,
  suggestVersion,
  type ChangeKindCounts,
  type VersionSuggestion,
} from './OntologyReleaseChanges.utils';
import type {
  PublicationAction,
  PublicationActionInput,
  PublicationActions,
  PublicationState,
  ReleasePanelView,
  ReleaseStage,
} from './OntologyReleasePanel.types';

export { nextPublicationVersion as nextSemanticVersion } from '../../../../hooks/governance/ontology/useOntologyPublication.utils';

export interface VersionEditorState {
  owner: string;
  versionBump?: VersionBump;
  releaseNotes: string;
}

export const getEditorValues = (
  editor: VersionEditorState | undefined,
  scopeKey: string
) =>
  editor?.owner === scopeKey
    ? { versionBump: editor.versionBump, releaseNotes: editor.releaseNotes }
    : { versionBump: undefined, releaseNotes: '' };

export const isCandidateStale = (
  candidate: { sourceWorkingRevision: number } | null | undefined,
  workingRevision: number | undefined
) => !candidate || candidate.sourceWorkingRevision !== workingRevision;

export const getWorkingDraft = (
  ontologyId: string,
  revision: number | undefined,
  isActive: boolean
) =>
  isActive && revision !== undefined ? { ontologyId, revision } : undefined;

type WorkingDiffPage = {
  groups?: Parameters<typeof flattenConceptChanges>[0];
  data: ReturnType<typeof flattenConceptChanges>;
  paging?: { after?: string };
};

const flattenWorkingDiff = (working: WorkingDiffPage) => [
  ...flattenConceptChanges(working.groups ?? []),
  ...working.data,
];

export const getWorkingChanges = (working: WorkingDiffPage | undefined) =>
  working ? flattenWorkingDiff(working) : [];

/**
 * The changes the review dialog counts, per kind and in total. A truncated diff
 * only holds its first page, so its total is the server's unpublished count.
 */
export const getWorkingChangeCounts = (
  working: WorkingDiffPage | undefined,
  unpublishedChanges: number | undefined,
  isFirstRelease: boolean
) => {
  const counts = countChangesByKind(getWorkingChanges(working));
  if (working?.paging?.after && unpublishedChanges !== undefined) {
    counts.total = Math.max(unpublishedChanges - Number(isFirstRelease), 0);
  }

  return counts;
};

export const suggestWorkingVersion = (
  changes: ReturnType<typeof getWorkingChanges>,
  baseVersion: string | undefined
) => (changes.length ? suggestVersion(changes, baseVersion) : undefined);

/**
 * A removal on a later page would make the suggestion too small, so a
 * truncated diff suggests nothing and the reader chooses the bump.
 */
export const resolveVersionChoice = (
  working: WorkingDiffPage | undefined,
  baseVersion: string | undefined,
  chosen: VersionBump | undefined
) => {
  const isTruncated = Boolean(working?.paging?.after);

  return {
    suggestion: isTruncated
      ? undefined
      : suggestWorkingVersion(getWorkingChanges(working), baseVersion),
    isPickRequired: isTruncated && chosen === undefined,
  };
};

export const resolveBump = (
  chosen: VersionBump | undefined,
  suggestion: VersionSuggestion | undefined
) => chosen ?? suggestion?.bump ?? VersionBump.Minor;

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
      hasIndependentReviewer: effective.length > 0,
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

/**
 * A draft nobody asked to review is only interesting while it is the newest;
 * older ones are superseded captures and would bury the releases that matter.
 */
export const visibleHistoryReleases = (
  releases: OntologyRelease[],
  latestReleaseId: string | undefined
) =>
  releases.filter(
    (release) =>
      release.entityStatus !== EntityStatus.Draft ||
      Boolean(release.reviewTask) ||
      release.id === latestReleaseId
  );

export type HistoryStatus = 'published' | 'inReview' | 'draft' | 'rejected';
export type HistoryStatusFilter = 'all' | HistoryStatus;

export const HISTORY_STATUS_FILTERS: readonly HistoryStatusFilter[] = [
  'all',
  'published',
  'inReview',
  'draft',
  'rejected',
];

/** Approved releases are the ones people can publish or already see. */
export const historyStatus = (release: OntologyRelease): HistoryStatus => {
  switch (release.entityStatus) {
    case EntityStatus.Approved:
      return 'published';
    case EntityStatus.InReview:
      return 'inReview';
    case EntityStatus.Rejected:
      return 'rejected';
    default:
      return 'draft';
  }
};

export const filterHistoryReleases = (
  releases: readonly OntologyRelease[],
  filter: HistoryStatusFilter,
  search: string
) => {
  const needle = search.trim().toLowerCase();

  return releases.filter(
    (release) =>
      (filter === 'all' || historyStatus(release) === filter) &&
      (!needle ||
        [release.semanticVersion, release.name, release.releaseNotes].some(
          (text) => text?.toLowerCase().includes(needle)
        ))
  );
};

/** Row counts by change type; a deprecation edits an existing concept. */
export const releaseChangeBreakdown = (release: OntologyRelease) => {
  const summary = release.changeSummary;
  if (!summary || summary.deprecated === undefined) {
    return undefined;
  }

  return {
    added: summary.added,
    changed: summary.changed + summary.deprecated,
    removed: summary.removed,
  };
};

/**
 * Per-kind counts of a release's changes, read from the summary the server
 * wrote at capture. A release captured before kind counts existed has none,
 * so its row keeps the added, changed and removed breakdown alone.
 */
export const releaseKindCounts = (
  release: OntologyRelease
): ChangeKindCounts | undefined => {
  const kinds = release.changeSummary?.kindCounts;
  if (!kinds) {
    return undefined;
  }
  const rules = kinds.axiom + kinds.shape;

  return {
    concepts: kinds.concept,
    properties: kinds.property,
    relationships: kinds.association,
    rules,
    total: kinds.concept + kinds.property + kinds.association + rules,
  };
};

const action = (
  kind: PublicationAction['kind'],
  isDisabled = false
): PublicationAction => ({ kind, isDisabled });

const REVIEW_STAGE_STATES: Partial<Record<Stage, PublicationState>> = {
  [Stage.InReview]: 'inReview',
  [Stage.ChangesRequested]: 'rejected',
};

const deriveDraftState = (input: PublicationActionInput): PublicationState => {
  if (!input.hasChanges) {
    return 'noChanges';
  }
  if (!input.hasReviewers) {
    return input.validationErrors.length > 0
      ? 'noReviewersInvalid'
      : 'noReviewers';
  }

  return input.hasIndependentReviewer ? 'reviewersSet' : 'soloReviewer';
};

export const derivePublicationState = (
  input: PublicationActionInput
): PublicationState => {
  const { stage, canEdit } = input;
  if (stage === Stage.Published && !input.hasChanges) {
    return 'published';
  }
  if (stage === Stage.Approved) {
    return canEdit ? 'approvedCanPublish' : 'approvedCannotPublish';
  }
  if (!canEdit) {
    return 'cannotEdit';
  }

  return REVIEW_STAGE_STATES[stage] ?? deriveDraftState(input);
};

type PublicationRow = (
  input: PublicationActionInput
) => Omit<PublicationActions, 'state' | 'errors'>;

/**
 * The publication state table (plan Appendix A). One row per state; the label
 * and sentence for each row are rendered by the panel.
 */
const PUBLICATION_ROWS: Record<PublicationState, PublicationRow> = {
  published: () => ({
    primary: null,
    secondary: null,
    text: 'message.ontology-publication-no-changes',
  }),
  cannotEdit: () => ({
    primary: null,
    secondary: null,
    text: 'message.ontology-publication-needs-author-role',
  }),
  noChanges: () => ({
    primary: action('publish', true),
    secondary: action('saveDraft', true),
    text: 'message.ontology-publication-no-changes',
  }),
  noReviewers: ({ isReady }) => ({
    primary: action('publish', !isReady),
    secondary: action('saveDraft', !isReady),
    text: 'message.ontology-publication-no-reviewers',
  }),
  noReviewersInvalid: ({ isReady }) => ({
    primary: action('publish', true),
    secondary: action('saveDraft', !isReady),
    text: 'message.ontology-publication-fix-to-publish',
  }),
  reviewersSet: ({ isReady }) => ({
    primary: action('requestReview', !isReady),
    secondary: action('saveDraft', !isReady),
    text: 'message.ontology-publication-draft-stays-editable',
  }),
  soloReviewer: ({ isReady }) => ({
    primary: action('requestReview', true),
    secondary: action('saveDraft', !isReady),
    text: 'message.ontology-publication-solo-reviewer',
  }),
  inReview: ({ isRequester, isReady }) => ({
    primary: action('publish', true),
    secondary: isRequester ? action('withdraw', !isReady) : null,
    text: 'message.ontology-publication-waiting-for',
  }),
  approvedCanPublish: ({ isReady }) => ({
    primary: action('publish', !isReady),
    secondary: null,
    text: 'message.ontology-publication-approved-by',
  }),
  approvedCannotPublish: () => ({
    primary: null,
    secondary: null,
    text: 'message.ontology-publication-only-author-publishes',
  }),
  rejected: ({ changedSinceRejection, hasIndependentReviewer, isReady }) => ({
    primary: action(
      'requestReviewAgain',
      !isReady || !changedSinceRejection || !hasIndependentReviewer
    ),
    secondary: action('saveDraft', !isReady || !changedSinceRejection),
    text: 'message.ontology-publication-edit-then-request-again',
  }),
};

export const getPublicationActions = (
  input: PublicationActionInput
): PublicationActions => {
  const state = derivePublicationState(input);

  return {
    state,
    ...PUBLICATION_ROWS[state](input),
    errors: state === 'noReviewersInvalid' ? input.validationErrors : [],
  };
};
