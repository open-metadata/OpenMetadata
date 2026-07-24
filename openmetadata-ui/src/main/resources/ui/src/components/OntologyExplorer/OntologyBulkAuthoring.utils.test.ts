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
  Operation,
} from '../../generated/api/data/ontologyBulkRequest';
import {
  buildOntologyBulkRequest,
  EMPTY_BULK_FORM,
  isActiveOntologyBulkJob,
  isOntologyBulkFormReady,
} from './OntologyBulkAuthoring.utils';

const GLOSSARY_ID = '831c26a6-e266-43d6-bca5-f116dcc31a46';

describe('OntologyBulkAuthoring.utils', () => {
  it('builds a typed find and replace request', () => {
    const request = buildOntologyBulkRequest(GLOSSARY_ID, {
      ...EMPTY_BULK_FORM,
      caseSensitive: true,
      changeSetDescription: 'Normalize descriptions',
      changeSetName: 'normalize-descriptions',
      field: MatchField.Description,
      find: 'Customer',
      matchMode: MatchMode.Exact,
      operation: Operation.FindReplace,
      replacement: 'Client',
    });

    expect(request).toEqual(
      expect.objectContaining({
        findReplace: {
          caseSensitive: true,
          field: MatchField.Description,
          find: 'Customer',
          matchMode: MatchMode.Exact,
          replacement: 'Client',
        },
        glossaryId: GLOSSARY_ID,
        operation: Operation.FindReplace,
      })
    );
  });

  it('parses an optional bounded term scope for retyping', () => {
    const request = buildOntologyBulkRequest(GLOSSARY_ID, {
      ...EMPTY_BULK_FORM,
      changeSetDescription: 'Retype relationships',
      changeSetName: 'retype-relationships',
      fromRelationshipTypeId: 'from-id',
      operation: Operation.RetypeRelationships,
      termIds: 'first-id, second-id\nthird-id',
      toRelationshipTypeId: 'to-id',
    });

    expect(request.retype?.termIds).toEqual([
      'first-id',
      'second-id',
      'third-id',
    ]);
  });

  it('requires operation-specific values and distinct retype identifiers', () => {
    const baseForm = {
      ...EMPTY_BULK_FORM,
      changeSetDescription: 'Description',
      changeSetName: 'bulk-change',
    };

    expect(isOntologyBulkFormReady(GLOSSARY_ID, baseForm)).toBe(false);
    expect(
      isOntologyBulkFormReady(GLOSSARY_ID, {
        ...baseForm,
        csv: 'action,termId,name,displayName,description,parentId,iri',
      })
    ).toBe(true);
    expect(
      isOntologyBulkFormReady(GLOSSARY_ID, {
        ...baseForm,
        fromRelationshipTypeId: 'same-id',
        operation: Operation.RetypeRelationships,
        toRelationshipTypeId: 'same-id',
      })
    ).toBe(false);
  });

  it('recognizes only queued and running jobs as active', () => {
    const job = { status: Status.Queued } as OntologyBulkJob;

    expect(isActiveOntologyBulkJob(job)).toBe(true);
    expect(isActiveOntologyBulkJob({ ...job, status: Status.Running })).toBe(
      true
    );
    expect(isActiveOntologyBulkJob({ ...job, status: Status.Completed })).toBe(
      false
    );
  });
});
