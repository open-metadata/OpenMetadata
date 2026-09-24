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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssue;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueSeverity;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;

class ODCSLenientReaderTest {
  private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());
  private static final String HEADER =
      """
      apiVersion: v3.1.0
      kind: DataContract
      id: 4f5b0c52-9f1e-4e89-a6a4-0e0b7a3a1c11
      version: 1.0.0
      status: active
      """;

  @Test
  void unknownLogicalTypeIsLeftOutAndTheRestIsRead() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSDataContract contract =
        read(
            HEADER
                + """
                schema:
                  - name: orders
                    logicalType: object
                    properties:
                      - name: attributes
                        logicalType: map
                        physicalType: MAP
                      - name: id
                        logicalType: integer
                """,
            issues);

    List<ODCSImportIssue> reported = issues.toList();
    assertEquals(2, contract.getSchema().getFirst().getProperties().size());
    assertNull(contract.getSchema().getFirst().getProperties().getFirst().getLogicalType());
    assertEquals(1, reported.size());
    assertEquals(ODCSImportIssueSeverity.WARNING, reported.getFirst().getSeverity());
    assertEquals(ODCSImportIssueCategory.SCHEMA, reported.getFirst().getCategory());
    assertEquals("schema[0].properties[0].logicalType", reported.getFirst().getPath());
    assertTrue(reported.getFirst().getMessage().contains("physicalType"));
  }

  @Test
  void unknownMetricIsKeptAsTheRuleName() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSDataContract contract =
        read(
            HEADER
                + """
                quality:
                  - name: Distribution
                    metric: valueDistribution
                """,
            issues);

    ODCSQualityRule rule = contract.getQuality().getFirst();
    assertNull(rule.getMetric());
    assertEquals("valueDistribution", rule.getRule());
    assertEquals(ODCSImportIssueCategory.QUALITY, issues.toList().getFirst().getCategory());
  }

  @Test
  void implementationWrittenAsAMappingIsKept() throws JsonProcessingException {
    ODCSDataContract contract =
        read(
            HEADER
                + """
                quality:
                  - type: custom
                    engine: soda
                    implementation:
                      checks: [row_count > 0]
                """,
            new ODCSImportIssues());

    assertEquals(
        "{\"checks\":[\"row_count > 0\"]}", contract.getQuality().getFirst().getImplementation());
  }

  @Test
  void unreadableRootValueIsLeftOut() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSDataContract contract =
        read(
            HEADER + "servers:\n  - server: prod\n    type: snowflake\n    port: not-a-port\n",
            issues);

    assertNull(contract.getServers().getFirst().getPort());
    assertEquals("servers[0].port", issues.toList().getFirst().getPath());
    assertEquals(ODCSImportIssueCategory.SERVERS, issues.toList().getFirst().getCategory());
  }

  @Test
  void newerOdcsVersionIsReadWithANote() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    read(HEADER.replace("v3.1.0", "v3.2.0"), issues);

    assertEquals(ODCSImportIssueSeverity.INFO, issues.toList().getFirst().getSeverity());
  }

  @Test
  void unsupportedVersionBlocksTheImport() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    boolean read =
        ODCSLenientReader.read(YAML, YAML.readTree(HEADER.replace("v3.1.0", "v4.0.0")), issues)
            .isPresent();

    assertTrue(!read && issues.hasBlocking());
    assertTrue(issues.toList().getFirst().getMessage().contains("v4.0.0"));
  }

  @Test
  void missingStatusBlocksTheImport() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSLenientReader.read(YAML, YAML.readTree(HEADER.replace("status: active\n", "")), issues);

    assertTrue(issues.hasBlocking());
    assertEquals("status", issues.toList().getFirst().getField());
  }

  @Test
  void rejectingReaderExplainsWhatBlocks() throws JsonProcessingException {
    IllegalArgumentException rejected =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                ODCSLenientReader.readOrReject(
                    YAML, YAML.readTree(HEADER.replace("DataContract", "ServiceContract"))));

    assertTrue(rejected.getMessage().contains("ServiceContract"));
  }

  @Test
  void plainTextDescriptionBecomesThePurpose() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSDataContract contract = read(HEADER + "description: Orders placed online\n", issues);

    assertEquals("Orders placed online", contract.getDescription().getPurpose());
    assertEquals(ODCSImportIssueSeverity.INFO, issues.toList().getFirst().getSeverity());
  }

  @Test
  void singleTagWrittenAsTextBecomesAList() throws JsonProcessingException {
    ODCSDataContract contract =
        read(
            HEADER
                + """
                tags: finance
                schema:
                  - name: orders
                    logicalType: object
                    properties:
                      - name: lines
                        logicalType: array
                        items:
                          name: line
                          tags: pii
                          quality:
                            - type: custom
                              engine: soda
                              implementation:
                                check: not_null
                """,
            new ODCSImportIssues());

    assertEquals(List.of("finance"), contract.getTags());
    ODCSSchemaElement item = contract.getSchema().getFirst().getProperties().getFirst().getItems();
    assertEquals(List.of("pii"), item.getTags());
    assertEquals("{\"check\":\"not_null\"}", item.getQuality().getFirst().getImplementation());
  }

  private static ODCSDataContract read(String yaml, ODCSImportIssues issues)
      throws JsonProcessingException {
    return ODCSLenientReader.read(YAML, YAML.readTree(yaml), issues).orElseThrow();
  }
}
