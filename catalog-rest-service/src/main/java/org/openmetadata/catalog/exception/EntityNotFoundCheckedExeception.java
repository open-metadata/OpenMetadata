package org.openmetadata.catalog.exception;

public class EntityNotFoundCheckedExeception extends Exception {

  public EntityNotFoundCheckedExeception(String message) {
    super(message);
  }

  public static EntityNotFoundCheckedExeception message(String message) {
    return new EntityNotFoundCheckedExeception(message);
  }
}
