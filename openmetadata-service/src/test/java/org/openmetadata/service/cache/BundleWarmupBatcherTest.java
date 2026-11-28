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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.USER;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.util.FullyQualifiedName;

class BundleWarmupBatcherTest {

  private CollectionDAO dao;
  private CollectionDAO.TagUsageDAO tagUsageDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CacheProvider cache;
  private CacheKeys keys;
  private BundleWarmupBatcher batcher;
  private EntityRelationshipRepository originalEntityRelationshipRepository;

  @BeforeEach
  void setUp() {
    originalEntityRelationshipRepository = Entity.getEntityRelationshipRepository();
    dao = mock(CollectionDAO.class);
    tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    cache = mock(CacheProvider.class);
    keys = new CacheKeys("om:test");
    batcher = new BundleWarmupBatcher(dao, cache, keys, false);
  }

  @AfterEach
  void tearDown() {
    Entity.setEntityRelationshipRepository(originalEntityRelationshipRepository);
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
  void optionallyWritesCommonRelationshipsIntoBundleKeys() {
    BundleWarmupBatcher relationshipBatcher = new BundleWarmupBatcher(dao, cache, keys, true);
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders");
    UUID ownerId = UUID.randomUUID();
    UUID domainId = UUID.randomUUID();
    when(tagUsageDAO.getTagsByTargetFQNHashes(any())).thenReturn(new HashMap<>());
    when(relationshipDAO.findFromBatchWithRelations(any(), eq("table"), any(), eq(NON_DELETED)))
        .thenReturn(
            List.of(
                CollectionDAO.EntityRelationshipObject.builder()
                    .fromId(ownerId.toString())
                    .fromEntity(USER)
                    .toId(table.getId().toString())
                    .toEntity("table")
                    .relation(Relationship.OWNS.ordinal())
                    .build(),
                CollectionDAO.EntityRelationshipObject.builder()
                    .fromId(domainId.toString())
                    .fromEntity(DOMAIN)
                    .toId(table.getId().toString())
                    .toEntity("table")
                    .relation(Relationship.HAS.ordinal())
                    .build()));
    when(relationshipDAO.findToBatchWithRelations(any(), eq("table"), any(), eq(NON_DELETED)))
        .thenReturn(Collections.emptyList());
    EntityRelationshipRepository relationshipRepository = mock(EntityRelationshipRepository.class);
    Entity.setEntityRelationshipRepository(relationshipRepository);
    when(relationshipRepository.getEntityReferences(any(), eq(NON_DELETED)))
        .thenAnswer(
            invocation -> {
              @SuppressWarnings("unchecked")
              List<CollectionDAO.EntityRelationshipRecord> records =
                  (List<CollectionDAO.EntityRelationshipRecord>) invocation.getArgument(0);
              return records.stream()
                  .map(
                      record ->
                          new EntityReference()
                              .withId(record.getId())
                              .withType(record.getType())
                              .withName(record.getType() + "-" + record.getId()))
                  .toList();
            });

    BundleWarmupBatcher.BatchResult result =
        relationshipBatcher.warmupBatch("table", List.of(table), Duration.ofSeconds(60));

    assertEquals(1, result.success());
    assertEquals(0, result.failed());
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, String>> captor = ArgumentCaptor.forClass(Map.class);
    verify(cache).pipelineSet(captor.capture(), any(Duration.class));
    CachedReadBundle.Dto dto =
        JsonUtils.readValue(
            captor.getValue().get(keys.bundle("table", table.getId())), CachedReadBundle.Dto.class);
    assertNotNull(dto.relations);
    assertEquals(1, dto.relations.get(FIELD_OWNERS).size());
    assertEquals(ownerId, dto.relations.get(FIELD_OWNERS).get(0).getId());
    assertEquals(1, dto.relations.get(FIELD_DOMAINS).size());
    assertEquals(domainId, dto.relations.get(FIELD_DOMAINS).get(0).getId());
    verify(relationshipRepository, times(1)).getEntityReferences(any(), eq(NON_DELETED));
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

  @Test
  void compressesLargeWarmedBundlesAndSkipsEntriesPastMaxEntrySize() {
    Table largeTable =
        new Table()
            .withId(UUID.randomUUID())
            .withName("wide_orders")
            .withFullyQualifiedName("svc.db.schema.wide_orders");
    List<TagLabel> manyTags = new ArrayList<>();
    for (int i = 0; i < 20; i++) {
      manyTags.add(
          new TagLabel()
              .withTagFQN("Classification.Tag_" + i)
              .withDescription("Repeated governance classification description"));
    }
    when(tagUsageDAO.getTagsByTargetFQNHashes(any()))
        .thenReturn(
            Map.of(FullyQualifiedName.buildHash(largeTable.getFullyQualifiedName()), manyTags));

    InMemoryCacheProvider inMemory = new InMemoryCacheProvider();
    BundleWarmupBatcher compressingBatcher =
        new BundleWarmupBatcher(dao, inMemory, keys, false, 256, 0);
    BundleWarmupBatcher.BatchResult compressedResult =
        compressingBatcher.warmupBatch("table", List.of(largeTable), Duration.ofSeconds(60));
    assertEquals(1, compressedResult.success());

    String stored = inMemory.get(keys.bundle("table", largeTable.getId())).orElseThrow();
    assertTrue(CacheValueCodec.isCompressed(stored));
    CachedReadBundle reader = new CachedReadBundle(inMemory, keys, new CacheConfig());
    CachedReadBundle.Dto decoded = reader.get("table", largeTable.getId());
    assertNotNull(decoded);
    assertEquals(20, decoded.tags.size());

    InMemoryCacheProvider cappedCache = new InMemoryCacheProvider();
    BundleWarmupBatcher cappedBatcher =
        new BundleWarmupBatcher(dao, cappedCache, keys, false, 256, 32);
    BundleWarmupBatcher.BatchResult skippedResult =
        cappedBatcher.warmupBatch("table", List.of(largeTable), Duration.ofSeconds(60));
    assertEquals(0, skippedResult.success());
    assertTrue(cappedCache.get(keys.bundle("table", largeTable.getId())).isEmpty());
  }

  @Test
  void skipsTagWarmupWhenTagTtlDisabledAndCapsTtlWhenShorterThanEntityTtl() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders");

    // Disabled tags + no relationships: short-circuits with zero DB/Redis calls.
    BundleWarmupBatcher disabledNoRel = new BundleWarmupBatcher(dao, cache, keys, false, 0, 0, 0);
    BundleWarmupBatcher.BatchResult emptyResult =
        disabledNoRel.warmupBatch("table", List.of(table), Duration.ofSeconds(3600));
    assertEquals(0, emptyResult.success());
    assertEquals(0, emptyResult.failed());
    verify(tagUsageDAO, never()).getTagsByTargetFQNHashes(any());
    verify(cache, never()).pipelineSet(any(), any());

    // Disabled tags + relationships enabled: skips tag query and writes relations without
    // tagsLoaded.
    when(relationshipDAO.findFromBatchWithRelations(any(), eq("table"), any(), eq(NON_DELETED)))
        .thenReturn(Collections.emptyList());
    when(relationshipDAO.findToBatchWithRelations(any(), eq("table"), any(), eq(NON_DELETED)))
        .thenReturn(Collections.emptyList());
    BundleWarmupBatcher disabledWithRel = new BundleWarmupBatcher(dao, cache, keys, true, 0, 0, 0);
    BundleWarmupBatcher.BatchResult relOnlyResult =
        disabledWithRel.warmupBatch("table", List.of(table), Duration.ofSeconds(3600));
    assertEquals(1, relOnlyResult.success());
    verify(tagUsageDAO, never()).getTagsByTargetFQNHashes(any());

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, String>> relCaptor = ArgumentCaptor.forClass(Map.class);
    ArgumentCaptor<Duration> ttlCaptor = ArgumentCaptor.forClass(Duration.class);
    verify(cache).pipelineSet(relCaptor.capture(), ttlCaptor.capture());
    assertEquals(Duration.ofSeconds(3600), ttlCaptor.getValue());
    CachedReadBundle.Dto relOnlyDto =
        JsonUtils.readValue(
            relCaptor.getValue().get(keys.bundle("table", table.getId())),
            CachedReadBundle.Dto.class);
    assertFalse(relOnlyDto.tagsLoaded);
    assertNull(relOnlyDto.tags);

    // Shorter positive tagTtlSeconds caps the warmed bundle TTL.
    when(tagUsageDAO.getTagsByTargetFQNHashes(any())).thenReturn(Collections.emptyMap());
    BundleWarmupBatcher shorterTagTtl = new BundleWarmupBatcher(dao, cache, keys, false, 0, 0, 120);
    BundleWarmupBatcher.BatchResult shortResult =
        shorterTagTtl.warmupBatch("table", List.of(table), Duration.ofSeconds(3600));
    assertEquals(1, shortResult.success());
    verify(cache).pipelineSet(any(), eq(Duration.ofSeconds(120)));
  }
}
