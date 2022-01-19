package org.openmetadata.catalog.exception;

public class EntityTypeNotFoundExeception extends Exception {

  public EntityTypeNotFoundExeception(String message) {
    super(message);
  }

  public static EntityTypeNotFoundExeception message(String message) {
    return new EntityTypeNotFoundExeception(message);
  }
}
