package org.openmetadata.service.entity.write;

import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_LIFE_CYCLE;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_STYLE;
import static org.openmetadata.service.Entity.FIELD_TAGS;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.history.EntityChangeSummary;
import org.openmetadata.service.entity.metadata.EntityCertificationUpdates;
import org.openmetadata.service.entity.metadata.EntityExtensionUpdater;
import org.openmetadata.service.entity.metadata.EntityGovernanceUpdates;
import org.openmetadata.service.entity.metadata.EntityOwnershipUpdates;
import org.openmetadata.service.entity.metadata.EntityTagUpdates;
import org.openmetadata.service.entity.metadata.EntityValueUpdates;

/** Orders shared metadata policies and entity hooks without opening a transaction or loading rows. */
public final class EntityMutationPlan<T extends EntityInterface> {
  public record Values<T extends EntityInterface>(
      EntityValueUpdates fields,
      EntityGovernanceUpdates governance,
      EntityCertificationUpdates<T> certification,
      EntityChangeSummary<T> summary) {}

  public record Metadata<T extends EntityInterface>(
      EntityOwnershipUpdates<T> ownership,
      EntityTagUpdates tags,
      EntityExtensionUpdater<T> extensions) {}

  private final Values<T> values;
  private final Metadata<T> metadata;
  private final EntityMutationPipeline<EntityUpdater<T>> pipeline;

  public EntityMutationPlan(final Values<T> values, final Metadata<T> metadata) {
    this.values = values;
    this.metadata = metadata;
    pipeline =
        new EntityMutationPipeline<>(
            new EntityMutationPipeline.Preparation<>(
                session -> session.operation.isDelete(),
                session -> session.updated.setId(session.original.getId()),
                session ->
                    values.fields().updateDeleted(session, session.original, session.updated),
                EntityUpdater::shouldCompare),
            steps(),
            this::complete);
  }

  public void apply(
      final EntityUpdater<T> session, final boolean importing, final boolean consolidating) {
    pipeline.apply(session, new EntityMutationPipeline.Context(importing, consolidating));
  }

  public void prepareCertification(final T entity) {
    values.certification().prepare(entity);
  }

  private List<EntityMutationPipeline.Step<EntityUpdater<T>>> steps() {
    return List.of(
        new EntityMutationPipeline.Step<>(
            FIELD_DESCRIPTION,
            (s, c) -> values.fields().updateDescription(s, s.original, s.updated)),
        new EntityMutationPipeline.Step<>(
            FIELD_DISPLAY_NAME,
            (s, c) -> values.fields().updateDisplayName(s, s.original, s.updated)),
        new EntityMutationPipeline.Step<>(
            FIELD_ENTITY_STATUS,
            (s, c) ->
                values.governance().updateStatus(s, s.original, s.updated, c.consolidating())),
        new EntityMutationPipeline.Step<>(FIELD_OWNERS, this::owners),
        new EntityMutationPipeline.Step<>(
            FIELD_EXTENSION,
            (s, c) ->
                metadata.extensions().update(s, s.isPut(), s.updatedByBot(), c.consolidating())),
        new EntityMutationPipeline.Step<>(FIELD_TAGS, this::tags),
        new EntityMutationPipeline.Step<>(FIELD_DOMAINS, this::domains),
        new EntityMutationPipeline.Step<>(
            FIELD_DATA_PRODUCTS,
            (s, c) -> values.governance().updateDataProducts(s, s.original, s.updated)),
        new EntityMutationPipeline.Step<>(
            FIELD_EXPERTS, (s, c) -> values.governance().updateExperts(s, s.original, s.updated)),
        new EntityMutationPipeline.Step<>(FIELD_REVIEWERS, (s, c) -> s.updateReviewers()),
        new EntityMutationPipeline.Step<>(
            FIELD_STYLE, (s, c) -> values.fields().updateStyle(s, s.original, s.updated)),
        new EntityMutationPipeline.Step<>(
            FIELD_LIFE_CYCLE, (s, c) -> values.fields().updateLifeCycle(s, s.original, s.updated)),
        new EntityMutationPipeline.Step<>(
            FIELD_CERTIFICATION,
            (s, c) -> values.certification().update(s, s.original, s.updated)));
  }

  private void owners(
      final EntityUpdater<T> session, final EntityMutationPipeline.Context context) {
    if (context.importing()) {
      metadata.ownership().updateOwnersForImport(session, session.original, session.updated);
    } else {
      metadata.ownership().updateOwners(session, session.original, session.updated);
    }
  }

  private void tags(final EntityUpdater<T> session, final EntityMutationPipeline.Context context) {
    if (context.importing()) {
      session.updateTagsForImport(
          session.updated.getFullyQualifiedName(),
          FIELD_TAGS,
          session.original.getTags(),
          session.updated.getTags());
    } else {
      session.updateTags(
          session.updated.getFullyQualifiedName(),
          FIELD_TAGS,
          session.original.getTags(),
          session.updated.getTags());
    }
  }

  private void domains(
      final EntityUpdater<T> session, final EntityMutationPipeline.Context context) {
    if (context.importing()) {
      session.updateDomainsForImport();
    } else {
      session.updateDomains();
    }
  }

  private void complete(
      final EntityUpdater<T> session, final EntityMutationPipeline.Context context) {
    session.entitySpecificUpdate(context.consolidating());
    values
        .summary()
        .update(
            session.original,
            session.updated,
            session.changeDescription,
            session.getChangeSource());
  }

  EntityOwnershipUpdates<T> ownership() {
    return metadata.ownership();
  }

  EntityTagUpdates tags() {
    return metadata.tags();
  }

  EntityGovernanceUpdates governance() {
    return values.governance();
  }
}
