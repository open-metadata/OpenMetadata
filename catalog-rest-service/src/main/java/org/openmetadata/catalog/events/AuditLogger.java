package org.openmetadata.catalog.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.Marker;
import org.slf4j.MarkerFactory;

public final class AuditLogger {

  private static final Marker AUDIT_MARKER = MarkerFactory.getMarker("AUDIT");

  @SuppressWarnings("PMD:LoggerIsNotStaticFinal")
  private final Logger logger;

  private AuditLogger(final Class<?> clazz) {
    logger = LoggerFactory.getLogger(clazz);
  }

  public static AuditLogger getLogger(final Class<?> clazz) {
    return new AuditLogger(clazz);
  }

  public void log(final String message) {
    logger.error(AUDIT_MARKER, message);
  }

  public void log(final String format, final Object... arguments) {
    logger.error(AUDIT_MARKER, format, arguments);
  }
}
