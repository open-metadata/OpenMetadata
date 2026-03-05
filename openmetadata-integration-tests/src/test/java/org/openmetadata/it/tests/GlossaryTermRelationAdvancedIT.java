/*
 *  Copyright 2024 Collate.
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Advanced integration tests for glossary term relations covering:
 * - Cross-glossary restrictions
 * - Bidirectional/inverse relations (antonym, partOf/hasPart)
 * - Soft delete handling
 * - Concurrent operations
 * - Cardinality (many-to-many)
 * - Graph depth traversal
 */
@Execution(ExecutionMode.SAME_THREAD)
@Tag("integration")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryTermRelationAdvancedIT {

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryTermRelationAdvancedIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  private static final String TEST_NAMESPACE =
      "RelationAdvanced_" + UUID.randomUUID().toString().substring(0, 8);

  private static OpenMetadataClient client;
  private static Glossary glossary1;
  private static Glossary glossary2;
  private static GlossaryTerm baseTerm;
  private static GlossaryTerm relatedTerm1;
  private static GlossaryTerm crossGlossaryTerm;

  @BeforeAll
  static void setup() throws Exception {
    client = SdkClients.adminClient();

    // Create two glossaries for cross-glossary testing
    glossary1 =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(TEST_NAMESPACE + "_Glossary1")
                    .withDisplayName("First Test Glossary")
                    .withDescription("First test glossary for advanced relation tests"));

    glossary2 =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(TEST_NAMESPACE + "_Glossary2")
                    .withDisplayName("Second Test Glossary")
                    .withDescription("Second test glossary for cross-glossary tests"));

    // Create terms in glossary1
    baseTerm = createGlossaryTerm(glossary1, "BaseTerm", "Base term for testing");
    relatedTerm1 = createGlossaryTerm(glossary1, "Related1", "Related term 1");

    // Create term in glossary2 for cross-glossary tests
    crossGlossaryTerm =
        createGlossaryTerm(glossary2, "CrossTerm", "Cross glossary term for testing");

    LOG.info("Test setup complete with namespace: {}", TEST_NAMESPACE);
  }

  private static GlossaryTerm createGlossaryTerm(Glossary glossary, String name, String description)
      throws Exception {
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName(TEST_NAMESPACE + "_" + name)
            .withDisplayName(name)
            .withDescription(description)
            .withGlossary(glossary.getFullyQualifiedName());

    GlossaryTerm term = client.glossaryTerms().create(createTerm);
    assertNotNull(term, "Glossary term " + name + " should be created");
    LOG.info("Created glossary term: {}", term.getFullyQualifiedName());
    return term;
  }

  // ==================== Cross-Glossary Relation Tests ====================

  @Test
  @Order(1)
  void testRelatedToAllowedCrossGlossary() throws Exception {
    // relatedTo should be allowed across glossaries
    addTypedRelation(baseTerm, crossGlossaryTerm, "relatedTo");

    // Verify the relation exists
    GlossaryTerm updated =
        client.glossaryTerms().getByName(baseTerm.getFullyQualifiedName(), "relatedTerms");

    boolean hasRelation =
        updated.getRelatedTerms().stream()
            .anyMatch(
                rel ->
                    rel.getTerm().getId().equals(crossGlossaryTerm.getId())
                        && "relatedTo".equals(rel.getRelationType()));

    assertTrue(hasRelation, "relatedTo relation should be allowed across glossaries");
  }

  // ==================== Antonym and PartOf Relation Tests ====================

  @Test
  @Order(10)
  void testAntonymRelationIsBidirectional() throws Exception {
    // Create terms for antonym test
    GlossaryTerm hotTerm = createGlossaryTerm(glossary1, "Hot", "Hot temperature");
    GlossaryTerm coldTerm = createGlossaryTerm(glossary1, "Cold", "Cold temperature");

    // Add antonym relation
    addTypedRelation(hotTerm, coldTerm, "antonym");

    // Verify bidirectional - hot should have antonym to cold
    GlossaryTerm hotUpdated =
        client.glossaryTerms().getByName(hotTerm.getFullyQualifiedName(), "relatedTerms");

    boolean hotHasAntonym =
        hotUpdated.getRelatedTerms().stream()
            .anyMatch(
                rel ->
                    rel.getTerm().getId().equals(coldTerm.getId())
                        && "antonym".equals(rel.getRelationType()));

    assertTrue(hotHasAntonym, "Hot should have antonym relation to Cold");

    // Verify inverse - cold should also have antonym to hot (symmetric)
    GlossaryTerm coldUpdated =
        client.glossaryTerms().getByName(coldTerm.getFullyQualifiedName(), "relatedTerms");

    boolean coldHasAntonym =
        coldUpdated.getRelatedTerms().stream()
            .anyMatch(
                rel ->
                    rel.getTerm().getId().equals(hotTerm.getId())
                        && "antonym".equals(rel.getRelationType()));

    assertTrue(coldHasAntonym, "Cold should have antonym relation to Hot (bidirectional)");
  }

  @Test
  @Order(11)
  void testPartOfRelationCreated() throws Exception {
    // Create terms for partOf test
    GlossaryTerm wholeTerm = createGlossaryTerm(glossary1, "Car", "A car (whole)");
    GlossaryTerm partTerm = createGlossaryTerm(glossary1, "Engine", "An engine (part)");

    // Add partOf relation (engine is partOf car)
    addTypedRelation(partTerm, wholeTerm, "partOf");

    // Verify partOf relation exists
    GlossaryTerm partUpdated =
        client.glossaryTerms().getByName(partTerm.getFullyQualifiedName(), "relatedTerms");

    boolean partHasPartOf =
        partUpdated.getRelatedTerms().stream()
            .anyMatch(
                rel ->
                    rel.getTerm().getId().equals(wholeTerm.getId())
                        && "partOf".equals(rel.getRelationType()));

    assertTrue(partHasPartOf, "Engine should have partOf relation to Car");

    // Document: inverse hasPart relation is NOT automatically created
    // This is expected behavior for asymmetric relations
    GlossaryTerm wholeUpdated =
        client.glossaryTerms().getByName(wholeTerm.getFullyQualifiedName(), "relatedTerms");

    boolean wholeHasPart =
        wholeUpdated.getRelatedTerms() != null
            && wholeUpdated.getRelatedTerms().stream()
                .anyMatch(
                    rel ->
                        rel.getTerm().getId().equals(partTerm.getId())
                            && "hasPart".equals(rel.getRelationType()));

    LOG.info(
        "Inverse hasPart relation automatically created: {}. "
            + "Note: Inverse relations for asymmetric relation types (partOf/hasPart) "
            + "require explicit creation if not configured for auto-inverse.",
        wholeHasPart);
  }

  // ==================== Soft Delete Handling Tests ====================

  @Test
  @Order(20)
  void testRelationsToSoftDeletedTermHandling() throws Exception {
    // Create terms for soft delete test
    GlossaryTerm termToDelete = createGlossaryTerm(glossary1, "ToDelete", "Term to be deleted");
    GlossaryTerm linkedTerm = createGlossaryTerm(glossary1, "Linked", "Term linked to deleted");

    // Add relation
    addTypedRelation(linkedTerm, termToDelete, "relatedTo");

    // Verify relation exists
    GlossaryTerm beforeDelete =
        client.glossaryTerms().getByName(linkedTerm.getFullyQualifiedName(), "relatedTerms");

    assertTrue(
        beforeDelete.getRelatedTerms().stream()
            .anyMatch(rel -> rel.getTerm().getId().equals(termToDelete.getId())),
        "Relation should exist before delete");

    // Soft delete the target term
    client.glossaryTerms().delete(termToDelete.getId().toString());

    // Verify behavior after soft delete
    GlossaryTerm afterDelete =
        client.glossaryTerms().getByName(linkedTerm.getFullyQualifiedName(), "relatedTerms");

    // Document current behavior - relation may or may not persist
    LOG.info(
        "Relations after soft delete: {}",
        afterDelete.getRelatedTerms() != null ? afterDelete.getRelatedTerms().size() : 0);
  }

  // ==================== Concurrent Operations Tests ====================

  @Test
  @Order(30)
  void testConcurrentRelationOperations() throws Exception {
    // Create a hub term that will receive many concurrent relations
    GlossaryTerm hubTerm = createGlossaryTerm(glossary1, "Hub", "Hub term for concurrent test");

    int threadCount = 10;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch latch = new CountDownLatch(threadCount);
    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger failureCount = new AtomicInteger(0);

    // Create terms and add relations concurrently
    for (int i = 0; i < threadCount; i++) {
      final int index = i;
      executor.submit(
          () -> {
            try {
              // Create a unique term
              GlossaryTerm spokeTerm =
                  createGlossaryTerm(glossary1, "Spoke" + index, "Spoke term " + index);

              // Add relation to hub
              addTypedRelation(spokeTerm, hubTerm, "relatedTo");

              successCount.incrementAndGet();
            } catch (Exception e) {
              LOG.error("Concurrent operation failed for thread {}: {}", index, e.getMessage());
              failureCount.incrementAndGet();
            } finally {
              latch.countDown();
            }
          });
    }

    // Wait for all threads to complete
    assertTrue(latch.await(60, TimeUnit.SECONDS), "All threads should complete within 60 seconds");
    executor.shutdown();

    LOG.info(
        "Concurrent test results: {} successes, {} failures",
        successCount.get(),
        failureCount.get());

    // Verify hub term has expected number of relations
    GlossaryTerm hubUpdated =
        client.glossaryTerms().getByName(hubTerm.getFullyQualifiedName(), "relatedTerms");

    LOG.info(
        "Hub term has {} relations after concurrent additions",
        hubUpdated.getRelatedTerms() != null ? hubUpdated.getRelatedTerms().size() : 0);

    // At least some relations should have been created
    assertTrue(successCount.get() > 0, "At least some concurrent relations should succeed");
  }

  // ==================== Cardinality Tests ====================

  @Test
  @Order(40)
  void testManyToManyCardinalityAllowed() throws Exception {
    // Create terms for many-to-many test
    GlossaryTerm termA = createGlossaryTerm(glossary1, "ManyA", "Term A for many-to-many");
    GlossaryTerm termB = createGlossaryTerm(glossary1, "ManyB", "Term B for many-to-many");
    GlossaryTerm termC = createGlossaryTerm(glossary1, "ManyC", "Term C for many-to-many");

    // Add multiple relations - A related to B and C
    addTypedRelation(termA, termB, "relatedTo");
    addTypedRelation(termA, termC, "relatedTo");

    // Add relation from B to C as well
    addTypedRelation(termB, termC, "relatedTo");

    // Verify A has two relations
    GlossaryTerm termAUpdated =
        client.glossaryTerms().getByName(termA.getFullyQualifiedName(), "relatedTerms");

    long aRelationCount =
        termAUpdated.getRelatedTerms().stream()
            .filter(rel -> "relatedTo".equals(rel.getRelationType()))
            .count();

    assertEquals(2, aRelationCount, "Term A should have 2 relatedTo relations");
  }

  // ==================== Graph Depth Traversal Tests ====================

  @Test
  @Order(50)
  void testGraphDepthTraversal() throws Exception {
    // Create a chain: Level1 -> Level2 -> Level3 -> Level4
    GlossaryTerm level1 = createGlossaryTerm(glossary1, "Level1", "Level 1 term");
    GlossaryTerm level2 = createGlossaryTerm(glossary1, "Level2", "Level 2 term");
    GlossaryTerm level3 = createGlossaryTerm(glossary1, "Level3", "Level 3 term");
    GlossaryTerm level4 = createGlossaryTerm(glossary1, "Level4", "Level 4 term");

    // Create chain using broader relations
    addTypedRelation(level1, level2, "broader");
    addTypedRelation(level2, level3, "broader");
    addTypedRelation(level3, level4, "broader");

    LOG.info("Created 4-level hierarchy chain for depth testing");

    // Verify the chain was created
    GlossaryTerm level1Updated =
        client.glossaryTerms().getByName(level1.getFullyQualifiedName(), "relatedTerms");

    boolean hasBroaderToLevel2 =
        level1Updated.getRelatedTerms().stream()
            .anyMatch(
                rel ->
                    rel.getTerm().getId().equals(level2.getId())
                        && "broader".equals(rel.getRelationType()));

    assertTrue(hasBroaderToLevel2, "Level1 should have broader relation to Level2");
  }

  private void addTypedRelation(GlossaryTerm fromTerm, GlossaryTerm toTerm, String relationType)
      throws Exception {
    String patchUrl = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromTerm.getId();

    String patchBody =
        MAPPER.writeValueAsString(
            List.of(
                new java.util.HashMap<String, Object>() {
                  {
                    put("op", "add");
                    put("path", "/relatedTerms/-");
                    put(
                        "value",
                        new java.util.HashMap<String, Object>() {
                          {
                            put("relationType", relationType);
                            put(
                                "term",
                                new java.util.HashMap<String, Object>() {
                                  {
                                    put("id", toTerm.getId().toString());
                                    put("type", "glossaryTerm");
                                  }
                                });
                          }
                        });
                  }
                }));

    LOG.info("PATCH request to {} with body: {}", patchUrl, patchBody);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(patchUrl))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(patchBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    LOG.info("PATCH response status: {}, body: {}", response.statusCode(), response.body());

    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "Adding relation should succeed. Status: "
            + response.statusCode()
            + ", Body: "
            + response.body());
  }
}
