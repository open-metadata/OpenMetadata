package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.cache.CachedTagUsageDao;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityRepositoryTagCacheTest {
  private final AtomicBoolean propagation = new AtomicBoolean(true);
  private final Table table = new Table().withId(UUID.randomUUID()).withFullyQualifiedName("s.d.t");
  private final TagLabel term =
      new TagLabel().withTagFQN("Glossary.Customer").withSource(TagLabel.TagSource.GLOSSARY);
  private final TagLabel derived =
      new TagLabel().withTagFQN("PII.Sensitive").withLabelType(TagLabel.LabelType.DERIVED);
  private TableRepository repository;
  private CollectionDAO.TagUsageDAO tagUsage;
  private CachedTagUsageDao cache;
  private MockedStatic<CacheBundle> cacheBundle;
  private MockedStatic<SettingsCache> settings;

  @BeforeEach
  void setup() {
    CollectionDAO collection = mock(CollectionDAO.class);
    tagUsage = mock(CollectionDAO.TagUsageDAO.class);
    when(collection.tagUsageDAO()).thenReturn(tagUsage);
    Entity.setCollectionDAO(collection);
    repository = new TableRepository();
    cache =
        new CachedTagUsageDao(
            collection, inMemoryProvider(), new CacheKeys("test"), new CacheConfig());
    cacheBundle = mockStatic(CacheBundle.class);
    cacheBundle.when(CacheBundle::getCachedTagUsageDao).thenReturn(cache);
    settings = mockStatic(SettingsCache.class, CALLS_REAL_METHODS);
    settings
        .when(SettingsCache::isGlossaryTagPropagationEnabled)
        .thenAnswer(call -> propagation.get());
  }

  @AfterEach
  void cleanup() {
    settings.close();
    cacheBundle.close();
    ReadBundleContext.clear();
    Entity.cleanup();
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void cacheHitsDoNotQueryDerivedTagsEvenWithAReadBundle(boolean withBundle) {
    if (withBundle) {
      useReadBundle();
    }
    when(tagUsage.getDerivedTagsBatch(anyList()))
        .thenThrow(new AssertionError("A warm tag cache must not query glossary tags"));
    for (boolean enabled : List.of(true, false)) {
      propagation.set(enabled);
      cache.putTags(
          Entity.TABLE, table.getId(), JsonUtils.pojoToJson(List.of(term, derived)), enabled);
      assertEquals(enabled ? List.of(term, derived) : List.of(term), repository.getTags(table));
    }
  }

  @Test
  void bundleTagsAreDerivedOncePerPreferenceChange() {
    useReadBundle();
    expectOneDerivedLookup(derived);
    assertEquals(List.of(term, derived), repository.getTags(table));
    assertEquals(List.of(term, derived), repository.getTags(table));

    propagation.set(false);
    SettingsCache.invalidateSettings(SettingsType.GLOSSARY_SETTINGS.value());
    assertEquals(List.of(term), repository.getTags(table));
    assertEquals(List.of(term), repository.getTags(table));

    TagLabel changed =
        new TagLabel().withTagFQN("PII.NonSensitive").withLabelType(TagLabel.LabelType.DERIVED);
    expectOneDerivedLookup(changed);
    propagation.set(true);
    SettingsCache.invalidateSettings(SettingsType.GLOSSARY_SETTINGS.value());
    assertEquals(List.of(term, changed), repository.getTags(table));
    assertEquals(List.of(term, changed), repository.getTags(table));
  }

  @Test
  void tagInvalidationRemovesBothPreferenceVariants() {
    for (boolean enabled : List.of(true, false)) {
      propagation.set(enabled);
      cache.putTags(Entity.TABLE, table.getId(), JsonUtils.pojoToJson(List.of(term)), enabled);
    }
    cache.invalidateTags(Entity.TABLE, table.getId());
    for (boolean enabled : List.of(true, false)) {
      propagation.set(enabled);
      assertNull(cache.getTags(Entity.TABLE, table.getId(), enabled));
    }
  }

  @Test
  void disabledCacheEntriesCannotAnswerEnabledReads() {
    cache.putTags(Entity.TABLE, table.getId(), JsonUtils.pojoToJson(List.of(term)), false);
    assertNull(cache.getTags(Entity.TABLE, table.getId(), true));
    assertEquals(List.of(term), cache.getTags(Entity.TABLE, table.getId(), false));
  }

  private void useReadBundle() {
    ReadBundle bundle = new ReadBundle();
    bundle.putTags(table.getId(), List.of(term));
    ReadBundleContext.push(bundle);
  }

  private void expectOneDerivedLookup(TagLabel tag) {
    doReturn(Map.of(FullyQualifiedName.buildHash(term.getTagFQN()), List.of(tag)))
        .doThrow(new AssertionError("A warm tag cache must not query glossary tags"))
        .when(tagUsage)
        .getDerivedTagsBatch(anyList());
  }

  private CacheProvider inMemoryProvider() {
    Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(16).build();
    CacheProvider provider = mock(CacheProvider.class);
    when(provider.get(anyString()))
        .thenAnswer(call -> Optional.ofNullable(values.getIfPresent(call.getArgument(0))));
    doAnswer(
            call -> {
              values.put(call.getArgument(0), call.getArgument(1));
              return null;
            })
        .when(provider)
        .set(anyString(), anyString(), any(Duration.class));
    doAnswer(
            call -> {
              values.invalidateAll(List.of((String[]) call.getRawArguments()[0]));
              return null;
            })
        .when(provider)
        .del(any(String[].class));
    when(provider.scanDelete("test:tags:*"))
        .thenAnswer(
            call -> {
              long size = values.size();
              values.invalidateAll();
              return size;
            });
    return provider;
  }
}
