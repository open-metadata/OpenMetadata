package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;

public record SpanBuilder(
    EntityInterface currentEntity,
    List<VersionRecord> versions,
    LocalDate createdAt,
    LocalDate windowStart,
    LocalDate windowEnd) {

  public List<Span> build() {
    if (versions.isEmpty()) {
      // Route through clippedToCreation so entities created after the window produce 0 spans.
      return clippedToCreation(List.of(new Span(windowStart, windowEnd, currentEntity, null)));
    }

    List<Span> spans = new ArrayList<>();
    LocalDate pointer = windowEnd;

    for (VersionRecord ver : versions) {
      LocalDate changeDay = toLocalDate(ver.updatedAt());

      if (changeDay.isAfter(pointer)) continue;
      if (changeDay.isBefore(windowStart)) break;

      // Post-change span: changeDay → pointer uses currentEntity for the first
      // (most recent) span, and the prior extensionKey for older ones.
      EntityInterface spanEntity = spans.isEmpty() ? currentEntity : null;
      String spanKey = spans.isEmpty() ? null : ver.extensionKey();
      spans.add(new Span(changeDay, pointer, spanEntity, spanKey));

      pointer = changeDay.minusDays(1);
    }

    // Pre-all-changes span: windowStart → pointer.
    // If no within-window changes were recorded (spans is empty), the entity didn't
    // change during the window, so current state applies for the whole window.
    // Otherwise, the oldest within-window version's extensionKey applies.
    if (!pointer.isBefore(windowStart)) {
      if (spans.isEmpty()) {
        spans.add(new Span(windowStart, pointer, currentEntity, null));
      } else {
        String oldestKey = versions.get(versions.size() - 1).extensionKey();
        spans.add(new Span(windowStart, pointer, null, oldestKey));
      }
    }

    return clippedToCreation(spans);
  }

  private Span singleSpan(EntityInterface entity, String extensionKey) {
    LocalDate start = createdAt.isAfter(windowStart) ? createdAt : windowStart;
    return new Span(start, windowEnd, entity, extensionKey);
  }

  private List<Span> clippedToCreation(List<Span> spans) {
    List<Span> result = new ArrayList<>();
    for (Span span : spans) {
      if (span.endDay().isBefore(createdAt)) continue;
      LocalDate start = span.startDay().isBefore(createdAt) ? createdAt : span.startDay();
      result.add(span.withStartDay(start));
    }
    return result;
  }

  private static LocalDate toLocalDate(long epochMillis) {
    return Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate();
  }
}
