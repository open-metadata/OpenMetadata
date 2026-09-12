package org.openmetadata.service.entity.write;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel;

/** Entity rules composed into a mutation's existing state, transaction and retry lifecycle. */
public interface EntitySpecificMutation<T extends EntityInterface> {
  default void update(EntityUpdater<T> mutation, boolean consolidating) {}

  default void reset() {}

  default void domains(EntityUpdater<T> mutation) {
    mutation
        .context
        .metadata()
        .plan()
        .ownership()
        .updateDomains(mutation, mutation.getOriginal(), mutation.getUpdated());
  }

  default void reviewers(EntityUpdater<T> mutation) {
    mutation
        .context
        .metadata()
        .plan()
        .governance()
        .updateReviewers(mutation, mutation.getOriginal(), mutation.getUpdated());
  }

  default void tags(
      EntityUpdater<T> mutation,
      String fqn,
      String field,
      List<TagLabel> original,
      List<TagLabel> updated) {
    mutation.context.metadata().plan().tags().update(mutation, fqn, field, original, updated);
  }

  default boolean consolidate(
      EntityUpdater<T> mutation, T original, T updated, EntityOperation operation) {
    return mutation
            .context
            .execution()
            .consolidation()
            .canConsolidate(
                original, updated, operation.isPatch(), mutation.isUseOptimisticLocking())
        && mutation
            .context
            .execution()
            .consolidation()
            .hasDifferentChangeSource(mutation.getOriginal(), mutation.getChangeSource());
  }

  @SuppressWarnings("unchecked")
  static <E extends EntityInterface> EntitySpecificMutation<E> standard() {
    return (EntitySpecificMutation<E>) Standard.INSTANCE;
  }

  final class Standard {
    private static final EntitySpecificMutation<?> INSTANCE = new EntitySpecificMutation<>() {};

    private Standard() {}
  }
}
