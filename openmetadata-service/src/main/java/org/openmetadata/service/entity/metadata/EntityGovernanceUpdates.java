package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.entity.metadata.EntityOwnershipUpdates.localReferences;
import static org.openmetadata.service.util.EntityUtil.entityReferenceListMatch;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates.References;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates.Target;

/** Reconciles governance fields through the owning updater's change tracking and DAO graph. */
public final class EntityGovernanceUpdates {
  public record Capabilities(
      String type, boolean dataProducts, boolean experts, boolean reviewers, boolean status) {}

  public record Validation(
      Consumer<List<EntityReference>> dataProducts,
      Consumer<List<EntityReference>> users,
      Consumer<List<EntityReference>> reviewers) {}

  public interface LineageMutation {
    void apply(UUID id, String type, List<EntityReference> references);
  }

  public record Lineage(LineageMutation remove, LineageMutation add) {}

  public interface Session extends EntityRelationshipUpdates.Session {
    boolean isPut();

    boolean updatedByBot();

    <K> boolean recordChange(String field, K original, K updated);

    <K> boolean recordChange(
        String field, K original, K updated, boolean jsonValue, BiPredicate<K, K> match);
  }

  private final Capabilities capabilities;
  private final Validation validation;
  private final EntityRelationshipUpdates relationships;
  private final Lineage lineage;
  private final BiConsumer<EntityInterface, String> checkReviewer;

  public EntityGovernanceUpdates(
      final Capabilities capabilities,
      final Validation validation,
      final EntityRelationshipUpdates relationships,
      final Lineage lineage,
      final BiConsumer<EntityInterface, String> checkReviewer) {
    this.capabilities = capabilities;
    this.validation = validation;
    this.relationships = relationships;
    this.lineage = lineage;
    this.checkReviewer = checkReviewer;
  }

  public void updateDataProducts(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (!capabilities.dataProducts()) {
      return;
    }
    final References references =
        new References(
            listOrEmpty(original.getDataProducts()), listOrEmpty(updated.getDataProducts()));
    validation.dataProducts().accept(references.updated());
    if (session.isPut() && !nullOrEmpty(original.getDataProducts()) && session.updatedByBot()) {
      updated.setDataProducts(original.getDataProducts());
    } else {
      reconcileDataProducts(session, original, updated, references);
    }
  }

  private void reconcileDataProducts(
      final Session session,
      final EntityInterface original,
      final EntityInterface updated,
      final References references) {
    if (nullOrEmpty(updated.getDomains()) && !nullOrEmpty(references.updated())) {
      throw new IllegalArgumentException("Domain cannot be empty when data products are provided.");
    }
    final List<EntityReference> current =
        recordDomainChange(session, original, updated, references);
    relationships.incoming(
        session,
        new Target(
            FIELD_DATA_PRODUCTS,
            original.getId(),
            capabilities.type(),
            DATA_PRODUCT,
            Relationship.HAS),
        new References(references.original(), current));
    lineage.remove().apply(original.getId(), capabilities.type(), references.original());
    lineage.add().apply(original.getId(), capabilities.type(), current);
  }

  private List<EntityReference> recordDomainChange(
      final Session session,
      final EntityInterface original,
      final EntityInterface updated,
      final References references) {
    return hasRemovedDomains(original, updated)
            && session.recordChange(
                FIELD_DATA_PRODUCTS,
                references.original(),
                references.updated(),
                true,
                entityReferenceListMatch)
        ? listOrEmpty(updated.getDataProducts())
        : references.updated();
  }

  private boolean hasRemovedDomains(final EntityInterface original, final EntityInterface updated) {
    final List<EntityReference> previous = localReferences(original.getDomains());
    final Set<UUID> currentIds =
        localReferences(updated.getDomains()).stream()
            .map(EntityReference::getId)
            .collect(Collectors.toSet());
    return previous.stream().anyMatch(reference -> !currentIds.contains(reference.getId()));
  }

  public void updateExperts(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (capabilities.experts()) {
      final References references =
          new References(
              localReferences(original.getExperts()), localReferences(updated.getExperts()));
      validation.users().accept(references.updated());
      relationships.outgoing(
          session,
          new Target(
              FIELD_EXPERTS, original.getId(), capabilities.type(), USER, Relationship.EXPERT),
          references,
          false);
      updated.setExperts(references.updated());
    }
  }

  public void updateReviewers(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (capabilities.reviewers()) {
      final References references =
          new References(
              localReferences(original.getReviewers()), localReferences(updated.getReviewers()));
      validation.reviewers().accept(references.updated());
      relationships.incoming(
          session,
          new Target(
              FIELD_REVIEWERS, original.getId(), capabilities.type(), null, Relationship.REVIEWS),
          references);
      updated.setReviewers(references.updated());
    }
  }

  public void updateStatus(
      final Session session,
      final EntityInterface original,
      final EntityInterface updated,
      final boolean consolidatingChanges) {
    if (capabilities.status() && original.getEntityStatus() != updated.getEntityStatus()) {
      if (!consolidatingChanges && requiresReviewer(original, updated)) {
        checkReviewer.accept(original, updated.getUpdatedBy());
      }
      session.recordChange(
          FIELD_ENTITY_STATUS, original.getEntityStatus(), updated.getEntityStatus());
    }
  }

  private boolean requiresReviewer(final EntityInterface original, final EntityInterface updated) {
    return original.getEntityStatus() == EntityStatus.IN_REVIEW
        && (updated.getEntityStatus() == EntityStatus.APPROVED
            || updated.getEntityStatus() == EntityStatus.REJECTED);
  }
}
