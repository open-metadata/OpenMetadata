package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListDiff;

/** Reconciles local ownership while retaining PUT, bot, inheritance and import rules. */
public final class EntityOwnershipUpdates<T extends EntityInterface> {
  public interface Session<T extends EntityInterface> {
    boolean isPut();

    boolean isPatch();

    boolean updatedByBot();

    boolean isOverrideMetadata();

    boolean updatingBotDeniedOperation(MetadataOperation operation);

    boolean shouldCompare(String field);

    ChangeDescription getChangeDescription();

    void updateOwners(T entity, List<EntityReference> original, List<EntityReference> updated);

    void updateDomains(T entity, List<EntityReference> original, List<EntityReference> updated);
  }

  enum Policy {
    KEEP,
    PUT,
    PATCH,
    IMPORT_OWNERS
  }

  record Decision(ListDiff<EntityReference> change, List<EntityReference> result) {
    static Decision between(
        final List<EntityReference> original,
        final List<EntityReference> requested,
        final Policy policy,
        final boolean selected) {
      final List<EntityReference> localOriginal = localReferences(original);
      final List<EntityReference> localRequested = localReferences(requested);
      final List<EntityReference> fallback =
          policy == Policy.IMPORT_OWNERS ? localOriginal : original;
      final ListDiff<EntityReference> change =
          selected && policy != Policy.KEEP && (policy != Policy.PUT || !localRequested.isEmpty())
              ? EntityChangeRecorder.diffList(
                  new ListChange<>(
                      localOriginal,
                      localRequested,
                      new ArrayList<>(),
                      new ArrayList<>(),
                      entityReferenceMatch))
              : null;
      return new Decision(change, change != null && change.changed() ? localRequested : fallback);
    }

    boolean changed() {
      return change != null && change.changed();
    }
  }

  public void updateOwners(
      final Session<T> session, final T original, final T updated, final boolean importing) {
    if (!importing
        && session.updatedByBot()
        && !nullOrEmpty(original.getOwners())
        && !session.isOverrideMetadata()
        && session.updatingBotDeniedOperation(MetadataOperation.EDIT_OWNERS)) {
      updated.setOwners(original.getOwners());
    } else {
      final Policy policy =
          importing ? Policy.IMPORT_OWNERS : session.isPatch() ? Policy.PATCH : Policy.PUT;
      final Decision decision =
          reconcile(session, original.getOwners(), updated.getOwners(), FIELD_OWNERS, policy);
      if (decision.changed()) {
        session.updateOwners(original, decision.change().values().original(), decision.result());
      }
      updated.setOwners(decision.result());
    }
  }

  public void updateDomains(
      final Session<T> session, final T original, final T updated, final boolean importing) {
    final Policy policy =
        importing || session.isPatch()
            ? Policy.PATCH
            : session.isPut() && !nullOrEmpty(original.getDomains()) && session.updatedByBot()
                ? Policy.KEEP
                : Policy.PUT;
    final Decision decision =
        reconcile(session, original.getDomains(), updated.getDomains(), FIELD_DOMAINS, policy);
    if (decision.changed()) {
      session.updateDomains(original, decision.change().values().original(), decision.result());
    }
    updated.setDomains(decision.result());
  }

  private Decision reconcile(
      final Session<T> session,
      final List<EntityReference> original,
      final List<EntityReference> updated,
      final String field,
      final Policy policy) {
    final Decision decision =
        Decision.between(original, updated, policy, session.shouldCompare(field));
    if (decision.changed()) {
      EntityChangeRecorder.recordList(session.getChangeDescription(), field, decision.change());
    }
    return decision;
  }

  public static List<EntityReference> localReferences(final List<EntityReference> references) {
    final List<EntityReference> local = new ArrayList<>();
    for (final EntityReference reference : listOrEmpty(references)) {
      if (!Boolean.TRUE.equals(reference.getInherited())) {
        local.add(reference);
      }
    }
    return local;
  }
}
