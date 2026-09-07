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

import { Operation } from '../generated/api/data/ontologyBulkRequest';
import { OntologyChangeSetCommand } from '../generated/api/data/ontologyChangeSetCommand';
import APIClient from './index';
import {
  generateOntologyDomainDraft,
  generateOntologySparql,
  getOntologyBulkTemplate,
  getRdfEntityDiff,
  installOntologyPack,
  listInferenceRules,
  listOntologyBulkJobs,
  listOntologyPacks,
  listRelationshipTypes,
  materializeInferenceRules,
  releaseOntologyEditLock,
  submitOntologyBulkOperation,
  suggestOntologyMappings,
  suggestOntologyRelationships,
  undoOntologyChangeSet,
  upsertInferenceRule,
} from './ontologyAPI';

jest.mock('./index', () => ({
  delete: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

const mockedApiClient = APIClient as jest.Mocked<typeof APIClient>;

describe('ontologyAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
