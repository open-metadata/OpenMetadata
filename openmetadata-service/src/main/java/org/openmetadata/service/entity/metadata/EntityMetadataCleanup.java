package org.openmetadata.service.entity.metadata;

import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter.Field;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter.Schema;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.BatchSelection;

/** Clears shared relationships in the existing import transaction before replacement writes. */
public final class EntityMetadataCleanup {
  public record Capabilities(Schema relationships, boolean tags) {}

  private static final List<Field> FIELDS = List.of(Field.values());
  private final Capabilities capabilities;
  private final Consumer<List<String>> tags;
  private final Consumer<BatchSelection> relationships;

  public EntityMetadataCleanup(
      final Capabilities capabilities,
      final Consumer<List<String>> tags,
      final Consumer<BatchSelection> relationships) {
    this.capabilities = capabilities;
    this.tags = tags;
    this.relationships = relationships;
  }

  public void clearMany(final List<? extends EntityInterface> entities) {
    if (entities.isEmpty()) {
      return;
    }
    final List<UUID> ids = entities.stream().map(EntityInterface::getId).toList();
    if (capabilities.tags()) {
      tags.accept(entities.stream().map(EntityInterface::getFullyQualifiedName).toList());
    }
    for (final Field field : FIELDS) {
      if (capabilities.relationships().supported().contains(field)) {
        relationships.accept(selection(field, ids));
      }
    }
  }

  private BatchSelection selection(final Field field, final List<UUID> ids) {
    final String type = capabilities.relationships().type();
    return switch (field) {
      case OWNERS -> new BatchSelection(ids, type, Relationship.OWNS, null);
      case DOMAINS -> new BatchSelection(ids, type, Relationship.HAS, DOMAIN);
      case REVIEWERS -> new BatchSelection(ids, type, Relationship.REVIEWS, null);
      case DATA_PRODUCTS -> new BatchSelection(ids, type, Relationship.HAS, DATA_PRODUCT);
    };
  }
}
