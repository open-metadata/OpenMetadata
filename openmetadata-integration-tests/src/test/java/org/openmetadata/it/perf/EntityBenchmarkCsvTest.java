package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.StringReader;
import org.apache.commons.csv.CSVFormat;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.perf.EntityBenchmarkHttp.Reply;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Checks;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.schema.api.data.CreateTable;

class EntityBenchmarkCsvTest {
  private static final String CSV =
      "column.name*,column.displayName,column.description,column.dataTypeDisplay,column.dataType,column.arrayDataType,column.dataLength,column.tags,column.glossaryTerms\r\n"
          + "column,\"Display, name\",\"Old\ndescription\",int,INT,,0,,\r\n";

  @Test
  void importFixturesChangeOnlyDescriptionsAndRetainQuotedCsvFields() throws Exception {
    final var workloads =
        EntityBenchmarkCsvWorkloads.create(
            new CreateTable().withDatabaseSchema("service.database.schema"), 1, CSV);
    final var changed =
        workloads.stream()
            .filter(workload -> workload.name().equals("csv.import.changed.1"))
            .findFirst()
            .orElseThrow();
    final var unchanged =
        workloads.stream()
            .filter(workload -> workload.name().equals("csv.import.unchanged.1"))
            .findFirst()
            .orElseThrow();
    assertEquals(CSV, unchanged.request().body());
    assertEquals("text/plain", changed.request().headers().get("Content-Type"));
    try (var parser = CSVFormat.RFC4180.parse(new StringReader(changed.request().body()))) {
      final var rows = parser.getRecords();
      assertEquals(2, rows.size());
      assertEquals("Display, name", rows.get(1).get(1));
      assertEquals("Imported description", rows.get(1).get(2));
      assertEquals("INT", rows.get(1).get(4));
      assertEquals("", rows.get(1).get(8));
    }
  }

  @Test
  void csvValidationRejectsPartialImportsAndIncompleteExports() {
    final var checks = Checks.forCsv(1);
    final Request importing = Request.json("PUT", "/import", CSV, 200);
    final Request exporting = Request.json("GET", "/export", null, 200);
    final String success =
        "{\"status\":\"success\",\"numberOfRowsProcessed\":1,\"numberOfRowsPassed\":1,\"numberOfRowsFailed\":0,\"dryRun\":false}";
    assertTrue(new Reply(200, 0, success).succeeds(importing, checks));
    assertFalse(new Reply(200, 0, success).succeeds(importing, Checks.forCsv(2)));
    assertFalse(
        new Reply(200, 0, success.replace("success", "partialSuccess"))
            .succeeds(importing, checks));
    assertTrue(new Reply(200, 0, CSV).succeeds(exporting, checks));
    assertFalse(new Reply(200, 0, "name,description\r\n").succeeds(exporting, checks));
    assertFalse(new Reply(200, 0, "name,description\r\ncolumn\r\n").succeeds(exporting, checks));
  }
}
