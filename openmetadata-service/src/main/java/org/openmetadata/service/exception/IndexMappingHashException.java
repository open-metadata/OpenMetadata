package org.openmetadata.service.exception;

/**
 * Exception thrown when computing hash for index mappings fails.
 * This typically indicates a critical system error since MD5 should always be available in Java.
 */
public class IndexMappingHashException extends Exception {

  public IndexMappingHashException(String message) {
    super(message);
  }

  public IndexMappingHashException(String message, Throwable cause) {
    super(message, cause);
  }
}
