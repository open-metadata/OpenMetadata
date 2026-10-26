package org.openmetadata.service.events.subscription;

/** The bounds on alert requests, kept in one place so every route and check uses the same ones. */
public final class AlertLimits {

  /** The most rows one alert event listing answers, the same bound as the change event list. */
  public static final int MAX_LISTING_ROWS = 1000;

  public static final String MAX_LISTING_ROWS_MESSAGE =
      "must be less than or equal to " + MAX_LISTING_ROWS;

  private AlertLimits() {}
}
