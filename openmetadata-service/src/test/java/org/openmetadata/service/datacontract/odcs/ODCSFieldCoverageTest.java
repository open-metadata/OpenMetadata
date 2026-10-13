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

package org.openmetadata.service.datacontract.odcs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssue;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueSeverity;

class ODCSFieldCoverageTest {
  private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());

  /** Shaped like the contracts customers export from other tools and enrich by hand. */
  private static final String DOCUMENT =
      """
      apiVersion: v3.1.0
      kind: DataContract
      id: 4f5b0c52-9f1e-4e89-a6a4-0e0b7a3a1c11
      name: accounts
      version: 1.0.0
      status: active
      tags: [governed]
      authoritativeDefinitions: []
      schema:
        - name: ACCOUNTS
          physicalName: ACCOUNTS
          logicalType: object
          primaryKey: false
          primaryKeyPosition: -1
          properties:
            - name: region
              businessName: Region
              physicalType: VARCHAR
              logicalType: string
              primaryKeyPosition: -1
              partitioned: false
              logicalTypeOptions:
                maxLength: 64
                defaultTimezone: Etc/UTC
            - name: account_type
              businessName: Account Type
              logicalType: string
              qualityExpectations:
                - name: Known type
            - name: owner
              logicalType: string
              authoritativeDefinitions:
                - url: https://wiki.example.org/owner
                  type: businessDefinition
        - name: HISTORY
          logicalType: object
          properties:
            - name: id
      servers:
        - server: prod
          type: snowflake
      team:
        - username: jdoe
          role: owner
          dateIn: 2024-01-01
      """;

  @Test
  void fieldsWithoutAnEquivalentAreReportedOncePerKey() throws JsonProcessingException {
    ODCSImportIssue businessName = issueFor("businessName");

    assertEquals(ODCSImportIssueSeverity.WARNING, businessName.getSeverity());
    assertEquals(ODCSImportIssueCategory.SCHEMA, businessName.getCategory());
    assertEquals(2, businessName.getOccurrences());
    assertEquals("schema[0].properties[0].businessName", businessName.getPath());
  }

  @Test
  void keysOdcsDoesNotDefineAreReportedAsUnknown() throws JsonProcessingException {
    assertTrue(issueFor("qualityExpectations").getMessage().contains("go under `quality`"));
  }

  @Test
  void logicalTypeOptionsOtherThanMaxLengthAreReported() throws JsonProcessingException {
    assertTrue(issueFor("defaultTimezone").getMessage().contains("maxLength"));
  }

  @Test
  void sectionsOpenMetadataDoesNotModelAreReported() throws JsonProcessingException {
    assertEquals(ODCSImportIssueCategory.SERVERS, issueFor("servers").getCategory());
    assertEquals(ODCSImportIssueCategory.DOCUMENT, issueFor("tags").getCategory());
    assertEquals(ODCSImportIssueCategory.TEAM, issueFor("dateIn").getCategory());
  }

  @Test
  void otherSchemaObjectsAreReportedAsNotImported() throws JsonProcessingException {
    ODCSImportIssue otherObject = issueFor("schema");

    assertTrue(otherObject.getMessage().contains("HISTORY"));
    assertEquals("schema[1]", otherObject.getPath());
  }

  @Test
  void attributesKeptForExportAreInformational() throws JsonProcessingException {
    assertEquals(ODCSImportIssueSeverity.INFO, issueFor("authoritativeDefinitions").getSeverity());
  }

  @Test
  void emptyAndDefaultValuesAreNotReported() throws JsonProcessingException {
    List<String> fields = report().stream().map(ODCSImportIssue::getField).toList();

    assertTrue(!fields.contains("primaryKeyPosition"));
    assertTrue(!fields.contains("partitioned"));
    assertTrue(!fields.contains("primaryKey"));
  }

  @Test
  void mappedFieldsAreNotReported() throws JsonProcessingException {
    List<String> fields = report().stream().map(ODCSImportIssue::getField).toList();

    assertTrue(!fields.contains("maxLength"));
    assertTrue(!fields.contains("physicalType"));
    assertTrue(!fields.contains("username"));
  }

  private static ODCSImportIssue issueFor(String field) throws JsonProcessingException {
    return report().stream()
        .filter(issue -> field.equals(issue.getField()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No issue for " + field));
  }

  private static List<ODCSImportIssue> report() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();
    ODCSFieldCoverage.report(YAML.readTree(DOCUMENT), "ACCOUNTS", issues);
    return issues.toList();
  }
}
