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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.UpdateTermRelation;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * End-to-end search verification for typed glossary {@code relatedTerms} edges: nested per-edge
 * queries on {@code relationType}, {@code provenance}, {@code status}, and target term FQN, plus
 * live bidirectional indexing when relations are added, approved, removed, or hard-deleted.
 *
 * <p>ADR:2026-11-23-glossary-related-terms-are-indexed-as-nested-typed-edges
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermRelatedTermsSearchIT {

  private static final String GLOSSARY_TERM_INDEX = "glossary_term_search_index";
  private static final ObjectMapper MAPPER = JsonUtils.getObjectMapper();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  private OpenMetadataClient client;
  private Glossary glossary;

  @BeforeEach
  void setUp(TestNamespace ns) {
    client = OssTestServer.defaultHandle().sdk();
    glossary = GlossaryTestFactory.createSimple(ns);
    assertNotNull(glossary);
  }

  @AfterEach
  void tearDown(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @Test
  void typedRelationsAreSearchableOnBothSidesAndRespectNestedEdgeBoundaries() throws Exception {
    GlossaryTerm pendingTerm = createTerm("PendingTerm");
    GlossaryTerm mixedTerm = createTerm("MixedTerm");
    GlossaryTerm targetA = createTerm("TargetA");
    GlossaryTerm targetB = createTerm("TargetB");

    postRelation(
        pendingTerm.getId(),
        targetA.getId(),
        "broader",
        RelationProvenance.MANUAL,
        EntityStatus.APPROVED);
    postRelation(
        pendingTerm.getId(),
        targetB.getId(),
        "synonym",
        RelationProvenance.AI_SUGGESTED,
        EntityStatus.DRAFT);
    postRelation(
        mixedTerm.getId(),
        targetA.getId(),
        "broader",
        RelationProvenance.MANUAL,
        EntityStatus.DRAFT);
    postRelation(
        mixedTerm.getId(),
        targetB.getId(),
        "synonym",
        RelationProvenance.AI_SUGGESTED,
        EntityStatus.APPROVED);

    awaitSearchHits(
        nestedFilter(Map.of("relatedTerms.relationType", "broader")),
        Set.of(pendingTerm.getId().toString(), mixedTerm.getId().toString()));
    awaitSearchHits(
        nestedFilter(Map.of("relatedTerms.relationType", "narrower")),
        Set.of(targetA.getId().toString()));
    awaitSearchHits(
        nestedFilter(
            Map.of(
                "relatedTerms.provenance", "AiSuggested",
                "relatedTerms.status", "Draft")),
        Set.of(pendingTerm.getId().toString(), targetB.getId().toString()));
    awaitSearchHits(
        nestedFilter(
            Map.of(
                "relatedTerms.relationType",
                "synonym",
                "relatedTerms.term.fullyQualifiedName",
                targetB.getFullyQualifiedName())),
        Set.of(pendingTerm.getId().toString(), mixedTerm.getId().toString()));
  }

  @Test
  void statusApprovalAndRemovalUpdateBothSidesInSearch() throws Exception {
    GlossaryTerm source = createTerm("ReviewSource");
    GlossaryTerm target = createTerm("ReviewTarget");

    postRelation(
        source.getId(),
        target.getId(),
        "broader",
        RelationProvenance.AI_SUGGESTED,
        EntityStatus.DRAFT);
    TermRelation created = findEdge(source, target.getId(), "broader");
    assertNotNull(created);
    assertNotNull(created.getId());

    awaitSearchHits(
        nestedFilter(
            Map.of(
                "relatedTerms.provenance", "AiSuggested",
                "relatedTerms.status", "Draft")),
        Set.of(source.getId().toString(), target.getId().toString()));

    HttpResponse<String> approveResponse =
        updateRelationById(
            source.getId(),
            created.getId(),
            new UpdateTermRelation().withStatus(EntityStatus.APPROVED));
    assertEquals(200, approveResponse.statusCode(), approveResponse.body());

    awaitSearchHits(
        nestedFilter(
            Map.of(
                "relatedTerms.provenance", "AiSuggested",
                "relatedTerms.status", "Draft")),
        Set.of());
    awaitSearchHits(
        nestedFilter(
            Map.of(
                "relatedTerms.provenance", "AiSuggested",
                "relatedTerms.status", "Approved")),
        Set.of(source.getId().toString(), target.getId().toString()));

    HttpResponse<String> deleteResponse = deleteRelationById(source.getId(), created.getId());
    assertEquals(200, deleteResponse.statusCode(), deleteResponse.body());

    awaitSearchHits(nestedFilter(Map.of("relatedTerms.provenance", "AiSuggested")), Set.of());
    awaitDoc(
        GLOSSARY_TERM_INDEX,
        source.getId(),
        doc -> doc.path("relatedTerms").isArray() && doc.path("relatedTerms").isEmpty());
    awaitDoc(
        GLOSSARY_TERM_INDEX,
        target.getId(),
        doc -> doc.path("relatedTerms").isArray() && doc.path("relatedTerms").isEmpty());
  }

  @Test
  void hardDeleteRemovesRelationFromSurvivingPeerSearchDoc() throws Exception {
    GlossaryTerm ephemeral = createTerm("EphemeralTerm");
    GlossaryTerm survivor = createTerm("SurvivorTerm");

    postRelation(
        ephemeral.getId(),
        survivor.getId(),
        "broader",
        RelationProvenance.AI_SUGGESTED,
        EntityStatus.DRAFT);

    awaitSearchHits(
        nestedFilter(
            Map.of(
                "relatedTerms.relationType", "narrower",
                "relatedTerms.provenance", "AiSuggested",
                "relatedTerms.status", "Draft")),
        Set.of(survivor.getId().toString()));

    HttpResponse<String> deleteResponse =
        send(
            "DELETE",
            SdkClients.getServerUrl()
                + "/v1/glossaryTerms/"
                + ephemeral.getId()
                + "?hardDelete=true",
            "");
    assertEquals(200, deleteResponse.statusCode(), deleteResponse.body());

    awaitSearchHits(nestedFilter(Map.of("relatedTerms.relationType", "narrower")), Set.of());
    awaitDoc(
        GLOSSARY_TERM_INDEX,
        survivor.getId(),
        doc -> doc.path("relatedTerms").isArray() && doc.path("relatedTerms").isEmpty());
  }

  @Test
  void parentRenameUpdatesDescendantRelationInPeerSearchDoc() throws Exception {
    GlossaryTerm parent = createTerm("OriginalParent");
    GlossaryTerm descendant = createTerm("Descendant", glossary, parent);
    GlossaryTerm peer = createTerm("Peer");
    linkPeerToDescendant(peer, descendant);

    GlossaryTerm renamed =
        client.glossaryTerms().update(parent.getId(), parent.withName("RenamedParent"));

    assertPeerFqnChanged(peer, descendant, renamed.getFullyQualifiedName());
  }

  @Test
  void glossaryRenameUpdatesDescendantRelationInExternalPeerSearchDoc(TestNamespace ns)
      throws Exception {
    Glossary otherGlossary = GlossaryTestFactory.createWithName(ns, "originalGlossary");
    GlossaryTerm descendant = createTerm("Descendant", otherGlossary, null);
    GlossaryTerm peer = createTerm("Peer");
    linkPeerToDescendant(peer, descendant);

    Glossary renamed =
        client
            .glossaries()
            .update(otherGlossary.getId(), otherGlossary.withName(ns.prefix("renamed")));

    assertPeerFqnChanged(peer, descendant, renamed.getFullyQualifiedName());
  }

  @Test
  void recursiveSoftDeleteUpdatesDescendantRelationInSurvivingPeerSearchDoc() throws Exception {
    GlossaryTerm parent = createTerm("Parent");
    GlossaryTerm descendant = createTerm("Descendant", glossary, parent);
    GlossaryTerm peer = createTerm("Peer");
    linkPeerToDescendant(peer, descendant);
    awaitPeerTargetDeleted(peer, descendant, false);

    HttpResponse<String> response =
        send(
            "DELETE",
            SdkClients.getServerUrl() + "/v1/glossaryTerms/" + parent.getId() + "?recursive=true",
            "");
    assertEquals(200, response.statusCode(), response.body());

    awaitPeerTargetDeleted(peer, descendant, true);
  }

  private void linkPeerToDescendant(GlossaryTerm peer, GlossaryTerm descendant) throws Exception {
    postRelation(
        peer.getId(),
        descendant.getId(),
        "relatedTo",
        RelationProvenance.MANUAL,
        EntityStatus.APPROVED);
    awaitSearchHits(
        targetFqnFilter(descendant.getFullyQualifiedName()), Set.of(peer.getId().toString()));
  }

  private void assertPeerFqnChanged(GlossaryTerm peer, GlossaryTerm descendant, String newParentFqn)
      throws Exception {
    String newFqn = FullyQualifiedName.add(newParentFqn, descendant.getName());
    awaitSearchHits(targetFqnFilter(newFqn), Set.of(peer.getId().toString()));
    awaitSearchHits(targetFqnFilter(descendant.getFullyQualifiedName()), Set.of());
  }

  private String targetFqnFilter(String fqn) throws Exception {
    return nestedFilter(Map.of("relatedTerms.term.fullyQualifiedName", fqn));
  }

  private void awaitPeerTargetDeleted(GlossaryTerm peer, GlossaryTerm target, boolean deleted) {
    awaitDoc(
        GLOSSARY_TERM_INDEX,
        peer.getId(),
        doc -> {
          JsonNode term = doc.path("relatedTerms").path(0).path("term");
          return target.getId().toString().equals(term.path("id").asText())
              && term.path("deleted").isBoolean()
              && term.path("deleted").asBoolean() == deleted;
        });
  }

  private GlossaryTerm createTerm(String name) {
    return createTerm(name, glossary, null);
  }

  private GlossaryTerm createTerm(String name, Glossary glossary, GlossaryTerm parent) {
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withGlossary(glossary.getFullyQualifiedName())
                .withParent(parent == null ? null : parent.getFullyQualifiedName())
                .withName(name)
                .withDescription("Description for " + name));
  }

  private void postRelation(
      UUID fromId,
      UUID toId,
      String relationType,
      RelationProvenance provenance,
      EntityStatus status)
      throws Exception {
    TermRelation relation =
        new TermRelation()
            .withTerm(new EntityReference().withId(toId).withType("glossaryTerm"))
            .withRelationType(relationType)
            .withProvenance(provenance)
            .withStatus(status);
    String url = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromId + "/relations";
    HttpResponse<String> response = send("POST", url, MAPPER.writeValueAsString(relation));
    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "POST relation failed: " + response.statusCode() + " " + response.body());
  }

  private HttpResponse<String> updateRelationById(
      UUID termId, UUID relationshipId, UpdateTermRelation update) throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/glossaryTerms/"
            + termId
            + "/relations/id/"
            + relationshipId;
    return send("PUT", url, MAPPER.writeValueAsString(update));
  }

  private HttpResponse<String> deleteRelationById(UUID termId, UUID relationshipId)
      throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/glossaryTerms/"
            + termId
            + "/relations/id/"
            + relationshipId;
    return send("DELETE", url, "");
  }

  private TermRelation findEdge(GlossaryTerm term, UUID targetId, String relationType) {
    GlossaryTerm reloaded =
        client.glossaryTerms().getByName(term.getFullyQualifiedName(), "relatedTerms");
    if (reloaded.getRelatedTerms() == null) {
      return null;
    }
    for (TermRelation relation : reloaded.getRelatedTerms()) {
      if (relation.getTerm() != null
          && targetId.equals(relation.getTerm().getId())
          && relationType.equals(relation.getRelationType())) {
        return relation;
      }
    }
    return null;
  }

  private String nestedFilter(Map<String, String> nestedFieldValues) throws Exception {
    List<Map<String, Object>> nestedClauses =
        nestedFieldValues.entrySet().stream()
            .map(entry -> Map.<String, Object>of("term", Map.of(entry.getKey(), entry.getValue())))
            .toList();
    Map<String, Object> filter =
        Map.of(
            "query",
            Map.of(
                "bool",
                Map.of(
                    "must",
                    List.of(
                        Map.of("term", Map.of("glossary.id", glossary.getId().toString())),
                        Map.of(
                            "nested",
                            Map.of(
                                "path",
                                "relatedTerms",
                                "query",
                                Map.of("bool", Map.of("must", nestedClauses))))))));
    return MAPPER.writeValueAsString(filter);
  }

  private void awaitSearchHits(String queryFilter, Set<String> expectedIds) {
    await("glossaryTerm search hits " + expectedIds)
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> assertEquals(expectedIds, searchTermIds(queryFilter)));
  }

  private Set<String> searchTermIds(String queryFilter) throws Exception {
    ObjectNode body = MAPPER.createObjectNode();
    body.put("query", "*");
    body.put("index", GLOSSARY_TERM_INDEX);
    body.put("from", 0);
    body.put("size", 25);
    body.put("deleted", false);
    body.put("queryFilter", queryFilter);
    HttpResponse<String> response =
        send("POST", SdkClients.getServerUrl() + "/v1/search/query", body.toString());
    assertEquals(200, response.statusCode(), response.body());
    Set<String> ids = new LinkedHashSet<>();
    for (JsonNode hit : MAPPER.readTree(response.body()).path("hits").path("hits")) {
      ids.add(hit.path("_source").path("id").asText());
    }
    return ids;
  }

  private HttpResponse<String> send(String method, String url, String body) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
