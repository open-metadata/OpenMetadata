package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;

class DerivedTagLoaderTest {
  private static final String TERM = "glossary.term";

  @Test
  void oneBatchPreservesOrderingDeduplicationAndIndependentDerivedValues() {
    final AtomicInteger reads = new AtomicInteger();
    final TagLabel derived =
        tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.DERIVED)
            .withMetadata(new TagLabelMetadata().withExpiryDate(10L));
    final DerivedTagLoader loader =
        new DerivedTagLoader(
            tags -> {
              assertEquals(1, reads.incrementAndGet());
              return Map.of(FullyQualifiedName.buildHash(TERM), List.of(derived));
            },
            TagLabelUtil::addDerivedTagsWithPreFetched,
            tags -> {
              throw new AssertionError("The batch succeeded");
            });
    final TagLabel term = tag(TERM, TagLabel.TagSource.GLOSSARY);

    final var result =
        loader.load(
            Map.of("first", List.of(term), "second", List.of(term)),
            DerivedTagLoader.FailureMode.FALL_BACK_TO_INDIVIDUAL);

    assertEquals(
        List.of("PII.Sensitive", TERM),
        result.get("first").stream().map(TagLabel::getTagFQN).toList());
    result.get("first").getFirst().getMetadata().setExpiryDate(20L);
    assertEquals(10L, result.get("second").getFirst().getMetadata().getExpiryDate());
    assertEquals(10L, derived.getMetadata().getExpiryDate());
  }

  @Test
  void explicitTagsTakePrecedenceOverDerivedTags() {
    final TagLabel explicit = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    final TagLabel derived =
        tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.DERIVED);
    final DerivedTagLoader loader =
        new DerivedTagLoader(
            tags -> Map.of(FullyQualifiedName.buildHash(TERM), List.of(derived)),
            TagLabelUtil::addDerivedTagsWithPreFetched,
            tags -> tags);

    final var result =
        loader.load(
            Map.of("table", List.of(explicit, tag(TERM, TagLabel.TagSource.GLOSSARY))),
            DerivedTagLoader.FailureMode.PROPAGATE);

    assertEquals(2, result.get("table").size());
    assertEquals(TagLabel.LabelType.MANUAL, result.get("table").getFirst().getLabelType());
  }

  @Test
  void bestEffortBatchesRetainTheIndividualFallback() {
    final AtomicInteger fallbacks = new AtomicInteger();
    final DerivedTagLoader loader =
        new DerivedTagLoader(
            tags -> {
              throw new IllegalStateException("Batch unavailable");
            },
            TagLabelUtil::addDerivedTagsWithPreFetched,
            tags -> {
              fallbacks.incrementAndGet();
              return List.of(tag("PII.Fallback", TagLabel.TagSource.CLASSIFICATION));
            });

    final var result =
        loader.load(
            Map.of(
                "first",
                List.of(tag(TERM, TagLabel.TagSource.GLOSSARY)),
                "second",
                List.of(tag(TERM, TagLabel.TagSource.GLOSSARY))),
            DerivedTagLoader.FailureMode.FALL_BACK_TO_INDIVIDUAL);

    assertEquals(2, fallbacks.get());
    assertEquals("PII.Fallback", result.get("first").getFirst().getTagFQN());
    assertEquals("PII.Fallback", result.get("second").getFirst().getTagFQN());
  }

  @Test
  void strictBatchesKeepTheirFailureContract() {
    final DerivedTagLoader loader =
        new DerivedTagLoader(
            tags -> {
              throw new IllegalStateException("Batch unavailable");
            },
            TagLabelUtil::addDerivedTagsWithPreFetched,
            tags -> {
              throw new AssertionError("Strict reads must propagate the failure");
            });

    assertThrows(
        IllegalStateException.class,
        () ->
            loader.load(
                Map.of("table", List.of(tag(TERM, TagLabel.TagSource.GLOSSARY))),
                DerivedTagLoader.FailureMode.PROPAGATE));
  }

  @Test
  void absentTagsNeedNoDerivedLookup() {
    final DerivedTagLoader loader =
        new DerivedTagLoader(
            tags -> {
              throw new AssertionError("No tags to load");
            },
            TagLabelUtil::addDerivedTagsWithPreFetched,
            tags -> tags);

    assertTrue(loader.load(Map.of(), DerivedTagLoader.FailureMode.PROPAGATE).isEmpty());
    assertEquals(
        List.of(),
        loader
            .load(Map.of("table", List.of()), DerivedTagLoader.FailureMode.PROPAGATE)
            .get("table"));
    assertEquals(List.of(), loader.loadSingle(List.of()));
  }

  private TagLabel tag(final String fqn, final TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
