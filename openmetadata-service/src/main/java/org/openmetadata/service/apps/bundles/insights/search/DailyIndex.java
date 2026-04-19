package org.openmetadata.service.apps.bundles.insights.search;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

public record DailyIndex(String clusterAlias, String entityType, LocalDate date) {

  private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd");

  public String name() {
    String base = "di-data-assets-" + entityType.toLowerCase() + "-" + DATE_FORMAT.format(date);
    return (clusterAlias == null || clusterAlias.isBlank()) ? base : clusterAlias + "-" + base;
  }

  public DailyIndex previous() {
    return new DailyIndex(clusterAlias, entityType, date.minusDays(1));
  }

  public boolean isExpiredBy(LocalDate cutoff) {
    return date.isBefore(cutoff);
  }

  public long startOfDayTimestamp() {
    return date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
  }

  public static DailyIndex parse(String clusterAlias, String entityType, String indexName) {
    LocalDate parsed = LocalDate.parse(indexName.substring(indexName.length() - 10), DATE_FORMAT);
    return new DailyIndex(clusterAlias, entityType, parsed);
  }
}
