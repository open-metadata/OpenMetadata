package org.openmetadata.service.entity.write;

import com.fasterxml.jackson.databind.util.TokenBuffer;
import java.util.HashSet;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;

/** Replays an update from its original state while preserving the caller's entity identities. */
public final class EntityUpdateSnapshot<T extends EntityInterface> {
  private final Class<T> entityClass;
  private final T original;
  private final T updated;
  private final T previous;
  private final TokenBuffer originalTokens;
  private final TokenBuffer updatedTokens;
  private final Changes changes;
  private final Flags flags;

  public EntityUpdateSnapshot(final EntityMutationState<T> state, final Class<T> entityClass) {
    this.entityClass = entityClass;
    original = state.getOriginal();
    updated = state.getUpdated();
    originalTokens = JsonUtils.toTokenBuffer(original);
    updatedTokens = JsonUtils.toTokenBuffer(updated);
    previous = copy(state.getPrevious());
    changes =
        new Changes(
            copy(state.getChangeDescription()),
            copy(state.getIncrementalChangeDescription()),
            copyFields(state.getPatchedFields()));
    flags =
        new Flags(
            state.isEntityChanged(),
            state.isVersionChanged(),
            state.isEntityStored(),
            state.isMajorVersionChange());
  }

  public void restore(final EntityMutationState<T> state, final boolean restoreEntityContents) {
    restoreEntities(state, restoreEntityContents);
    state.setChangeDescription(copy(changes.consolidated()));
    state.setIncrementalChangeDescription(copy(changes.incremental()));
    state.setPatchedFields(copyFields(changes.patchedFields()));
    state.setEntityChanged(flags.entityChanged());
    state.setVersionChanged(flags.versionChanged());
    state.setEntityStored(flags.entityStored());
    state.setMajorVersionChange(flags.majorVersionChange());
  }

  private void restoreEntities(final EntityMutationState<T> state, final boolean restoreContents) {
    state.setOriginal(original);
    state.setUpdated(updated);
    if (restoreContents) {
      JsonUtils.overwriteFromTokenBuffer(original, originalTokens);
      JsonUtils.overwriteFromTokenBuffer(updated, updatedTokens);
    }
    state.setPrevious(copy(previous));
  }

  private T copy(final T entity) {
    return entity == null ? null : JsonUtils.deepCopy(entity, entityClass);
  }

  private static ChangeDescription copy(final ChangeDescription changes) {
    return changes == null ? null : JsonUtils.deepCopy(changes, ChangeDescription.class);
  }

  private static Set<String> copyFields(final Set<String> fields) {
    return fields == null ? null : new HashSet<>(fields);
  }

  private record Changes(
      ChangeDescription consolidated, ChangeDescription incremental, Set<String> patchedFields) {}

  private record Flags(
      boolean entityChanged,
      boolean versionChanged,
      boolean entityStored,
      boolean majorVersionChange) {}
}
