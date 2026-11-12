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
import type { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';

/**
 * The open reviews the Studio banner may announce: those the caller votes on,
 * then those the caller requested, once each.
 */
export const getOpenReviews = (
  ...lists: (OntologyReleaseReview[] | undefined)[]
) => {
  const seen = new Set<string>();

  return lists
    .flatMap((list) => list ?? [])
    .filter((review) => {
      const duplicate = seen.has(review.task.id);
      seen.add(review.task.id);

      return !duplicate;
    });
};

/** The bump between two semantic versions; a first release counts from 0.0.0. */
export const releaseBump = (
  base: string | undefined,
  version: string | undefined
) => {
  if (!version) {
    return undefined;
  }
  const [major, minor] = (base ?? '0.0.0').split('.');
  const [nextMajor, nextMinor] = version.split('.');
  if (major !== nextMajor) {
    return VersionBump.Major;
  }

  return minor === nextMinor ? VersionBump.Patch : VersionBump.Minor;
};

/** Paging controls only help once there is a page to move to or back from. */
export const hasMorePages = (after: string | undefined, pagesSeen: number) =>
  Boolean(after) || pagesSeen > 1;

/** The loaded reviews whose title, task id, ontology or requester matches the search. */
export const filterReviews = (
  reviews: OntologyReleaseReview[],
  search: string
) => {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return reviews;
  }

  return reviews.filter((review) =>
    [
      review.task.displayName,
      review.taskId,
      review.ontology.displayName ?? review.ontology.name,
      review.requester?.displayName ?? review.requester?.name,
    ].some((value) => value?.toLowerCase().includes(needle))
  );
};
