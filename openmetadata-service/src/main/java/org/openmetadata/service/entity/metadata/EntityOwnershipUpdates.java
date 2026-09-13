package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;

/** Reconciles local ownership while retaining PUT, bot, inheritance and import rules. */
public final class EntityOwnershipUpdates<T extends EntityInterface> {
  public interface Session<T extends EntityInterface> {
    boolean isPut();

    boolean isPatch();

    boolean updatedByBot();

    boolean isOverrideMetadata();

    boolean updatingBotDeniedOperation(MetadataOperation operation);

    boolean recordReferenceChanges(String field, ListChange<EntityReference> values);

    void updateOwners(T entity, List<EntityReference> original, List<EntityReference> updated);

    void updateDomains(T entity, List<EntityReference> original, List<EntityReference> updated);
  }

  private enum Field {
    OWNERS(FIELD_OWNERS, EntityInterface::getOwners, EntityInterface::setOwners),
    DOMAINS(FIELD_DOMAINS, EntityInterface::getDomains, EntityInterface::setDomains);

    private final String name;
    private final Function<EntityInterface, List<EntityReference>> get;
    private final BiConsumer<EntityInterface, List<EntityReference>> set;

    Field(
        final String name,
        final Function<EntityInterface, List<EntityReference>> get,
        final BiConsumer<EntityInterface, List<EntityReference>> set) {
      this.name = name;
      this.get = get;
      this.set = set;
    }
  }

  private record Update<T extends EntityInterface>(
      T original, T updated, Field field, ListChange<EntityReference> values) {
    private Update(final T original, final T updated, final Field field) {
      this(
          original,
          updated,
          field,
          new ListChange<>(
              localReferences(field.get.apply(original)),
              localReferences(field.get.apply(updated)),
              new ArrayList<>(),
              new ArrayList<>(),
              entityReferenceMatch));
    }
  }

  public void updateOwners(final Session<T> session, final T original, final T updated) {
    if (preserveUserOwners(session, original)) {
      updated.setOwners(original.getOwners());
    } else {
      reconcile(session, new Update<>(original, updated, Field.OWNERS), false);
    }
  }

  private boolean preserveUserOwners(final Session<T> session, final T original) {
    return session.updatedByBot()
        && !nullOrEmpty(original.getOwners())
        && !session.isOverrideMetadata()
        && session.updatingBotDeniedOperation(MetadataOperation.EDIT_OWNERS);
  }

  public void updateOwnersForImport(final Session<T> session, final T original, final T updated) {
    reconcile(session, new Update<>(original, updated, Field.OWNERS), true);
  }

  public void updateDomains(final Session<T> session, final T original, final T updated) {
    final Update<T> update = new Update<>(original, updated, Field.DOMAINS);
    if (session.isPut() && !nullOrEmpty(original.getDomains()) && session.updatedByBot()) {
      updated.setDomains(original.getDomains());
    } else {
      reconcile(session, update, false);
    }
  }

  public void updateDomainsForImport(final Session<T> session, final T original, final T updated) {
    reconcile(session, new Update<>(original, updated, Field.DOMAINS), true);
  }

  private void reconcile(
      final Session<T> session, final Update<T> update, final boolean importing) {
    final ListChange<EntityReference> values = update.values();
    if ((importing || session.isPatch() || !values.updated().isEmpty())
        && session.recordReferenceChanges(update.field().name, values)) {
      persist(session, update);
      update.field().set.accept(update.updated(), values.updated());
    } else {
      update
          .field()
          .set
          .accept(
              update.updated(),
              importing && update.field() == Field.OWNERS
                  ? values.original()
                  : update.field().get.apply(update.original()));
    }
  }

  private void persist(final Session<T> session, final Update<T> update) {
    switch (update.field()) {
      case OWNERS -> session.updateOwners(
          update.original(), update.values().original(), update.values().updated());
      case DOMAINS -> session.updateDomains(
          update.original(), update.values().original(), update.values().updated());
    }
  }

  public static List<EntityReference> localReferences(final List<EntityReference> references) {
    return listOrEmpty(references).stream()
        .filter(reference -> !Boolean.TRUE.equals(reference.getInherited()))
        .collect(Collectors.toList());
  }
}
