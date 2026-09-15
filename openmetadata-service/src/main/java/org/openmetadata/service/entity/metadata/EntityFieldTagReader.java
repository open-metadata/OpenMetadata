package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TagLabelWithFQNHash;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/** Hydrates nested field tags in exact-FQN batches, preserving each input occurrence. */
@Slf4j
public final class EntityFieldTagReader {
  public record Hydration(
      Function<List<TagLabelWithFQNHash>, Map<String, List<TagLabel>>> populate,
      Function<List<TagLabel>, Map<String, List<TagLabel>>> derived,
      BiFunction<List<TagLabel>, Map<String, List<TagLabel>>, List<TagLabel>> combine) {}

  private record Fields<F>(List<List<F>> occurrences, Set<String> fqns) {}

  private static final int QUERY_BATCH_SIZE = 5000;
  private final Supplier<TagUsageDAO> usages;
  private final Hydration hydration;

  public EntityFieldTagReader(final Supplier<TagUsageDAO> usages, final Hydration hydration) {
    this.usages = usages;
    this.hydration = hydration;
  }

  public <T, F extends FieldInterface> void populate(
      final List<T> entities, final Function<T, List<F>> extract) {
    if (nullOrEmpty(entities)) {
      return;
    }
    final Fields<F> fields = collectFields(entities, extract);
    if (fields.fqns().isEmpty()) {
      return;
    }
    final Map<String, List<TagLabel>> tags = hydration.populate().apply(read(fields.fqns()));
    final Map<String, List<TagLabel>> derived = readDerived(tags);
    fields.occurrences().forEach(occurrence -> assign(occurrence, tags, derived));
  }

  private <T, F extends FieldInterface> Fields<F> collectFields(
      final List<T> entities, final Function<T, List<F>> extract) {
    final List<List<F>> occurrences = new ArrayList<>(entities.size());
    final Set<String> fqns = new LinkedHashSet<>();
    for (final T entity : entities) {
      final List<F> fields = extract.apply(entity);
      if (fields != null) {
        final List<F> flattened = EntityUtil.getFlattenedEntityField(fields);
        occurrences.add(flattened);
        flattened.stream()
            .map(FieldInterface::getFullyQualifiedName)
            .filter(fqn -> fqn != null)
            .forEach(fqns::add);
      }
    }
    return new Fields<>(occurrences, fqns);
  }

  private List<TagLabelWithFQNHash> read(final Set<String> fqns) {
    final List<String> ordered = new ArrayList<>(fqns);
    final List<TagLabelWithFQNHash> rows = new ArrayList<>();
    for (int start = 0; start < ordered.size(); start += QUERY_BATCH_SIZE) {
      final List<String> chunk =
          ordered.subList(start, Math.min(start + QUERY_BATCH_SIZE, ordered.size()));
      rows.addAll(listOrEmpty(usages.get().getTagsInternalBatch(chunk)));
    }
    return rows;
  }

  private Map<String, List<TagLabel>> readDerived(final Map<String, List<TagLabel>> tags) {
    try {
      return hydration.derived().apply(tags.values().stream().flatMap(List::stream).toList());
    } catch (RuntimeException failure) {
      LOG.warn("Failed to batch fetch derived tags for fields. Skipping derived tags.", failure);
      return Map.of();
    }
  }

  private <F extends FieldInterface> void assign(
      final List<F> fields,
      final Map<String, List<TagLabel>> tags,
      final Map<String, List<TagLabel>> derived) {
    for (final F field : fields) {
      final List<TagLabel> labels =
          tags.get(FullyQualifiedName.buildHash(field.getFullyQualifiedName()));
      field.setTags(
          labels == null ? new ArrayList<>() : hydration.combine().apply(labels, derived));
    }
  }
}
