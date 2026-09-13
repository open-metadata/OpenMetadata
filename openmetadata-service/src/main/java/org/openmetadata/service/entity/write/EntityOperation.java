package org.openmetadata.service.entity.write;

public enum EntityOperation {
  PUT,
  PATCH,
  SOFT_DELETE;

  public boolean isPatch() {
    return this == PATCH;
  }

  public boolean isPut() {
    return this == PUT;
  }

  public boolean isDelete() {
    return this == SOFT_DELETE;
  }
}
