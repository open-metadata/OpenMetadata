package org.openmetadata.service.jdbi3;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.openmetadata.schema.tests.type.IncidentTrendDirection;

/** The bounded sampling window shared by every incident group in one response. */
public record IncidentGroupTrend(long start, long end) {
  public static final int INTERVALS = 8;
  private static final long WINDOW_MILLIS = Duration.ofDays(7).toMillis();

  public static IncidentGroupTrend endingAt(long timestamp) {
    return new IncidentGroupTrend(Math.max(0, timestamp - WINDOW_MILLIS), timestamp);
  }

  public Map<String, Object> bindings() {
    Map<String, Object> result = new HashMap<>();
    for (int sample = 0; sample <= INTERVALS; sample++) {
      result.put("trendSample" + sample, start + (end - start) * sample / INTERVALS);
    }
    result.put("trendEnd", end);
    return result;
  }

  /** Builds the nine-row time axis shared by every group, with timestamps bound by the caller. */
  public static String samplesSql() {
    return IntStream.rangeClosed(0, INTERVALS)
        .mapToObj(
            sample ->
                "SELECT "
                    + sample
                    + " AS sample, CAST(:trendSample"
                    + sample
                    + " AS DECIMAL(20,0)) AS sampledAt")
        .collect(Collectors.joining(" UNION ALL "));
  }

  public static List<Integer> counts(List<TimeSeriesDAOs.IncidentGroupTrendCount> rows) {
    List<Integer> result = new ArrayList<>(Collections.nCopies(INTERVALS + 1, 0));
    rows.forEach(row -> result.set(row.sample(), row.incidentCount()));
    return List.copyOf(result);
  }

  public static IncidentTrendDirection direction(List<Integer> counts) {
    return switch (Integer.compare(counts.getLast(), counts.getFirst())) {
      case 1 -> IncidentTrendDirection.Rising;
      case -1 -> IncidentTrendDirection.Falling;
      default -> IncidentTrendDirection.Steady;
    };
  }
}
