/*
 *  Copyright 2025 Collate
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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityRelationshipCleanup;
import org.openmetadata.service.util.EntityUtil;

/**
 * A/B performance benchmark for the Data Retention relationship cleanup. It seeds a configurable
 * number of orphaned relationship rows and times two strategies over the exact same data:
 *
 * <ul>
 *   <li><b>LEGACY</b> - the pre-fix algorithm: scan the whole table with OFFSET pagination and
 *       validate each row with a per-endpoint {@code repository.get(...)} read (up to 2 reads per
 *       relationship), exactly as {@code EntityRelationshipCleanup} did before this change.
 *   <li><b>NEW</b> - the current {@link EntityRelationshipCleanup} (dry run) which keyset-scans and
 *       resolves existence in bulk with one {@code WHERE id IN (...)} query per entity type.
 * </ul>
 *
 * <p>Both runs validate without deleting, so the comparison isolates the validation cost - the
 * factor that made the job run for days on large catalogs. The headline numbers are printed to
 * stdout, e.g. {@code LEGACY=42310ms NEW=1180ms speedup=35.9x}.
 *
 * <p>Skipped by default; run explicitly with:
 *
 * <pre>
 *   mvn test -pl :openmetadata-integration-tests -Dtest=EntityRelationshipCleanupBenchmarkIT \
 *       -DrunBenchmark=true -DbenchmarkRows=20000 -DbenchmarkBatch=1000
 * </pre>
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class EntityRelationshipCleanupBenchmarkIT {

  @Test
  void benchmark_legacyPerRow_vs_newBatched(TestNamespace ns) {
    Assumptions.assumeTrue(
        Boolean.getBoolean("runBenchmark"),
        "Performance benchmark - enable with -DrunBenchmark=true");

    int rows = Integer.getInteger("benchmarkRows", 10_000);
    int batchSize = Integer.getInteger("benchmarkBatch", 1_000);
    String marker = "ITBENCH_" + ns.uniqueShortId();

    try {
      seedOrphans(marker, rows);

      // Run NEW first (cold caches) and LEGACY second (warm DB page cache): a deliberately
      // conservative ordering that biases against NEW, so any win it shows is real.
      long newMs = timeNewCleanup(batchSize);
      long legacyMs = timeLegacyCleanup(batchSize);

      double speedup = legacyMs / (double) Math.max(newMs, 1);
      System.out.printf(
          "%n=== DataRetention relationship cleanup benchmark ===%n"
              + "seeded orphan rows : %d%n"
              + "batch size         : %d%n"
              + "LEGACY (per-row)   : %d ms%n"
              + "NEW (batched)      : %d ms%n"
              + "speedup            : %.1fx%n"
              + "====================================================%n",
          rows, batchSize, legacyMs, newMs, speedup);

      assertTrue(
          newMs <= legacyMs,
          () ->
              "expected new batched cleanup to be at least as fast as the legacy per-row scan, "
                  + "but NEW="
                  + newMs
                  + "ms LEGACY="
                  + legacyMs
                  + "ms");
    } finally {
      deleteOrphans(marker);
    }
  }

  private long timeNewCleanup(int batchSize) {
    long start = System.nanoTime();
    new EntityRelationshipCleanup(Entity.getCollectionDAO(), true).performCleanup(batchSize);
    return elapsedMs(start);
  }

  private long timeLegacyCleanup(int batchSize) {
    long start = System.nanoTime();
    CollectionDAO dao = Entity.getCollectionDAO();
    Map<String, EntityRepository<?>> repositories = buildEntityRepositories();
    long total = dao.relationshipDAO().getTotalRelationshipCount();

    long offset = 0;
    boolean hasMore = true;
    while (hasMore) {
      List<EntityRelationshipObject> batch =
          dao.relationshipDAO().getAllRelationshipsPaginated(offset, batchSize);
      if (batch.isEmpty()) {
        hasMore = false;
      } else {
        batch.forEach(relationship -> legacyValidate(relationship, repositories));
        offset += batch.size();
      }
    }
    return elapsedMs(start);
  }

  private void legacyValidate(
      EntityRelationshipObject relationship, Map<String, EntityRepository<?>> repositories) {
    legacyExists(relationship.getFromId(), relationship.getFromEntity(), repositories);
    legacyExists(relationship.getToId(), relationship.getToEntity(), repositories);
  }

  private boolean legacyExists(
      String id, String entityType, Map<String, EntityRepository<?>> repositories) {
    EntityRepository<?> repository = repositories.get(entityType);
    boolean result;
    if (repository == null) {
      result = true;
    } else {
      result = readOne(repository, id);
    }
    return result;
  }

  private boolean readOne(EntityRepository<?> repository, String id) {
    boolean result;
    try {
      repository.get(null, UUID.fromString(id), EntityUtil.Fields.EMPTY_FIELDS, Include.ALL, false);
      result = true;
    } catch (EntityNotFoundException e) {
      result = false;
    } catch (Exception ex) {
      result = true;
    }
    return result;
  }

  private Map<String, EntityRepository<?>> buildEntityRepositories() {
    Map<String, EntityRepository<?>> repositories = new HashMap<>();
    for (String entityType : Entity.getEntityList()) {
      try {
        repositories.put(entityType, Entity.getEntityRepository(entityType));
      } catch (Exception e) {
        // Entity types without a regular repository (time series, threads) are validated lazily.
      }
    }
    return repositories;
  }

  private void seedOrphans(String marker, int count) {
    int relation = Relationship.CONTAINS.ordinal();
    for (int i = 0; i < count; i++) {
      insertOrphan(
          UUID.randomUUID().toString(),
          UUID.randomUUID().toString(),
          Entity.DATABASE_SCHEMA,
          Entity.TABLE,
          relation,
          marker);
    }
  }

  private void insertOrphan(
      String fromId, String toId, String fromEntity, String toEntity, int relation, String marker) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "INSERT INTO entity_relationship "
                            + "(fromId, toId, fromEntity, toEntity, relation, relationType) "
                            + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation, :relationType)")
                    .bind("fromId", fromId)
                    .bind("toId", toId)
                    .bind("fromEntity", fromEntity)
                    .bind("toEntity", toEntity)
                    .bind("relation", relation)
                    .bind("relationType", marker)
                    .execute());
  }

  private void deleteOrphans(String marker) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM entity_relationship WHERE relationType = :m")
                    .bind("m", marker)
                    .execute());
  }

  private long elapsedMs(long startNanos) {
    return (System.nanoTime() - startNanos) / 1_000_000;
  }
}
