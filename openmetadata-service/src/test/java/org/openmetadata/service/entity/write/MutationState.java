package org.openmetadata.service.entity.write;

import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;

@Getter
@Setter
class MutationState<T extends EntityInterface> implements EntityMutationState<T> {
  private T original;
  private T updated;
  private T previous;
  private ChangeDescription changeDescription;
  private ChangeDescription incrementalChangeDescription;
  private Set<String> patchedFields;
  private boolean entityChanged;
  private boolean versionChanged;
  private boolean entityStored;
  private boolean majorVersionChange;
  private boolean indexBaselinePass = true;

  MutationState(T original, T updated) {
    this.original = original;
    this.updated = updated;
  }
}
