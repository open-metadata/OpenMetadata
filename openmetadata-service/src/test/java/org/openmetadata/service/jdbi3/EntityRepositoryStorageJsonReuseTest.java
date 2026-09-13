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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityRepositoryStorageJsonReuseTest {

  @Test
  void writeThroughCacheReusesAndConsumesTheStoredJson() {
    CollectionDAO.PipelineDAO dao = mock(CollectionDAO.PipelineDAO.class);
    CachedEntityDao cachedEntityDao = mock(CachedEntityDao.class);
    CountingPipelineRepository repository = new CountingPipelineRepository(dao);
    Pipeline pipeline = pipeline("before");
    repository.storeForCacheForTest(pipeline);
    pipeline.setName("after");
    try (MockedStatic<CacheBundle> cacheBundle = mockStatic(CacheBundle.class)) {
      when(CacheBundle.getCachedEntityDao()).thenReturn(cachedEntityDao);
      repository.writeThroughCacheForTest(pipeline);
      assertEquals(1, repository.serializationCount);
      verify(cachedEntityDao).putBase(Entity.PIPELINE, pipeline.getId(), "{\"name\":\"before\"}");
      repository.writeThroughCacheForTest(pipeline);
      assertEquals(2, repository.serializationCount);
      verify(cachedEntityDao).putBase(Entity.PIPELINE, pipeline.getId(), "{\"name\":\"after\"}");
    }
  }

  @Test
  void directStoreDoesNotRetainJson() {
    CollectionDAO.PipelineDAO dao = mock(CollectionDAO.PipelineDAO.class);
    CachedEntityDao cachedEntityDao = mock(CachedEntityDao.class);
    CountingPipelineRepository repository = new CountingPipelineRepository(dao);
    Pipeline pipeline = pipeline("before");
    repository.storeDirectlyForTest(pipeline);
    pipeline.setName("after");
    try (MockedStatic<CacheBundle> cacheBundle = mockStatic(CacheBundle.class)) {
      when(CacheBundle.getCachedEntityDao()).thenReturn(cachedEntityDao);
      repository.writeThroughCacheForTest(pipeline);
    }
    assertEquals(2, repository.serializationCount);
    verify(cachedEntityDao).putBase(Entity.PIPELINE, pipeline.getId(), "{\"name\":\"after\"}");
  }

  private static Pipeline pipeline(String name) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("service." + name);
  }

  @Repository()
  private static class CountingPipelineRepository implements EntityPolicy<Pipeline> {

    private int serializationCount;

    private CountingPipelineRepository(CollectionDAO.PipelineDAO dao) {
      this.entityContext =
          new EntityPolicyContext<>(
              new EntityPolicyContext.Schema<>("pipelines", Entity.PIPELINE, Pipeline.class, dao),
              new EntityPolicyContext.WriteFields("", "", Set.of()),
              EntityModuleDependencies.standard());
      EntityModuleFactory.initialize(this, false);
    }

    private void storeForCacheForTest(Pipeline pipeline) {
      storeEntityAndCaptureJson(pipeline, false);
    }

    private void storeDirectlyForTest(Pipeline pipeline) {
      storeEntity(pipeline, false);
    }

    private void writeThroughCacheForTest(Pipeline pipeline) {
      writeThroughCache(pipeline, false);
    }

    @Override
    public String serializeForStorage(Pipeline entity) {
      serializationCount++;
      return JsonUtils.pojoToJson(Map.of("name", entity.getName()));
    }

    @Override
    public void setFields(Pipeline entity, Fields fields, RelationIncludes relationIncludes) {}

    @Override
    public void clearFields(Pipeline entity, Fields fields) {}

    @Override
    public void prepare(Pipeline entity, boolean update) {}

    @Override
    public void storeEntity(Pipeline entity, boolean update) {
      persistence().store(entity, update);
    }

    @Override
    public void storeRelationships(Pipeline entity) {}

    private final EntityPolicyContext<Pipeline> entityContext;

    @Override
    public final EntityPolicyContext<Pipeline> context() {
      return entityContext;
    }
  }
}
