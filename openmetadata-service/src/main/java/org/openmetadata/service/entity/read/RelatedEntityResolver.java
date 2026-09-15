package org.openmetadata.service.entity.read;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiFunction;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.EntityUtil;

/** Resolves the union of requested references once per Include and entity type. */
public final class RelatedEntityResolver {
  private final BiFunction<List<EntityRelationshipRecord>, Include, List<EntityReference>> source;

  public RelatedEntityResolver(
      final BiFunction<List<EntityRelationshipRecord>, Include, List<EntityReference>> source) {
    this.source = source;
  }

  public record Request(List<EntityRelationshipRecord> records, Include include) {
    public Request {
      records = List.copyOf(records);
      include = include == null ? Include.ALL : include;
    }
  }

  public <K> Map<K, List<EntityReference>> resolve(final Map<K, Request> requests) {
    final Map<Include, Map<Identity, EntityRelationshipRecord>> grouped = groupRequests(requests);
    final Map<Include, Map<Identity, EntityReference>> loaded = new HashMap<>();
    grouped.forEach((include, records) -> loaded.put(include, load(records, include)));
    final Map<K, List<EntityReference>> result = new HashMap<>();
    requests.forEach(
        (field, request) ->
            result.put(
                field,
                selectReferences(request, loaded.getOrDefault(request.include(), Map.of()))));
    return result;
  }

  private <K> Map<Include, Map<Identity, EntityRelationshipRecord>> groupRequests(
      final Map<K, Request> requests) {
    final Map<Include, Map<Identity, EntityRelationshipRecord>> grouped = new HashMap<>();
    for (final Request request : requests.values()) {
      for (final EntityRelationshipRecord record : request.records()) {
        grouped
            .computeIfAbsent(request.include(), ignored -> new LinkedHashMap<>())
            .putIfAbsent(new Identity(record.getType(), record.getId()), record);
      }
    }
    return grouped;
  }

  private Map<Identity, EntityReference> load(
      final Map<Identity, EntityRelationshipRecord> records, final Include include) {
    final Map<Identity, EntityReference> loaded = new HashMap<>();
    for (final EntityReference reference : source.apply(List.copyOf(records.values()), include)) {
      loaded.putIfAbsent(new Identity(reference.getType(), reference.getId()), reference);
    }
    return loaded;
  }

  private List<EntityReference> selectReferences(
      final Request request, final Map<Identity, EntityReference> loaded) {
    return request.records().stream()
        .map(record -> new Identity(record.getType(), record.getId()))
        .distinct()
        .map(loaded::get)
        .filter(Objects::nonNull)
        .map(RelatedEntityResolver::copyReference)
        .sorted(EntityUtil.compareEntityReference)
        .toList();
  }

  static EntityReference copyReference(final EntityReference reference) {
    // Hydration can mark one field inherited; another field must keep its own mutable reference.
    final EntityReference copy = new EntityReference();
    EntityUtil.copy(reference, copy);
    return copy.withDescription(reference.getDescription())
        .withInherited(reference.getInherited())
        .withHref(reference.getHref());
  }

  private record Identity(String entityType, UUID id) {}
}
