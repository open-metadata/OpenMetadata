package org.openmetadata.it.perf;

import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Checks;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.utils.JsonUtils;

/** Uses an actual exported template to keep import fields identical between server versions. */
final class EntityBenchmarkCsvWorkloads {
  private enum Mode {
    EXPORT("export"),
    UNCHANGED("import.unchanged"),
    CHANGED("import.changed"),
    DRY_RUN("import.dry_run");

    private final String suffix;

    Mode(final String suffix) {
      this.suffix = suffix;
    }
  }

  private record Content(String original, String changed) {}

  private EntityBenchmarkCsvWorkloads() {}

  static List<Workload> create(final CreateTable template, final int columns, final String csv)
      throws IOException {
    final var content = new Content(csv, withDescriptions(csv));
    return Arrays.stream(Mode.values())
        .map(mode -> workload(template, columns, content, mode))
        .toList();
  }

  private static Workload workload(
      final CreateTable template, final int columns, final Content content, final Mode mode) {
    final String name = "csv." + mode.suffix + "." + columns;
    final CreateTable create =
        JsonUtils.deepCopy(template, CreateTable.class)
            .withName(name.replace('.', '_') + "_${sequence}");
    final String path = "/v1/tables/name/" + create.getDatabaseSchema() + "." + create.getName();
    return new Workload(
        name,
        List.of(Request.json("POST", "/v1/tables", JsonUtils.pojoToJson(create), 201)),
        request(path, content, mode),
        Checks.forCsv(columns));
  }

  private static Request request(final String path, final Content content, final Mode mode) {
    return mode == Mode.EXPORT
        ? Request.json("GET", path + "/export", null, 200)
        : new Request(
            "PUT",
            path + "/import?dryRun=" + (mode == Mode.DRY_RUN),
            Map.of("Content-Type", "text/plain"),
            mode == Mode.UNCHANGED ? content.original() : content.changed(),
            200);
  }

  private static String withDescriptions(final String csv) throws IOException {
    final var output = new StringWriter();
    try (var parser = CSVFormat.RFC4180.parse(new StringReader(csv));
        var printer = new CSVPrinter(output, CSVFormat.RFC4180)) {
      final var rows = parser.getRecords();
      printRows(printer, rows);
    }
    return output.toString();
  }

  private static void printRows(final CSVPrinter printer, final List<CSVRecord> rows)
      throws IOException {
    final List<String> headers = rows.getFirst().toList();
    final int description = headers.indexOf("column.description");
    if (description < 0) throw new IllegalArgumentException("CSV template is missing description");
    printer.printRecord(headers);
    for (final var row : rows.subList(1, rows.size())) {
      final List<String> values = new ArrayList<>(row.toList());
      values.set(description, "Imported description");
      printer.printRecord(values);
    }
  }
}
