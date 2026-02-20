package org.openmetadata.service.search.vector.utils;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

public final class AvailableEntityTypes {
  private AvailableEntityTypes() {}

  public static final List<String> LIST =
      List.of(
          "table",
          "glossary",
          "glossaryTerm",
          "chart",
          "dashboard",
          "dashboardDataModel",
          "database",
          "databaseSchema",
          "dataProduct",
          "pipeline",
          "mlmodel",
          "metric",
          "apiEndpoint",
          "apiCollection",
          "page",
          "storedProcedure",
          "searchIndex",
          "topic");

  public static final Set<String> SET =
      LIST.stream().map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());

  public static boolean isVectorIndexable(String entityType) {
    return entityType != null && SET.contains(entityType.toLowerCase(Locale.ROOT));
  }
}
