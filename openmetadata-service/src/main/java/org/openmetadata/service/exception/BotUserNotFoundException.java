package org.openmetadata.service.exception;

/**
 * A bot whose bot user cannot be resolved. Extends {@link IllegalArgumentException} so existing
 * callers of {@code OpenMetadataConnectionBuilder} keep handling it as before.
 */
public class BotUserNotFoundException extends IllegalArgumentException {
  public BotUserNotFoundException(String message) {
    super(message);
  }
}
