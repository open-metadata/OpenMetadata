package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

/**
 * Fetches each relationship group once and resolves the requested reference union. Child SQL
 * objects are obtained inside the operation to participate in the retained DAO transaction.
 */
public final class RelationshipReadLoader {
  private final Supplier<EntityRelationshipDAO> relationships;
  private final RelatedEntityResolver references;

  public RelationshipReadLoader(
      final Supplier<EntityRelationshipDAO> relationships, final RelatedEntityResolver references) {
    this.relationships = relationships;
    this.references = references;
  }

  public void load(UUID id, String entityType, ReadPlan plan, ReadBundle bundle) {
    if (plan.getRelationSpecs().isEmpty()) {
      return;
    }
    List<EntityRelationshipObject> incoming;
    List<EntityRelationshipObject> outgoing;
    try (var ignored = phase("readBundleFetchToRelationships")) {
      incoming = fetchIncoming(id, entityType, plan.getToRelationsByInclude());
    }
    try (var ignored = phase("readBundleFetchFromRelationships")) {
      outgoing = fetchOutgoing(id, entityType, plan.getFromRelationsByInclude());
    }
    Map<String, RelatedEntityResolver.Request> requests = new HashMap<>();
    plan.getRelationSpecs()
        .forEach((field, spec) -> requests.put(field, request(spec, incoming, outgoing)));
    references
        .resolve(requests)
        .forEach(
            (field, refs) -> bundle.putRelations(id, field, plan.getIncludeForField(field), refs));
  }

  private RelatedEntityResolver.Request request(
      ReadPlan.RelationSpec spec,
      List<EntityRelationshipObject> incoming,
      List<EntityRelationshipObject> outgoing) {
    List<EntityRelationshipRecord> records =
        switch (spec.direction()) {
          case TO -> incomingReferences(incoming, spec.relationship(), spec.relatedEntityType());
          case FROM -> outgoingReferences(outgoing, spec.relationship(), spec.relatedEntityType());
        };
    return new RelatedEntityResolver.Request(records, spec.include());
  }

  private List<EntityRelationshipObject> fetchIncoming(
      UUID id, String entityType, Map<Include, Set<Integer>> groups) {
    if (groups.isEmpty()) {
      return List.of();
    }
    List<EntityRelationshipObject> records = new ArrayList<>();
    collapseGroups(groups)
        .forEach(
            (include, ordinals) ->
                records.addAll(
                    relationships
                        .get()
                        .findToRelationshipsForEntity(
                            id, entityType, new ArrayList<>(ordinals), include)));
    return records;
  }

  private List<EntityRelationshipObject> fetchOutgoing(
      UUID id, String entityType, Map<Include, Set<Integer>> groups) {
    if (groups.isEmpty()) {
      return List.of();
    }
    List<EntityRelationshipObject> records = new ArrayList<>();
    collapseGroups(groups)
        .forEach(
            (include, ordinals) ->
                records.addAll(
                    relationships
                        .get()
                        .findFromRelationshipsForEntity(
                            id, entityType, new ArrayList<>(ordinals), include)));
    return records;
  }

  private Map<Include, Set<Integer>> collapseGroups(Map<Include, Set<Integer>> groups) {
    Map<Include, Set<Integer>> collapsed = new HashMap<>();
    groups.forEach(
        (include, ordinals) -> {
          if (!nullOrEmpty(ordinals)) {
            collapsed.put(include, new HashSet<>(ordinals));
          }
        });
    Set<Integer> all = collapsed.getOrDefault(ALL, Collections.emptySet());
    if (!all.isEmpty()) {
      collapsed.forEach(
          (include, ordinals) -> {
            if (include != ALL) {
              ordinals.removeAll(all);
            }
          });
    }
    collapsed.values().removeIf(Set::isEmpty);
    return collapsed;
  }

  public static List<EntityRelationshipRecord> incomingReferences(
      List<EntityRelationshipObject> records, Relationship relationship, String entityType) {
    return records.stream()
        .filter(record -> record.getRelation() == relationship.ordinal())
        .filter(record -> entityType == null || entityType.equals(record.getFromEntity()))
        .map(
            record ->
                EntityRelationshipRecord.builder()
                    .id(UUID.fromString(record.getFromId()))
                    .type(record.getFromEntity())
                    .json(record.getJson())
                    .build())
        .toList();
  }

  private static List<EntityRelationshipRecord> outgoingReferences(
      List<EntityRelationshipObject> records, Relationship relationship, String entityType) {
    return records.stream()
        .filter(record -> record.getRelation() == relationship.ordinal())
        .filter(record -> entityType == null || entityType.equals(record.getToEntity()))
        .map(
            record ->
                EntityRelationshipRecord.builder()
                    .id(UUID.fromString(record.getToId()))
                    .type(record.getToEntity())
                    .json(record.getJson())
                    .build())
        .toList();
  }
}
