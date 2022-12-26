/*
 *  Copyright 2021 Collate
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

package org.openmetadata.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.common.utils.CommonUtil.listOf;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.type.csv.CsvImportResult.Status;

class CsvUtilTest {
  private static final List<CsvHeader> CSV_HEADERS;
  private static final String HEADER_STRING = "h1*,h2,h3\r\n";

  static {
    Object[][] headers = {
      {"h1", Boolean.TRUE},
      {"h2", Boolean.FALSE},
      {"h3", Boolean.FALSE}
    };
    CSV_HEADERS = getHeaders(headers);
  }

  @Test
  void test_formatHeader() throws IOException {
    CsvFile csvFile = new CsvFile();
    csvFile.withHeaders(CSV_HEADERS);
    String file = CsvUtil.formatCsv(csvFile);
    assertEquals(HEADER_STRING, file);
  }

  @Test
  void test_validateCsvInvalidHeader() throws IOException {
    String csv = ",h2,h3\r\n"; // Header h1 is missing in the CSV file
    TestCsv testCsv = new TestCsv(CSV_HEADERS);
    CsvImportResult importResult = testCsv.importCsv(csv, true);
    assertEquals(Status.ABORTED, importResult.getStatus());
    assertEquals(1, importResult.getNumberOfRowsProcessed());
    assertNull(importResult.getImportResultsCsv());
    assertEquals(TestCsv.invalidHeader("h1*,h2,h3", ",h2,h3"), importResult.getAbortReason());
  }

  @Test
  void test_validateCsvInvalidRecords() throws IOException {
    // Invalid record 2 - Missing required value in h1
    // Invalid record 3 - Record with only two fields instead of 3
    List<String> records = listOf("h1*,h2,h3", ",2,3", "1,2", "1,2,3");
    String csv = String.join("\r\n", records);

    TestCsv testCsv = new TestCsv(CSV_HEADERS);
    CsvImportResult importResult = testCsv.importCsv(csv, true);
    assertEquals(Status.FAILURE, importResult.getStatus());
    assertEquals(records.size(), importResult.getNumberOfRowsProcessed());
    String[] resultRecords = importResult.getImportResultsCsv().split("\r\n");

    assertEquals(importResult.getNumberOfRowsProcessed(), resultRecords.length);
    assertEquals("status,errors,h1*,h2,h3", resultRecords[0]);
    assertEquals(String.format("failed,\"%s\",,2,3", TestCsv.fieldRequired(1)), resultRecords[1]);
    assertEquals(String.format("failed,\"%s\",1,2", TestCsv.invalidFieldCount(3, 2)), resultRecords[2]);
    assertEquals("success,,1,2,3", resultRecords[3]);
  }

  @Test
  void testQuoteField() {
    // Single string field related tests
    assertEquals("abc", CsvUtil.quoteField("abc")); // Strings without separator is not quoted
    assertEquals("\"a,bc\"", CsvUtil.quoteField("a,bc")); // Strings with separator are quoted

    // List of strings in a field related tests
    assertEquals("abc;def;ghi", CsvUtil.quoteField(listOf("abc", "def", "ghi")));
    assertEquals("\"a;bc\";\"d,ef\";ghi", CsvUtil.quoteField(listOf("a;bc", "d,ef", "ghi")));
  }

  @Test
  void testAddRecord() {
    List<String> expectedRecord = new ArrayList<>();
    List<String> actualRecord = new ArrayList<>();

    // Add string
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addField(actualRecord, null));

    expectedRecord.add("abc");
    assertEquals(expectedRecord, CsvUtil.addField(actualRecord, "abc"));

    // Add list of strings
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addFieldList(actualRecord, null));

    expectedRecord.add("def;ghi");
    assertEquals(expectedRecord, CsvUtil.addFieldList(actualRecord, listOf("def", "ghi")));

    // Add entity reference
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addEntityReference(actualRecord, null)); // Null entity reference

    expectedRecord.add("fqn");
    assertEquals(
        expectedRecord, CsvUtil.addEntityReference(actualRecord, new EntityReference().withFullyQualifiedName("fqn")));

    // Add entity references
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addEntityReferences(actualRecord, null)); // Null entity references

    expectedRecord.add("fqn1;fqn2");
    List<EntityReference> refs =
        listOf(
            new EntityReference().withFullyQualifiedName("fqn1"), new EntityReference().withFullyQualifiedName("fqn2"));
    assertEquals(expectedRecord, CsvUtil.addEntityReferences(actualRecord, refs));

    // Add tag labels
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addTagLabels(actualRecord, null)); // Null entity references

    expectedRecord.add("t1;t2");
    List<TagLabel> tags = listOf(new TagLabel().withTagFQN("t1"), new TagLabel().withTagFQN("t2"));
    assertEquals(expectedRecord, CsvUtil.addTagLabels(actualRecord, tags));
  }

  private static List<CsvHeader> getHeaders(Object[][] headers) {
    List<CsvHeader> csvHeaders = new ArrayList<>();
    for (Object[] header : headers) {
      csvHeaders.add(new CsvHeader().withName((String) header[0]).withRequired((Boolean) header[1]));
    }
    return csvHeaders;
  }

  private static class TestCsv extends EntityCsv<EntityInterface> {

    protected TestCsv(List<CsvHeader> csvHeaders) {
      super(csvHeaders);
    }

    @Override
    protected EntityInterface toEntity(CSVPrinter resultsPrinter, CSVRecord record) {
      return new Table(); // Return a random entity to mark successfully processing a record
    }

    @Override
    protected List<String> toRecord(EntityInterface entity) {
      return null;
    }
  }
}
