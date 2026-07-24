/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.ontology;

import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.io.StringReader;
import java.util.List;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.api.data.OntologyBulkRowError;

final class OntologyBulkCsvParser {
  static final String ACTION_HEADER = "action";
  static final String TERM_ID_HEADER = "termId";
  static final String NAME_HEADER = "name";
  static final String DISPLAY_NAME_HEADER = "displayName";
  static final String DESCRIPTION_HEADER = "description";
  static final String PARENT_ID_HEADER = "parentId";
  static final String IRI_HEADER = "iri";
  static final String ROOT_PARENT = "__ROOT__";
  static final List<String> HEADERS =
      List.of(
          ACTION_HEADER,
          TERM_ID_HEADER,
          NAME_HEADER,
          DISPLAY_NAME_HEADER,
          DESCRIPTION_HEADER,
          PARENT_ID_HEADER,
          IRI_HEADER);
  private static final Set<String> HEADER_SET = Set.copyOf(HEADERS);

  ParsedCsv parse(final String csv) {
    try (CSVParser parser = parser(csv)) {
      final List<CSVRecord> records = parser.getRecords();
      final OntologyBulkRowError headerError = headerError(parser.getHeaderNames());
      final ParsedCsv parsed =
          headerError == null
              ? new ParsedCsv(
                  records.size(),
                  records.stream().map(OntologyBulkCsvParser::row).toList(),
                  List.of())
              : new ParsedCsv(records.size(), List.of(), List.of(headerError));
      return parsed;
    } catch (IOException exception) {
      throw new BadRequestException("Unable to parse ontology bulk CSV", exception);
    }
  }

  private static CSVParser parser(final String csv) throws IOException {
    final CSVFormat format =
        CSVFormat.DEFAULT
            .builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .setIgnoreEmptyLines(true)
            .setTrim(true)
            .build();
    return CSVParser.parse(new StringReader(csv), format);
  }

  private static OntologyBulkRowError headerError(final List<String> headers) {
    final boolean isInvalid =
        !headers.contains(ACTION_HEADER)
            || headers.stream().anyMatch(header -> !HEADER_SET.contains(header));
    final OntologyBulkRowError error =
        isInvalid
            ? new OntologyBulkRowError()
                .withRowNumber(1)
                .withCode(OntologyBulkErrorCode.INVALID_HEADER)
                .withMessage("CSV headers must be selected from " + HEADERS)
            : null;
    return error;
  }

  private static CsvRow row(final CSVRecord record) {
    return new CsvRow(
        Math.toIntExact(record.getRecordNumber() + 1),
        value(record, ACTION_HEADER),
        value(record, TERM_ID_HEADER),
        value(record, NAME_HEADER),
        value(record, DISPLAY_NAME_HEADER),
        value(record, DESCRIPTION_HEADER),
        value(record, PARENT_ID_HEADER),
        value(record, IRI_HEADER));
  }

  private static String value(final CSVRecord record, final String header) {
    final String value =
        record.isMapped(header) && record.isSet(header) ? record.get(header).trim() : "";
    return value;
  }

  record ParsedCsv(int totalRows, List<CsvRow> rows, List<OntologyBulkRowError> errors) {
    ParsedCsv {
      rows = List.copyOf(rows);
      errors = List.copyOf(errors);
    }
  }

  record CsvRow(
      int rowNumber,
      String action,
      String termId,
      String name,
      String displayName,
      String description,
      String parentId,
      String iri) {}
}
