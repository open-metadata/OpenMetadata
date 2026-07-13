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

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
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
public class DataInsightAliasReconciliationIT {

  private static final String DQ_ENTITY = Entity.TEST_CASE_RESOLUTION_STATUS;

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void startupReconciliationReattachesDataInsightAlias() {
    SearchRepository repo = Entity.getSearchRepository();
    SearchClient client = repo.getSearchClient();
    String clusterAlias = repo.getClusterAlias();
    IndexMapping mapping = repo.getIndexMapping(DQ_ENTITY);

    List<String> dataInsightAliases = mapping.getDataInsightAliases(clusterAlias);
    assertFalse(
        dataInsightAliases.isEmpty(), DQ_ENTITY + " must declare a Data Insights alias in mapping");
    String dataInsightAlias = dataInsightAliases.getFirst();
    String canonicalIndex = mapping.getIndexName(clusterAlias);

    assertTrue(
        client.indexExists(canonicalIndex), canonicalIndex + " should exist after bootstrap");

    // Simulate a cluster that predates the alias: detach it from the live index.
    client.removeAliases(canonicalIndex, Set.of(dataInsightAlias));
    assertFalse(
        client.getIndicesByAlias(dataInsightAlias).contains(canonicalIndex),
        "Precondition: Data Insights alias should be detached before reconciliation");

    // Startup reconciliation must re-attach it.
    repo.createMissingIndexes();

    assertTrue(
        client.getIndicesByAlias(dataInsightAlias).contains(canonicalIndex),
        "createMissingIndexes must reconcile the Data Insights alias back onto the live index so "
            + "custom Data Insights charts resolve it after an upgrade");
  }
}
