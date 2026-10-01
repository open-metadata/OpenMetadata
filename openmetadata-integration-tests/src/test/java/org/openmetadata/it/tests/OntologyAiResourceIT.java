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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyMemoryDerivationRequest;
import org.openmetadata.schema.api.data.OntologyMemoryProposalStatus;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryRequest;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionRequest;
import org.openmetadata.schema.api.rdf.RdfStatus;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.context.ContextMemoryService;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyAiResourceIT {
  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void memoryDerivationStaysOffWithoutTheOntologyAiFlag(final TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final ContextMemory memory =
        namespace.trackRoot(
            "contextMemory",
            new ContextMemoryService(client.getHttpClient())
                .create(
                    new CreateContextMemory()
                        .withName(namespace.prefix("gatedMemory"))
                        .withDescription("Memory for a disabled derivation")
                        .withQuestion("What is churn?")
                        .withAnswer("Customers who cancel every subscription.")));
    final OntologyMemoryDerivationRequest request =
        new OntologyMemoryDerivationRequest().withMemoryIds(Set.of(memory.getId()));

    assertNotFound(
        () ->
            client
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    "/v1/ontology/ai/memories/jobs",
                    request,
                    BackgroundJob.class));
    final OntologyMemoryProposalStatus status =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontology/ai/memories/" + memory.getId() + "/proposals",
                null,
                OntologyMemoryProposalStatus.class);
    assertFalse(status.getEnabled());
    assertFalse(status.getQueued());
  }

  @Test
  void defaultDisabledCapabilityHidesEveryAiRoute(TestNamespace namespace) {
    final String glossary = namespace.prefix("AiDisabled");
    final UUID sourceId = UUID.randomUUID();
    final UUID targetId = UUID.randomUUID();
    final UUID relationshipTypeId = UUID.randomUUID();
    final OntologyRelationshipSuggestionRequest relationships =
        new OntologyRelationshipSuggestionRequest()
            .withGlossary(glossary)
            .withSourceTermIds(Set.of(sourceId))
            .withCandidateTermIds(Set.of(targetId))
            .withRelationshipTypeIds(Set.of(relationshipTypeId))
            .withMaxSuggestions(1);
    final OntologyMappingSuggestionRequest mappings =
        new OntologyMappingSuggestionRequest()
            .withGlossary(glossary)
            .withSourceTermIds(Set.of(sourceId))
            .withStandards(Set.of("FHIR"))
            .withMaxSuggestions(1);
    final OntologyNaturalLanguageQueryRequest query =
        new OntologyNaturalLanguageQueryRequest()
            .withGlossaries(Set.of(glossary))
            .withQuestion("Which concepts exist?");
    final OntologyDomainDraftRequest draft =
        new OntologyDomainDraftRequest()
            .withGlossary(glossary)
            .withChangeSetName(namespace.prefix("GeneratedDraft"))
            .withDisplayName("Generated Draft")
            .withDescription("Generated for capability testing")
            .withDomainDescription("A small healthcare domain")
            .withMaxConcepts(5);

    assertNotFound(() -> SdkClients.adminClient().ontologyAi().suggestRelationships(relationships));
    assertNotFound(() -> SdkClients.adminClient().ontologyAi().suggestMappings(mappings));
    assertNotFound(() -> SdkClients.adminClient().ontologyAi().generateSparql(query));
    assertNotFound(() -> SdkClients.adminClient().ontologyAi().generateDomainDraft(draft));
  }

  @Test
  void rdfStatusPublishesTheEffectiveAiCapability() {
    final RdfStatus status =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/rdf/status", null, RdfStatus.class);

    assertFalse(status.getAiEnabled());
  }

  private static void assertNotFound(final Runnable request) {
    final OpenMetadataException exception = assertThrows(OpenMetadataException.class, request::run);
    assertEquals(404, exception.getStatusCode());
  }
}
