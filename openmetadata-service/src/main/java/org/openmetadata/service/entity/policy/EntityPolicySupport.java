package org.openmetadata.service.entity.policy;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.TEAM;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.bootstrap.EntitySeedResources;
import org.openmetadata.service.entity.bulk.EntityCsvChangeLog;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.delete.EntitySubtree;
import org.openmetadata.service.entity.metadata.EntityReviewerPolicy;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.lock.HierarchicalLockManager;
import org.openmetadata.service.seeding.SeedDataGate;
import org.openmetadata.service.util.EntityUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class EntityPolicySupport {

  private EntityPolicySupport() {}

  public static final Logger LOG = LoggerFactory.getLogger(EntityPolicy.class);

  public static final String BULK_IMPORT = EntityCsvChangeLog.BULK_IMPORT;

  /**
   * Max entities per transaction in the wrapped bulk-create path. One transaction holds InnoDB row
   * locks for every entity + relationship + tag row it writes; chunking bounds the lock-hold and
   * deadlock window so a large ingestion batch can't pin one connection for thousands of rows.
   * Atomicity is per chunk.
   */
  public static final int BULK_CREATE_TXN_CHUNK_SIZE = 100;

  /**
   * Max entities hydrated + purged per chunk in {@link EntitySubtree#bulkHardDeleteSubtree(List, String)}. The
   * pre-chunking path loaded an ENTIRE tree level ({@code loadForBulk(ids, ALL)}) into the heap
   * before deleting — a service with hundreds of thousands of tables would OOM on that single load.
   * Chunking bounds peak heap to ~{@code CHUNK_SIZE * tree-depth} hydrated entities: each chunk
   * loads, recurses into its children, then purges its own rows. Larger than the create chunk
   * because each delete chunk also issues one child-discovery query, so an over-small value
   * multiplies round-trips on wide levels. Each chunk's metadata and entity-row purge share
   * one transaction after its descendants have been processed.
   */
  public static final int BULK_HARD_DELETE_TXN_CHUNK_SIZE = 500;

  public static final EntityReviewerPolicy REVIEWER_POLICY =
      new EntityReviewerPolicy(
          name -> {
            final Team team = Entity.getEntityByName(TEAM, name, "users", NON_DELETED);
            return team.getUsers();
          });

  public static final int DEFAULT_FIELD_FETCH_POOL_SIZE =
      Math.min(50, Runtime.getRuntime().availableProcessors() * 4);

  public static final ThreadPoolExecutor FIELD_FETCH_EXECUTOR =
      EntityPolicySupport.createFieldFetchExecutor(DEFAULT_FIELD_FETCH_POOL_SIZE);

  public static final EntitySeedResources SEED_RESOURCES =
      new EntitySeedResources(
          new EntitySeedResources.Source(
              EntityUtil::getJsonDataResources,
              resource ->
                  CommonUtil.getResourceAsStream(EntityPolicy.class.getClassLoader(), resource)),
          () -> SeedDataGate.getInstance().recordSeedFailure());

  // Lock manager for preventing orphaned entities during cascade deletion
  public static HierarchicalLockManager lockManager;

  public static ThreadPoolExecutor createFieldFetchExecutor(int poolSize) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            poolSize,
            poolSize,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(),
            Thread.ofVirtual().name("om-field-fetch-", 0).factory());
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  public static synchronized void setFieldFetchPoolSize(int size) {
    int newSize = Math.max(1, Math.min(50, size));
    if (newSize <= EntityPolicySupport.FIELD_FETCH_EXECUTOR.getMaximumPoolSize()) {
      EntityPolicySupport.FIELD_FETCH_EXECUTOR.setCorePoolSize(newSize);
      EntityPolicySupport.FIELD_FETCH_EXECUTOR.setMaximumPoolSize(newSize);
    } else {
      EntityPolicySupport.FIELD_FETCH_EXECUTOR.setMaximumPoolSize(newSize);
      EntityPolicySupport.FIELD_FETCH_EXECUTOR.setCorePoolSize(newSize);
    }
    EntityPolicySupport.LOG.info("Field-fetch pool resized to {} threads", newSize);
  }

  public static synchronized void resetFieldFetchPoolSize() {
    EntityPolicySupport.setFieldFetchPoolSize(EntityPolicySupport.DEFAULT_FIELD_FETCH_POOL_SIZE);
  }

  // Static setter for lock manager initialization
  public static void setLockManager(HierarchicalLockManager manager) {
    EntityPolicySupport.lockManager = manager;
  }

  public static <U> List<U> getEntitiesFromSeedData(String entityType, String path, Class<U> clazz)
      throws IOException {
    return EntityPolicySupport.SEED_RESOURCES.read(entityType, path, clazz);
  }

  public static void deferCacheBundleInvalidation(
      final String entityType, final UUID id, final String fqn) {
    EntityCaches.invalidations().registeredAfterCommit(entityType, id, fqn);
  }

  public static void ensureSingleRelationship(
      String entityType,
      UUID id,
      List<EntityRelationshipRecord> relations,
      String relationshipName,
      String toEntityType,
      boolean mustHaveRelationship) {
    EntityRelationshipReader.requireSingle(
        new EntityRelationshipReader.Requirement(
            entityType, id, relationshipName, toEntityType, mustHaveRelationship),
        relations);
  }

  public static <A, B, R, ID> List<R> diffLists(
      List<A> l1, List<B> l2, Function<A, ID> aID, Function<B, ID> bID, Function<A, R> r) {
    return EntityChangeRecorder.difference(l1, l2, aID, bID, r);
  }
}
