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

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;

/**
 * HierarchyCSVImporter provides utilities for recursive import/export of hierarchical database entities
 * (database service, database, schema, table, stored procedure) with special handling for column-level details.
 */
public class HierarchyCSVImporter {

  // Fields that should be empty at database, schema, table, and stored procedure levels
  // These fields should only be filled at the column level
  private static final List<String> EMPTY_AT_ENTITY_LEVEL =
      List.of("owner", "domain", "extension", "retentionPeriod", "tiers");

  // Fields that should be empty at column level
  private static final List<String> EMPTY_AT_COLUMN_LEVEL =
      List.of(
          // Currently no specific fields need to be empty at column level
          );

  private HierarchyCSVImporter() {}

  public static List<String> addEntityRecordWithEmptyFields(
      CsvFile csvFile,
      List<String> record,
      List<CsvHeader> csvHeaders,
      String entityType,
      boolean isColumn) {

    List<String> orderedRecord = new ArrayList<>(csvHeaders.size());
    for (int i = 0; i < csvHeaders.size(); i++) {
      orderedRecord.add(""); // Initialize all fields as empty
    }

    for (int i = 0; i < Math.min(record.size(), orderedRecord.size()); i++) {
      if (record.get(i) != null) {
        orderedRecord.set(i, record.get(i));
      }
    }
    for (int i = 0; i < csvHeaders.size(); i++) {
      String headerName = csvHeaders.get(i).getName();

      if (!isColumn && EMPTY_AT_ENTITY_LEVEL.contains(headerName)) {
        orderedRecord.set(i, "");
      } else if (isColumn && EMPTY_AT_COLUMN_LEVEL.contains(headerName)) {
        orderedRecord.set(i, "");
      }
    }

    // Add the processed record to the CSV file
    List<List<String>> records = csvFile.getRecords();
    if (records == null) {
      records = new ArrayList<>();
      csvFile.withRecords(records);
    }
    records.add(orderedRecord);

    return orderedRecord;
  }


  public static List<String> createBaseRecord(String entityType, String fullyQualifiedName) {
    List<String> record = new ArrayList<>();
    record.add(entityType); // entityType field
    record.add(fullyQualifiedName); // fullyQualifiedName field
    return record;
  }

  public static boolean isColumnRecord(CSVRecord csvRecord, int entityTypeIndex)
      throws IOException {
    if (entityTypeIndex < 0 || entityTypeIndex >= csvRecord.size()) {
      return false;
    }

    String entityType = csvRecord.get(entityTypeIndex);
    return "column".equals(entityType);
  }

  public static String getEntityType(CSVRecord csvRecord, int entityTypeIndex) throws IOException {
    if (entityTypeIndex < 0 || entityTypeIndex >= csvRecord.size()) {
      return null;
    }
    return csvRecord.get(entityTypeIndex);
  }
}
