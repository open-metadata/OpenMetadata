package org.openmetadata.catalog;

import org.openmetadata.catalog.type.EntityReference;

public interface CreateEntity {
  String getName();

  String getDisplayName();

  String getDescription();

  default EntityReference getOwner() {
    return null;
  }

  default Object getExtension() {
    return null;
  };

  <K extends CreateEntity> K withName(String name);

  <K extends CreateEntity> K withDisplayName(String displayName);

  <K extends CreateEntity> K withDescription(String description);

  default <K extends CreateEntity> K withOwner(EntityReference owner) {
    return (K) this;
  }

  default <K extends CreateEntity> K withExtension(Object extension) {
    return (K) this;
  };
}
