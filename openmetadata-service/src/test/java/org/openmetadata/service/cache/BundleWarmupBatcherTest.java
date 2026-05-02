/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */
package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

class BundleWarmupBatcherTest {

  private CollectionDAO dao;
  private CollectionDAO.TagUsageDAO tagUsageDAO;
  private CacheProvider cache;
  private CacheKeys keys;
  private BundleWarmupBatcher batcher;

  @BeforeEach
  void setUp() {
    dao = mock(CollectionDAO.class);
    tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
    when(dao.tagUsageDAO()).thenReturn(tagUsageDAO);
    cache = mock(CacheProvider.class);
    keys = new CacheKeys("om:test");
    batcher = new BundleWarmupBatcher(dao, cache, keys);
  }

  @Test
  void emptyEntitiesShortCircuits() {
    BundleWarmupBatcher.BatchResult result =
        batcher.warmupBatch("table", Collections.emptyList(), Duration.ofSeconds(60));
    assertEquals(0, result.success());
    assertEquals(0, result.failed());
    verify(cache, never()).pipelineSet(any(), any());
    verify(tagUsageDAO, never()).getTagsByTargetFQNHashes(any());
  }

  @Test
  void writesBundleKeysWithTagsAndCertification() {
    Table t1 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders");
    Table t2 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("lineitem")
            .withFullyQualifiedName("svc.db.schema.lineitem");
    AssetCertification cert =
        new AssetCertification().withTagLabel(new TagLabel().withTagFQN("Certification.Gold"));
    t1.withCertification(cert);

    String hash1 = FullyQualifiedName.buildHash(t1.getFullyQualifiedName());
    String hash2 = FullyQualifiedName.buildHash(t2.getFullyQualifiedName());

    Map<String, List<TagLabel>> tagMap = new HashMap<>();
    tagMap.put(hash1, List.of(new TagLabel().withTagFQN("PII.Sensitive")));
    when(tagUsageDAO.getTagsByTargetFQNHashes(any())).thenReturn(tagMap);

    BundleWarmupBatcher.BatchResult result =
        batcher.warmupBatch("table", List.of(t1, t2), Duration.ofSeconds(60));
    assertEquals(2, result.success());
    assertEquals(0, result.failed());

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, String>> captor = ArgumentCaptor.forClass(Map.class);
    verify(cache, times(1)).pipelineSet(captor.capture(), any(Duration.class));
    Map<String, String> writes = captor.getValue();
    assertEquals(2, writes.size());

    String t1Json = writes.get(keys.bundle("table", t1.getId()));
    assertNotNull(t1Json);
    CachedReadBundle.Dto t1Dto = JsonUtils.readValue(t1Json, CachedReadBundle.Dto.class);
    assertNull(t1Dto.relations, "Relations should be left null for lazy populate");
    assertTrue(t1Dto.tagsLoaded);
    assertEquals(1, t1Dto.tags.size());
    assertEquals("PII.Sensitive", t1Dto.tags.get(0).getTagFQN());
    assertTrue(t1Dto.certificationLoaded);
    assertNotNull(t1Dto.certification);

    String t2Json = writes.get(keys.bundle("table", t2.getId()));
    assertNotNull(t2Json);
    CachedReadBundle.Dto t2Dto = JsonUtils.readValue(t2Json, CachedReadBundle.Dto.class);
    assertTrue(t2Dto.tagsLoaded);
    assertTrue(t2Dto.tags.isEmpty(), "Untagged entity should have empty tags list");
    assertTrue(t2Dto.certificationLoaded);
    assertNull(t2Dto.certification);
  }

  @Test
  void skipsEntitiesMissingIdOrFqn() {
    Table withoutId = new Table().withName("noId").withFullyQualifiedName("svc.db.schema.noId");
    Table withoutFqn = new Table().withId(UUID.randomUUID()).withName("noFqn");
    Table good =
        new Table()
            .withId(UUID.randomUUID())
            .withName("good")
            .withFullyQualifiedName("svc.db.schema.good");

    when(tagUsageDAO.getTagsByTargetFQNHashes(any())).thenReturn(new HashMap<>());

    BundleWarmupBatcher.BatchResult result =
        batcher.warmupBatch("table", List.of(withoutId, withoutFqn, good), Duration.ofSeconds(60));
    assertEquals(1, result.success());
  }

  @Test
  void tagFetchFailureMarksAllEntitiesFailed() {
    Table t1 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("a")
            .withFullyQualifiedName("svc.db.schema.a");
    when(tagUsageDAO.getTagsByTargetFQNHashes(any())).thenThrow(new RuntimeException("db down"));

    BundleWarmupBatcher.BatchResult result =
        batcher.warmupBatch("table", List.of(t1), Duration.ofSeconds(60));
    assertEquals(0, result.success());
    assertEquals(1, result.failed());
    verify(cache, never()).pipelineSet(any(), any());
  }

  @Test
  void redisWriteFailureMarksAllEntitiesFailed() {
    Table t1 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("a")
            .withFullyQualifiedName("svc.db.schema.a");
    when(tagUsageDAO.getTagsByTargetFQNHashes(any())).thenReturn(new HashMap<>());
    org.mockito.Mockito.doThrow(new RuntimeException("pipeline timeout"))
        .when(cache)
        .pipelineSet(any(), any());

    BundleWarmupBatcher.BatchResult result =
        batcher.warmupBatch("table", List.of(t1), Duration.ofSeconds(60));
    assertEquals(0, result.success());
    assertTrue(result.failed() >= 1);
  }

  @Test
  void usesFqnHashAsTagLookupKey() {
    Table t1 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("a")
            .withFullyQualifiedName("svc.db.schema.a");
    when(tagUsageDAO.getTagsByTargetFQNHashes(any())).thenReturn(new HashMap<>());

    batcher.warmupBatch("table", List.of(t1), Duration.ofSeconds(60));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<String>> hashesCaptor = ArgumentCaptor.forClass(List.class);
    verify(tagUsageDAO).getTagsByTargetFQNHashes(hashesCaptor.capture());
    List<String> hashesPassed = new ArrayList<>(hashesCaptor.getValue());
    assertEquals(1, hashesPassed.size());
    assertEquals(FullyQualifiedName.buildHash(t1.getFullyQualifiedName()), hashesPassed.get(0));
  }
}
