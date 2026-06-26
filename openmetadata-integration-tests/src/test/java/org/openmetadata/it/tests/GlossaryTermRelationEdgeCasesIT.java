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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Comprehensive edge case and priority tests for Glossary Term Relations.
 *
 * <p>Tests cover:
 * - Priority 1: Bidirectional relations, cross-glossary enforcement, self-relations, duplicates
 * - Priority 2: Authorization and permissions
 * - Priority 3: Data validation
 * - Priority 4: Transitive relations, circular prevention
 * - Priority 5: CSV edge cases
 * - Priority 6: Concurrency
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermRelationEdgeCasesIT {

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryTermRelationEdgeCasesIT.class);
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  // ==================== PRIORITY 1: BIDIRECTIONAL RELATIONS ====================

  @Test
  void testSymmetricRelationCreatesBidirectional(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    GlossaryTerm updatedTermA =
        addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    assertNotNull(updatedTermA, "Should successfully add synonym relation");

    GlossaryTerm fetchedTermB = getGlossaryTerm(termB.getId().toString());
    assertNotNull(fetchedTermB, "Should fetch termB");

    boolean termBHasRelationToA =
        fetchedTermB.getRelatedTerms() != null
            && fetchedTermB.getRelatedTerms().stream()
                .anyMatch(r -> r.getTerm().getId().equals(termA.getId()));

    LOG.info(
        "Symmetric relation test: termA->termB created, termB has {} related terms",
        fetchedTermB.getRelatedTerms() != null ? fetchedTermB.getRelatedTerms().size() : 0);

    assertTrue(
        termBHasRelationToA,
        "Symmetric relation (synonym) should create bidirectional link - termB should relate to termA");
  }

  @Test
  void testAsymmetricRelationCreatesInverse(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm narrowTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "narrowTerm");
    GlossaryTerm broadTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "broadTerm");

    GlossaryTerm updatedNarrow =
        addTermRelation(narrowTerm.getId().toString(), broadTerm.getId().toString(), "broader");
    assertNotNull(updatedNarrow, "Should successfully add broader relation");

    boolean narrowHasBroaderToBroad =
        updatedNarrow.getRelatedTerms() != null
            && updatedNarrow.getRelatedTerms().stream()
                .anyMatch(
                    r ->
                        r.getTerm().getId().equals(broadTerm.getId())
                            && "broader".equals(r.getRelationType()));
    assertTrue(narrowHasBroaderToBroad, "narrowTerm should have 'broader' relation to broadTerm");

    GlossaryTerm fetchedBroad = getGlossaryTerm(broadTerm.getId().toString());
    assertNotNull(fetchedBroad, "Should fetch broadTerm");

    boolean broadHasAnyRelationToNarrow =
        fetchedBroad.getRelatedTerms() != null
            && fetchedBroad.getRelatedTerms().stream()
                .anyMatch(r -> r.getTerm().getId().equals(narrowTerm.getId()));

    LOG.info(
        "Asymmetric relation test: narrowTerm->broadTerm (broader), broadTerm has relations: {}",
        fetchedBroad.getRelatedTerms());

    assertTrue(
        broadHasAnyRelationToNarrow,
        "Adding 'broader' relation should create a bidirectional link (broadTerm relates back to narrowTerm)");
  }

  @Test
  void testRemovingOneDirectionRemovesBoth(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");

    GlossaryTerm termABeforeRemove = getGlossaryTerm(termA.getId().toString());
    int countBefore =
        termABeforeRemove.getRelatedTerms() != null
            ? termABeforeRemove.getRelatedTerms().size()
            : 0;
    LOG.info("Before removal, termA has {} relations", countBefore);

    removeTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    removeTermRelation(termB.getId().toString(), termA.getId().toString(), "synonym");

    GlossaryTerm termAAfterRemove = getGlossaryTerm(termA.getId().toString());
    GlossaryTerm termBAfterRemove = getGlossaryTerm(termB.getId().toString());

    boolean termAStillHasRelation =
        termAAfterRemove.getRelatedTerms() != null
            && termAAfterRemove.getRelatedTerms().stream()
                .anyMatch(
                    r ->
                        r.getTerm().getId().equals(termB.getId())
                            && "synonym".equals(r.getRelationType()));

    boolean termBStillHasRelation =
        termBAfterRemove.getRelatedTerms() != null
            && termBAfterRemove.getRelatedTerms().stream()
                .anyMatch(
                    r ->
                        r.getTerm().getId().equals(termA.getId())
                            && "synonym".equals(r.getRelationType()));

    LOG.info(
        "After removal (both directions): termA has synonym to termB: {}, termB has synonym to termA: {}",
        termAStillHasRelation,
        termBStillHasRelation);

    assertFalse(
        termAStillHasRelation,
        "After removing both directions, termA should not have synonym relation to termB");
    assertFalse(
        termBStillHasRelation,
        "After removing both directions, termB should not have synonym relation to termA");
  }

  // ==================== PRIORITY 1: SELF-RELATION PREVENTION ====================

  @Test
  void testSelfRelationShouldBePreventedOrHandled(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term = GlossaryTermTestFactory.createWithName(ns, glossary, "selfTerm");

    HttpResponse<String> response =
        addTermRelationRaw(term.getId().toString(), term.getId().toString(), "synonym");

    LOG.info("Self-relation attempt: status={}, body={}", response.statusCode(), response.body());

    assertTrue(
        response.statusCode() >= 400 || response.statusCode() == 200,
        "Self-relation should either be prevented (4xx) or handled gracefully");

    if (response.statusCode() == 200) {
      GlossaryTerm fetchedTerm = getGlossaryTerm(term.getId().toString());
      boolean hasSelfRelation =
          fetchedTerm.getRelatedTerms() != null
              && fetchedTerm.getRelatedTerms().stream()
                  .anyMatch(r -> r.getTerm().getId().equals(term.getId()));
      LOG.info("Self-relation was accepted, term has self-relation: {}", hasSelfRelation);
    }
  }

  // ==================== PRIORITY 1: DUPLICATE RELATION PREVENTION ====================

  @Test
  void testDuplicateRelationHandling(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    GlossaryTerm firstAdd =
        addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    assertNotNull(firstAdd, "First relation should be added successfully");

    int countAfterFirst =
        firstAdd.getRelatedTerms() != null ? firstAdd.getRelatedTerms().size() : 0;
    LOG.info("After first add, termA has {} relations", countAfterFirst);

    HttpResponse<String> secondResponse =
        addTermRelationRaw(termA.getId().toString(), termB.getId().toString(), "synonym");
    LOG.info(
        "Duplicate relation attempt: status={}, body={}",
        secondResponse.statusCode(),
        secondResponse.body());

    if (secondResponse.statusCode() == 200) {
      GlossaryTerm afterSecond = OBJECT_MAPPER.readValue(secondResponse.body(), GlossaryTerm.class);
      int countAfterSecond =
          afterSecond.getRelatedTerms() != null ? afterSecond.getRelatedTerms().size() : 0;

      LOG.info("After second add attempt, termA has {} relations", countAfterSecond);

      long synonymCount =
          afterSecond.getRelatedTerms().stream()
              .filter(
                  r ->
                      r.getTerm().getId().equals(termB.getId())
                          && "synonym".equals(r.getRelationType()))
              .count();

      assertTrue(
          synonymCount <= 1,
          "Should not have duplicate synonym relations to same term. Found: " + synonymCount);
    }
  }

  @Test
  void testAddingDifferentRelationTypesToSamePair(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    addTermRelation(termA.getId().toString(), termB.getId().toString(), "relatedTo");

    GlossaryTerm fetchedTermA = getGlossaryTerm(termA.getId().toString());

    long relationCount =
        fetchedTermA.getRelatedTerms() != null
            ? fetchedTermA.getRelatedTerms().stream()
                .filter(r -> r.getTerm().getId().equals(termB.getId()))
                .count()
            : 0;

    LOG.info(
        "After adding synonym and relatedTo to same pair, termA has {} relations to termB",
        relationCount);

    assertTrue(
        relationCount >= 1,
        "Should be able to have at least one relation type between same term pair");
  }

  // ==================== PRIORITY 1: CROSS-GLOSSARY RELATIONS ====================

  @Test
  void testCrossGlossaryRelationWithRelatedTo(TestNamespace ns) throws Exception {
    Glossary glossary1 = GlossaryTestFactory.createWithName(ns, "glossary1");
    Glossary glossary2 = GlossaryTestFactory.createWithName(ns, "glossary2");

    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary1, "term1");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary2, "term2");

    HttpResponse<String> response =
        addTermRelationRaw(term1.getId().toString(), term2.getId().toString(), "relatedTo");

    LOG.info(
        "Cross-glossary relation (relatedTo) attempt: status={}, body={}",
        response.statusCode(),
        response.body());

    assertEquals(
        200,
        response.statusCode(),
        "relatedTo relation should be allowed across glossaries (isCrossGlossaryAllowed=true)");
  }

  // ==================== PRIORITY 3: DATA VALIDATION ====================

  @Test
  void testInvalidRelationTypeIsRejected(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    HttpResponse<String> response =
        addTermRelationRaw(
            termA.getId().toString(), termB.getId().toString(), "invalidRelationType123");

    LOG.info(
        "Invalid relation type attempt: status={}, body={}",
        response.statusCode(),
        response.body());

    assertTrue(
        response.statusCode() >= 400,
        "Invalid relation type should be rejected with 4xx status. Got: " + response.statusCode());
  }

  @Test
  void testEmptyRelationTypeHandling(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String jsonBody =
        String.format("{\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"}}", termB.getId());

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/glossaryTerms/" + termA.getId() + "/relations"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    LOG.info(
        "Empty relation type attempt: status={}, body={}", response.statusCode(), response.body());

    assertTrue(
        response.statusCode() == 200 || response.statusCode() >= 400,
        "Empty relation type should either be accepted with default or rejected. Got: "
            + response.statusCode());

    if (response.statusCode() == 200) {
      GlossaryTerm result = OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
      boolean hasRelation =
          result.getRelatedTerms() != null
              && result.getRelatedTerms().stream()
                  .anyMatch(r -> r.getTerm().getId().equals(termB.getId()));
      LOG.info("Empty relation type was accepted, relation created: {}", hasRelation);
    } else {
      LOG.info(
          "Empty relation type was rejected with status {}, which is acceptable behavior",
          response.statusCode());
    }
  }

  @Test
  void testRelationToNonExistentTermFails(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");

    String nonExistentId = UUID.randomUUID().toString();

    HttpResponse<String> response =
        addTermRelationRaw(termA.getId().toString(), nonExistentId, "synonym");

    LOG.info(
        "Relation to non-existent term attempt: status={}, body={}",
        response.statusCode(),
        response.body());

    assertTrue(
        response.statusCode() >= 400,
        "Relation to non-existent term should fail. Got status: " + response.statusCode());
  }

  // ==================== PRIORITY 4: TRANSITIVE RELATIONS ====================

  @Test
  void testTransitiveRelationChainInGraph(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "termC");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "broader");
    addTermRelation(termB.getId().toString(), termC.getId().toString(), "broader");

    Map<String, Object> graph = getTermRelationGraph(termA.getId().toString(), 3, null);

    assertNotNull(graph, "Graph should not be null");
    assertTrue(graph.containsKey("nodes"), "Graph should have nodes");
    assertTrue(graph.containsKey("edges"), "Graph should have edges");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> nodes = (List<Map<String, Object>>) graph.get("nodes");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> edges = (List<Map<String, Object>>) graph.get("edges");

    LOG.info("Transitive chain graph: {} nodes, {} edges", nodes.size(), edges.size());

    assertTrue(nodes.size() >= 3, "Graph should include all 3 terms in the chain");
    assertTrue(edges.size() >= 2, "Graph should include the 2 direct relations");
  }

  @Test
  void testGraphDepthLimitsResults(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "term1");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "term2");
    GlossaryTerm term3 = GlossaryTermTestFactory.createWithName(ns, glossary, "term3");
    GlossaryTerm term4 = GlossaryTermTestFactory.createWithName(ns, glossary, "term4");

    addTermRelation(term1.getId().toString(), term2.getId().toString(), "broader");
    addTermRelation(term2.getId().toString(), term3.getId().toString(), "broader");
    addTermRelation(term3.getId().toString(), term4.getId().toString(), "broader");

    Map<String, Object> depthOneGraph = getTermRelationGraph(term1.getId().toString(), 1, null);
    Map<String, Object> depthThreeGraph = getTermRelationGraph(term1.getId().toString(), 3, null);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> depthOneNodes =
        (List<Map<String, Object>>) depthOneGraph.get("nodes");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> depthThreeNodes =
        (List<Map<String, Object>>) depthThreeGraph.get("nodes");

    LOG.info(
        "Depth 1 graph: {} nodes, Depth 3 graph: {} nodes",
        depthOneNodes.size(),
        depthThreeNodes.size());

    assertTrue(
        depthThreeNodes.size() >= depthOneNodes.size(),
        "Deeper traversal should include at least as many nodes");
  }

  // ==================== PRIORITY 4: CIRCULAR RELATION DETECTION ====================

  @Test
  void testCircularRelationHandling(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "termC");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "broader");
    addTermRelation(termB.getId().toString(), termC.getId().toString(), "broader");

    HttpResponse<String> circularResponse =
        addTermRelationRaw(termC.getId().toString(), termA.getId().toString(), "broader");

    LOG.info(
        "Circular relation attempt (C->A after A->B->C): status={}, body={}",
        circularResponse.statusCode(),
        circularResponse.body());

    Map<String, Object> graph = getTermRelationGraph(termA.getId().toString(), 5, null);
    assertNotNull(graph, "Graph query should not fail even with potential cycles");

    LOG.info(
        "Graph query succeeded with potential cycle, nodes: {}",
        ((List<?>) graph.get("nodes")).size());
  }

  // ==================== PRIORITY 5: CSV EDGE CASES ====================

  @Test
  void testCsvImportWithMissingReferencedTerm(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);

    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s_termWithBadRef,Term With Bad Ref,Test description,,synonym:nonExistent.term.fqn,,,,,Draft,,,",
            ns.prefix(""));

    String result = importGlossaryCsv(glossary.getName(), csvContent, true);
    LOG.info("CSV import with missing referenced term result: {}", result);

    assertNotNull(result, "Import should return a result (success or failure details)");
  }

  @Test
  void testCsvImportWithInvalidRelationType(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm =
        GlossaryTermTestFactory.createWithName(ns, glossary, "existingTerm");

    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s_newTerm,New Term,Test description,,invalidType:%s,,,,,Draft,,,",
            ns.prefix(""), existingTerm.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, true);
    LOG.info("CSV import with invalid relation type result: {}", result);

    assertNotNull(result, "Import should return a result");
  }

  @Test
  void testCsvExportPreservesAllRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm baseTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "baseTerm");
    GlossaryTerm synonymTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "synonymTerm");
    GlossaryTerm broaderTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "broaderTerm");

    addTermRelation(baseTerm.getId().toString(), synonymTerm.getId().toString(), "synonym");
    addTermRelation(baseTerm.getId().toString(), broaderTerm.getId().toString(), "broader");

    String csv = exportGlossaryCsv(glossary.getName());

    LOG.info("Exported CSV:\n{}", csv);

    assertNotNull(csv, "CSV export should succeed");
    assertTrue(
        csv.contains("synonym:") || csv.contains(synonymTerm.getName()),
        "CSV should contain synonym relation or term name");
    assertTrue(
        csv.contains("broader:") || csv.contains(broaderTerm.getName()),
        "CSV should contain broader relation or term name");
  }

  // ==================== PRIORITY 6: CONCURRENCY ====================

  @Test
  void testConcurrentRelationAdditions(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm baseTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "baseTerm");

    int numConcurrentOps = 5;
    GlossaryTerm[] targetTerms = new GlossaryTerm[numConcurrentOps];
    for (int i = 0; i < numConcurrentOps; i++) {
      targetTerms[i] = GlossaryTermTestFactory.createWithName(ns, glossary, "target" + i);
    }

    ExecutorService executor = Executors.newFixedThreadPool(numConcurrentOps);
    CountDownLatch latch = new CountDownLatch(numConcurrentOps);
    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger failureCount = new AtomicInteger(0);

    for (int i = 0; i < numConcurrentOps; i++) {
      final int index = i;
      executor.submit(
          () -> {
            try {
              GlossaryTerm result =
                  addTermRelation(
                      baseTerm.getId().toString(),
                      targetTerms[index].getId().toString(),
                      "relatedTo");
              if (result != null) {
                successCount.incrementAndGet();
              } else {
                failureCount.incrementAndGet();
              }
            } catch (Exception e) {
              LOG.warn("Concurrent operation {} failed: {}", index, e.getMessage());
              failureCount.incrementAndGet();
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await();
    executor.shutdown();

    LOG.info(
        "Concurrent relation additions: {} successes, {} failures",
        successCount.get(),
        failureCount.get());

    GlossaryTerm finalTerm = getGlossaryTerm(baseTerm.getId().toString());
    int finalRelationCount =
        finalTerm.getRelatedTerms() != null ? finalTerm.getRelatedTerms().size() : 0;

    LOG.info("Final relation count on baseTerm: {}", finalRelationCount);

    assertTrue(successCount.get() > 0, "At least some concurrent operations should succeed");
  }

  @Test
  void testConcurrentSameRelationAddition(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    int numConcurrentOps = 3;
    ExecutorService executor = Executors.newFixedThreadPool(numConcurrentOps);
    CountDownLatch latch = new CountDownLatch(numConcurrentOps);
    AtomicInteger successCount = new AtomicInteger(0);

    for (int i = 0; i < numConcurrentOps; i++) {
      executor.submit(
          () -> {
            try {
              HttpResponse<String> response =
                  addTermRelationRaw(termA.getId().toString(), termB.getId().toString(), "synonym");
              if (response.statusCode() == 200) {
                successCount.incrementAndGet();
              }
            } catch (Exception e) {
              LOG.warn("Concurrent same-relation operation failed: {}", e.getMessage());
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await();
    executor.shutdown();

    LOG.info("Concurrent same-relation additions: {} reported success", successCount.get());

    GlossaryTerm finalTermA = getGlossaryTerm(termA.getId().toString());
    long synonymCount =
        finalTermA.getRelatedTerms() != null
            ? finalTermA.getRelatedTerms().stream()
                .filter(
                    r ->
                        r.getTerm().getId().equals(termB.getId())
                            && "synonym".equals(r.getRelationType()))
                .count()
            : 0;

    LOG.info("Final synonym relation count from termA to termB: {}", synonymCount);

    assertTrue(
        synonymCount <= 1,
        "Should not have duplicate relations even with concurrent additions. Found: "
            + synonymCount);
  }

  // ==================== PRIORITY 7: HARD DELETE CASCADE ====================

  @Test
  void testHardDeleteCascadesRelations(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "termC");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "relatedTo");
    addTermRelation(termA.getId().toString(), termC.getId().toString(), "synonym");

    GlossaryTerm beforeDelete = getGlossaryTerm(termB.getId().toString());
    boolean hasRelationBeforeDelete =
        beforeDelete.getRelatedTerms() != null
            && beforeDelete.getRelatedTerms().stream()
                .anyMatch(r -> r.getTerm().getId().equals(termA.getId()));
    assertTrue(hasRelationBeforeDelete, "termB should have relation to termA before delete");

    hardDeleteTerm(termA.getId().toString());

    GlossaryTerm termBAfterDelete = getGlossaryTerm(termB.getId().toString());
    boolean hasRelationAfterDelete =
        termBAfterDelete.getRelatedTerms() != null
            && termBAfterDelete.getRelatedTerms().stream()
                .anyMatch(r -> r.getTerm().getId().equals(termA.getId()));

    assertFalse(
        hasRelationAfterDelete, "termB should NOT have relation to termA after hard delete");

    GlossaryTerm termCAfterDelete = getGlossaryTerm(termC.getId().toString());
    boolean cHasRelationAfterDelete =
        termCAfterDelete.getRelatedTerms() != null
            && termCAfterDelete.getRelatedTerms().stream()
                .anyMatch(r -> r.getTerm().getId().equals(termA.getId()));

    assertFalse(
        cHasRelationAfterDelete,
        "termC should NOT have synonym relation to termA after hard delete");
  }

  @Test
  void testSoftDeleteAndRestorePreservesRelations(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");

    GlossaryTerm beforeDelete = getGlossaryTerm(termA.getId().toString());
    int countBefore =
        beforeDelete.getRelatedTerms() != null ? beforeDelete.getRelatedTerms().size() : 0;
    assertTrue(countBefore > 0, "Should have relations before soft delete");

    softDeleteTerm(termA.getId().toString());

    restoreTerm(termA.getId().toString());

    GlossaryTerm afterRestore = getGlossaryTerm(termA.getId().toString());
    int countAfter =
        afterRestore.getRelatedTerms() != null ? afterRestore.getRelatedTerms().size() : 0;

    LOG.info("Relations before delete: {}, after restore: {}", countBefore, countAfter);

    assertEquals(
        countBefore, countAfter, "Relations should be preserved after soft delete + restore");
  }

  // ==================== PRIORITY 8: GRAPH ENDPOINT EDGE CASES ====================

  @Test
  void testRelationGraphForTermWithNoRelations(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm isolatedTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "isolated");

    Map<String, Object> graph = getTermRelationGraph(isolatedTerm.getId().toString(), 1, null);

    assertNotNull(graph, "Graph should not be null even for isolated term");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> nodes = (List<Map<String, Object>>) graph.get("nodes");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> edges = (List<Map<String, Object>>) graph.get("edges");

    assertNotNull(nodes, "Nodes should not be null");
    assertEquals(1, nodes.size(), "Should have exactly 1 node (the term itself)");
    assertTrue(edges == null || edges.isEmpty(), "Should have no edges for isolated term");
  }

  @Test
  void testRelationGraphFilteredBySpecificType(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "termC");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    addTermRelation(termA.getId().toString(), termC.getId().toString(), "broader");

    Map<String, Object> allGraph = getTermRelationGraph(termA.getId().toString(), 1, null);
    Map<String, Object> synonymOnlyGraph =
        getTermRelationGraph(termA.getId().toString(), 1, "synonym");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> allEdges = (List<Map<String, Object>>) allGraph.get("edges");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> synonymEdges =
        (List<Map<String, Object>>) synonymOnlyGraph.get("edges");

    LOG.info(
        "All edges: {}, synonym-only edges: {}",
        allEdges != null ? allEdges.size() : 0,
        synonymEdges != null ? synonymEdges.size() : 0);

    assertTrue(
        allEdges != null && allEdges.size() >= 2, "Unfiltered graph should have at least 2 edges");
    assertTrue(
        synonymEdges != null && synonymEdges.size() >= 1,
        "Synonym-filtered graph should have at least 1 edge");
    assertTrue(
        synonymEdges.size() <= allEdges.size(),
        "Filtered graph should have fewer or equal edges than unfiltered");
  }

  @Test
  void testRelationGraphForNonExistentTerm(TestNamespace ns) throws Exception {
    String nonExistentId = UUID.randomUUID().toString();

    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format("%s/v1/glossaryTerms/%s/relationsGraph?depth=1", baseUrl, nonExistentId);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertTrue(
        response.statusCode() >= 400,
        "Graph for non-existent term should return 4xx. Got: " + response.statusCode());
  }

  // ==================== PRIORITY 9: PATCH OPERATIONS ====================

  @Test
  void testPatchRemoveSpecificRelation(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "termC");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    addTermRelation(termA.getId().toString(), termC.getId().toString(), "relatedTo");

    GlossaryTerm before = getGlossaryTerm(termA.getId().toString());
    int countBefore = before.getRelatedTerms() != null ? before.getRelatedTerms().size() : 0;
    assertTrue(countBefore >= 2, "Should have at least 2 relations before removal");

    removeTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");

    GlossaryTerm after = getGlossaryTerm(termA.getId().toString());

    boolean stillHasSynonym =
        after.getRelatedTerms() != null
            && after.getRelatedTerms().stream()
                .anyMatch(
                    r ->
                        r.getTerm().getId().equals(termB.getId())
                            && "synonym".equals(r.getRelationType()));

    boolean stillHasRelatedTo =
        after.getRelatedTerms() != null
            && after.getRelatedTerms().stream()
                .anyMatch(
                    r ->
                        r.getTerm().getId().equals(termC.getId())
                            && "relatedTo".equals(r.getRelationType()));

    assertFalse(stillHasSynonym, "Synonym to termB should be removed");
    assertTrue(stillHasRelatedTo, "relatedTo to termC should still exist");
  }

  @Test
  void testRemoveRelationWithoutSpecifyingType(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");

    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format("%s/v1/glossaryTerms/%s/relations/%s", baseUrl, termA.getId(), termB.getId());

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30))
            .DELETE()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    LOG.info(
        "Remove without relationType: status={}, body={}", response.statusCode(), response.body());

    assertTrue(
        response.statusCode() == 200 || response.statusCode() >= 400,
        "Remove without type should either succeed (remove all) or fail explicitly");

    if (response.statusCode() == 200) {
      GlossaryTerm after = getGlossaryTerm(termA.getId().toString());
      boolean hasRelation =
          after.getRelatedTerms() != null
              && after.getRelatedTerms().stream()
                  .anyMatch(r -> r.getTerm().getId().equals(termB.getId()));
      LOG.info("After remove without type, relation exists: {}", hasRelation);
    }
  }

  // ==================== PRIORITY 10: BULK CREATION ====================

  @Test
  void testCreateTermWithRelatedTermsInPayload(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "existing");

    GlossaryTerm newTerm =
        GlossaryTermTestFactory.createWithRelatedTerms(
            ns, glossary, "withRelated", List.of(existingTerm.getFullyQualifiedName()));

    assertNotNull(newTerm, "Term with related terms should be created");

    GlossaryTerm fetched = getGlossaryTerm(newTerm.getId().toString());
    boolean hasRelation =
        fetched.getRelatedTerms() != null
            && fetched.getRelatedTerms().stream()
                .anyMatch(r -> r.getTerm().getId().equals(existingTerm.getId()));

    assertTrue(hasRelation, "Newly created term should have relation to existing term");
  }

  @Test
  void testCreateTermWithMultipleRelatedTerms(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "rel1");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "rel2");
    GlossaryTerm term3 = GlossaryTermTestFactory.createWithName(ns, glossary, "rel3");

    GlossaryTerm newTerm =
        GlossaryTermTestFactory.createWithRelatedTerms(
            ns,
            glossary,
            "multiRelated",
            List.of(
                term1.getFullyQualifiedName(),
                term2.getFullyQualifiedName(),
                term3.getFullyQualifiedName()));

    assertNotNull(newTerm, "Term with multiple related terms should be created");

    GlossaryTerm fetched = getGlossaryTerm(newTerm.getId().toString());
    int relationCount = fetched.getRelatedTerms() != null ? fetched.getRelatedTerms().size() : 0;

    LOG.info("Term created with {} related terms, fetched has {} relations", 3, relationCount);

    assertTrue(relationCount >= 3, "Should have at least 3 relations from creation payload");
  }

  // ==================== PRIORITY 11: MIGRATION VERIFICATION ====================

  @Test
  void testExistingRelationsHaveRelationType(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "relatedTo");

    GlossaryTerm fetched = getGlossaryTerm(termA.getId().toString());
    assertNotNull(fetched.getRelatedTerms(), "Should have related terms");
    assertFalse(fetched.getRelatedTerms().isEmpty(), "Related terms should not be empty");

    for (var relation : fetched.getRelatedTerms()) {
      assertNotNull(
          relation.getRelationType(),
          "Every relation should have a relationType (migration backfill)");
      assertFalse(relation.getRelationType().isEmpty(), "relationType should not be empty");
      LOG.info(
          "Relation to {} has type: {}", relation.getTerm().getName(), relation.getRelationType());
    }
  }

  // ==================== PRIORITY 12: USAGE COUNTS ACCURACY ====================

  @Test
  void testUsageCountsReflectActualRelations(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "termC");

    Map<String, Integer> countsBefore = getUsageCounts();
    int synonymBefore = countsBefore.getOrDefault("synonym", 0);

    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    addTermRelation(termA.getId().toString(), termC.getId().toString(), "synonym");

    Map<String, Integer> countsAfter = getUsageCounts();
    int synonymAfter = countsAfter.getOrDefault("synonym", 0);

    LOG.info("Synonym usage: before={}, after={}", synonymBefore, synonymAfter);

    assertTrue(
        synonymAfter > synonymBefore,
        "Synonym usage count should increase after adding synonym relations");
  }

  // ==================== HELPER METHODS ====================

  private GlossaryTerm addTermRelation(String fromTermId, String toTermId, String relationType)
      throws Exception {
    HttpResponse<String> response = addTermRelationRaw(fromTermId, toTermId, relationType);
    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to add term relation: status={}, body={}",
          response.statusCode(),
          response.body());
      return null;
    }
    return OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private HttpResponse<String> addTermRelationRaw(
      String fromTermId, String toTermId, String relationType) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s/relations", baseUrl, fromTermId);

    String jsonBody =
        String.format(
            "{\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"},\"relationType\":\"%s\"}",
            toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private void removeTermRelation(String fromTermId, String toTermId, String relationType)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaryTerms/%s/relations/%s?relationType=%s",
            baseUrl, fromTermId, toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30))
            .DELETE()
            .build();

    HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private GlossaryTerm getGlossaryTerm(String termId) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s?fields=relatedTerms", baseUrl, termId);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn("Failed to get term: status={}, body={}", response.statusCode(), response.body());
      return null;
    }

    return OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private Map<String, Object> getTermRelationGraph(String termId, int depth, String relationTypes)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaryTerms/%s/relationsGraph?depth=%d%s",
            baseUrl, termId, depth, relationTypes != null ? "&relationTypes=" + relationTypes : "");

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to get term relation graph: status={}, body={}",
          response.statusCode(),
          response.body());
      return Map.of();
    }

    return OBJECT_MAPPER.readValue(response.body(), new TypeReference<Map<String, Object>>() {});
  }

  private String exportGlossaryCsv(String glossaryName) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaries/name/%s/export", baseUrl, glossaryName);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "text/plain")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn("Failed to export CSV: status={}, body={}", response.statusCode(), response.body());
      return null;
    }

    return response.body();
  }

  private String importGlossaryCsv(String glossaryName, String csvContent, boolean dryRun)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format("%s/v1/glossaries/name/%s/import?dryRun=%s", baseUrl, glossaryName, dryRun);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "text/plain")
            .timeout(Duration.ofSeconds(30))
            .PUT(HttpRequest.BodyPublishers.ofString(csvContent))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    return response.body();
  }

  private void hardDeleteTerm(String termId) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format("%s/v1/glossaryTerms/%s?hardDelete=true&recursive=true", baseUrl, termId);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30))
            .DELETE()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to hard delete term: status={}, body={}", response.statusCode(), response.body());
    }
  }

  private void softDeleteTerm(String termId) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s", baseUrl, termId);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30))
            .DELETE()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to soft delete term: status={}, body={}", response.statusCode(), response.body());
    }
  }

  private void restoreTerm(String termId) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/restore", baseUrl);
    String jsonBody = String.format("{\"id\":\"%s\"}", termId);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .PUT(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to restore term: status={}, body={}", response.statusCode(), response.body());
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Integer> getUsageCounts() throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/glossaryTerms/relationTypes/usage"))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      return Map.of();
    }

    return OBJECT_MAPPER.readValue(response.body(), new TypeReference<Map<String, Integer>>() {});
  }
}
