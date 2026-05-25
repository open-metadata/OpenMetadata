/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.OrphanedIndexCleaner;
import org.openmetadata.service.search.IndexManagementClient.IndexStats;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Verifies that on a shared search cluster where the app is configured with a non-empty
 * {@code clusterAlias}, the orphaned-index cleanup and index-listing paths only read / touch
 * indices matching {@code {clusterAlias}_*}.
 *
 * <p>In production this prevents the {@code indices:admin/aliases/get} 403 reported in
 * openmetadata-collate#3557: if we never ask OpenSearch for foreign indices, the tenant role
 * never needs permission on them.
 *
 * <p>The test simulates a "foreign tenant" by creating indices with a different prefix directly
 * on the container (security plugin is disabled in the IT bootstrap, so the 403 itself cannot be
 * reproduced — but the behavioral guarantee that produces it is verified here).
 */
@Execution(ExecutionMode.SAME_THREAD)
@TestMethodOrder(OrderAnnotation.class)
public class OrphanedIndexCleanerScopedCleanupIT {

  private static final String CLUSTER_ALIAS = "openmetadata";
  private static final String FOREIGN_PREFIX = "foreigntenant_it_orphans";
  private static final String OUR_PREFIX = CLUSTER_ALIAS + "_it_orphans";

  private static final long OLD_TIMESTAMP =
      System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(45);

  private static final String OUR_ORPHAN = OUR_PREFIX + "_table_rebuild_" + OLD_TIMESTAMP;
  private static final String FOREIGN_ORPHAN = FOREIGN_PREFIX + "_table_rebuild_" + OLD_TIMESTAMP;
  private static final String FOREIGN_LIVE = FOREIGN_PREFIX + "_table_live";
  private static final String FOREIGN_LIVE_ALIAS = FOREIGN_PREFIX + "_alias";

  private static Rest5Client lowLevelClient;

  @BeforeAll
  static void setUp() throws Exception {
    // Sanity-check: the app under test must have the cluster alias configured, otherwise this
    // test is not exercising the scoping behavior at all.
    SearchRepository searchRepo = Entity.getSearchRepository();
    assertTrue(
        CLUSTER_ALIAS.equals(searchRepo.getClusterAlias()),
        "Test expects cluster alias '"
            + CLUSTER_ALIAS
            + "' but got '"
            + searchRepo.getClusterAlias()
            + "'");

    lowLevelClient = TestSuiteBootstrap.createSearchClient();

    // Idempotent: drop any residue from a prior failed run before creating.
    for (String index : List.of(OUR_ORPHAN, FOREIGN_ORPHAN, FOREIGN_LIVE)) {
      deleteIndexQuietly(index);
    }

    createIndex(OUR_ORPHAN);
    createIndex(FOREIGN_ORPHAN);
    createIndex(FOREIGN_LIVE);
    addAlias(FOREIGN_LIVE, FOREIGN_LIVE_ALIAS);
  }

  @AfterAll
  static void tearDown() throws Exception {
    if (lowLevelClient == null) {
      return;
    }
    // Best-effort cleanup — the cleaner may have already removed OUR_ORPHAN.
    for (String index : List.of(OUR_ORPHAN, FOREIGN_ORPHAN, FOREIGN_LIVE)) {
      deleteIndexQuietly(index);
    }
    lowLevelClient.close();
  }

  @Test
  @Order(1)
  void listIndicesByPrefixWithEmptyPrefixOnlyReturnsClusterScopedIndices() {
    SearchClient client = Entity.getSearchRepository().getSearchClient();

    Set<String> indices = client.listIndicesByPrefix("");

    assertTrue(
        indices.contains(OUR_ORPHAN),
        "Expected our-prefix orphan " + OUR_ORPHAN + " to be listed, got " + indices);
    assertFalse(
        indices.contains(FOREIGN_ORPHAN),
        "Foreign orphan " + FOREIGN_ORPHAN + " must not be listed (cross-tenant leak)");
    assertFalse(
        indices.contains(FOREIGN_LIVE),
        "Foreign live index " + FOREIGN_LIVE + " must not be listed (cross-tenant leak)");
    for (String name : indices) {
      assertTrue(
          name.startsWith(CLUSTER_ALIAS + "_"),
          "Index " + name + " outside cluster prefix should not be returned");
    }
  }

  @Test
  @Order(2)
  void getAllIndexStatsOnlyReturnsClusterScopedIndices() throws Exception {
    SearchClient client = Entity.getSearchRepository().getSearchClient();

    List<IndexStats> stats = client.getAllIndexStats();

    for (IndexStats stat : stats) {
      assertTrue(
          stat.name().startsWith(CLUSTER_ALIAS + "_"),
          "Stats for " + stat.name() + " returned from outside cluster prefix");
    }
    assertTrue(
        stats.stream().anyMatch(s -> s.name().equals(OUR_ORPHAN)),
        "Expected stats for our-prefix orphan " + OUR_ORPHAN);
    assertFalse(
        stats.stream().anyMatch(s -> s.name().equals(FOREIGN_ORPHAN)),
        "Foreign orphan " + FOREIGN_ORPHAN + " must not appear in stats");
  }

  /**
   * Read-only assertion that orphan discovery only looks at indices under the cluster prefix.
   *
   * <p>We deliberately avoid calling {@link OrphanedIndexCleaner#cleanupOrphanedIndices} here:
   * that is a destructive, globally-scoped operation and would race with other ITs that may
   * create temporary {@code _rebuild_} indices under the same shared {@code openmetadata_*}
   * namespace. Since cleanup = discovery + per-index delete, verifying discovery is scoped is
   * sufficient for the 403-prevention guarantee; per-index deletion is covered by unit tests.
   */
  @Test
  @Order(3)
  void findOrphanedRebuildIndicesOnlyDiscoversClusterScopedOrphans() {
    SearchClient client = Entity.getSearchRepository().getSearchClient();
    OrphanedIndexCleaner cleaner = new OrphanedIndexCleaner();

    List<OrphanedIndexCleaner.OrphanedIndex> orphans = cleaner.findOrphanedRebuildIndices(client);

    assertTrue(
        orphans.stream().anyMatch(o -> o.indexName().equals(OUR_ORPHAN)),
        "Expected our-prefix orphan "
            + OUR_ORPHAN
            + " to be discovered, got "
            + orphans.stream().map(OrphanedIndexCleaner.OrphanedIndex::indexName).toList());
    assertFalse(
        orphans.stream().anyMatch(o -> o.indexName().equals(FOREIGN_ORPHAN)),
        "Foreign orphan " + FOREIGN_ORPHAN + " must not be discovered (cross-tenant leak)");
    for (OrphanedIndexCleaner.OrphanedIndex orphan : orphans) {
      assertTrue(
          orphan.indexName().startsWith(CLUSTER_ALIAS + "_"),
          "Discovered orphan " + orphan.indexName() + " is outside cluster prefix");
    }
    assertTrue(indexExists(FOREIGN_ORPHAN), "Foreign orphan must still exist (never touched)");
    assertTrue(indexExists(FOREIGN_LIVE), "Foreign live index must still exist (never touched)");
  }

  private static void createIndex(String name) throws Exception {
    Request request = new Request("PUT", "/" + name);
    request.setJsonEntity(
        "{\"settings\":{\"index\":{\"number_of_shards\":1,\"number_of_replicas\":0}}}");
    lowLevelClient.performRequest(request);
  }

  private static void addAlias(String index, String alias) throws Exception {
    Request request = new Request("POST", "/_aliases");
    request.setJsonEntity(
        String.format(
            "{\"actions\":[{\"add\":{\"index\":\"%s\",\"alias\":\"%s\"}}]}", index, alias));
    lowLevelClient.performRequest(request);
  }

  private static boolean indexExists(String name) {
    try {
      Request request = new Request("HEAD", "/" + name);
      return lowLevelClient.performRequest(request).getStatusCode() == 200;
    } catch (Exception e) {
      return false;
    }
  }

  private static void deleteIndexQuietly(String name) {
    try {
      lowLevelClient.performRequest(new Request("DELETE", "/" + name));
    } catch (Exception ignored) {
      // Best-effort cleanup.
    }
  }
}
