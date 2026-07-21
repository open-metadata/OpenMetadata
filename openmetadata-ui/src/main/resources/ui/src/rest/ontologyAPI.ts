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

import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import { InferenceMaterializationResult } from '../generated/api/configuration/rdf/inferenceMaterializationResult';
import { InferenceRuleList } from '../generated/api/configuration/rdf/inferenceRuleList';
import {
  InferenceRule,
  InferenceRuleStatus,
} from '../generated/api/configuration/rdf/inferenceRuleStatus';
import { AcquireOntologyEditLock } from '../generated/api/data/acquireOntologyEditLock';
import { ApplyOntologyChangeSet } from '../generated/api/data/applyOntologyChangeSet';
import { BuildOntologySubset } from '../generated/api/data/buildOntologySubset';
import { CreateOntologyAxiom } from '../generated/api/data/createOntologyAxiom';
import { CreateOntologyChangeSet } from '../generated/api/data/createOntologyChangeSet';
import { CreateRelationshipType } from '../generated/api/data/createRelationshipType';
import { DeleteOntologyResource } from '../generated/api/data/deleteOntologyResource';
import { InstallOntologyPack } from '../generated/api/data/installOntologyPack';
import { InstantiateOntologyPattern } from '../generated/api/data/instantiateOntologyPattern';
import { MergeOntologyStructure } from '../generated/api/data/mergeOntologyStructure';
import { OntologyBulkJob } from '../generated/api/data/ontologyBulkJob';
import { OntologyBulkJobList } from '../generated/api/data/ontologyBulkJobList';
import { OntologyBulkRequest } from '../generated/api/data/ontologyBulkRequest';
import { OntologyBulkResultArtifact } from '../generated/api/data/ontologyBulkResultArtifact';
import { OntologyBulkSubmission } from '../generated/api/data/ontologyBulkSubmission';
import { OntologyBulkTemplate } from '../generated/api/data/ontologyBulkTemplate';
import { OntologyChangeSetCommand } from '../generated/api/data/ontologyChangeSetCommand';
import { OntologyDeleteResult } from '../generated/api/data/ontologyDeleteResult';
import { OntologyDomainDraftRequest } from '../generated/api/data/ontologyDomainDraftRequest';
import {
  CreateOntologyChangeSetRequest,
  OntologyDomainDraftResult,
} from '../generated/api/data/ontologyDomainDraftResult';
import { OntologyImpactReport } from '../generated/api/data/ontologyImpactReport';
import { OntologyInferenceExplanation } from '../generated/api/data/ontologyInferenceExplanation';
import { OntologyInferenceExplanationRequest } from '../generated/api/data/ontologyInferenceExplanationRequest';
import { OntologyIRIPreview } from '../generated/api/data/ontologyIriPreview';
import { OntologyIRIPreviewRequest } from '../generated/api/data/ontologyIriPreviewRequest';
import { OntologyMappingSuggestionList } from '../generated/api/data/ontologyMappingSuggestionList';
import { OntologyMappingSuggestionRequest } from '../generated/api/data/ontologyMappingSuggestionRequest';
import { OntologyNaturalLanguageQueryRequest } from '../generated/api/data/ontologyNaturalLanguageQueryRequest';
import { OntologyNaturalLanguageQueryResult } from '../generated/api/data/ontologyNaturalLanguageQueryResult';
import { OntologyPackInstallResult } from '../generated/api/data/ontologyPackInstallResult';
import { OntologyPackList } from '../generated/api/data/ontologyPackList';
import { OntologyPackManifest } from '../generated/api/data/ontologyPackManifest';
import { OntologyPatternInstantiationResult } from '../generated/api/data/ontologyPatternInstantiationResult';
import { OntologyPatternList } from '../generated/api/data/ontologyPatternList';
import { OntologyProfileReport } from '../generated/api/data/ontologyProfileReport';
import { OntologyRelationshipSuggestionList } from '../generated/api/data/ontologyRelationshipSuggestionList';
import { OntologyRelationshipSuggestionRequest } from '../generated/api/data/ontologyRelationshipSuggestionRequest';
import { OntologyStructuralDiff } from '../generated/api/data/ontologyStructuralDiff';
import { OntologyStructuralDiffRequest } from '../generated/api/data/ontologyStructuralDiffRequest';
import { OntologyStructuralMergeResult } from '../generated/api/data/ontologyStructuralMergeResult';
import { OntologySubsetResult } from '../generated/api/data/ontologySubsetResult';
import { RDFEntityDiff } from '../generated/api/data/rdfEntityDiff';
import { UpdateOntologyChangeSet } from '../generated/api/data/updateOntologyChangeSet';
import { OntologyAxiom } from '../generated/entity/data/ontologyAxiom';
import { OntologyChangeSet } from '../generated/entity/data/ontologyChangeSet';
import { RelationshipType } from '../generated/entity/data/relationshipType';
import { OntologyEditLock } from '../generated/type/ontologyEditLock';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

const RELATIONSHIP_TYPES_PATH = '/relationshipTypes';
const ONTOLOGY_AXIOMS_PATH = '/ontologyAxioms';
const CHANGE_SETS_PATH = '/ontologyChangeSets';
const EDIT_LOCKS_PATH = '/ontologyEditLocks';
const INFERENCE_RULES_PATH = '/rdf/rules';
const ONTOLOGY_PACKS_PATH = '/ontologyPacks';
const ONTOLOGY_AI_PATH = '/ontology/ai';
const ONTOLOGY_BULK_PATH = '/ontology/bulk';
const ONTOLOGY_IMPACTS_PATH = '/ontology/impacts/glossaryTerms';
const ONTOLOGY_MODELING_PATH = '/ontology/modeling';
const ONTOLOGY_PATTERNS_PATH = '/ontology/patterns';
const ONTOLOGY_REASONING_PATH = '/ontology/reasoning';
const ONTOLOGY_STRUCTURE_PATH = '/ontology/structure';
const ONTOLOGY_SUBSETS_PATH = '/ontology/subsets';

type OntologyChangeSetCreation =
  | CreateOntologyChangeSet
  | CreateOntologyChangeSetRequest;

export const listRelationshipTypes = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<RelationshipType[]>>(
    RELATIONSHIP_TYPES_PATH,
    { params }
  );

  return response.data;
};

export const getRelationshipTypeByName = async (name: string) => {
  const response = await APIClient.get<RelationshipType>(
    `${RELATIONSHIP_TYPES_PATH}/name/${getEncodedFqn(name)}`
  );

  return response.data;
};

export const createRelationshipType = async (
  request: CreateRelationshipType
) => {
  const response = await APIClient.post<
    CreateRelationshipType,
    AxiosResponse<RelationshipType>
  >(RELATIONSHIP_TYPES_PATH, request);

  return response.data;
};

export const updateRelationshipType = async (
  request: CreateRelationshipType
) => {
  const response = await APIClient.put<
    CreateRelationshipType,
    AxiosResponse<RelationshipType>
  >(RELATIONSHIP_TYPES_PATH, request);

  return response.data;
};

export const patchRelationshipType = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<RelationshipType>
  >(`${RELATIONSHIP_TYPES_PATH}/${id}`, patch);

  return response.data;
};

export const deleteRelationshipType = async (id: string) => {
  await APIClient.delete(`${RELATIONSHIP_TYPES_PATH}/${id}`);
};

export const listOntologyAxioms = async (
  glossary: string,
  params?: ListParams
) => {
  const response = await APIClient.get<PagingResponse<OntologyAxiom[]>>(
    ONTOLOGY_AXIOMS_PATH,
    { params: { ...params, glossary } }
  );

  return response.data;
};

export const validateOntologyAxiom = async (request: CreateOntologyAxiom) => {
  const response = await APIClient.post<
    CreateOntologyAxiom,
    AxiosResponse<OntologyProfileReport>
  >(`${ONTOLOGY_AXIOMS_PATH}/validate`, request);

  return response.data;
};

export const createOntologyAxiom = async (request: CreateOntologyAxiom) => {
  const response = await APIClient.post<
    CreateOntologyAxiom,
    AxiosResponse<OntologyAxiom>
  >(ONTOLOGY_AXIOMS_PATH, request);

  return response.data;
};

export const listOntologyChangeSets = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<OntologyChangeSet[]>>(
    CHANGE_SETS_PATH,
    { params }
  );

  return response.data;
};

export const createOntologyChangeSet = async (
  request: OntologyChangeSetCreation
) => {
  const response = await APIClient.post<
    OntologyChangeSetCreation,
    AxiosResponse<OntologyChangeSet>
  >(CHANGE_SETS_PATH, request);

  return response.data;
};

export const replaceOntologyChangeOperations = async (
  id: string,
  request: UpdateOntologyChangeSet
) => {
  const response = await APIClient.put<
    UpdateOntologyChangeSet,
    AxiosResponse<OntologyChangeSet>
  >(`${CHANGE_SETS_PATH}/${id}/operations`, request);

  return response.data;
};

const executeChangeSetCommand = async <Request>(
  id: string,
  action: string,
  request: Request
) => {
  const response = await APIClient.post<
    Request,
    AxiosResponse<OntologyChangeSet>
  >(`${CHANGE_SETS_PATH}/${id}/${action}`, request);

  return response.data;
};

export const undoOntologyChangeSet = (
  id: string,
  request: OntologyChangeSetCommand
) => executeChangeSetCommand(id, 'undo', request);

export const redoOntologyChangeSet = (
  id: string,
  request: OntologyChangeSetCommand
) => executeChangeSetCommand(id, 'redo', request);

export const submitOntologyChangeSet = (
  id: string,
  request: OntologyChangeSetCommand
) => executeChangeSetCommand(id, 'submit', request);

export const discardOntologyChangeSet = (
  id: string,
  request: OntologyChangeSetCommand
) => executeChangeSetCommand(id, 'discard', request);

export const applyOntologyChangeSet = (
  id: string,
  request: ApplyOntologyChangeSet
) => executeChangeSetCommand(id, 'apply', request);

export const acquireOntologyEditLock = async (
  request: AcquireOntologyEditLock
) => {
  const response = await APIClient.post<
    AcquireOntologyEditLock,
    AxiosResponse<OntologyEditLock>
  >(`${EDIT_LOCKS_PATH}/acquire`, request);

  return response.data;
};

export const renewOntologyEditLock = async (
  request: AcquireOntologyEditLock
) => {
  const response = await APIClient.put<
    AcquireOntologyEditLock,
    AxiosResponse<OntologyEditLock>
  >(`${EDIT_LOCKS_PATH}/renew`, request);

  return response.data;
};

export const releaseOntologyEditLock = async (
  resourceType: string,
  resourceId: string,
  sessionId: string
) => {
  await APIClient.delete(`${EDIT_LOCKS_PATH}/${resourceType}/${resourceId}`, {
    params: { sessionId },
  });
};

export const getOntologyEditLock = async (
  resourceType: string,
  resourceId: string
) => {
  const response = await APIClient.get<OntologyEditLock>(
    `${EDIT_LOCKS_PATH}/${resourceType}/${resourceId}`
  );

  return response.data;
};

export const previewOntologyIri = async (
  request: OntologyIRIPreviewRequest
) => {
  const response = await APIClient.post<
    OntologyIRIPreviewRequest,
    AxiosResponse<OntologyIRIPreview>
  >(`${ONTOLOGY_MODELING_PATH}/iris/preview`, request);

  return response.data;
};

export const listOntologyPatterns = async () => {
  const response = await APIClient.get<OntologyPatternList>(
    ONTOLOGY_PATTERNS_PATH
  );

  return response.data;
};

export const instantiateOntologyPattern = async (
  request: InstantiateOntologyPattern
) => {
  const response = await APIClient.post<
    InstantiateOntologyPattern,
    AxiosResponse<OntologyPatternInstantiationResult>
  >(`${ONTOLOGY_PATTERNS_PATH}/instantiate`, request);

  return response.data;
};

export const buildOntologySubset = async (request: BuildOntologySubset) => {
  const response = await APIClient.post<
    BuildOntologySubset,
    AxiosResponse<OntologySubsetResult>
  >(ONTOLOGY_SUBSETS_PATH, request);

  return response.data;
};

export const diffOntologyStructure = async (
  request: OntologyStructuralDiffRequest
) => {
  const response = await APIClient.post<
    OntologyStructuralDiffRequest,
    AxiosResponse<OntologyStructuralDiff>
  >(`${ONTOLOGY_STRUCTURE_PATH}/diff`, request);

  return response.data;
};

export const mergeOntologyStructure = async (
  request: MergeOntologyStructure
) => {
  const response = await APIClient.post<
    MergeOntologyStructure,
    AxiosResponse<OntologyStructuralMergeResult>
  >(`${ONTOLOGY_STRUCTURE_PATH}/merge`, request);

  return response.data;
};

export const explainOntologyInference = async (
  request: OntologyInferenceExplanationRequest
) => {
  const response = await APIClient.post<
    OntologyInferenceExplanationRequest,
    AxiosResponse<OntologyInferenceExplanation>
  >(`${ONTOLOGY_REASONING_PATH}/explanations`, request);

  return response.data;
};

export const previewGlossaryTermDeleteImpact = async (termId: string) => {
  const response = await APIClient.get<OntologyImpactReport>(
    `${ONTOLOGY_IMPACTS_PATH}/${termId}/delete`
  );

  return response.data;
};

export const deleteGlossaryTermWithImpact = async (
  termId: string,
  request: DeleteOntologyResource
) => {
  const response = await APIClient.post<
    DeleteOntologyResource,
    AxiosResponse<OntologyDeleteResult>
  >(`${ONTOLOGY_IMPACTS_PATH}/${termId}/delete`, request);

  return response.data;
};

export const getRdfEntityDiff = async (
  entityType: string,
  entityId: string,
  fromVersion: number,
  toVersion: number
) => {
  const response = await APIClient.get<RDFEntityDiff>(
    `/rdf/entity/${entityType}/${entityId}/diff`,
    { params: { fromVersion, toVersion } }
  );

  return response.data;
};

export const listInferenceRules = async () => {
  const response = await APIClient.get<InferenceRuleList>(INFERENCE_RULES_PATH);

  return response.data;
};

export const upsertInferenceRule = async (
  name: string,
  rule: InferenceRule
) => {
  const response = await APIClient.put<
    InferenceRule,
    AxiosResponse<InferenceRuleStatus>
  >(`${INFERENCE_RULES_PATH}/${name}`, rule);

  return response.data;
};

export const deleteInferenceRule = async (name: string) => {
  await APIClient.delete(`${INFERENCE_RULES_PATH}/${name}`);
};

export const materializeInferenceRules = async (
  force = false,
  ruleName?: string
) => {
  const response = await APIClient.post<
    undefined,
    AxiosResponse<InferenceMaterializationResult>
  >(`${INFERENCE_RULES_PATH}/materialize`, undefined, {
    params: { force, ruleName },
  });

  return response.data;
};

export const listOntologyPacks = async () => {
  const response = await APIClient.get<OntologyPackList>(ONTOLOGY_PACKS_PATH);

  return response.data;
};

export const getOntologyPack = async (packId: string) => {
  const response = await APIClient.get<OntologyPackManifest>(
    `${ONTOLOGY_PACKS_PATH}/${encodeURIComponent(packId)}`
  );

  return response.data;
};

export const installOntologyPack = async (
  packId: string,
  request: InstallOntologyPack
) => {
  const response = await APIClient.post<
    InstallOntologyPack,
    AxiosResponse<OntologyPackInstallResult>
  >(`${ONTOLOGY_PACKS_PATH}/${encodeURIComponent(packId)}/install`, request);

  return response.data;
};

export const suggestOntologyRelationships = async (
  request: OntologyRelationshipSuggestionRequest
) => {
  const response = await APIClient.post<
    OntologyRelationshipSuggestionRequest,
    AxiosResponse<OntologyRelationshipSuggestionList>
  >(`${ONTOLOGY_AI_PATH}/relationships/suggestions`, request);

  return response.data;
};

export const suggestOntologyMappings = async (
  request: OntologyMappingSuggestionRequest
) => {
  const response = await APIClient.post<
    OntologyMappingSuggestionRequest,
    AxiosResponse<OntologyMappingSuggestionList>
  >(`${ONTOLOGY_AI_PATH}/mappings/suggestions`, request);

  return response.data;
};

export const generateOntologySparql = async (
  request: OntologyNaturalLanguageQueryRequest
) => {
  const response = await APIClient.post<
    OntologyNaturalLanguageQueryRequest,
    AxiosResponse<OntologyNaturalLanguageQueryResult>
  >(`${ONTOLOGY_AI_PATH}/sparql`, request);

  return response.data;
};

export const generateOntologyDomainDraft = async (
  request: OntologyDomainDraftRequest
) => {
  const response = await APIClient.post<
    OntologyDomainDraftRequest,
    AxiosResponse<OntologyDomainDraftResult>
  >(`${ONTOLOGY_AI_PATH}/drafts`, request);

  return response.data;
};

export const getOntologyBulkTemplate = async () => {
  const response = await APIClient.get<OntologyBulkTemplate>(
    `${ONTOLOGY_BULK_PATH}/template`
  );

  return response.data;
};

export const submitOntologyBulkOperation = async (
  request: OntologyBulkRequest
) => {
  const response = await APIClient.post<
    OntologyBulkRequest,
    AxiosResponse<OntologyBulkSubmission>
  >(ONTOLOGY_BULK_PATH, request);

  return response.data;
};

export const listOntologyBulkJobs = async (limit = 20) => {
  const response = await APIClient.get<OntologyBulkJobList>(
    `${ONTOLOGY_BULK_PATH}/jobs`,
    { params: { limit } }
  );

  return response.data;
};

export const getOntologyBulkJob = async (jobId: number) => {
  const response = await APIClient.get<OntologyBulkJob>(
    `${ONTOLOGY_BULK_PATH}/jobs/${jobId}`
  );

  return response.data;
};

export const cancelOntologyBulkJob = async (jobId: number) => {
  const response = await APIClient.put<
    undefined,
    AxiosResponse<OntologyBulkJob>
  >(`${ONTOLOGY_BULK_PATH}/jobs/${jobId}/cancel`);

  return response.data;
};

export const getOntologyBulkResultArtifact = async (jobId: number) => {
  const response = await APIClient.get<OntologyBulkResultArtifact>(
    `${ONTOLOGY_BULK_PATH}/jobs/${jobId}/artifact`
  );

  return response.data;
};
