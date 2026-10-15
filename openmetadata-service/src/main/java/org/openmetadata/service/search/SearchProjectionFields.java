package org.openmetadata.service.search;

import static org.openmetadata.service.apps.bundles.searchIndex.SearchIndexEntityTypes.TIME_SERIES_ENTITIES;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Uses each index's field declaration for live reads, retries and catalog scans. */
@Slf4j
public final class SearchProjectionFields {
  private final Supplier<SearchIndexFactory> factory;
  private final BiFunction<String, List<String>, Fields> supportedFields;

  public SearchProjectionFields(
      final Supplier<SearchIndexFactory> factory,
      final BiFunction<String, List<String>, Fields> supportedFields) {
    this.factory = factory;
    this.supportedFields = supportedFields;
  }

  public List<String> forEntityType(final String entityType) {
    if (TIME_SERIES_ENTITIES.contains(entityType)) {
      return List.of();
    }
    final List<String> required = new ArrayList<>(factory.get().getReindexFieldsFor(entityType));
    List<String> fields = required;
    try {
      fields = new ArrayList<>(supportedFields.apply(entityType, required).getFieldList());
    } catch (RuntimeException failure) {
      // Startup may precede repository registration; retain the declaration so the reader
      // validates it when registration completes instead of hydrating every field with "*".
      LOG.debug(
          "Could not validate search projection fields for {}: {}",
          entityType,
          failure.getMessage());
    }
    return List.copyOf(fields);
  }
}
