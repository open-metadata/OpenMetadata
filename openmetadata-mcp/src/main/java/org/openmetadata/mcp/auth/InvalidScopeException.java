package org.openmetadata.mcp.auth;

/**
 * Exception thrown when a requested scope is invalid.
 */
public class InvalidScopeException extends Exception {

  public InvalidScopeException(String message) {
    super(message);
  }
}
