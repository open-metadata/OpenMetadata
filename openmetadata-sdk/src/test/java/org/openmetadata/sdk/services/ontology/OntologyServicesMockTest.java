/*
 *  Copyright 2026 Collate
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

package org.openmetadata.sdk.services.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.api.data.DeleteOntologyResource;
import org.openmetadata.schema.api.data.InstallOntologyPack;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.MergeOntologyStructure;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
import org.openmetadata.schema.api.data.OntologyDeleteResult;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.api.data.OntologyDomainDraftResult;
import org.openmetadata.schema.api.data.OntologyImpactReport;
import org.openmetadata.schema.api.data.OntologyInferenceExplanation;
import org.openmetadata.schema.api.data.OntologyInferenceExplanationRequest;
import org.openmetadata.schema.api.data.OntologyIriPreview;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionList;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryResult;
import org.openmetadata.schema.api.data.OntologyPackInstallResult;
import org.openmetadata.schema.api.data.OntologyPackList;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.api.data.OntologyPatternInstantiationResult;
import org.openmetadata.schema.api.data.OntologyPatternList;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionList;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyStructuralDiff;
import org.openmetadata.schema.api.data.OntologyStructuralDiffRequest;
import org.openmetadata.schema.api.data.OntologyStructuralMergeResult;
import org.openmetadata.schema.api.data.OntologySubsetResult;
import org.openmetadata.schema.api.data.UpdateOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

class OntologyServicesMockTest {
  private HttpClient httpClient;

  @BeforeEach
  void setUp() {
    httpClient = mock(HttpClient.class);
  }

  @Test
  void relationshipTypeServiceUsesTypedEntityEndpoints() {
    RelationshipTypeService service = new RelationshipTypeService(httpClient);
    CreateRelationshipType request = new CreateRelationshipType();
    RelationshipType expected = new RelationshipType();
    when(httpClient.execute(
            HttpMethod.POST, "/v1/relationshipTypes", request, RelationshipType.class))
        .thenReturn(expected);
    when(httpClient.execute(
            HttpMethod.PUT, "/v1/relationshipTypes", request, RelationshipType.class))
        .thenReturn(expected);

    assertSame(expected, service.create(request));
    assertSame(expected, service.upsert(request));
    service.delete("relationship-id", true);

    ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    verify(httpClient)
        .execute(
            eq(HttpMethod.DELETE),
            eq("/v1/relationshipTypes/relationship-id"),
            isNull(),
            eq(Void.class),
            options.capture());
    assertEquals("true", options.getValue().getQueryParams().get("hardDelete"));
  }

  @Test
  void ontologyAxiomServiceExposesValidationAndPersistence() {
    OntologyAxiomService service = new OntologyAxiomService(httpClient);
    CreateOntologyAxiom request = new CreateOntologyAxiom();
    OntologyAxiom axiom = new OntologyAxiom();
    OntologyProfileReport report = new OntologyProfileReport();
    when(httpClient.execute(HttpMethod.POST, "/v1/ontologyAxioms", request, OntologyAxiom.class))
        .thenReturn(axiom);
    when(httpClient.execute(HttpMethod.PUT, "/v1/ontologyAxioms", request, OntologyAxiom.class))
        .thenReturn(axiom);
    when(httpClient.execute(
            HttpMethod.POST, "/v1/ontologyAxioms/validate", request, OntologyProfileReport.class))
        .thenReturn(report);

    assertSame(axiom, service.create(request));
    assertSame(axiom, service.upsert(request));
    assertSame(report, service.validate(request));
  }

  @Test
  void changeSetServiceRoutesEveryTypedCommand() {
    OntologyChangeSetService service = new OntologyChangeSetService(httpClient);
    UUID id = UUID.randomUUID();
    OntologyChangeSet expected = new OntologyChangeSet();
    CreateOntologyChangeSet create = new CreateOntologyChangeSet();
    UpdateOntologyChangeSet update = new UpdateOntologyChangeSet();
    OntologyChangeSetCommand command = new OntologyChangeSetCommand();
    ApplyOntologyChangeSet apply = new ApplyOntologyChangeSet();
    when(httpClient.execute(
            HttpMethod.POST, "/v1/ontologyChangeSets", create, OntologyChangeSet.class))
        .thenReturn(expected);
    stubChangeSet(HttpMethod.PUT, id, "/operations", update, expected);
    stubChangeSet(HttpMethod.POST, id, "/undo", command, expected);
    stubChangeSet(HttpMethod.POST, id, "/redo", command, expected);
    stubChangeSet(HttpMethod.POST, id, "/submit", command, expected);
    stubChangeSet(HttpMethod.POST, id, "/apply", apply, expected);
    stubChangeSet(HttpMethod.POST, id, "/discard", command, expected);

    assertSame(expected, service.create(create));
    assertSame(expected, service.replaceOperations(id, update));
    assertSame(expected, service.undo(id, command));
    assertSame(expected, service.redo(id, command));
    assertSame(expected, service.submit(id, command));
    assertSame(expected, service.apply(id, apply));
    assertSame(expected, service.discard(id, command));
  }

  @Test
  void editLockServiceCarriesLeaseIdentityOnRelease() {
    OntologyEditLockService service = new OntologyEditLockService(httpClient);
    UUID resourceId = UUID.randomUUID();
    AcquireOntologyEditLock request = new AcquireOntologyEditLock();
    OntologyEditLock expected = new OntologyEditLock();
    String resourcePath = "/v1/ontologyEditLocks/ontologyChangeSet/" + resourceId;
    when(httpClient.execute(
            HttpMethod.POST, "/v1/ontologyEditLocks/acquire", request, OntologyEditLock.class))
        .thenReturn(expected);
    when(httpClient.execute(
            HttpMethod.PUT, "/v1/ontologyEditLocks/renew", request, OntologyEditLock.class))
        .thenReturn(expected);
    when(httpClient.execute(HttpMethod.GET, resourcePath, null, OntologyEditLock.class))
        .thenReturn(expected);

    assertSame(expected, service.acquire(request));
    assertSame(expected, service.renew(request));
    assertSame(expected, service.get("ontologyChangeSet", resourceId));
    service.release("ontologyChangeSet", resourceId, "editor-session");

    ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    verify(httpClient)
        .execute(
            eq(HttpMethod.DELETE), eq(resourcePath), isNull(), eq(Void.class), options.capture());
    assertEquals("editor-session", options.getValue().getQueryParams().get("sessionId"));
  }

  @Test
  void ontologyPackServiceUsesTypedCatalogueAndInstallEndpoints() {
    final OntologyPackService service = new OntologyPackService(httpClient);
    final InstallOntologyPack request = new InstallOntologyPack();
    final OntologyPackList list = new OntologyPackList();
    final OntologyPackManifest manifest = new OntologyPackManifest();
    final OntologyPackInstallResult installResult = new OntologyPackInstallResult();
    when(httpClient.execute(HttpMethod.GET, "/v1/ontologyPacks", null, OntologyPackList.class))
        .thenReturn(list);
    when(httpClient.execute(
            HttpMethod.GET, "/v1/ontologyPacks/fhir", null, OntologyPackManifest.class))
        .thenReturn(manifest);
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontologyPacks/fhir/install",
            request,
            OntologyPackInstallResult.class))
        .thenReturn(installResult);

    assertSame(list, service.list());
    assertSame(manifest, service.get("fhir"));
    assertSame(installResult, service.install("fhir", request));
  }

  @Test
  void ontologyModelingServiceUsesTypedIriPreviewEndpoint() {
    final OntologyModelingService service = new OntologyModelingService(httpClient);
    final OntologyIriPreviewRequest request = new OntologyIriPreviewRequest();
    final OntologyIriPreview expected = new OntologyIriPreview();
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/modeling/iris/preview",
            request,
            OntologyIriPreview.class))
        .thenReturn(expected);

    assertSame(expected, service.previewIri(request));
  }

  @Test
  void ontologyPatternServiceUsesTypedDraftEndpoints() {
    final OntologyPatternService service = new OntologyPatternService(httpClient);
    final InstantiateOntologyPattern request = new InstantiateOntologyPattern();
    final OntologyPatternList list = new OntologyPatternList();
    final OntologyPatternInstantiationResult result = new OntologyPatternInstantiationResult();
    when(httpClient.execute(
            HttpMethod.GET, "/v1/ontology/patterns", null, OntologyPatternList.class))
        .thenReturn(list);
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/patterns/instantiate",
            request,
            OntologyPatternInstantiationResult.class))
        .thenReturn(result);

    assertSame(list, service.list());
    assertSame(result, service.instantiate(request));
  }

  @Test
  void ontologySubsetServiceUsesTypedDraftEndpoint() {
    final OntologySubsetService service = new OntologySubsetService(httpClient);
    final BuildOntologySubset request = new BuildOntologySubset();
    final OntologySubsetResult result = new OntologySubsetResult();
    when(httpClient.execute(
            HttpMethod.POST, "/v1/ontology/subsets", request, OntologySubsetResult.class))
        .thenReturn(result);

    assertSame(result, service.build(request));
  }

  @Test
  void ontologyStructureServiceUsesTypedDiffAndMergeEndpoints() {
    final OntologyStructureService service = new OntologyStructureService(httpClient);
    final OntologyStructuralDiffRequest diffRequest = new OntologyStructuralDiffRequest();
    final MergeOntologyStructure mergeRequest = new MergeOntologyStructure();
    final OntologyStructuralDiff diff = new OntologyStructuralDiff();
    final OntologyStructuralMergeResult merge = new OntologyStructuralMergeResult();
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/structure/diff",
            diffRequest,
            OntologyStructuralDiff.class))
        .thenReturn(diff);
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/structure/merge",
            mergeRequest,
            OntologyStructuralMergeResult.class))
        .thenReturn(merge);

    assertSame(diff, service.diff(diffRequest));
    assertSame(merge, service.merge(mergeRequest));
  }

  @Test
  void ontologyImpactServiceUsesTokenProtectedDeleteEndpoints() {
    final OntologyImpactService service = new OntologyImpactService(httpClient);
    final UUID termId = UUID.randomUUID();
    final String path = "/v1/ontology/impacts/glossaryTerms/" + termId + "/delete";
    final DeleteOntologyResource request = new DeleteOntologyResource();
    final OntologyImpactReport impact = new OntologyImpactReport();
    final OntologyDeleteResult result = new OntologyDeleteResult();
    when(httpClient.execute(HttpMethod.GET, path, null, OntologyImpactReport.class))
        .thenReturn(impact);
    when(httpClient.execute(HttpMethod.POST, path, request, OntologyDeleteResult.class))
        .thenReturn(result);

    assertSame(impact, service.previewGlossaryTermDelete(termId));
    assertSame(result, service.deleteGlossaryTerm(termId, request));
  }

  @Test
  void ontologyReasoningServiceUsesTypedExplanationEndpoint() {
    final OntologyReasoningService service = new OntologyReasoningService(httpClient);
    final OntologyInferenceExplanationRequest request = new OntologyInferenceExplanationRequest();
    final OntologyInferenceExplanation result = new OntologyInferenceExplanation();
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/reasoning/explanations",
            request,
            OntologyInferenceExplanation.class))
        .thenReturn(result);

    assertSame(result, service.explain(request));
  }

  @Test
  void ontologyAiServiceUsesTypedProposalEndpoints() {
    final OntologyAiService service = new OntologyAiService(httpClient);
    final OntologyRelationshipSuggestionRequest relationships =
        new OntologyRelationshipSuggestionRequest();
    final OntologyMappingSuggestionRequest mappings = new OntologyMappingSuggestionRequest();
    final OntologyNaturalLanguageQueryRequest query = new OntologyNaturalLanguageQueryRequest();
    final OntologyDomainDraftRequest draft = new OntologyDomainDraftRequest();
    final OntologyRelationshipSuggestionList relationshipResult =
        new OntologyRelationshipSuggestionList();
    final OntologyMappingSuggestionList mappingResult = new OntologyMappingSuggestionList();
    final OntologyNaturalLanguageQueryResult queryResult = new OntologyNaturalLanguageQueryResult();
    final OntologyDomainDraftResult draftResult = new OntologyDomainDraftResult();
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/ai/relationships/suggestions",
            relationships,
            OntologyRelationshipSuggestionList.class))
        .thenReturn(relationshipResult);
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/ai/mappings/suggestions",
            mappings,
            OntologyMappingSuggestionList.class))
        .thenReturn(mappingResult);
    when(httpClient.execute(
            HttpMethod.POST,
            "/v1/ontology/ai/sparql",
            query,
            OntologyNaturalLanguageQueryResult.class))
        .thenReturn(queryResult);
    when(httpClient.execute(
            HttpMethod.POST, "/v1/ontology/ai/drafts", draft, OntologyDomainDraftResult.class))
        .thenReturn(draftResult);

    assertSame(relationshipResult, service.suggestRelationships(relationships));
    assertSame(mappingResult, service.suggestMappings(mappings));
    assertSame(queryResult, service.generateSparql(query));
    assertSame(draftResult, service.generateDomainDraft(draft));
  }

  private <RequestT> void stubChangeSet(
      HttpMethod method, UUID id, String action, RequestT request, OntologyChangeSet response) {
    when(httpClient.execute(
            method, "/v1/ontologyChangeSets/" + id + action, request, OntologyChangeSet.class))
        .thenReturn(response);
  }
}
