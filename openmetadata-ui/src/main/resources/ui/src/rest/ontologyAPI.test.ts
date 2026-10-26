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

import { OntologyConceptType } from '../generated/api/data/createOntologyConcept';
import { Operation } from '../generated/api/data/ontologyBulkRequest';
import { OntologyChangeSetCommand } from '../generated/api/data/ontologyChangeSetCommand';
import { OntologyChangeSetState } from '../generated/entity/data/ontologyChangeSet';
import APIClient from './axiosClient';
import {
  activateOntologyRelease,
  captureOntologyRelease,
  createOntology,
  createOntologyConcept,
  generateOntologyDomainDraft,
  generateOntologySparql,
  getOntologyBulkTemplate,
  getOntologyByName,
  getOntologyChangeSet,
  getOntologyRelease,
  getOntologyReleaseReview,
  getOntologyReleaseValidation,
  getRdfEntityDiff,
  installOntologyPack,
  listInferenceRules,
  listOntologies,
  listOntologyBulkJobs,
  listOntologyChangeSets,
  listOntologyConcepts,
  listOntologyPacks,
  listOntologyReleases,
  listRelationshipTypes,
  materializeInferenceRules,
  patchOntologyConcept,
  releaseOntologyEditLock,
  submitOntologyBulkOperation,
  suggestOntologyMappings,
  suggestOntologyRelationships,
  undoOntologyChangeSet,
  upsertInferenceRule,
} from './ontologyAPI';

jest.mock('./axiosClient', () => ({
  delete: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

const mockedApiClient = APIClient as jest.Mocked<typeof APIClient>;

describe('ontologyAPI', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it.each([
    ['review', getOntologyReleaseReview],
    ['validation', getOntologyReleaseValidation],
  ] as const)(
    'reads the selected captured %s with cancellation and encoded identity',
    async (endpoint, read) => {
      const response = { releaseId: 'release/id', marker: endpoint };
      mockedApiClient.get.mockResolvedValue({ data: response });
      const controller = new AbortController();

      expect(await read('release/id', controller.signal)).toEqual(response);
      expect(mockedApiClient.get.mock.calls.map(([url]) => url)).toEqual([
        '/ontologyReleases/release%2Fid/' + endpoint,
      ]);
      expect(mockedApiClient.get.mock.calls[0][1]?.signal).toBe(
        controller.signal
      );

      mockedApiClient.get.mockRejectedValue(new Error('Read denied'));

      await expect(read('release/id')).rejects.toThrow('Read denied');
    }
  );

  it('recovers a native ontology by its frozen encoded name', async () => {
    const ontology = {
      id: 'ontology-id',
      name: 'library name',
      iri: 'urn:library',
    };
    mockedApiClient.get.mockResolvedValue({ data: ontology });

    expect(await getOntologyByName('library name')).toEqual(ontology);
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/ontologies/name/library%20name'
    );
  });

  it('creates native ontology definitions and patches by identity', async () => {
    const ontology = {
      name: 'Sales',
      iri: 'urn:sales',
      namespace: 'urn:sales:',
    };
    const concept = {
      name: 'Customer',
      ontology: 'Sales',
      conceptType: OntologyConceptType.OwlClass,
    };
    mockedApiClient.post.mockResolvedValue({ data: { id: 'created' } });
    mockedApiClient.patch.mockResolvedValue({ data: { id: 'updated' } });

    expect(await createOntology(ontology)).toEqual({ id: 'created' });
    expect(mockedApiClient.post).toHaveBeenLastCalledWith(
      '/ontologies',
      ontology
    );
    expect(await createOntologyConcept(concept)).toEqual({ id: 'created' });
    expect(mockedApiClient.post).toHaveBeenLastCalledWith(
      '/ontologyConcepts',
      concept
    );

    const patch = [{ op: 'test' as const, path: '/version', value: 0.1 }];

    expect(await patchOntologyConcept('concept/id', patch)).toEqual({
      id: 'updated',
    });
    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/ontologyConcepts/concept%2Fid',
      patch,
      {
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
  });

  it('browses sealed releases by native owner and reads a selected release', async () => {
    const release = { id: 'release-id', ontology: { id: 'ontology-id' } };
    mockedApiClient.get
      .mockResolvedValueOnce({
        data: { data: [release], paging: { total: 1 } },
      })
      .mockResolvedValueOnce({ data: release });
    const signal = new AbortController().signal;

    await listOntologyReleases(
      'ontology-id',
      { limit: 25, after: 'cursor' },
      signal
    );

    expect(mockedApiClient.get).toHaveBeenLastCalledWith('/ontologyReleases', {
      params: { ontologyId: 'ontology-id', limit: 25, after: 'cursor' },
      signal,
    });
    expect(await getOntologyRelease('release-id', signal)).toEqual(release);
    expect(mockedApiClient.get).toHaveBeenLastCalledWith(
      '/ontologyReleases/release-id',
      { signal }
    );
  });

  it('uses dedicated ontology collections and preserves cursor paging', async () => {
    const response = {
      data: { data: [], paging: { total: 150, after: 'next' } },
    };
    mockedApiClient.get.mockResolvedValue(response);
    const signal = new AbortController().signal;

    expect(await listOntologies({ limit: 25, after: 'first' }, signal)).toEqual(
      response.data
    );
    expect(mockedApiClient.get).toHaveBeenLastCalledWith('/ontologies', {
      params: { limit: 25, after: 'first' },
      signal,
    });

    await listOntologyConcepts(
      { ontology: 'Sales', fields: 'superClasses,subClasses', limit: 25 },
      signal
    );

    expect(mockedApiClient.get).toHaveBeenLastCalledWith('/ontologyConcepts', {
      params: {
        ontology: 'Sales',
        fields: 'superClasses,subClasses',
        limit: 25,
      },
      signal,
    });
  });

  it('captures the selected working revision', async () => {
    const request = {
      expectedWorkingRevision: 7,
    };
    const release = { id: 'candidate', contentDigest: 'sealed' };
    mockedApiClient.post.mockResolvedValue({ data: release });

    expect(await captureOntologyRelease('ontology-id', request)).toEqual(
      release
    );
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontologies/ontology-id/releases',
      request
    );
  });

  it('preserves activation conflicts for a reload instead of retrying with a newer revision', async () => {
    const conflict = new Error('Activation changed');
    const request = {
      releaseId: 'approved-release',
      expectedActivationRevision: 2,
    };
    mockedApiClient.put.mockRejectedValue(conflict);

    await expect(activateOntologyRelease('ontology-id', request)).rejects.toBe(
      conflict
    );
    expect(mockedApiClient.put).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.put).toHaveBeenCalledWith(
      '/ontologies/ontology-id/activation',
      request
    );
  });

  it('lists governed relationship types with paging parameters', async () => {
    const response = { data: { data: [], paging: { total: 0 } } };
    mockedApiClient.get.mockResolvedValue(response);

    const result = await listRelationshipTypes({ limit: 25 });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/relationshipTypes', {
      params: { limit: 25 },
    });
    expect(result).toEqual(response.data);
  });

  it('lists memory drafts across several states in one request', async () => {
    mockedApiClient.get.mockResolvedValue({ data: { data: [], paging: {} } });

    await listOntologyChangeSets({
      memorySourced: true,
      state: [OntologyChangeSetState.Draft, OntologyChangeSetState.Submitted],
    });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/ontologyChangeSets', {
      params: {
        memorySourced: true,
        state: [OntologyChangeSetState.Draft, OntologyChangeSetState.Submitted],
      },
    });
  });

  it('reads one change set with the requested fields', async () => {
    const changeSet = { id: 'draft-id' };
    mockedApiClient.get.mockResolvedValue({ data: changeSet });

    expect(await getOntologyChangeSet('draft-id', 'operations')).toEqual(
      changeSet
    );
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/ontologyChangeSets/draft-id',
      { params: { fields: 'operations' } }
    );
  });

  it('routes typed draft commands to the requested change set', async () => {
    const request: OntologyChangeSetCommand = {
      lease: { sessionId: 'editor-session', version: 2 },
    };
    const response = { data: { id: 'change-set-id' } };
    mockedApiClient.post.mockResolvedValue(response);

    const result = await undoOntologyChangeSet('change-set-id', request);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontologyChangeSets/change-set-id/undo',
      request
    );
    expect(result).toEqual(response.data);
  });

  it('loads the typed ontology bulk CSV template', async () => {
    const response = {
      data: {
        csv: 'action,termId,name,displayName,description,parentId,iri',
        fileName: 'ontology-bulk-template.csv',
      },
    };
    mockedApiClient.get.mockResolvedValue(response);

    const result = await getOntologyBulkTemplate();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/ontology/bulk/template');
    expect(result).toEqual(response.data);
  });

  it('submits and lists typed ontology bulk work', async () => {
    const request = {
      changeSetDescription: 'Create concepts',
      changeSetName: 'create-concepts',
      csv: 'action,termId,name,displayName,description,parentId,iri',
      dryRun: true,
      glossaryId: 'glossary-id',
      operation: Operation.CSVUpsert,
    };
    const submission = { data: { executionMode: 'SYNCHRONOUS' } };
    const jobs = { data: { jobs: [] } };
    mockedApiClient.post.mockResolvedValue(submission);
    mockedApiClient.get.mockResolvedValue(jobs);

    const submitResult = await submitOntologyBulkOperation(request);
    const jobsResult = await listOntologyBulkJobs(25);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontology/bulk',
      request
    );
    expect(mockedApiClient.get).toHaveBeenCalledWith('/ontology/bulk/jobs', {
      params: { limit: 25 },
    });
    expect(submitResult).toEqual(submission.data);
    expect(jobsResult).toEqual(jobs.data);
  });

  it('releases only the caller edit session', async () => {
    mockedApiClient.delete.mockResolvedValue({ data: undefined });

    await releaseOntologyEditLock(
      'ontologyChangeSet',
      'change-set-id',
      'editor-session'
    );

    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      '/ontologyEditLocks/ontologyChangeSet/change-set-id',
      { params: { sessionId: 'editor-session' } }
    );
  });

  it('requests a canonical RDF diff for explicit versions', async () => {
    const response = {
      data: {
        addedStatements: [],
        entityId: 'entity-id',
        entityType: 'glossaryTerm',
        fromVersion: 0.1,
        removedStatements: [],
        toVersion: 0.2,
      },
    };
    mockedApiClient.get.mockResolvedValue(response);

    const result = await getRdfEntityDiff(
      'glossaryTerm',
      'entity-id',
      0.1,
      0.2
    );

    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/rdf/entity/glossaryTerm/entity-id/diff',
      { params: { fromVersion: 0.1, toVersion: 0.2 } }
    );
    expect(result).toEqual(response.data);
  });

  it('lists inference rules with durable materialization state', async () => {
    const response = { data: { rules: [] } };
    mockedApiClient.get.mockResolvedValue(response);

    const result = await listInferenceRules();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/rdf/rules');
    expect(result).toEqual(response.data);
  });

  it('upserts a typed inference rule by its stable name', async () => {
    const rule = {
      name: 'custom-rule',
      ruleBody: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
    };
    const response = { data: { dirty: true, rule } };
    mockedApiClient.put.mockResolvedValue(response);

    const result = await upsertInferenceRule(rule.name, rule);

    expect(mockedApiClient.put).toHaveBeenCalledWith(
      '/rdf/rules/custom-rule',
      rule
    );
    expect(result).toEqual(response.data);
  });

  it('materializes one rule with explicit force semantics', async () => {
    const response = { data: { failedRules: 0, successfulRules: 1 } };
    mockedApiClient.post.mockResolvedValue(response);

    const result = await materializeInferenceRules(true, 'custom-rule');

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/rdf/rules/materialize',
      undefined,
      { params: { force: true, ruleName: 'custom-rule' } }
    );
    expect(result).toEqual(response.data);
  });

  it('lists the typed ontology library catalogue', async () => {
    const response = { data: { packs: [] } };
    mockedApiClient.get.mockResolvedValue(response);

    const result = await listOntologyPacks();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/ontologyPacks');
    expect(result).toEqual(response.data);
  });

  it('installs selected ontology modules with an explicit dry run', async () => {
    const request = {
      dryRun: true,
      moduleIds: ['clinical'],
      targetGlossaryName: 'FHIR Reference',
    };
    const response = {
      data: { dryRun: true, moduleIds: ['core', 'clinical'] },
    };
    mockedApiClient.post.mockResolvedValue(response);

    const result = await installOntologyPack('fhir', request);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontologyPacks/fhir/install',
      request
    );
    expect(result).toEqual(response.data);
  });

  it('requests typed relationship proposals without applying them', async () => {
    const request = {
      candidateTermIds: ['target-id'],
      glossary: 'Finance',
      maxSuggestions: 5,
      relationshipTypeIds: ['type-id'],
      sourceTermIds: ['source-id'],
    };
    const response = {
      data: { generatedAt: 1, modelId: 'model', suggestions: [] },
    };
    mockedApiClient.post.mockResolvedValue(response);

    const result = await suggestOntologyRelationships(request);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontology/ai/relationships/suggestions',
      request
    );
    expect(result).toEqual(response.data);
  });

  it('requests typed standards-mapping proposals', async () => {
    const request = {
      glossary: 'Finance',
      maxSuggestions: 5,
      sourceTermIds: ['source-id'],
      standards: ['FIBO'],
    };
    const response = {
      data: { generatedAt: 1, modelId: 'model', suggestions: [] },
    };
    mockedApiClient.post.mockResolvedValue(response);

    const result = await suggestOntologyMappings(request);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontology/ai/mappings/suggestions',
      request
    );
    expect(result).toEqual(response.data);
  });

  it('generates visible SPARQL from a natural-language question', async () => {
    const request = {
      glossaries: ['Finance'],
      question: 'Show every concept',
    };
    const response = {
      data: {
        explanation: 'Lists every concept.',
        generatedAt: 1,
        modelId: 'model',
        query: 'SELECT ?concept WHERE { ?concept ?predicate ?value }',
      },
    };
    mockedApiClient.post.mockResolvedValue(response);

    const result = await generateOntologySparql(request);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontology/ai/sparql',
      request
    );
    expect(result).toEqual(response.data);
  });

  it('generates a reviewable domain payload without persisting it', async () => {
    const request = {
      changeSetName: 'retail_draft',
      description: 'Review retail concepts',
      displayName: 'Retail draft',
      domainDescription: 'Model retail banking',
      glossary: 'Finance',
      maxConcepts: 25,
    };
    const response = {
      data: {
        draft: {
          description: request.description,
          displayName: request.displayName,
          glossaries: [request.glossary],
          name: request.changeSetName,
        },
        generatedAt: 1,
        modelId: 'model',
      },
    };
    mockedApiClient.post.mockResolvedValue(response);

    const result = await generateOntologyDomainDraft(request);

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/ontology/ai/drafts',
      request
    );
    expect(result).toEqual(response.data);
  });
});
