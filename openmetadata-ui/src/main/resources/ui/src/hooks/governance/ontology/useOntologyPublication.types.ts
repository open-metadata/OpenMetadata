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
import type { CaptureOntologyRelease } from '../../../generated/api/data/captureOntologyRelease';
import type { OntologyReleaseReview } from '../../../generated/api/data/ontologyReleaseReview';
import type { Ontology } from '../../../generated/entity/data/ontology';
import type { OntologyRelease } from '../../../generated/entity/data/ontologyRelease';
import type { OntologyState } from '../../../generated/type/ontologyState';

export type PublicationRead<T> =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: 'failed' | 'stale' | 'missing' }
  | { kind: 'ready'; value: T };

export type ReviewSettings = Required<
  Pick<Ontology, 'reviewers' | 'approvalRule'>
>;
export type OntologyReleaseMetadata = Pick<
  CaptureOntologyRelease,
  'versionBump' | 'releaseNotes'
>;
export type CurrentPublication = {
  ontology: Ontology;
  state: OntologyState;
  candidate: OntologyRelease | null;
  review: OntologyReleaseReview | null;
};
export type ReceiptScope = {
  origin: string;
  userId: string;
  ontologyId: string;
};
export type CapturedIdentity = Pick<
  OntologyRelease,
  | 'id'
  | 'releaseRevision'
  | 'semanticVersion'
  | 'contentDigest'
  | 'sourceWorkingRevision'
  | 'fullyQualifiedName'
  | 'baseReleaseId'
  | 'releaseNotes'
>;
export type PublicationReceipt = ReceiptScope & { state: OntologyState } & (
    | {
        operation: 'capture';
        phase: 'running' | 'unknown';
        intent: 'capture' | 'review';
        metadata: OntologyReleaseMetadata;
        expectedVersion?: string;
      }
    | {
        operation: 'review';
        phase: 'running' | 'unknown' | 'failed';
        release: CapturedIdentity;
      }
    | {
        operation: 'activation';
        phase: 'running' | 'unknown' | 'conflict';
        release: CapturedIdentity;
      }
  );
export type ReceiptRead = PublicationRead<PublicationReceipt | null>;
export type SettingsOutcome = { kind: 'saved' | 'conflict' | 'unavailable' };
