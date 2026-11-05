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
import { VersionBump } from '../../../generated/api/data/captureOntologyRelease';
import {
  OntologyReleaseReview,
  ReviewVoteDecision,
} from '../../../generated/api/data/ontologyReleaseReview';
import {
  Ontology,
  OntologyApprovalRule,
} from '../../../generated/entity/data/ontology';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../generated/entity/data/ontologyRelease';
import {
  ReviewLock,
  Stage,
} from '../../../generated/type/ontologyPublicationStatus';
import { OntologyState } from '../../../generated/type/ontologyState';
import { listOntologyReleaseHistory } from '../../../rest/ontologyAPI';
import type {
  CapturedIdentity,
  CurrentPublication,
  PublicationRead,
  PublicationReceipt,
  ReceiptRead,
  ReceiptScope,
  ReviewSettings,
} from './useOntologyPublication.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isRevision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isOptionalVersion = (value: unknown): value is string | undefined =>
  value === undefined ||
  (typeof value === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value));
const isNotes = (value: unknown): value is string | undefined =>
  value === undefined || (typeof value === 'string' && value.length <= 16384);

export const eligiblePublicationReviewers = (
  reviewers: NonNullable<Ontology['reviewers']>,
  exclusions: {
    ids: readonly (string | undefined)[];
    names: readonly (string | undefined)[];
  }
) =>
  reviewers.filter((entry) => {
    if (entry.deleted) {
      return false;
    }
    if (entry.type === 'team') {
      return true;
    }

    return [
      entry.type === 'user',
      !exclusions.ids.includes(entry.id),
      entry.name === undefined || !exclusions.names.includes(entry.name),
    ].every(Boolean);
  });

export const latestVersionedOntologyRelease = async (
  ontologyId: string,
  signal: AbortSignal
) => {
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const response = await listOntologyReleaseHistory(
      ontologyId,
      { limit: 100, after },
      signal
    );
    if (response.data.some((release) => release.ontology.id !== ontologyId)) {
      throw new Error('Ontology release owner does not match the selection');
    }
    const versioned = response.data.find((release) => release.semanticVersion);
    if (versioned) {
      return versioned;
    }
    if (!response.paging.after) {
      return null;
    }
    if (response.paging.after === after) {
      throw new Error('Ontology release cursor did not advance');
    }
    after = response.paging.after;
  }

  throw new Error(
    'Latest versioned ontology release exceeds the bounded history lookup'
  );
};

export const readPublicationQuery = <T>(query: {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  data: T | undefined;
}): PublicationRead<T> => {
  if (query.isError) {
    return { kind: 'unavailable', reason: 'failed' };
  }
  if (query.isFetching || query.isPending) {
    return { kind: 'loading' };
  }
  if (query.data === undefined) {
    return { kind: 'unavailable', reason: 'missing' };
  }

  return { kind: 'ready', value: query.data };
};

export const readReviewLock = (lock: unknown): PublicationRead<ReviewLock> => {
  if (!isRecord(lock)) {
    return { kind: 'unavailable', reason: 'missing' };
  }
  if (Object.keys(lock).length === 0) {
    return { kind: 'ready', value: {} };
  }
  const release = lock.inReview;
  if (
    !isRecord(release) ||
    !isUuid(release.releaseId) ||
    !isRevision(release.releaseRevision) ||
    !isOptionalVersion(release.semanticVersion)
  ) {
    return { kind: 'unavailable', reason: 'stale' };
  }
  if (release.releaseRevision < 1) {
    return { kind: 'unavailable', reason: 'stale' };
  }

  return {
    kind: 'ready',
    value: {
      inReview: {
        releaseId: release.releaseId,
        releaseRevision: release.releaseRevision,
        semanticVersion: release.semanticVersion,
      },
    },
  };
};

export const publicationStage = (
  release: OntologyRelease,
  state: OntologyState
) => {
  switch (release.entityStatus) {
    case EntityStatus.Approved:
      return release.id === state.activeReleaseId
        ? Stage.Published
        : Stage.Approved;
    case EntityStatus.InReview:
      return Stage.InReview;
    case EntityStatus.Rejected:
      return Stage.ChangesRequested;
    case EntityStatus.Draft:
      return Stage.Draft;
    default:
      return undefined;
  }
};

export const matchesPublicationReview = (
  task: OntologyReleaseReview,
  release: OntologyRelease
) =>
  [
    task.ontology.id === release.ontology.id,
    task.release.id === release.id,
    task.task.id === release.reviewTask,
    task.status === release.entityStatus,
    Boolean(task.taskId),
  ].every(Boolean);

const coherentReview = (
  release: OntologyRelease,
  task: OntologyReleaseReview | null
) => {
  if (!release.reviewTask) {
    return (
      !task &&
      ![EntityStatus.InReview, EntityStatus.Rejected].includes(
        release.entityStatus
      )
    );
  }
  if (
    !task ||
    !matchesPublicationReview(task, release) ||
    release.entityStatus === EntityStatus.Draft
  ) {
    return false;
  }

  return (
    release.entityStatus !== EntityStatus.Rejected ||
    task.latestDecision?.decision === ReviewVoteDecision.Rejected
  );
};

const coherentCandidate = (
  owner: Ontology,
  state: OntologyState,
  release: OntologyRelease | null,
  task: OntologyReleaseReview | null
) => {
  const latest = owner.publicationStatus?.latest;
  if (!latest) {
    return !release && !task && state.lastReleaseRevision === 0;
  }
  if (!release) {
    return false;
  }
  const stage = publicationStage(release, state);

  return [
    release.id === latest.releaseId,
    release.ontology.id === owner.id,
    release.releaseRevision === latest.releaseRevision,
    release.releaseRevision === state.lastReleaseRevision,
    release.sourceWorkingRevision <= state.workingRevision,
    release.semanticVersion === latest.semanticVersion,
    stage === latest.stage,
    release.id !== state.activeReleaseId || stage === Stage.Published,
    coherentReview(release, task),
  ].every(Boolean);
};

export const joinPublicationReads = (
  ontology: PublicationRead<Ontology>,
  state: PublicationRead<OntologyState>,
  candidate: PublicationRead<OntologyRelease | null>,
  review: PublicationRead<OntologyReleaseReview | null>
): PublicationRead<CurrentPublication> => {
  if (ontology.kind !== 'ready') {
    return ontology;
  }
  if (state.kind !== 'ready') {
    return state;
  }
  if (candidate.kind !== 'ready') {
    return candidate;
  }
  if (review.kind !== 'ready') {
    return review;
  }
  const owner = ontology.value;
  const projection = owner.publicationStatus;
  const release = candidate.value;
  const task = review.value;
  const unavailable = { kind: 'unavailable', reason: 'stale' } as const;
  if (
    !projection ||
    owner.id !== state.value.ontologyId ||
    projection.active?.releaseId !== state.value.activeReleaseId ||
    !isRevision(projection.unpublishedChanges)
  ) {
    return unavailable;
  }
  if (!coherentCandidate(owner, state.value, release, task)) {
    return unavailable;
  }

  return {
    kind: 'ready',
    value: {
      ontology: owner,
      state: state.value,
      candidate: release,
      review: task,
    },
  };
};

export const samePublicationState = (
  left: OntologyState,
  right: OntologyState
) =>
  [
    left.ontologyId === right.ontologyId,
    left.workingRevision === right.workingRevision,
    left.activationRevision === right.activationRevision,
    left.activeReleaseId === right.activeReleaseId,
    left.lastReleaseRevision === right.lastReleaseRevision,
  ].every(Boolean);

export const capturedIdentity = (
  release: OntologyRelease
): CapturedIdentity => ({
  id: release.id,
  releaseRevision: release.releaseRevision,
  semanticVersion: release.semanticVersion,
  contentDigest: release.contentDigest,
  sourceWorkingRevision: release.sourceWorkingRevision,
  fullyQualifiedName: release.fullyQualifiedName,
  baseReleaseId: release.baseReleaseId,
  releaseNotes: release.releaseNotes,
});

export const matchesCapturedIdentity = (
  release: OntologyRelease,
  identity: CapturedIdentity
) =>
  Object.entries(identity).every(([key, value]) =>
    Object.entries(capturedIdentity(release)).some(
      ([field, actual]) => field === key && actual === value
    )
  );

export const nextPublicationVersion = (
  version: string | undefined,
  bump: VersionBump
) => {
  if (!isOptionalVersion(version)) {
    throw new Error('Invalid ontology semantic version');
  }
  const [major, minor, patch] = (version ?? '0.0.0').split('.').map(BigInt);
  switch (bump) {
    case VersionBump.Major:
      return `${major + BigInt(1)}.0.0`;
    case VersionBump.Minor:
      return `${major}.${minor + BigInt(1)}.0`;
    case VersionBump.Patch:
      return `${major}.${minor}.${patch + BigInt(1)}`;
  }
};

export const matchesCaptureMetadata = (
  release: OntologyRelease,
  attempt: Extract<PublicationReceipt, { operation: 'capture' }>
) =>
  [
    release.ontology.id === attempt.ontologyId,
    release.sourceWorkingRevision === attempt.state.workingRevision,
    release.baseReleaseId === attempt.state.activeReleaseId,
    release.semanticVersion === attempt.expectedVersion,
    (release.releaseNotes ?? '') === (attempt.metadata.releaseNotes ?? ''),
  ].every(Boolean);

export const reusablePublicationCandidate = ({
  candidate,
  state,
}: CurrentPublication) => {
  if (
    candidate?.entityStatus === EntityStatus.Draft &&
    candidate.sourceWorkingRevision === state.workingRevision &&
    candidate.baseReleaseId === state.activeReleaseId &&
    !candidate.reviewTask
  ) {
    return candidate;
  }

  return undefined;
};

export const isReviewableCandidate = (current: CurrentPublication) => {
  const { ontology, candidate, state } = current;
  if (!ontology.publicationStatus?.unpublishedChanges) {
    return false;
  }
  switch (candidate?.entityStatus) {
    case EntityStatus.InReview:
      return false;
    case EntityStatus.Approved:
      return candidate.id === state.activeReleaseId;
    case EntityStatus.Rejected:
      return candidate.sourceWorkingRevision !== state.workingRevision;
    default:
      return true;
  }
};

export const isValidReviewSettings = (settings: ReviewSettings) => {
  const validRule = [
    OntologyApprovalRule.AnyReviewer,
    OntologyApprovalRule.AllReviewers,
  ].includes(settings.approvalRule);
  const validTypes = settings.reviewers.every(
    (entry) => entry.type === 'user' || entry.type === 'team'
  );
  const validTeamSelection =
    !settings.reviewers.some((entry) => entry.type === 'team') ||
    settings.reviewers.length === 1;
  const unique =
    new Set(settings.reviewers.map((entry) => entry.id)).size ===
    settings.reviewers.length;

  return validRule && validTypes && validTeamSelection && unique;
};

export const canEditPublicationSettings = (current: CurrentPublication) => {
  const lock = readReviewLock(current.ontology.publicationStatus?.reviewLock);
  const draft =
    !current.candidate || current.candidate.entityStatus === EntityStatus.Draft;

  return (
    lock.kind === 'ready' &&
    !lock.value.inReview &&
    draft &&
    current.ontology.version !== undefined
  );
};

export const matchesReviewSettings = (
  stored: Ontology | undefined,
  ontologyId: string,
  settings: ReviewSettings
) => {
  if (!stored || stored.id !== ontologyId) {
    return false;
  }

  return (
    stored.approvalRule === settings.approvalRule &&
    stored.reviewers?.length === settings.reviewers.length &&
    settings.reviewers.every((reviewer) =>
      stored.reviewers?.some(
        (entry) => entry.id === reviewer.id && entry.type === reviewer.type
      )
    )
  );
};

const captureMatchInPage = (
  releases: OntologyRelease[],
  attempt: Extract<PublicationReceipt, { operation: 'capture' }>,
  previous: OntologyRelease | undefined
) => {
  let match = previous;
  for (const release of releases) {
    if (release.ontology.id !== attempt.ontologyId) {
      throw new Error('Ontology release owner does not match recovery');
    }
    if (
      release.releaseRevision > attempt.state.lastReleaseRevision &&
      matchesCaptureMetadata(release, attempt)
    ) {
      if (match && match.id !== release.id) {
        throw new Error('Ambiguous capture outcome');
      }
      match = release;
    }
  }

  return match;
};

export const findCapturedAttempt = async (
  attempt: Extract<PublicationReceipt, { operation: 'capture' }>,
  signal?: AbortSignal
) => {
  let after: string | undefined;
  let match: OntologyRelease | undefined;
  for (let page = 0; page < 10; page++) {
    const response = await listOntologyReleaseHistory(
      attempt.ontologyId,
      { limit: 100, after },
      signal
    );
    match = captureMatchInPage(response.data, attempt, match);
    if (!response.paging.after) {
      return match;
    }
    if (response.paging.after === after) {
      throw new Error('Ontology release cursor did not advance');
    }
    after = response.paging.after;
  }

  throw new Error('Capture recovery exceeds the bounded history lookup');
};

const RECEIPT_KEY = 'ontology-publication-receipts-v1';
const MAX_RECEIPTS = 8;
const MAX_RECEIPT_BYTES = 64 * 1024;
const STORAGE_FULL = 'Publication recovery storage is full';
const isState = (value: unknown): value is OntologyState => {
  if (!isRecord(value)) {
    return false;
  }

  return [
    isUuid(value.ontologyId),
    isRevision(value.workingRevision),
    isRevision(value.activationRevision),
    isRevision(value.lastReleaseRevision),
    value.activeReleaseId === undefined || isUuid(value.activeReleaseId),
  ].every(Boolean);
};
const isCapturedIdentity = (value: unknown): value is CapturedIdentity => {
  if (!isRecord(value)) {
    return false;
  }

  return [
    isUuid(value.id),
    isRevision(value.releaseRevision) && value.releaseRevision > 0,
    isRevision(value.sourceWorkingRevision),
    typeof value.contentDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(value.contentDigest),
    typeof value.fullyQualifiedName === 'string' &&
      value.fullyQualifiedName.length > 0 &&
      value.fullyQualifiedName.length <= 3072,
    isOptionalVersion(value.semanticVersion),
    isNotes(value.releaseNotes),
    value.baseReleaseId === undefined || isUuid(value.baseReleaseId),
  ].every(Boolean);
};
const isCaptureReceipt = (value: Record<string, unknown>) => {
  if (!isRecord(value.metadata)) {
    return false;
  }

  const metadata = value.metadata;

  return [
    ['running', 'unknown'].some((option) => option === value.phase),
    ['capture', 'review'].some((option) => option === value.intent),
    isNotes(metadata.releaseNotes),
    [undefined, VersionBump.Major, VersionBump.Minor, VersionBump.Patch].some(
      (bump) => bump === metadata.versionBump
    ),
    isOptionalVersion(value.expectedVersion),
  ].every(Boolean);
};
const isReceipt = (value: unknown): value is PublicationReceipt => {
  if (!isRecord(value) || !isState(value.state)) {
    return false;
  }
  const validOwner = [
    value.origin === window.location.origin,
    isUuid(value.userId),
    isUuid(value.ontologyId),
    value.state.ontologyId === value.ontologyId,
  ].every(Boolean);
  if (!validOwner) {
    return false;
  }
  switch (value.operation) {
    case 'capture':
      return isCaptureReceipt(value);
    case 'review':
      return (
        ['running', 'unknown', 'failed'].some(
          (option) => option === value.phase
        ) && isCapturedIdentity(value.release)
      );
    case 'activation':
      return (
        ['running', 'unknown', 'conflict'].some(
          (option) => option === value.phase
        ) && isCapturedIdentity(value.release)
      );
    default:
      return false;
  }
};
const sameScope = (left: ReceiptScope, right: ReceiptScope) =>
  left.origin === right.origin &&
  left.userId === right.userId &&
  left.ontologyId === right.ontologyId;
const receiptText = (receipts: PublicationReceipt[]) => {
  const text = JSON.stringify(receipts);
  if (new TextEncoder().encode(text).length > MAX_RECEIPT_BYTES) {
    throw new Error(STORAGE_FULL);
  }

  return text;
};
const readReceipts = (): PublicationReceipt[] => {
  const raw = sessionStorage.getItem(RECEIPT_KEY) ?? '[]';
  if (new TextEncoder().encode(raw).length > MAX_RECEIPT_BYTES) {
    throw new Error(STORAGE_FULL);
  }
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    parsed.length > MAX_RECEIPTS ||
    !parsed.every(isReceipt) ||
    parsed.some((receipt, index) =>
      parsed.slice(0, index).some((prior) => sameScope(prior, receipt))
    )
  ) {
    throw new Error('Invalid publication recovery receipt');
  }

  return parsed;
};

export const readPublicationReceipt = (scope: ReceiptScope): ReceiptRead => {
  try {
    if (!isUuid(scope.userId) || !isUuid(scope.ontologyId)) {
      throw new Error('Publication recovery owner is unavailable');
    }
    const receipts = readReceipts();
    const receipt = receipts.find((entry) => sameScope(entry, scope)) ?? null;
    if (!receipt && receipts.length >= MAX_RECEIPTS) {
      throw new Error(STORAGE_FULL);
    }
    sessionStorage.setItem(RECEIPT_KEY, receiptText(receipts));

    return { kind: 'ready', value: receipt };
  } catch {
    return { kind: 'unavailable', reason: 'failed' };
  }
};
export const savePublicationReceipt = (
  scope: ReceiptScope,
  receipt: PublicationReceipt | null,
  previous: PublicationReceipt | null
) => {
  const receipts = readReceipts();
  const existing = receipts.find((entry) => sameScope(entry, scope)) ?? null;
  if (JSON.stringify(existing) !== JSON.stringify(previous)) {
    throw new Error('Publication recovery changed in another panel');
  }
  if (receipt && (!isReceipt(receipt) || !sameScope(receipt, scope))) {
    throw new Error('Invalid publication recovery receipt');
  }
  const next = receipts.filter((entry) => !sameScope(entry, scope));
  if (receipt) {
    next.push(receipt);
  }
  if (next.length > MAX_RECEIPTS) {
    throw new Error(STORAGE_FULL);
  }
  sessionStorage.setItem(RECEIPT_KEY, receiptText(next));
};
