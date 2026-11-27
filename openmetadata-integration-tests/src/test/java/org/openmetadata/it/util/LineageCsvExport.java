package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.StringReader;
import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.awaitility.Awaitility;

/**
 * Runs the lineage CSV export the lineage page runs ({@code /lineage/exportAsync}, one hop
 * downstream) and returns the rows for one edge.
 */
public final class LineageCsvExport {
  private static final String EXPORT_PATH = "/v1/lineage/exportAsync";
  private static final String COMPLETED = "COMPLETED";
  private static final int HTTP_OK = 200;
  private static final int HTTP_RELEASED = 404;
  private static final Duration EXPORT_TIMEOUT = Duration.ofMinutes(3);

  private LineageCsvExport() {}

  public static List<CSVRecord> edgeRows(
      final String fromEntityType, final String fromFqn, final String toFqn) throws IOException {
    return downstreamRows(fromEntityType, fromFqn).stream()
        .filter(
            row -> fromFqn.equals(row.get("fromEntityFQN")) && toFqn.equals(row.get("toEntityFQN")))
        .toList();
  }

  /**
   * The server keeps only the last few export results per user and releases older ones, so under
   * concurrent admin exports a finished job's result can be gone (404) before it is downloaded.
   * Such an export is run again.
   */
  private static List<CSVRecord> downstreamRows(final String entityType, final String fqn)
      throws IOException {
    final String csv =
        Awaitility.await("lineage export of " + fqn)
            .atMost(EXPORT_TIMEOUT)
            .pollInterval(Duration.ofSeconds(1))
            .until(() -> exportOnce(entityType, fqn), Optional::isPresent)
            .orElseThrow();
    try (CSVParser parser =
        CSVFormat.DEFAULT
            .builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .get()
            .parse(new StringReader(csv))) {
      return parser.getRecords();
    }
  }

  private static Optional<String> exportOnce(final String entityType, final String fqn)
      throws IOException, InterruptedException {
    final CsvJobClient jobs = CsvJobClient.onDefaultServer();
    final String jobId =
        jobs.startExport(
            EXPORT_PATH
                + "?type="
                + entityType
                + "&upstreamDepth=0&downstreamDepth=1&fqn="
                + URLEncoder.encode(fqn, StandardCharsets.UTF_8));
    jobs.awaitJobStatus(jobId, COMPLETED);
    final HttpResponse<String> result = jobs.downloadResult(jobId);
    // Only a released result (404) is retried; any other failure fails the test.
    if (result.statusCode() == HTTP_RELEASED) {
      return Optional.empty();
    }
    assertEquals(HTTP_OK, result.statusCode(), "lineage export download of " + fqn);
    return Optional.of(result.body());
  }
}
