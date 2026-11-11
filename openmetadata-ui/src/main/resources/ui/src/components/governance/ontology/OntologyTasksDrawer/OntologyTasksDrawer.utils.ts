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

import { QueryClient } from '@tanstack/react-query';
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import type { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import {
  ONTOLOGY_RELEASE_VALIDATION_QUERY_KEY,
  ONTOLOGY_WORKING_DIFF_QUERY_KEY,
  PROJECTION_QUERY,
  RELEASE_QUERY,
  REVIEW_QUERY,
} from '../../../../hooks/governance/ontology/useOntologyPublication';
import { ONTOLOGY_STUDIO_MODEL_QUERY_KEY } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY } from '../../../../hooks/governance/ontology/useOntologyStudioScopes';

/**
 * The reads `useOntologyPublication`'s `refresh` invalidates after its own
 * withdraw, so a withdraw from Tasks updates the publish button, release
 * history and unpublished count the same way.
 */
const PUBLICATION_QUERY_KEYS = [
  PROJECTION_QUERY,
  RELEASE_QUERY,
  REVIEW_QUERY,
  'ontology-state',
  'ontology-release-history',
  'ontology-release-events',
  ONTOLOGY_WORKING_DIFF_QUERY_KEY,
  ONTOLOGY_RELEASE_VALIDATION_QUERY_KEY,
  ONTOLOGY_STUDIO_MODEL_QUERY_KEY,
  ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY,
];

export const invalidatePublicationReads = (queryClient: QueryClient) =>
  Promise.allSettled(
    PUBLICATION_QUERY_KEYS.map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    )
  );

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
