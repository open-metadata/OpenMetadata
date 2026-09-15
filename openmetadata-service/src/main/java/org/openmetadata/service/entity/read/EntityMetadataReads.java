package org.openmetadata.service.entity.read;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;
import static org.openmetadata.service.Entity.USER;

import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityFieldTagReader;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.EntityUtil;

/** Composes shared metadata reads while retaining entity-specific domain, child and field policies. */
public final class EntityMetadataReads<T extends EntityInterface> {
  public record Schema(String type, Set<String> fields, CollectionDAO collection) {
    public Schema {
      fields = Set.copyOf(fields);
    }
  }

  public record Hooks<T>(
      BiFunction<T, Include, List<EntityReference>> domains,
      BiFunction<T, Include, List<EntityReference>> children,
      EntityMetadataHydrator.EntityFields<T> fields) {}

  public record Values<T>(
      Function<T, List<TagLabel>> tags,
      Function<T, AssetCertification> certification,
      Function<T, Object> extensions) {}

  private final EntityRelationshipReader relationships;
  private final EntityRelationshipFields fields;
  private final EntityBatchReferenceReader batch;
  private final EntityAccessMetadataReader access;
  private final EntityFieldTagReader fieldTags;
  private final BulkRelationshipLoader bulk;
  private final EntityVoteReader<T> votes;
  private final EntityMetadataHydrator<T> hydrator;
  private final ReadPlanner.ReadPlannerConfig plannerConfig;

  public EntityMetadataReads(
      final Schema schema,
      final Hooks<T> hooks,
      final Values<T> values,
      final BiConsumer<String, String> fallback) {
    relationships = EntityReadFactory.relationships(schema.type(), schema.collection());
    final var bundles =
        new ReadBundleAccess(schema.type(), ReadBundleContext::getCurrent, fallback);
    fields =
        EntityReadFactory.relationshipFields(
            schema.type(), schema.fields(), relationships, bundles);
    batch = EntityReadFactory.batchReferences(schema.collection());
    access = EntityReadFactory.accessMetadata(schema.collection());
    fieldTags = EntityReadFactory.fieldTags(schema.collection());
    bulk = EntityReadFactory.bulkRelationships(schema.type(), schema.fields(), schema.collection());
    votes = votes(schema, bundles);
    hydrator = hydrator(hooks, values);
    plannerConfig = plannerConfig(schema);
  }

  private EntityVoteReader<T> votes(final Schema schema, final ReadBundleAccess bundles) {
    return new EntityVoteReader<>(
        schema.fields().contains(FIELD_VOTES),
        new EntityVoteReader.Queries(
            id ->
                relationships.fromRecords(
                    new EntityRelationshipReader.Selection(
                        id, schema.type(), Relationship.VOTED, USER)),
            ids ->
                schema
                    .collection()
                    .relationshipDAO()
                    .findFromBatch(ids, Relationship.VOTED.ordinal(), USER, ALL)),
        new EntityVoteReader.References(
            EntityUtil::getEntityReferences,
            ids -> Entity.getEntityReferencesByIds(USER, ids, NON_DELETED)),
        bundles::votes);
  }

  private EntityMetadataHydrator<T> hydrator(final Hooks<T> hooks, final Values<T> values) {
    return new EntityMetadataHydrator<>(
        new EntityMetadataHydrator.CoreReferences<>(
            fields::owners, hooks.domains(), fields::dataProducts, fields::dataContract),
        new EntityMetadataHydrator.AccessReferences<>(
            fields::followers, hooks.children(), fields::experts, fields::reviewers),
        new EntityMetadataHydrator.Values<>(
            values.tags(), values.certification(), values.extensions(), votes::read),
        hooks.fields());
  }

  private static ReadPlanner.ReadPlannerConfig plannerConfig(final Schema schema) {
    final Set<String> supported = schema.fields();
    return new ReadPlanner.ReadPlannerConfig(
        schema.type(),
        supported.contains(FIELD_OWNERS),
        supported.contains(FIELD_DOMAINS),
        supported.contains(FIELD_FOLLOWERS),
        supported.contains(FIELD_REVIEWERS),
        supported.contains(FIELD_DATA_PRODUCTS),
        supported.contains(FIELD_EXPERTS),
        supported.contains(FIELD_EXTENSION),
        supported.contains(FIELD_TAGS),
        supported.contains(FIELD_VOTES));
  }

  public EntityRelationshipReader relationships() {
    return relationships;
  }

  public EntityRelationshipFields fields() {
    return fields;
  }

  public EntityBatchReferenceReader batch() {
    return batch;
  }

  public EntityAccessMetadataReader access() {
    return access;
  }

  public EntityFieldTagReader fieldTags() {
    return fieldTags;
  }

  public BulkRelationshipLoader bulk() {
    return bulk;
  }

  public EntityVoteReader<T> votes() {
    return votes;
  }

  public EntityMetadataHydrator<T> hydrator() {
    return hydrator;
  }

  public ReadPlanner.ReadPlannerConfig plannerConfig() {
    return plannerConfig;
  }
}
