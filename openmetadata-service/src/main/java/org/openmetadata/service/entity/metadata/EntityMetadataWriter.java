package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Value;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/** Stores shared metadata using the existing single-row and bulk relationship policies. */
@Slf4j
public final class EntityMetadataWriter {
  public enum Field {
    OWNERS(FIELD_OWNERS, Relationship.OWNS),
    DOMAINS(FIELD_DOMAINS, Relationship.HAS),
    REVIEWERS(FIELD_REVIEWERS, Relationship.REVIEWS),
    DATA_PRODUCTS(FIELD_DATA_PRODUCTS, Relationship.HAS);

    private final String name;
    private final Relationship relationship;

    Field(final String name, final Relationship relationship) {
      this.name = name;
      this.relationship = relationship;
    }

    private List<EntityReference> references(final EntityInterface entity) {
      return switch (this) {
        case OWNERS -> entity.getOwners();
        case DOMAINS -> entity.getDomains();
        case REVIEWERS -> entity.getReviewers();
        case DATA_PRODUCTS -> entity.getDataProducts();
      };
    }

    private String type(final EntityReference reference) {
      return switch (this) {
        case DOMAINS -> DOMAIN;
        case DATA_PRODUCTS -> DATA_PRODUCT;
        case OWNERS, REVIEWERS -> reference.getType();
      };
    }
  }

  public record Schema(String type, Set<Field> supported) {
    public Schema {
      supported = Set.copyOf(supported);
    }

    public static Schema fromFields(final String type, final Set<String> fields) {
      return new Schema(
          type,
          Arrays.stream(Field.values())
              .filter(field -> fields.contains(field.name))
              .collect(Collectors.toSet()));
    }
  }

  private final Schema schema;
  private final EntityRelationshipWriter relationships;
  private final Consumer<List<EntityReference>> validateDomains;
  private final BiConsumer<UUID, EntityReference> domainLineage;

  public EntityMetadataWriter(
      final Schema schema,
      final EntityRelationshipWriter relationships,
      final Consumer<List<EntityReference>> validateDomains,
      final BiConsumer<UUID, EntityReference> domainLineage) {
    this.schema = schema;
    this.relationships = relationships;
    this.validateDomains = validateDomains;
    this.domainLineage = domainLineage;
  }

  public void store(
      final Field field, final EntityInterface entity, final List<EntityReference> values) {
    if (schema.supported().contains(field) && !nullOrEmpty(values)) {
      if (field == Field.DOMAINS) {
        storeDomains(entity, values);
      } else {
        logCount(field, entity, values.size());
        relationships.insertMany(values.stream().map(value -> row(field, entity, value)).toList());
      }
    }
  }

  private void storeDomains(final EntityInterface entity, final List<EntityReference> domains) {
    validateDomains.accept(domains);
    for (final EntityReference domain : domains) {
      LOG.info(
          "Adding domain {} for entity {}:{}",
          domain.getFullyQualifiedName(),
          schema.type(),
          entity.getId());
      relationships.add(
          new Edge(domain.getId(), entity.getId(), DOMAIN, schema.type(), Relationship.HAS),
          Value.EMPTY,
          false);
      domainLineage.accept(domain.getId(), domain);
    }
  }

  public void storeMany(final Field field, final List<? extends EntityInterface> entities) {
    if (schema.supported().contains(field)) {
      final List<EntityRelationshipObject> rows = new ArrayList<>();
      for (final EntityInterface entity : entities) {
        appendRows(field, entity, rows);
      }
      relationships.insertMany(rows);
    }
  }

  private void appendRows(
      final Field field, final EntityInterface entity, final List<EntityRelationshipObject> rows) {
    final List<EntityReference> values = field.references(entity);
    if (!nullOrEmpty(values)) {
      if (field == Field.DOMAINS) {
        validateDomains.accept(values);
      }
      for (final EntityReference value : values) {
        rows.add(row(field, entity, value));
        if (field == Field.DOMAINS) {
          domainLineage.accept(value.getId(), value);
        }
      }
    }
  }

  private EntityRelationshipObject row(
      final Field field, final EntityInterface entity, final EntityReference reference) {
    return EntityRelationshipWriter.row(
        reference.getId(),
        entity.getId(),
        field.type(reference),
        schema.type(),
        field.relationship);
  }

  private void logCount(final Field field, final EntityInterface entity, final int count) {
    if (field == Field.OWNERS) {
      LOG.info("Adding {} owners for entity {}:{}", count, schema.type(), entity.getId());
    } else if (field == Field.DATA_PRODUCTS) {
      LOG.info("Adding {} data products for entity {}:{}", count, schema.type(), entity.getId());
    }
  }
}
