package org.openmetadata.service.entity.bulk;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.io.StringWriter;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.schema.type.csv.CsvImportResult;

/** Retains CSV outcomes and identifying names without repeating imported metadata in history. */
@Slf4j
public final class CsvImportSummary {
  private static final String STATUS = "status";
  private static final String DETAILS = "details";
  private static final String NAME = "name";

  private CsvImportSummary() {}

  public static CsvImportResult summarize(final CsvImportResult original) {
    final CsvImportResult summary =
        new CsvImportResult()
            .withDryRun(original.getDryRun())
            .withStatus(original.getStatus())
            .withNumberOfRowsProcessed(original.getNumberOfRowsProcessed())
            .withNumberOfRowsPassed(original.getNumberOfRowsPassed())
            .withNumberOfRowsFailed(original.getNumberOfRowsFailed())
            .withAbortReason(original.getAbortReason());
    if (!nullOrEmpty(original.getImportResultsCsv())) {
      summary.setImportResultsCsv(summarizeCsv(original.getImportResultsCsv()));
    }
    return summary;
  }

  private static String summarizeCsv(final String csv) {
    try (var parser = CSVParser.parse(csv, CSVFormat.DEFAULT.withFirstRecordAsHeader())) {
      return printSummary(parser);
    } catch (IOException | IllegalArgumentException exception) {
      LOG.warn("Failed to create lean CSV for change description, returning full CSV", exception);
      return csv;
    }
  }

  private static String printSummary(final CSVParser parser) throws IOException {
    final int nameIndex = findNameColumn(parser.getHeaderNames());
    final StringWriter output = new StringWriter();
    try (var printer =
        new CSVPrinter(output, CSVFormat.DEFAULT.withHeader(STATUS, DETAILS, NAME))) {
      for (final CSVRecord record : parser) {
        final String name =
            nameIndex >= 0 && nameIndex < record.size() ? record.get(nameIndex) : "";
        printer.printRecord(record.get(STATUS), record.get(DETAILS), name);
      }
    }
    return output.toString();
  }

  private static int findNameColumn(final List<String> headers) {
    for (int index = 0; index < headers.size(); index++) {
      if (headers.get(index).toLowerCase(Locale.ROOT).contains(NAME)) {
        return index;
      }
    }
    return -1;
  }
}
