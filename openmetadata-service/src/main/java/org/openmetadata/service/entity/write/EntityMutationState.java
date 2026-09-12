package org.openmetadata.service.entity.write;

import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;

/** Mutable state owned by one update, shared by its diff, retry and persistence components. */
public interface EntityMutationState<T extends EntityInterface> {
  T getOriginal();

  void setOriginal(T original);

  T getUpdated();

  void setUpdated(T updated);

  T getPrevious();

  void setPrevious(T previous);

  ChangeDescription getChangeDescription();

  void setChangeDescription(ChangeDescription changes);

  ChangeDescription getIncrementalChangeDescription();

  void setIncrementalChangeDescription(ChangeDescription changes);

  Set<String> getPatchedFields();

  void setPatchedFields(Set<String> fields);

  boolean isEntityChanged();

  void setEntityChanged(boolean changed);

  boolean isVersionChanged();

  void setVersionChanged(boolean changed);

  boolean isEntityStored();

  void setEntityStored(boolean stored);

  boolean isMajorVersionChange();

  void setMajorVersionChange(boolean major);
}
