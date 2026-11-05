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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.cache.CachedReadBundle;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * Regression coverage for the warmer-seeded certification back-fill contract documented on {@link
 * org.openmetadata.service.cache.BundleWarmupBatcher}: the bundle warmer caches {@code
 * tagsLoaded=true} / {@code certificationLoaded=false}, and the read path must upgrade the entry on
 * the first cache hit so later hits take the {@code readBundle.hasCertification} fast path with no
 * {@code getCertTagsInternalBatch} SQL and no per-hit Redis {@code SET}.
 *
 * <p>The earlier single-hit test ({@link BundleWarmupReadPathCertificationTest}) only asserts the
 * first hit recomputes certification; it cannot observe the never-self-heal cycle these tests pin.
 * They seed a real {@link CachedReadBundle} backed by an in-memory {@link CacheProvider}, then
 * issue repeated {@code repo.get(...)} calls (clearing the request-scoped cache between each) and
 * assert on the persistent cache state and the DAO invocation count.
 */
class BundleWarmupCertificationBackfillTest {

  private CollectionDAO daoCollection;
  private TagUsageDAO tagUsageDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;
  private TestPipelineRepo repo;
  private Pipeline entity;
  private UUID entityId;
  private CountingCacheProvider cacheProvider;
  private CachedReadBundle bundleCache;
  private MockedStatic<CacheBundle> cacheBundleMock;

  private static class TestPipelineRepo extends EntityRepository<Pipeline> {
    TestPipelineRepo(CollectionDAO.PipelineDAO dao) {
      super(
          "pipelines",
          Entity.PIPELINE,
          Pipeline.class,
          dao,
          "certification,tags,owners",
          "certification,tags,owners");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes r) {}

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
    daoCollection = mock(CollectionDAO.class);
    tagUsageDAO = mock(TagUsageDAO.class);
    when(daoCollection.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(daoCollection);
    Entity.setJobDAO(null);
    Entity.setSearchRepository(null);
    Entity.setEntityRelationshipRepository(null);

    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    repo = new TestPipelineRepo(pipelineDAO);

    entityId = UUID.randomUUID();
    entity =
        new Pipeline()
            .withId(entityId)
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline");
    when(pipelineDAO.findEntityById(entityId, Include.NON_DELETED)).thenReturn(entity);

    cacheProvider = new CountingCacheProvider();
    bundleCache = new CachedReadBundle(cacheProvider, new CacheKeys("test"), new CacheConfig());
    cacheBundleMock = mockStatic(CacheBundle.class);
    cacheBundleMock.when(CacheBundle::getCachedReadBundle).thenReturn(bundleCache);
  }

  @AfterEach
  void tearDown() {
    try {
      cacheBundleMock.close();
    } finally {
      RequestEntityCache.clear();
      ReadBundleContext.clear();
      Entity.setCollectionDAO(null);
      Entity.setJobDAO(null);
      Entity.setSearchRepository(null);
      Entity.setEntityRelationshipRepository(null);
    }
  }

  private CachedReadBundle.Dto warmedDto(List<TagLabel> tags) {
    CachedReadBundle.Dto dto = new CachedReadBundle.Dto();
    dto.relations = null; // default warmer config does not pre-warm relationships
    dto.tags = tags;
    dto.tagsLoaded = true;
    dto.certification = null;
    dto.certificationLoaded = false; // the state the warmer seeds
    return dto;
  }

  private CollectionDAO.TagUsageDAO.TagLabelWithFQNHash certRow(String certTagFqn) {
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash row =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    row.setTagFQN(certTagFqn);
    row.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    row.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    row.setState(TagLabel.State.CONFIRMED.ordinal());
    return row;
  }

  private Pipeline readOnce() {
    Pipeline result =
        repo.get(
            null,
            entityId,
            repo.getFields("tags,certification"),
            RelationIncludes.fromInclude(Include.NON_DELETED),
            false);
    // The request-scoped cache would otherwise answer the next call without re-running
    // buildReadBundle; clear it so each call models a distinct request on the same warmed entry.
    RequestEntityCache.clear();
    return result;
  }

  @Test
  void warmerSeededEntryBackFillsCertificationOnFirstHitAndSkipsSqlAfterwards() {
    TagLabel piiTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    bundleCache.put(Entity.PIPELINE, entityId, warmedDto(List.of(piiTag)));
    cacheProvider.resetSetCount();

    when(tagUsageDAO.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenReturn(List.of(certRow("Certification.Gold")));

    Pipeline first = readOnce();
    Pipeline second = readOnce();
    Pipeline third = readOnce();

    // Correctness preserved across every hit.
    for (Pipeline got : List.of(first, second, third)) {
      assertNotNull(got.getCertification(), "every GET must surface a populated certification");
      assertEquals("Certification.Gold", got.getCertification().getTagLabel().getTagFQN());
      assertNotNull(got.getTags());
      assertEquals(1, got.getTags().size(), "Certification.* tag must stay stripped from tags");
      assertEquals("PII.Sensitive", got.getTags().get(0).getTagFQN());
    }

    // The cert-only back-fill runs once (hit 1); hits 2 and 3 take the bundle fast path. Without
    // the fix this would be times(3) — one lazy getCertTagsInternalBatch per hit, indefinitely.
    verify(tagUsageDAO, times(1)).getCertTagsInternalBatch(anyInt(), anyList(), anyString());

    // Tags were served from the warmed bundle on every hit, so the full tag-fetch never runs.
    verify(tagUsageDAO, never()).getTagsInternalBatch(any());

    // The persistent bundle entry self-heals to certificationLoaded=true after the first hit.
    CachedReadBundle.Dto after = bundleCache.get(Entity.PIPELINE, entityId);
    assertNotNull(after);
    assertTrue(
        after.certificationLoaded,
        "warmer-seeded entry must upgrade to certificationLoaded=true after the first hit");
    assertNotNull(after.certification);
    assertEquals("Certification.Gold", after.certification.getTagLabel().getTagFQN());
    assertTrue(after.tagsLoaded);
    assertEquals(1, after.tags.size());
    assertEquals("PII.Sensitive", after.tags.get(0).getTagFQN());

    // Steady state: only the first warmer-seeded hit writes back to Redis. Without the fix every
    // hit would re-serialize the identical Dto and refresh its TTL (times == 3 here).
    assertEquals(
        1, cacheProvider.setCount(), "only the first warmer-seeded hit should write back to Redis");
  }

  @Test
  void warmerSeededEntryWithoutCertificationStillSelfHealsAndSkipsSqlAfterwards() {
    // Non-certified entity of a cert-supporting type: the cert query returns zero rows. The
    // back-fill must still mark the entry loaded (with an explicit null) so later hits skip the
    // round-trip entirely — this is the larger population the warmer intended to protect.
    TagLabel piiTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    bundleCache.put(Entity.PIPELINE, entityId, warmedDto(List.of(piiTag)));
    cacheProvider.resetSetCount();

    when(tagUsageDAO.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenReturn(List.of());

    Pipeline first = readOnce();
    Pipeline second = readOnce();
    Pipeline third = readOnce();

    for (Pipeline got : List.of(first, second, third)) {
      assertNull(got.getCertification(), "a non-certified entity surfaces a null certification");
      assertNotNull(got.getTags());
      assertEquals(1, got.getTags().size());
    }

    verify(tagUsageDAO, times(1)).getCertTagsInternalBatch(anyInt(), anyList(), anyString());
    verify(tagUsageDAO, never()).getTagsInternalBatch(any());

    CachedReadBundle.Dto after = bundleCache.get(Entity.PIPELINE, entityId);
    assertNotNull(after);
    assertTrue(
        after.certificationLoaded,
        "a non-certified warmer-seeded entry must still self-heal to certificationLoaded=true");
    assertNull(after.certification);

    assertEquals(1, cacheProvider.setCount());
  }

  @Test
  void coldMissPathStillPopulatesCertificationLoadedWithoutRegression() {
    // A naturally-warmed (cold-miss) entry reaches fetchAndPutTagsWithCertification, which calls
    // bundle.putCertification itself; the cert-only back-fill must NOT also fire (it is gated on
    // tagsFilledFromCache), and the entry must end up certificationLoaded=true. This guards the
    // already-healthy path against the new code.
    cacheProvider.resetSetCount();

    when(tagUsageDAO.getTagsInternalBatch(any())).thenReturn(List.of());

    Pipeline first = readOnce();

    assertNull(first.getCertification(), "no cert rows -> null certification");
    verify(tagUsageDAO, times(1)).getTagsInternalBatch(any());
    // The cert-only query never runs on a cold miss — cert is split out of the tag query.
    verify(tagUsageDAO, never()).getCertTagsInternalBatch(anyInt(), anyList(), anyString());

    CachedReadBundle.Dto after = bundleCache.get(Entity.PIPELINE, entityId);
    assertNotNull(after);
    assertTrue(
        after.certificationLoaded,
        "cold-miss entry must mark certificationLoaded=true on its first write-back");
    assertNull(after.certification);
    assertTrue(after.tagsLoaded);
  }

  @Test
  void readThatDoesNotRequestTagsLeavesTheWarmerSeededEntryUnchanged() {
    // Sanity check the gating: a fields set that does not engage shouldLoadTags neither back-fills
    // certification nor degrades the warmed entry, so the subsequent tags-requesting read still
    // back-fills on its own first hit (the canonical lazy-deferral contract).
    TagLabel piiTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    bundleCache.put(Entity.PIPELINE, entityId, warmedDto(List.of(piiTag)));
    cacheProvider.resetSetCount();

    when(tagUsageDAO.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenReturn(List.of());

    Pipeline nonTagsRead =
        repo.get(
            null,
            entityId,
            repo.getFields("certification"),
            RelationIncludes.fromInclude(Include.NON_DELETED),
            false);
    RequestEntityCache.clear();

    // certification is recomputed by the lazy getCertification() path (shouldLoadTags is false, so
    // the bundle cert axis is not engaged and the back-fill does not fire).
    assertNull(nonTagsRead.getCertification());
    verify(tagUsageDAO, times(1)).getCertTagsInternalBatch(anyInt(), anyList(), anyString());

    CachedReadBundle.Dto afterCertOnly = bundleCache.get(Entity.PIPELINE, entityId);
    assertNotNull(afterCertOnly);
    assertFalse(
        afterCertOnly.certificationLoaded,
        "a certification-only read must not claim the bundle cert axis is loaded");
    assertTrue(afterCertOnly.tagsLoaded, "the warmed tags must be preserved");
    assertEquals(1, afterCertOnly.tags.size());

    // The next tags-requesting read then back-fills as the canonical case does.
    when(tagUsageDAO.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenReturn(List.of(certRow("Certification.Gold")));
    Pipeline tagsRead = readOnce();
    assertNotNull(tagsRead.getCertification());
    assertEquals("Certification.Gold", tagsRead.getCertification().getTagLabel().getTagFQN());

    CachedReadBundle.Dto afterTagsRead = bundleCache.get(Entity.PIPELINE, entityId);
    assertNotNull(afterTagsRead);
    assertTrue(afterTagsRead.certificationLoaded);
  }

  /** Minimal in-memory CacheProvider that counts SET calls so tests can assert write-back rate. */
  private static final class CountingCacheProvider implements CacheProvider {
    private final Map<String, String> strings = new HashMap<>();
    private int setCount = 0;

    void resetSetCount() {
      setCount = 0;
    }

    int setCount() {
      return setCount;
    }

    @Override
    public Optional<String> get(String key) {
      return Optional.ofNullable(strings.get(key));
    }

    @Override
    public void set(String key, String value, Duration ttl) {
      strings.put(key, value);
      setCount++;
    }

    @Override
    public boolean setIfAbsent(String key, String value, Duration ttl) {
      return strings.putIfAbsent(key, value) == null;
    }

    @Override
    public void del(String... keysToDelete) {
      for (String key : keysToDelete) {
        strings.remove(key);
      }
    }

    @Override
    public Optional<String> hget(String key, String field) {
      return Optional.empty();
    }

    @Override
    public void hset(String key, Map<String, String> fields, Duration ttl) {}

    @Override
    public void hdel(String key, String... fields) {}

    @Override
    public boolean available() {
      return true;
    }

    @Override
    public Map<String, Object> getStats() {
      return Map.of();
    }

    @Override
    public void close() {}
  }
}
