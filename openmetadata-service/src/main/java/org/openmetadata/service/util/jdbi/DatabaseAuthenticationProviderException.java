package org.openmetadata.service.util.jdbi;

/** Database authentication provider exception responsible to all generic exception thrown by this layer. */
public class DatabaseAuthenticationProviderException extends RuntimeException {
  public DatabaseAuthenticationProviderException() {}

  public DatabaseAuthenticationProviderException(String message) {
    super(message);
  }

  public DatabaseAuthenticationProviderException(String message, Throwable cause) {
    super(message, cause);
  }

  public DatabaseAuthenticationProviderException(Throwable cause) {
    super(cause);
  }

  public DatabaseAuthenticationProviderException(
      String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
    super(message, cause, enableSuppression, writableStackTrace);
  }
}
