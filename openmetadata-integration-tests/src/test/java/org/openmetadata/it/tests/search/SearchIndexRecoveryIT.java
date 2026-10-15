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
package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.util.QueuedSearchWrites;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocuments;
import org.openmetadata.it.util.SearchRepairPasses;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * A search cluster that loses an index, as one restored from an old snapshot or replaced would,
 * gets it back without anyone starting a reindex: the scheduled repair finds the index missing, or
 * created by a live write without its aliases, and rebuilds that type alone.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class SearchIndexRecoveryIT {
  private static final Duration REBUILD_WAIT = Duration.ofMinutes(5);
  private static final String REBUILT = "_rebuild_";

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void anIndexTheClusterLostIsRebuiltWithItsDocuments(final TestNamespace ns) throws Exception {
    final Topic topic = TopicTestFactory.createSimple(ns);
    final String topics = servingIndex();
    assertTrue(SearchDocuments.find(topics, topic.getId().toString()).isPresent());

    searchClient().deleteIndex(SearchDocuments.servingIndex(topics));
    assertFalse(searchClient().indexExists(topics));

    SearchRepairPasses.run();

    awaitRebuilt(topics, topic);
  }

  @Test
  void anIndexALiveWriteCreatedWithoutItsAliasesIsReplaced(final TestNamespace ns)
      throws Exception {
    final Topic topic = TopicTestFactory.createSimple(ns);
    final String topics = servingIndex();
    searchClient().deleteIndex(SearchDocuments.servingIndex(topics));
    // A write to the missing index makes the engine create one: template mapping, no aliases.
    SearchDocuments.put(topics, "auto-created", Map.of("name", "auto-created"));
    assertFalse(aliasesOf(topics).contains(shortAlias()));

    SearchRepairPasses.run();

    awaitRebuilt(topics, topic);
  }

  /** The type was rebuilt into a new index, promoted with its aliases, holding the topic. */
  private static void awaitRebuilt(final String topics, final Topic topic) {
    QueuedSearchWrites.await();
    Awaitility.await("The repair rebuilt the topic index")
        .atMost(REBUILD_WAIT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () ->
                SearchDocuments.servingIndex(topics).startsWith(topics + REBUILT)
                    && aliasesOf(topics).contains(shortAlias())
                    && SearchDocuments.find(topics, topic.getId().toString()).isPresent());
  }

  private static Set<String> aliasesOf(final String index) {
    return searchClient().getAliases(index);
  }

  private static String servingIndex() {
    return topicMapping().getIndexName(searchRepository().getClusterAlias());
  }

  private static String shortAlias() {
    return topicMapping().getAlias(searchRepository().getClusterAlias());
  }

  private static IndexMapping topicMapping() {
    return searchRepository().getIndexMapping(Entity.TOPIC);
  }

  private static SearchClient searchClient() {
    return searchRepository().getSearchClient();
  }

  private static SearchRepository searchRepository() {
    return Entity.getSearchRepository();
  }
}
