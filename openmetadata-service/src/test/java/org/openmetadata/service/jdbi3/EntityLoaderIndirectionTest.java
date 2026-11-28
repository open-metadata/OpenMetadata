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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.HandleCallback;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.AncestorsCache;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.CachedTagUsageDao;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.cache.InMemoryCacheProvider;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Verifies {@link EntityRepository.EntityLoaderWithId} and {@link
 * EntityRepository.EntityLoaderWithName} with FQN-to-UUID indirection: loading by ID also writes
 * the tiny FQN pointer so subsequent by-name lookups hit Redis without a DB query, and a stale FQN
 * pointer after a rename is rejected and evicted.
 */
class EntityLoaderIndirectionTest {

  private final InMemoryCacheProvider redis = new InMemoryCacheProvider();
  private final CacheKeys keys = new CacheKeys("om-test");
  private final CachedEntityDao cachedEntityDao =
      new CachedEntityDao(redis, keys, new CacheConfig());
  private CollectionDAO.PipelineDAO pipelineDao;
  private StubPipelineRepository pipelineRepository;
  private MockedStatic<CacheBundle> cacheBundle;

  private static final class StubPipelineRepository extends EntityRepository<Pipeline> {
    StubPipelineRepository(final CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes relationIncludes) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() {
    final CollectionDAO daoCollection = mock(CollectionDAO.class);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    pipelineDao = mock(CollectionDAO.PipelineDAO.class);
    when(pipelineDao.getTableName()).thenReturn("pipeline_entity");
    when(pipelineDao.getNameHashColumn()).thenReturn("fqnHash");
    when(pipelineDao.getCondition(any())).thenReturn("");
    Entity.setCollectionDAO(daoCollection);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(daoCollection));
    pipelineRepository = new StubPipelineRepository(pipelineDao);
    cacheBundle = mockStatic(CacheBundle.class);
    cacheBundle.when(CacheBundle::getCachedEntityDao).thenReturn(cachedEntityDao);
  }

  @AfterEach
  void tearDown() {
    cacheBundle.close();
    Entity.setJdbi(null);
    Entity.setEntityRelationshipRepository(null);
    Entity.setCollectionDAO(null);
    Entity.cleanup();
  }

  @Test
  void loadByIdPopulatesUuidPointerSoSubsequentByNameLookupHitsRedis() {
    final UUID id = UUID.randomUUID();
    final String fqn = "svc.daily_etl";
    final String json = pipelineJson(id, "daily_etl", fqn);
    when(pipelineDao.findById(eq("pipeline_entity"), eq(id), any())).thenReturn(json);

    final String loadedById =
        new EntityRepository.EntityLoaderWithId().load(new ImmutablePair<>(Entity.PIPELINE, id));
    final String loadedByName =
        new EntityRepository.EntityLoaderWithName().load(new ImmutablePair<>(Entity.PIPELINE, fqn));

    assertEquals(json, loadedById);
    assertEquals(json, loadedByName);
    assertEquals(Optional.of(id.toString()), redis.get(keys.entityIdByName(Entity.PIPELINE, fqn)));
    verify(pipelineDao, never()).findByName(any(), any(), any(), any());
  }

  @Test
  void loadByNameRejectsAndEvictsStaleAliasWhoseTargetWasRenamed() {
    final UUID renamedId = UUID.randomUUID();
    final UUID replacementId = UUID.randomUUID();
    final String oldFqn = "svc.old_name";
    final String newFqn = "svc.new_name";
    final String renamedJson = pipelineJson(renamedId, "new_name", newFqn);
    final String replacementJson = pipelineJson(replacementId, "old_name", oldFqn);

    cachedEntityDao.putBase(Entity.PIPELINE, renamedId, renamedJson);
    cachedEntityDao.putByName(Entity.PIPELINE, oldFqn, renamedId);
    when(pipelineDao.findByName(eq("pipeline_entity"), eq("fqnHash"), eq(oldFqn), any()))
        .thenReturn(replacementJson);

    final String loaded =
        new EntityRepository.EntityLoaderWithName()
            .load(new ImmutablePair<>(Entity.PIPELINE, oldFqn));

    assertEquals(replacementJson, loaded);
    assertEquals(
        Optional.of(replacementId.toString()),
        redis.get(keys.entityIdByName(Entity.PIPELINE, oldFqn)));
    assertTrue(cachedEntityDao.getBase(replacementId, Entity.PIPELINE).isPresent());
  }

  @Test
  void skipPopulateServesWarmEntriesWithoutWritingColdMissesToRedis() {
    final UUID coldId = UUID.randomUUID();
    final String coldFqn = "svc.cold_pipeline";
    final String coldJson = pipelineJson(coldId, "cold_pipeline", coldFqn);
    when(pipelineDao.findByName(eq("pipeline_entity"), eq("fqnHash"), eq(coldFqn), any()))
        .thenReturn(coldJson);

    final String loaded;
    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skipPopulate()) {
      loaded =
          new EntityRepository.EntityLoaderWithName()
              .load(new ImmutablePair<>(Entity.PIPELINE, coldFqn));
    }

    assertEquals(coldJson, loaded);
    assertTrue(redis.hget(keys.entity(Entity.PIPELINE, coldId), "base").isEmpty());
    assertTrue(redis.get(keys.entityIdByName(Entity.PIPELINE, coldFqn)).isEmpty());
  }

  @Test
  void excludedEntityTypesInCacheConfigAreNotCacheable() {
    final CacheConfig config = new CacheConfig();
    config.setExcludedEntityTypes("table,testCase");
    cacheBundle.when(CacheBundle::getCacheConfig).thenReturn(config);

    assertFalse(EntityRepository.isCacheableEntityType(Entity.TABLE));
    assertFalse(EntityRepository.isCacheableEntityType(Entity.TEST_CASE));
    assertTrue(EntityRepository.isCacheableEntityType(Entity.PIPELINE));
  }

  @Test
  void excludedEntityTypesSkipRelationshipCachesForOwnersDomainsAndContainer() {
    final CacheConfig config = new CacheConfig();
    config.setExcludedEntityTypes(Entity.PIPELINE);
    cacheBundle.when(CacheBundle::getCacheConfig).thenReturn(config);
    final CachedRelationshipDao relationshipCache = mock(CachedRelationshipDao.class);
    cacheBundle.when(CacheBundle::getCachedRelationshipDao).thenReturn(relationshipCache);

    final UUID id = UUID.randomUUID();
    final Pipeline pipeline =
        new Pipeline().withId(id).withName("excluded").withFullyQualifiedName("svc.excluded");

    pipelineRepository.getOwners(pipeline, Include.NON_DELETED);
    pipelineRepository.getDomains(pipeline, Include.NON_DELETED);
    pipelineRepository.getFromEntityRef(id, Entity.PIPELINE, Relationship.CONTAINS, null, false);

    verifyNoInteractions(relationshipCache);

    // Control check: once not excluded, the same three calls consult the relationship cache.
    config.setExcludedEntityTypes("");
    pipelineRepository.getOwners(pipeline, Include.NON_DELETED);
    pipelineRepository.getDomains(pipeline, Include.NON_DELETED);
    pipelineRepository.getFromEntityRef(id, Entity.PIPELINE, Relationship.CONTAINS, null, false);

    verify(relationshipCache).getOwners(Entity.PIPELINE, id);
    verify(relationshipCache).getDomains(Entity.PIPELINE, id);
    verify(relationshipCache).getContainer(Entity.PIPELINE, id, Relationship.CONTAINS.ordinal());
  }

  @Test
  void excludedContainerTypeSkipsReferenceAndAncestorsCacheInContainerRepository() {
    final CollectionDAO daoCollection = Entity.getCollectionDAO();
    final CollectionDAO.ContainerDAO containerDao = mock(CollectionDAO.ContainerDAO.class);
    when(daoCollection.containerDAO()).thenReturn(containerDao);
    when(containerDao.getTableName()).thenReturn("storage_container_entity");
    when(containerDao.getNameHashColumn()).thenReturn("fqnHash");
    final EntityReference rootRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.CONTAINER)
            .withName("root")
            .withFullyQualifiedName("svc.root");
    when(containerDao.findReferencesByFqns(List.of("svc.root"), Include.NON_DELETED))
        .thenReturn(List.of(rootRef));

    final ContainerRepository containerRepository = new ContainerRepository();
    final CacheConfig config = new CacheConfig();
    config.setExcludedEntityTypes(Entity.CONTAINER);
    cacheBundle.when(CacheBundle::getCacheConfig).thenReturn(config);
    final AncestorsCache ancestorsCache = mock(AncestorsCache.class);
    cacheBundle.when(CacheBundle::getAncestorsCache).thenReturn(ancestorsCache);

    final List<EntityReference> ancestors = containerRepository.getAncestors("svc.root.leaf");

    assertEquals(List.of(rootRef), ancestors);
    assertTrue(redis.get(keys.refByName(Entity.CONTAINER, "svc.root")).isEmpty());
    verifyNoInteractions(ancestorsCache);
  }

  @Test
  void restCreateOrUpdateWithColdL1AndRedisSkipsPopulatingRedisWhenPopulateOnUpsertDisabled() {
    final CollectionDAO daoCollection = Entity.getCollectionDAO();
    final CollectionDAO.TagUsageDAO tagUsageDao = mock(CollectionDAO.TagUsageDAO.class);
    when(daoCollection.tagUsageDAO()).thenReturn(tagUsageDao);
    when(tagUsageDao.getTags(any())).thenReturn(List.of());
    final CollectionDAO.EntityExtensionDAO extensionDao =
        mock(CollectionDAO.EntityExtensionDAO.class);
    when(daoCollection.entityExtensionDAO()).thenReturn(extensionDao);
    when(extensionDao.getExtensions(any(), any())).thenReturn(List.of());
    @SuppressWarnings("unchecked")
    final EntityRepository<User> mockUserRepo = mock(EntityRepository.class);
    when(mockUserRepo.findByNameOrNull(any(), any()))
        .thenReturn(new User().withName("ingestion-bot").withIsBot(true));
    Entity.registerEntity(User.class, Entity.USER, mockUserRepo);
    final Jdbi mockJdbi = mock(Jdbi.class);
    final Handle mockHandle = mock(Handle.class);
    when(mockHandle.attach(CollectionDAO.class)).thenReturn(daoCollection);
    when(mockJdbi.inTransaction(any()))
        .thenAnswer(
            inv -> {
              final HandleCallback<?, ?> callback = inv.getArgument(0);
              return callback.withHandle(mockHandle);
            });
    Entity.setJdbi(mockJdbi);

    final UUID id = UUID.randomUUID();
    final String name = "unchanged_pipeline";
    final String fqn = name;
    final String json = pipelineJson(id, name, fqn);
    when(pipelineDao.findByName(eq("pipeline_entity"), eq("fqnHash"), eq(fqn), any()))
        .thenReturn(json);
    when(pipelineDao.findById(eq("pipeline_entity"), eq(id), any())).thenReturn(json);
    when(pipelineDao.findEntityByName(eq(fqn), any()))
        .thenReturn(JsonUtils.readValue(json, Pipeline.class));

    final InMemoryCacheProvider coldRedis = new InMemoryCacheProvider();
    final CacheConfig config = new CacheConfig();
    config.populateOnUpsert = false;
    final CachedEntityDao entityDao = new CachedEntityDao(coldRedis, keys, config);
    final CachedRelationshipDao relDao =
        new CachedRelationshipDao(daoCollection, coldRedis, keys, config);
    final CachedTagUsageDao tagDao = new CachedTagUsageDao(daoCollection, coldRedis, keys, config);
    cacheBundle.when(CacheBundle::getCacheConfig).thenReturn(config);
    cacheBundle.when(CacheBundle::getCachedEntityDao).thenReturn(entityDao);
    cacheBundle.when(CacheBundle::getCachedRelationshipDao).thenReturn(relDao);
    cacheBundle.when(CacheBundle::getCachedTagUsageDao).thenReturn(tagDao);

    final Authorizer authorizer = mock(Authorizer.class);
    final Limits limits = mock(Limits.class);
    final EntityResource<Pipeline, StubPipelineRepository> resource =
        new EntityResource<>(Entity.PIPELINE, authorizer, limits) {};
    final SecurityContext securityContext = mock(SecurityContext.class);
    final Principal principal = () -> "ingestion-bot";
    when(securityContext.getUserPrincipal()).thenReturn(principal);

    EntityRepository.CACHE_WITH_NAME.invalidateAll();
    EntityRepository.CACHE_WITH_ID.invalidateAll();

    final Pipeline incoming =
        new Pipeline().withId(id).withName(name).withFullyQualifiedName(fqn).withUpdatedBy("admin");
    resource.createOrUpdate(null, securityContext, incoming);

    assertTrue(coldRedis.hget(keys.entity(Entity.PIPELINE, id), "base").isEmpty());
    assertTrue(coldRedis.hget(keys.entity(Entity.PIPELINE, id), "owners").isEmpty());
    assertTrue(coldRedis.hget(keys.entity(Entity.PIPELINE, id), "domains").isEmpty());
    assertTrue(coldRedis.get(keys.entityIdByName(Entity.PIPELINE, fqn)).isEmpty());
    assertTrue(coldRedis.get(keys.tags(Entity.PIPELINE, id)).isEmpty());

    config.populateOnUpsert = true;
    EntityRepository.CACHE_WITH_NAME.invalidateAll();
    EntityRepository.CACHE_WITH_ID.invalidateAll();
    resource.createOrUpdate(null, securityContext, incoming);

    assertTrue(coldRedis.hget(keys.entity(Entity.PIPELINE, id), "base").isPresent());
    assertEquals(
        Optional.of(id.toString()), coldRedis.get(keys.entityIdByName(Entity.PIPELINE, fqn)));
  }

  @Test
  void oversizedEntityDoesNotWriteDanglingNamePointer() {
    final CacheConfig smallCap = new CacheConfig();
    smallCap.compressionThresholdBytes = 0;
    smallCap.maxEntrySizeBytes = 32;
    final CachedEntityDao cappedDao = new CachedEntityDao(redis, keys, smallCap);
    cacheBundle.when(CacheBundle::getCachedEntityDao).thenReturn(cappedDao);

    final UUID id = UUID.randomUUID();
    final String fqn = "svc.oversized";
    final String json = pipelineJson(id, "oversized", fqn);
    when(pipelineDao.findById(eq("pipeline_entity"), eq(id), any())).thenReturn(json);

    new EntityRepository.EntityLoaderWithId().load(new ImmutablePair<>(Entity.PIPELINE, id));

    assertTrue(redis.hget(keys.entity(Entity.PIPELINE, id), "base").isEmpty());
    assertTrue(redis.get(keys.entityIdByName(Entity.PIPELINE, fqn)).isEmpty());
  }

  @Test
  void loadByIdEvictsBothBaseAndNamePointerWhenConcurrentWriteRacesLoad() {
    final UUID id = UUID.randomUUID();
    final String fqn = "svc.raced_pipeline";
    final String json = pipelineJson(id, "raced_pipeline", fqn);
    when(pipelineDao.findById(eq("pipeline_entity"), eq(id), any()))
        .thenAnswer(
            ignored -> {
              // Simulate a writer committing and bumping the write epoch mid-load.
              EntityRepository.invalidateCacheForEntity(Entity.PIPELINE, id, fqn);
              return json;
            });

    assertThrows(
        EntityRepository.LoaderRaceException.class,
        () ->
            new EntityRepository.EntityLoaderWithId()
                .load(new ImmutablePair<>(Entity.PIPELINE, id)));

    assertTrue(redis.hget(keys.entity(Entity.PIPELINE, id), "base").isEmpty());
    assertTrue(redis.get(keys.entityIdByName(Entity.PIPELINE, fqn)).isEmpty());
  }

  private static String pipelineJson(final UUID id, final String name, final String fqn) {
    return JsonUtils.pojoToJson(
        new Pipeline()
            .withId(id)
            .withName(name)
            .withFullyQualifiedName(fqn)
            .withUpdatedBy("admin"));
  }
}
