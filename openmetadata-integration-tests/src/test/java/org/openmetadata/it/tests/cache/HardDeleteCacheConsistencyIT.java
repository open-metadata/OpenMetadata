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
package org.openmetadata.it.tests.cache;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.RequestEntityCache;

@ExtendWith(TestNamespaceExtension.class)
class HardDeleteCacheConsistencyIT {
  private static final String PARALLELISM_PROPERTY =
      "junit.jupiter.execution.parallel.config.fixed.parallelism";
  private static final int REPETITIONS = 50;

  @BeforeAll
  static void requireRedis() {
    Assumptions.assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "Hard-delete cache consistency requires cacheProvider=redis");
  }

  @Test
  void staleLoaderResultCannotResurrectHardDeletedEntity(TestNamespace namespace)
      throws ExecutionException, InterruptedException {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace);
    Table table =
        TableTestFactory.createWithName(
            namespace, schema.getFullyQualifiedName(), "hard_delete_cache");
    ImmutablePair<String, UUID> idKey = new ImmutablePair<>(Entity.TABLE, table.getId());
    ImmutablePair<String, String> nameKey =
        new ImmutablePair<>(Entity.TABLE, table.getFullyQualifiedName());

    EntityRepository.CACHE_WITH_ID.invalidate(idKey);
    EntityRepository.CACHE_WITH_NAME.invalidate(nameKey);
    RequestEntityCache.clear();
    Entity.getEntity(Entity.TABLE, table.getId(), "", Include.NON_DELETED, true);
    String staleById = EntityRepository.CACHE_WITH_ID.getIfPresent(idKey);
    assertNotNull(staleById);

    RequestEntityCache.clear();
    Entity.getEntityByName(
        Entity.TABLE, table.getFullyQualifiedName(), "", Include.NON_DELETED, true);
    String staleByName = EntityRepository.CACHE_WITH_NAME.getIfPresent(nameKey);
    assertNotNull(staleByName);

    SdkClients.adminClient()
        .tables()
        .delete(table.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    List<Callable<Void>> attempts = new ArrayList<>(REPETITIONS * Include.values().length);
    for (int repetition = 0; repetition < REPETITIONS; repetition++) {
      int currentRepetition = repetition;
      for (Include include : Include.values()) {
        attempts.add(
            () -> {
              assertMissing(
                  table, idKey, nameKey, staleById, staleByName, include, currentRepetition);
              return null;
            });
      }
    }

    int parallelism = Math.max(1, Integer.getInteger(PARALLELISM_PROPERTY, 4));
    try (ExecutorService executor = Executors.newFixedThreadPool(parallelism)) {
      for (Future<Void> result : executor.invokeAll(attempts)) {
        result.get();
      }
    }
  }

  private static void assertMissing(
      Table table,
      ImmutablePair<String, UUID> idKey,
      ImmutablePair<String, String> nameKey,
      String staleById,
      String staleByName,
      Include include,
      int repetition) {
    EntityRepository.CACHE_WITH_ID.put(idKey, staleById);
    RequestEntityCache.clear();
    assertThrows(
        EntityNotFoundException.class,
        () -> Entity.getEntity(Entity.TABLE, table.getId(), "", include, true),
        () -> "Stale ID cache returned for include=" + include + " repetition=" + repetition);

    EntityRepository.CACHE_WITH_NAME.put(nameKey, staleByName);
    RequestEntityCache.clear();
    assertThrows(
        EntityNotFoundException.class,
        () ->
            Entity.getEntityByName(Entity.TABLE, table.getFullyQualifiedName(), "", include, true),
        () -> "Stale name cache returned for include=" + include + " repetition=" + repetition);
  }
}
