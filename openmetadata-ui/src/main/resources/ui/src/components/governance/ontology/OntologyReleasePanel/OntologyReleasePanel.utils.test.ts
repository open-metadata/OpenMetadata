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
import {
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import type { PublicationActionInput } from './OntologyReleasePanel.types';
import {
  getPublicationActions,
  isSameWorkingState,
  nextSemanticVersion,
  releaseBump,
  releaseDisplayStatus,
  visibleHistoryReleases,
} from './OntologyReleasePanel.utils';

describe('publication version preview', () => {
  it.each([
    [undefined, VersionBump.Major, '1.0.0'],
    ['1.4.9', VersionBump.Patch, '1.4.10'],
    ['1.4.9', VersionBump.Minor, '1.5.0'],
    ['1.4.9', VersionBump.Major, '2.0.0'],
    ['9007199254740991.0.0', VersionBump.Major, '9007199254740992.0.0'],
  ])('previews %s with %s as %s', (version, bump, expected) => {
    expect(nextSemanticVersion(version, bump)).toBe(expected);
  });

  it.each(['01.0.0', '1.0', '1.2.3-beta'])(
    'rejects invalid versions %s',
    (version) => {
      expect(() => nextSemanticVersion(version, VersionBump.Major)).toThrow();
    }
  );

  it('requires the same latest release fence across working preview pages', () => {
    const state = {
      ontologyId: 'owner',
      workingRevision: 2,
      activationRevision: 1,
      lastReleaseRevision: 3,
    };

    expect(isSameWorkingState(state, { ...state })).toBe(true);
    expect(
      isSameWorkingState(state, { ...state, lastReleaseRevision: 4 })
    ).toBe(false);
  });
});

describe('visible release history', () => {
  const release = (
    id: string,
    entityStatus: EntityStatus,
    reviewTask?: string
  ) => ({ id, entityStatus, reviewTask } as OntologyRelease);

  it('hides a draft with no task unless it is the latest', () => {
    const releases = [
      release('latest-draft', EntityStatus.Draft),
      release('old-draft', EntityStatus.Draft),
      release('reviewed-draft', EntityStatus.Draft, 'task'),
      release('approved', EntityStatus.Approved),
      release('in-review', EntityStatus.InReview, 'task'),
    ];

    expect(
      visibleHistoryReleases(releases, 'latest-draft').map(({ id }) => id)
    ).toEqual(['latest-draft', 'reviewed-draft', 'approved', 'in-review']);
  });

  it('keeps every draft out of the way of a newer decided release', () => {
    const releases = [
      release('approved', EntityStatus.Approved),
      release('old-draft', EntityStatus.Draft),
    ];

    expect(
      visibleHistoryReleases(releases, 'approved').map(({ id }) => id)
    ).toEqual(['approved']);
  });
});

describe('getPublicationActions', () => {
  const base: PublicationActionInput = {
    stage: Stage.Draft,
    canEdit: true,
    hasReviewers: true,
    hasIndependentReviewer: true,
    hasChanges: true,
    changedSinceRejection: true,
    validationErrors: [],
    isReady: true,
    isRequester: true,
    version: '1.2.0',
  };
  const row = (override: Partial<PublicationActionInput>) =>
    getPublicationActions({ ...base, ...override });

  it('no reviewers, changes, valid: Publish enabled, Save as release draft enabled', () => {
    expect(row({ hasReviewers: false })).toEqual({
      state: 'noReviewers',
      primary: { kind: 'publish', isDisabled: false },
      secondary: { kind: 'saveDraft', isDisabled: false },
      text: 'message.ontology-publication-no-reviewers',
      errors: [],
    });
  });

  it('no reviewers with validation errors: Publish disabled and the errors returned', () => {
    expect(row({ hasReviewers: false, validationErrors: ['A', 'B'] })).toEqual({
      state: 'noReviewersInvalid',
      primary: { kind: 'publish', isDisabled: true },
      secondary: { kind: 'saveDraft', isDisabled: false },
      text: 'message.ontology-publication-fix-to-publish',
      errors: ['A', 'B'],
    });
  });

  it('reviewers set: Request review', () => {
    expect(row({})).toEqual({
      state: 'reviewersSet',
      primary: { kind: 'requestReview', isDisabled: false },
      secondary: { kind: 'saveDraft', isDisabled: false },
      text: 'message.ontology-publication-draft-stays-editable',
      errors: [],
    });
  });

  it('only reviewer is the caller: Request review disabled', () => {
    expect(row({ hasIndependentReviewer: false })).toEqual({
      state: 'soloReviewer',
      primary: { kind: 'requestReview', isDisabled: true },
      secondary: { kind: 'saveDraft', isDisabled: false },
      text: 'message.ontology-publication-solo-reviewer',
      errors: [],
    });
  });

  it('review open: Publish disabled and Withdraw only for the requester', () => {
    expect(row({ stage: Stage.InReview })).toEqual({
      state: 'inReview',
      primary: { kind: 'publish', isDisabled: true },
      secondary: { kind: 'withdraw', isDisabled: false },
      text: 'message.ontology-publication-waiting-for',
      errors: [],
    });
    expect(row({ stage: Stage.InReview, isRequester: false }).secondary).toBe(
      null
    );
  });

  it('approved: Publish for an editor, nothing for anyone else', () => {
    expect(row({ stage: Stage.Approved })).toEqual({
      state: 'approvedCanPublish',
      primary: { kind: 'publish', isDisabled: false },
      secondary: null,
      text: 'message.ontology-publication-approved-by',
      errors: [],
    });
    expect(row({ stage: Stage.Approved, canEdit: false })).toEqual({
      state: 'approvedCannotPublish',
      primary: null,
      secondary: null,
      text: 'message.ontology-publication-only-author-publishes',
      errors: [],
    });
  });

  it('published with new changes: the draft rows apply again', () => {
    expect(row({ stage: Stage.Published }).state).toBe('reviewersSet');
    expect(row({ stage: Stage.Published, hasReviewers: false }).state).toBe(
      'noReviewers'
    );
  });

  it('published: the active release offers no action, only the nothing-to-capture line', () => {
    expect(row({ stage: Stage.Published, hasChanges: false })).toEqual({
      state: 'published',
      primary: null,
      secondary: null,
      text: 'message.ontology-publication-no-changes',
      errors: [],
    });
  });

  it('rejected: Request review again stays disabled until a change exists', () => {
    expect(
      row({ stage: Stage.ChangesRequested, changedSinceRejection: false })
    ).toEqual({
      state: 'rejected',
      primary: { kind: 'requestReviewAgain', isDisabled: true },
      secondary: { kind: 'saveDraft', isDisabled: true },
      text: 'message.ontology-publication-edit-then-request-again',
      errors: [],
    });
    expect(row({ stage: Stage.ChangesRequested }).primary?.isDisabled).toBe(
      false
    );
  });

  it('a caller who cannot edit gets no action', () => {
    expect(row({ canEdit: false })).toEqual({
      state: 'cannotEdit',
      primary: null,
      secondary: null,
      text: 'message.ontology-publication-needs-author-role',
      errors: [],
    });
  });

  it('no unpublished changes: both actions disabled', () => {
    expect(row({ hasChanges: false, hasReviewers: false })).toEqual({
      state: 'noChanges',
      primary: { kind: 'publish', isDisabled: true },
      secondary: { kind: 'saveDraft', isDisabled: true },
      text: 'message.ontology-publication-no-changes',
      errors: [],
    });
  });

  it('a write that is not ready disables the enabled actions', () => {
    expect(row({ isReady: false }).primary?.isDisabled).toBe(true);
    expect(row({ isReady: false }).secondary?.isDisabled).toBe(true);
  });
});

describe('release display status', () => {
  const at = (
    id: string,
    revision: number,
    entityStatus: EntityStatus,
    extra: Partial<OntologyRelease> = {}
  ) =>
    ({
      id,
      releaseRevision: revision,
      entityStatus,
      ...extra,
    } as OntologyRelease);
  const active = at('active', 5, EntityStatus.Approved);

  it.each([
    ['the active release', active, 'active'],
    [
      'an older approved release',
      at('old', 3, EntityStatus.Approved),
      'superseded',
    ],
    [
      'a newer approved release',
      at('new', 6, EntityStatus.Approved),
      'approved',
    ],
    ['a release in review', at('rev', 7, EntityStatus.InReview), 'inReview'],
    ['a rejected release', at('rej', 7, EntityStatus.Rejected), 'rejected'],
    ['a draft never sent for review', at('d', 7, EntityStatus.Draft), 'draft'],
  ])('reads %s as %s', (_, release, expected) => {
    expect(releaseDisplayStatus(release, active)).toBe(expected);
  });

  it('reads a draft whose review was withdrawn as withdrawn', () => {
    expect(
      releaseDisplayStatus(at('wd', 7, EntityStatus.Draft), active, true)
    ).toBe('withdrawn');
  });

  it('keeps an approved release approved when nothing is active', () => {
    expect(releaseDisplayStatus(at('a', 1, EntityStatus.Approved))).toBe(
      'approved'
    );
  });
});

describe('release bump', () => {
  it.each([
    ['1.1.0', '1.0.0', VersionBump.Minor],
    ['1.0.1', '1.0.0', VersionBump.Patch],
    ['2.0.0', '1.4.2', VersionBump.Major],
    ['1.0.0', undefined, undefined],
    [undefined, '1.0.0', undefined],
    ['1.0', '1.0.0', undefined],
  ])('reads %s from %s as %s', (version, base, expected) => {
    expect(releaseBump(version, base)).toBe(expected);
  });
});
