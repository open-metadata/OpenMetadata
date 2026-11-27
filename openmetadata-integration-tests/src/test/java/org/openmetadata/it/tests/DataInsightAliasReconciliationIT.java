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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Locks down the Data Insights aliases (di-data-assets-*) that custom Data Insights charts read for
 * data quality. These aliases point at the live {@code testCaseResolutionStatus} /
 * {@code testCaseResult} search indices; if a chart cannot resolve them it silently undercounts
 * resolved incidents.
 *
 * <p>The aliases are attached on index create, re-attached on the reindex alias swap (covered by
 * {@code DefaultRecreateHandlerTest}), and reconciled on startup by
 * {@link SearchRepository#createMissingIndexes()} so a cluster that predates the alias — an upgraded
 * cluster, or one whose alias a past reindex dropped — gets it back. This exercises that startup
 * reconciliation against the live cluster.
 */
@Isolated("Temporarily removes shared Data Insights aliases")
@Execution(ExecutionMode.SAME_THREAD)
public class DataInsightAliasReconciliationIT {

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  /** The live indices aliased under di-data-assets-*: test results and incident history. */
  static Stream<String> dataInsightAliasedEntities() {
    return Stream.of(Entity.TEST_CASE_RESOLUTION_STATUS, Entity.TEST_CASE_RESULT);
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("dataInsightAliasedEntities")
  void startupReconciliationReattachesDataInsightAlias(String entityType) {
    SearchRepository repo = Entity.getSearchRepository();
    SearchClient client = repo.getSearchClient();
    String clusterAlias = repo.getClusterAlias();
    IndexMapping mapping = repo.getIndexMapping(entityType);

    List<String> dataInsightAliases = mapping.getDataInsightAliases(clusterAlias);
    assertFalse(
        dataInsightAliases.isEmpty(),
        entityType + " must declare a Data Insights alias in mapping");
    String dataInsightAlias = dataInsightAliases.getFirst();
    String canonicalIndex = mapping.getIndexName(clusterAlias);

    assertTrue(
        client.indexExists(canonicalIndex), canonicalIndex + " should exist after bootstrap");

    // After a reindex the canonical name is itself an alias onto a *_rebuild_* index, so resolve
    // the concrete index (or indices) actually serving this entity. Aliases attach to concrete
    // indices, never to another alias.
    Set<String> servingIndices = client.getIndicesByAlias(canonicalIndex);
    if (servingIndices.isEmpty()) {
      servingIndices = Set.of(canonicalIndex); // canonical is still a concrete index
    }

    // Simulate a cluster that predates the alias: detach it from the serving index/indices.
    for (String servingIndex : servingIndices) {
      client.removeAliases(servingIndex, Set.of(dataInsightAlias));
    }
    assertTrue(
        Collections.disjoint(client.getIndicesByAlias(dataInsightAlias), servingIndices),
        "Precondition: Data Insights alias should be detached before reconciliation");

    // Startup reconciliation must re-attach it.
    repo.createMissingIndexes();

    assertTrue(
        client.getIndicesByAlias(dataInsightAlias).containsAll(servingIndices),
        "createMissingIndexes must reconcile the Data Insights alias back onto the live index so "
            + "custom Data Insights charts resolve it after an upgrade");
  }
}
