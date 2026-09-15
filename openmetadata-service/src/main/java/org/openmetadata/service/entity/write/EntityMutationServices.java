package org.openmetadata.service.entity.write;

import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_LIFE_CYCLE;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_STYLE;

import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.entity.history.EntityHistoryServices;
import org.openmetadata.service.entity.metadata.ColumnValueUpdater;
import org.openmetadata.service.entity.metadata.EntityCertificationUpdates;
import org.openmetadata.service.entity.metadata.EntityColumnUpdates;
import org.openmetadata.service.entity.metadata.EntityExtensionService;
import org.openmetadata.service.entity.metadata.EntityExtensionUpdater;
import org.openmetadata.service.entity.metadata.EntityGovernanceUpdates;
import org.openmetadata.service.entity.metadata.EntityOwnershipUpdates;
import org.openmetadata.service.entity.metadata.EntityOwnershipWriter;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityTagUpdates;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.metadata.EntityValueUpdates;
import org.openmetadata.service.jdbi3.CollectionDAO;

/** Builds one mutation graph from the entity schema, retained stores and explicit policies. */
public final class EntityMutationServices {
  public record Schema<T extends EntityInterface>(
      String type, Class<T> entityClass, Set<String> fields) {
    public Schema {
      fields = Set.copyOf(fields);
    }
  }

  public record Metadata<T extends EntityInterface>(
      CollectionDAO daos,
      EntityRelationshipUpdates relationships,
      EntityOwnershipWriter<T> ownership,
      EntityTagWriter tags,
      EntityExtensionService extensions) {}

  public record Governance(
      EntityGovernanceUpdates.Validation validation,
      EntityGovernanceUpdates.Lineage lineage,
      BiConsumer<EntityInterface, String> authorizeReview) {}

  public record Certification<T extends EntityInterface>(
      Supplier<AssetCertificationSettings> settings,
      EntityCertificationUpdates.Persistence<T> persistence,
      Supplier<String> classification,
      Consumer<List<TagLabel>> mutuallyExclusive) {}

  public record Policies<T extends EntityInterface>(
      UnaryOperator<String> description,
      UnaryOperator<Object> extension,
      Governance governance,
      Certification<T> certification) {}

  public record Execution<T extends EntityInterface>(
      EntityHistoryServices<T> history,
      EntityMutationLifecycle.Execution<T> transaction,
      BiConsumer<T, T> postUpdate,
      EntityUpdateContext.Hooks<T> hooks,
      Clock clock) {}

  private EntityMutationServices() {}

  public static <T extends EntityInterface> EntityUpdateContext<T> create(
      final Schema<T> schema,
      final Metadata<T> metadata,
      final Policies<T> policies,
      final Execution<T> execution) {
    final EntityMutationPlan<T> plan = mutationPlan(schema, metadata, policies, execution);
    return new EntityUpdateContext<>(
        schema.type(),
        lifecycle(schema, execution),
        new EntityUpdateContext.Metadata<>(
            plan, metadata.relationships(), metadata.ownership(), metadata.tags()),
        execution.hooks(),
        columns(metadata));
  }

  private static <T extends EntityInterface> EntityUpdateContext.Execution<T> lifecycle(
      final Schema<T> schema, final Execution<T> execution) {
    final EntityHistoryServices<T> history = execution.history();
    return new EntityUpdateContext.Execution<>(
        new EntityMutationLifecycle<>(
            schema.entityClass(), execution.transaction(), execution.postUpdate()),
        history.updateWorkflow(),
        history.updateStore(),
        history.consolidation());
  }

  private static <T extends EntityInterface> EntityMutationPlan<T> mutationPlan(
      final Schema<T> schema,
      final Metadata<T> metadata,
      final Policies<T> policies,
      final Execution<T> execution) {
    final var values =
        new EntityMutationPlan.Values<T>(
            new EntityValueUpdates(
                new EntityValueUpdates.Capabilities(
                    schema.type(),
                    schema.fields().contains(FIELD_STYLE),
                    schema.fields().contains(FIELD_LIFE_CYCLE)),
                policies.description()),
            governance(schema, metadata.relationships(), policies.governance()),
            certification(schema, policies.certification(), execution.clock()),
            execution.history().changes());
    final var mutations =
        new EntityMutationPlan.Metadata<T>(
            new EntityOwnershipUpdates<>(),
            new EntityTagUpdates(
                metadata.tags(),
                policies.certification().mutuallyExclusive(),
                policies.certification().classification()),
            new EntityExtensionUpdater<>(
                metadata.extensions()::remove, metadata.extensions()::store, policies.extension()));
    return new EntityMutationPlan<>(values, mutations);
  }

  private static EntityGovernanceUpdates governance(
      final Schema<?> schema,
      final EntityRelationshipUpdates relationships,
      final Governance policy) {
    final Set<String> fields = schema.fields();
    return new EntityGovernanceUpdates(
        new EntityGovernanceUpdates.Capabilities(
            schema.type(),
            fields.contains(FIELD_DATA_PRODUCTS),
            fields.contains(FIELD_EXPERTS),
            fields.contains(FIELD_REVIEWERS),
            fields.contains(FIELD_ENTITY_STATUS)),
        policy.validation(),
        relationships,
        policy.lineage(),
        policy.authorizeReview());
  }

  private static <T extends EntityInterface> EntityCertificationUpdates<T> certification(
      final Schema<T> schema, final Certification<T> policy, final Clock clock) {
    return new EntityCertificationUpdates<>(
        schema.fields().contains(FIELD_CERTIFICATION),
        policy.settings(),
        clock::millis,
        policy.persistence());
  }

  private static EntityUpdateContext.Columns columns(final Metadata<?> metadata) {
    final ColumnValueUpdater values = new ColumnValueUpdater();
    final EntityColumnUpdates updates =
        new EntityColumnUpdates(
            values,
            metadata.extensions(),
            () -> metadata.daos().tagUsageDAO(),
            () -> metadata.daos().entityExtensionDAO());
    return new EntityUpdateContext.Columns(updates, values);
  }
}
