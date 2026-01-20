package org.openmetadata.csv;

import static org.junit.jupiter.api.Assertions.*;

import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.Test;

public class CsvParseTest {

  @Test
  void testParseQuotedFqnWithDot() throws Exception {
    // CSV with service name containing dot - the FQN is quoted as "local.mysql"
    String csv =
        "name*,displayName,description,owner,tags,glossaryTerms,tiers,certification,"
            + "retentionPeriod,sourceUrl,domains,extension,entityType*,fullyQualifiedName,"
            + "column.dataTypeDisplay,column.dataType,column.arrayDataType,column.dataLength,"
            + "storedProcedure.code,storedProcedure.language\r\n"
            + "default,,,,,,,,,,,,database,\"\"\"local.mysql\"\".default\"\r\n"
            + "openmetadata_db,,,,,,,,,,,,databaseSchema,"
            + "\"\"\"local.mysql\"\".default.openmetadata_db\",,,,,,\r\n";

    System.out.println("CSV content:");
    System.out.println(csv);
    System.out.println("---");

    // Test with the exact same configuration as EntityCsv.parse(String, boolean)
    CSVParser parser =
        CSVFormat.DEFAULT
            .withFirstRecordAsHeader()
            .withQuote('"')
            .withIgnoreEmptyLines()
            .parse(new StringReader(csv));

    int count = 0;
    for (CSVRecord record : parser) {
      count++;
      String name = record.get("name*");
      String fqn = record.get("fullyQualifiedName");
      System.out.println("Row " + count + ": name=" + name + ", fqn=" + fqn);
      assertNotNull(name);
      assertNotNull(fqn);
    }

    assertEquals(2, count, "Should parse 2 data rows");
  }

  @Test
  void testParseSimpleQuotedField() throws Exception {
    // Simpler test case with just the problematic field
    String csv = "fqn\r\n\"\"\"local.mysql\"\".default\"\r\n";

    System.out.println("Simple CSV:");
    System.out.println(csv);
    System.out.println("Hex: " + bytesToHex(csv.getBytes()));
    System.out.println("---");

    CSVParser parser =
        CSVFormat.DEFAULT
            .withFirstRecordAsHeader()
            .withQuote('"')
            .withIgnoreEmptyLines()
            .parse(new StringReader(csv));

    for (CSVRecord record : parser) {
      String fqn = record.get("fqn");
      System.out.println("Parsed FQN: " + fqn);
      assertEquals("\"local.mysql\".default", fqn);
    }
  }

  @Test
  void testParseActualExportedFile() throws Exception {
    // Read the actual exported file
    Path filePath = Path.of("/Users/harsha/Downloads/_local.mysql__2026-01-11T10_00_37.617.csv");
    if (!Files.exists(filePath)) {
      System.out.println("Skipping test - file not found: " + filePath);
      return;
    }

    String csv = Files.readString(filePath);
    System.out.println("File size: " + csv.length() + " characters");
    System.out.println("First 500 chars: " + csv.substring(0, Math.min(500, csv.length())));
    System.out.println("---");

    // Test with the exact same configuration as EntityCsv.parse(String, boolean)
    CSVParser parser =
        CSVFormat.DEFAULT
            .withFirstRecordAsHeader()
            .withQuote('"')
            .withIgnoreEmptyLines()
            .parse(new StringReader(csv));

    int count = 0;
    for (CSVRecord record : parser) {
      count++;
      if (count <= 5) {
        String name = record.get("name*");
        String fqn = record.get("fullyQualifiedName");
        System.out.println("Row " + count + ": name=" + name + ", fqn=" + fqn);
      }
    }

    System.out.println("Total rows parsed: " + count);
    assertTrue(count > 0, "Should parse at least one row");
  }

  private static String bytesToHex(byte[] bytes) {
    StringBuilder sb = new StringBuilder();
    for (byte b : bytes) {
      sb.append(String.format("%02x ", b));
    }
    return sb.toString();
  }
}
