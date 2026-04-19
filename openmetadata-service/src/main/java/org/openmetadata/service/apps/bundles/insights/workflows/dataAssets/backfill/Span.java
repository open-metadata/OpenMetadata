package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import java.time.LocalDate;
import org.openmetadata.schema.EntityInterface;

public record Span(
    LocalDate startDay, LocalDate endDay, EntityInterface currentEntity, String extensionKey) {

  public Span {
    if (startDay.isAfter(endDay)) {
      throw new IllegalArgumentException(
          "startDay %s must not be after endDay %s".formatted(startDay, endDay));
    }
  }

  public Span withStartDay(LocalDate newStartDay) {
    return new Span(newStartDay, endDay, currentEntity, extensionKey);
  }
}
