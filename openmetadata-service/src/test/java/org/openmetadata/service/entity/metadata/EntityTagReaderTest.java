package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedTagUsageDao;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.entity.metadata.DerivedTagLoader.FailureMode;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadBundleContext;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TagLabelWithFQNHash;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityTagReaderTest {
  private static final String TABLE = "table";
  private static final String CLASSIFICATION = "Certification";
  private static final String GOLD = "Certification.Gold";
  private static final String SENSITIVE = "PII.Sensitive";
  private final TagUsageDAO dao = mock(TagUsageDAO.class);
  private final Table table =
      new Table().withId(UUID.randomUUID()).withFullyQualifiedName("service.schema.table");
  private final List<String> fallbacks = new ArrayList<>();
  private final RecordingProvider provider = new RecordingProvider();
  private final CacheKeys keys = new CacheKeys("om:tag-reader");
  private final CacheConfig config = new CacheConfig();
  private final CachedTagUsageDao cache = new CachedTagUsageDao(null, provider, keys, config);

  @Test
  void detailMissPublishesTheExistingCacheFormatAndHitsReturnIndependentValues() {
    final var reader = reader(true, CLASSIFICATION, cache);
    config.entityTtlSeconds = 123;
    when(dao.getTags(table.getFullyQualifiedName()))
        .thenReturn(List.of(label(SENSITIVE), label(GOLD)));

    final List<TagLabel> first = reader.read(table);
    assertEquals(List.of(label(SENSITIVE)), first);
    assertEquals(
        JsonUtils.pojoToJson(first), provider.values.getIfPresent(keys.tags(TABLE, table.getId())));
    assertEquals(Duration.ofSeconds(123), provider.ttl);
    first.getFirst().setDescription("local change");
    when(dao.getTags(table.getFullyQualifiedName()))
        .thenThrow(new AssertionError("Cache hit must avoid SQL"));

    assertNull(reader.read(table).getFirst().getDescription());
    assertEquals(List.of("no_bundle", "no_bundle"), fallbacks);
  }

  @Test
  void bypassReadsFreshTagsWithoutOverwritingTheCachedValue() {
    final var reader = reader(true, CLASSIFICATION, cache);
    cache.putTags(TABLE, table.getId(), JsonUtils.pojoToJson(List.of(label(SENSITIVE))));
    when(dao.getTags(table.getFullyQualifiedName())).thenReturn(List.of(label("PII.Fresh")));

    try (var ignored = EntityCacheBypass.skip()) {
      assertEquals("PII.Fresh", reader.read(table).getFirst().getTagFQN());
    }
    assertEquals(SENSITIVE, reader.read(table).getFirst().getTagFQN());
  }

  @Test
  void loadedEmptyBundleAvoidsBothCacheAndSqlWhileMissingCoverageFallsBack() {
    final var reader = reader(true, CLASSIFICATION, cache);
    cache.putTags(TABLE, table.getId(), JsonUtils.pojoToJson(List.of(label(SENSITIVE))));
    final ReadBundle bundle = new ReadBundle();
    ReadBundleContext.push(bundle);
    try {
      assertEquals(List.of(label(SENSITIVE)), reader.read(table));
      bundle.putTags(table.getId(), List.of());
      assertTrue(reader.read(table).isEmpty());
      assertEquals(List.of("not_loaded"), fallbacks);
    } finally {
      ReadBundleContext.pop();
    }
  }

  @Test
  void combinedProjectionKeepsUnrequestedValuesAndDoesNotQueryCertificationAgain() {
    final var reader = reader(true, CLASSIFICATION, null);
    when(dao.getTagsInternalBatch(anyList())).thenReturn(List.of(row(GOLD), row(SENSITIVE)));
    final AssetCertification original = new AssetCertification().withExpiryDate(20L);
    table.setCertification(original);

    reader.populate(
        List.of(table), new EntityTagReader.Projection(true, false, FailureMode.PROPAGATE));
    assertEquals(original, table.getCertification());
    assertEquals(List.of(label(SENSITIVE)), table.getTags());
    reader.populate(
        List.of(table), new EntityTagReader.Projection(true, true, FailureMode.PROPAGATE));
    assertEquals(GOLD, table.getCertification().getTagLabel().getTagFQN());
    reader.populate(
        List.of(table), new EntityTagReader.Projection(false, false, FailureMode.PROPAGATE));
    assertEquals(GOLD, table.getCertification().getTagLabel().getTagFQN());
  }

  @Test
  void bundleProjectionKeepsItsFirstExactParentRule() {
    final var reader = reader(true, CLASSIFICATION, null);
    when(dao.getTagsInternalBatch(anyList()))
        .thenReturn(
            List.of(
                row(GOLD),
                row("Certification.Nested.Silver"),
                row("Certification.Silver"),
                row(SENSITIVE)));
    final ReadBundle bundle = new ReadBundle();

    reader.loadBundle(table, bundle);

    assertEquals(GOLD, bundle.getCertificationOrNull(table.getId()).getTagLabel().getTagFQN());
    assertEquals(
        List.of("Certification.Nested.Silver", "Certification.Silver", SENSITIVE),
        bundle.getTags(table.getId()).orElseThrow().stream().map(TagLabel::getTagFQN).toList());
  }

  @Test
  void duplicateFqnsRetainIndependentListsAndDerivedValues() {
    final String term = "glossary.term";
    final TagLabelWithFQNHash applied = row(term);
    applied.setSource(TagLabel.TagSource.GLOSSARY.ordinal());
    when(dao.getTagsInternalBatch(anyList())).thenReturn(List.of(applied));
    final TagLabel derived =
        label(SENSITIVE)
            .withLabelType(TagLabel.LabelType.DERIVED)
            .withMetadata(new TagLabelMetadata().withExpiryDate(100L));
    final var loader =
        new DerivedTagLoader(
            tags -> Map.of(FullyQualifiedName.buildHash(term), List.of(derived)),
            TagLabelUtil::addDerivedTagsWithPreFetched,
            tags -> tags);
    final var reader = reader(true, CLASSIFICATION, null, loader);
    final Table duplicate = JsonUtils.deepCopy(table, Table.class);

    reader.populate(
        List.of(table, duplicate),
        new EntityTagReader.Projection(true, false, FailureMode.FALL_BACK_TO_INDIVIDUAL));
    table.getTags().add(label("PII.Local"));
    table.getTags().getFirst().getMetadata().setExpiryDate(200L);

    assertEquals(2, duplicate.getTags().size());
    assertEquals(100L, duplicate.getTags().getFirst().getMetadata().getExpiryDate());
  }

  @Test
  void emptyBundleStillRecordsCertificationCoverage() {
    final var reader = reader(true, CLASSIFICATION, null);
    final ReadBundle bundle = new ReadBundle();
    reader.loadBundle(table, bundle);

    assertTrue(bundle.hasCertification(table.getId()));
    assertNull(bundle.getCertificationOrNull(table.getId()));
    assertTrue(bundle.getTags(table.getId()).orElseThrow().isEmpty());
    assertTrue(reader.readMany(List.of()).isEmpty());
    assertTrue(
        reader
            .readMany(List.of(table.getFullyQualifiedName(), table.getFullyQualifiedName()))
            .get(table.getFullyQualifiedName())
            .isEmpty());
  }

  @Test
  void unconfiguredCertificationLeavesTagsIntactAndPrefixReadsRetainNestedTags() {
    when(dao.getTags(table.getFullyQualifiedName())).thenReturn(List.of(label(GOLD)));
    assertEquals(List.of(label(GOLD)), reader(true, null, null).read(table));
    final List<TagLabel> tags =
        new ArrayList<>(
            List.of(label(GOLD), label("Certification.Nested.Silver"), label(SENSITIVE)));
    when(dao.getTagsByPrefix("prefix", "postfix", true)).thenReturn(Map.of("column", tags));

    assertEquals(
        List.of(label("Certification.Nested.Silver"), label(SENSITIVE)),
        reader(true, CLASSIFICATION, null).readByPrefix("prefix", "postfix").get("column"));
  }

  @Test
  void unsupportedTagsLeaveTheEntityAlone() {
    final var reader = reader(false, null, null);
    assertNull(reader.read(table));
    assertNull(reader.read(table.getFullyQualifiedName()));
    assertNull(reader.readByPrefix("prefix", "postfix"));
    reader.populate(
        List.of(table), new EntityTagReader.Projection(true, false, FailureMode.PROPAGATE));
    reader.populate(List.of(), new EntityTagReader.Projection(true, true, FailureMode.PROPAGATE));
    assertNull(table.getTags());
  }

  private EntityTagReader<Table> reader(
      final boolean supportsTags, final String classification, final CachedTagUsageDao cached) {
    return reader(
        supportsTags,
        classification,
        cached,
        new DerivedTagLoader(
            tags -> Map.of(), TagLabelUtil::addDerivedTagsWithPreFetched, tags -> tags));
  }

  private EntityTagReader<Table> reader(
      final boolean supportsTags,
      final String classification,
      final CachedTagUsageDao cached,
      final DerivedTagLoader derived) {
    final var certifications =
        new EntityCertificationService<Table>(() -> dao, () -> classification, true, label -> {});
    return new EntityTagReader<>(
        () -> dao,
        () -> cached,
        certifications,
        new EntityTagReader.Hydration<>(
            rows ->
                rows.stream()
                    .collect(
                        Collectors.groupingBy(
                            TagLabelWithFQNHash::getTargetFQNHash,
                            Collectors.mapping(
                                TagLabelWithFQNHash::toTagLabel, Collectors.toList()))),
            derived,
            certifications::read),
        new EntityTagReader.Options(TABLE, supportsTags, fallbacks::add));
  }

  private TagLabel label(final String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private TagLabelWithFQNHash row(final String fqn) {
    final TagLabelWithFQNHash row = new TagLabelWithFQNHash();
    row.setTargetFQNHash(FullyQualifiedName.buildHash(table.getFullyQualifiedName()));
    row.setTagFQN(fqn);
    row.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    row.setLabelType(TagLabel.LabelType.MANUAL.ordinal());
    row.setState(TagLabel.State.CONFIRMED.ordinal());
    return row;
  }

  private static final class RecordingProvider extends NoopCacheProvider {
    private final Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private Duration ttl;

    @Override
    public Optional<String> get(final String key) {
      return Optional.ofNullable(values.getIfPresent(key));
    }

    @Override
    public void set(final String key, final String value, final Duration ttl) {
      values.put(key, value);
      this.ttl = ttl;
    }
  }
}
