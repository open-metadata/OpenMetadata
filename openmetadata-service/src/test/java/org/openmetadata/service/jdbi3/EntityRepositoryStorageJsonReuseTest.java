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
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityRepositoryStorageJsonReuseTest {

  @Test
  void writeThroughCacheReusesAndConsumesTheStoredJson() {
    CollectionDAO.PipelineDAO dao = mock(CollectionDAO.PipelineDAO.class);
    CachedEntityDao cachedEntityDao = mock(CachedEntityDao.class);
    CountingPipelineRepository repository = new CountingPipelineRepository(dao);
    Pipeline pipeline = pipeline("before");

    repository.storeForTest(pipeline);
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
  void requestBoundaryCleanupDiscardsUnconsumedStoredJson() {
    CollectionDAO.PipelineDAO dao = mock(CollectionDAO.PipelineDAO.class);
    CachedEntityDao cachedEntityDao = mock(CachedEntityDao.class);
    CountingPipelineRepository repository = new CountingPipelineRepository(dao);
    Pipeline pipeline = pipeline("before");

    repository.storeForTest(pipeline);
    repository.clearParentCache();
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

  private static class CountingPipelineRepository extends EntityRepository<Pipeline> {
    private int serializationCount;

    private CountingPipelineRepository(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "", Set.of(), false);
    }

    private void storeForTest(Pipeline pipeline) {
      store(pipeline, false);
    }

    private void writeThroughCacheForTest(Pipeline pipeline) {
      writeThroughCache(pipeline, false);
    }

    @Override
    protected String serializeForStorage(Pipeline entity) {
      serializationCount++;
      return JsonUtils.pojoToJson(Map.of("name", entity.getName()));
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
}
