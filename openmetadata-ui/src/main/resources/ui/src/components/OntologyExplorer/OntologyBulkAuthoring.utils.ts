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
  OntologyBulkJob,
  Status,
} from '../../generated/api/data/ontologyBulkJob';
import {
  MatchField,
  MatchMode,
  OntologyBulkRequest,
  Operation,
} from '../../generated/api/data/ontologyBulkRequest';

export interface OntologyBulkFormState {
  caseSensitive: boolean;
  changeSetDescription: string;
  changeSetDisplayName: string;
  changeSetName: string;
  csv: string;
  dryRun: boolean;
  field: MatchField;
  find: string;
  fromRelationshipTypeId: string;
  matchMode: MatchMode;
  operation: Operation;
  replacement: string;
  termIds: string;
  toRelationshipTypeId: string;
}

export const EMPTY_BULK_FORM: OntologyBulkFormState = {
  caseSensitive: false,
  changeSetDescription: '',
  changeSetDisplayName: '',
  changeSetName: '',
  csv: '',
  dryRun: true,
  field: MatchField.Description,
  find: '',
  fromRelationshipTypeId: '',
  matchMode: MatchMode.Contains,
  operation: Operation.CSVUpsert,
  replacement: '',
  termIds: '',
  toRelationshipTypeId: '',
};

const parseTermIds = (value: string): string[] =>
  value
    .split(/[\s,]+/)
    .map((termId) => termId.trim())
    .filter(Boolean);

export const buildOntologyBulkRequest = (
  glossaryId: string,
  form: OntologyBulkFormState
): OntologyBulkRequest => {
  const common = {
    changeSetDescription: form.changeSetDescription.trim(),
    changeSetDisplayName: form.changeSetDisplayName.trim() || undefined,
    changeSetName: form.changeSetName.trim(),
    dryRun: form.dryRun,
    glossaryId,
    operation: form.operation,
  };
  let request: OntologyBulkRequest;

  switch (form.operation) {
    case Operation.CSVUpsert:
      request = { ...common, csv: form.csv };

      break;
    case Operation.FindReplace:
      request = {
        ...common,
        findReplace: {
          caseSensitive: form.caseSensitive,
          field: form.field,
          find: form.find,
          matchMode: form.matchMode,
          replacement: form.replacement,
        },
      };

      break;
    case Operation.RetypeRelationships: {
      const termIds = parseTermIds(form.termIds);
      request = {
        ...common,
        retype: {
          fromRelationshipTypeId: form.fromRelationshipTypeId,
          termIds: termIds.length > 0 ? termIds : undefined,
          toRelationshipTypeId: form.toRelationshipTypeId,
        },
      };

      break;
    }
  }

  return request;
};

export const isOntologyBulkFormReady = (
  glossaryId: string | undefined,
  form: OntologyBulkFormState
): boolean => {
  const hasChangeSetMetadata =
    Boolean(glossaryId) &&
    Boolean(form.changeSetName.trim()) &&
    Boolean(form.changeSetDescription.trim());
  let hasOperationValues: boolean;

  switch (form.operation) {
    case Operation.CSVUpsert:
      hasOperationValues = Boolean(form.csv.trim());

      break;
    case Operation.FindReplace:
      hasOperationValues = Boolean(form.find.trim());

      break;
    case Operation.RetypeRelationships:
      hasOperationValues =
        Boolean(form.fromRelationshipTypeId) &&
        Boolean(form.toRelationshipTypeId) &&
        form.fromRelationshipTypeId !== form.toRelationshipTypeId;

      break;
  }

  return hasChangeSetMetadata && hasOperationValues;
};

export const isActiveOntologyBulkJob = (job: OntologyBulkJob): boolean =>
  job.status === Status.Queued || job.status === Status.Running;

export const artifactFileName = (jobId?: number): string =>
  jobId ? `ontology-bulk-${jobId}.json` : 'ontology-bulk-result.json';
