package org.openmetadata.service.events.subscription;

/** The alert catalog could not be loaded. The message names the file and the entry at fault. */
public class AlertCatalogException extends RuntimeException {

  public AlertCatalogException(String file, String entry, String problem) {
    super(String.format("Alert catalog %s, %s: %s", file, entry, problem));
  }

  public AlertCatalogException(String file, String problem, Throwable cause) {
    super(String.format("Alert catalog %s: %s", file, problem), cause);
  }
}
