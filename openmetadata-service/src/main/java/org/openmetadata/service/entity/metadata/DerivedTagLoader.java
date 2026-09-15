package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/** Resolves glossary-derived tags once per batch without sharing mutable derived labels. */
@Slf4j
public final class DerivedTagLoader {
  public enum FailureMode {
    PROPAGATE,
    FALL_BACK_TO_INDIVIDUAL
  }

  private final Function<List<TagLabel>, Map<String, List<TagLabel>>> fetch;
  private final BiFunction<List<TagLabel>, Map<String, List<TagLabel>>, List<TagLabel>> combine;
  private final Function<List<TagLabel>, List<TagLabel>> fallback;

  public DerivedTagLoader(
      final Function<List<TagLabel>, Map<String, List<TagLabel>>> fetch,
      final BiFunction<List<TagLabel>, Map<String, List<TagLabel>>, List<TagLabel>> combine,
      final Function<List<TagLabel>, List<TagLabel>> fallback) {
    this.fetch = fetch;
    this.combine = combine;
    this.fallback = fallback;
  }

  public <K> Map<K, List<TagLabel>> load(
      final Map<K, List<TagLabel>> tags, final FailureMode failureMode) {
    final List<TagLabel> allTags = tags.values().stream().flatMap(List::stream).toList();
    if (allTags.isEmpty()) {
      return tags;
    }
    final Map<String, List<TagLabel>> derived;
    try {
      derived = fetch.apply(allTags);
    } catch (RuntimeException exception) {
      return handleFailure(tags, failureMode, exception);
    }
    final Map<K, List<TagLabel>> result = new HashMap<>();
    tags.forEach(
        (key, labels) -> result.put(key, combine.apply(labels, copyDerived(labels, derived))));
    return result;
  }

  private <K> Map<K, List<TagLabel>> handleFailure(
      final Map<K, List<TagLabel>> tags, final FailureMode mode, final RuntimeException exception) {
    if (mode == FailureMode.PROPAGATE) {
      throw exception;
    }
    LOG.warn(
        "Derived tag batch read failed; falling back to individual reads: {}",
        exception.getMessage());
    final Map<K, List<TagLabel>> result = new HashMap<>();
    tags.forEach((key, labels) -> result.put(key, loadSingle(labels)));
    return result;
  }

  private Map<String, List<TagLabel>> copyDerived(
      final List<TagLabel> tags, final Map<String, List<TagLabel>> derived) {
    if (derived.isEmpty()) {
      return Map.of();
    }
    final Map<String, List<TagLabel>> copies = new HashMap<>();
    for (final TagLabel tag : tags) {
      if (tag != null && tag.getSource() == TagLabel.TagSource.GLOSSARY) {
        final String hash = FullyQualifiedName.buildHash(tag.getTagFQN());
        copies.computeIfAbsent(
            hash,
            key ->
                derived.getOrDefault(key, List.of()).stream()
                    .map(label -> JsonUtils.deepCopy(label, TagLabel.class))
                    .toList());
      }
    }
    return copies;
  }

  public List<TagLabel> loadSingle(final List<TagLabel> tags) {
    return nullOrEmpty(tags) ? tags : fallback.apply(tags);
  }
}
