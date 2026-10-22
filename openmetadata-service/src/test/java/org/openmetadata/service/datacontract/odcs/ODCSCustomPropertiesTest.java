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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSCustomProperty;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;

class ODCSCustomPropertiesTest {
  private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());
  private static final String HEADER =
      """
      apiVersion: v3.1.0
      kind: DataContract
      id: 4f5b0c52-9f1e-4e89-a6a4-0e0b7a3a1c11
      version: 1.0.0
      status: active
      """;

  private static final String LIST_FORM =
      HEADER
          + """
          customProperties:
            - property: domainOwner
              value: sales
          servers:
            - server: prod
              type: postgres
              customProperties:
                - property: replicas
                  value: 3
          roles:
            - role: analyst
              access: read
              customProperties:
                - property: approved
                  value: true
          quality:
            - type: sql
              query: SELECT 1
              customProperties:
                - property: severity
                  value: high
          schema:
            - name: orders
              logicalType: object
              customProperties:
                - property: retentionDays
                  value: 30
              properties:
                - name: id
                  logicalType: integer
                  customProperties:
                    - property: pii
                      value: false
                  quality:
                    - type: sql
                      query: SELECT 2
                      customProperties:
                        - property: owner
                          value: dq-team
          """;

  private static final String MAPPING_FORM =
      HEADER
          + """
          servers:
            - server: prod
              type: postgres
              customProperties:
                replicas: 3
          roles:
            - role: analyst
              access: read
              customProperties:
                approved: true
          quality:
            - type: sql
              query: SELECT 1
              customProperties:
                severity: high
          schema:
            - name: orders
              logicalType: object
              customProperties:
                retentionDays: 30
              properties:
                - name: tags
                  logicalType: array
                  items:
                    name: tag
                    logicalType: string
                    customProperties:
                      maxLength: 64
                  quality:
                    - type: sql
                      query: SELECT 2
                      customProperties:
                        owner: dq-team
          """;

  @Test
  void listFormIsReadAtEveryLocationKeepingNonStringValues() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSDataContract contract = read(LIST_FORM, issues);

    ODCSSchemaElement orders = contract.getSchema().getFirst();
    ODCSSchemaElement id = orders.getProperties().getFirst();
    assertTrue(issues.toList().isEmpty(), () -> issues.toList().toString());
    assertProperty(contract.getCustomProperties(), "domainOwner", "sales");
    assertProperty(contract.getServers().getFirst().getCustomProperties(), "replicas", 3);
    assertProperty(contract.getRoles().getFirst().getCustomProperties(), "approved", true);
    assertProperty(contract.getQuality().getFirst().getCustomProperties(), "severity", "high");
    assertProperty(orders.getCustomProperties(), "retentionDays", 30);
    assertProperty(id.getCustomProperties(), "pii", false);
    assertProperty(id.getQuality().getFirst().getCustomProperties(), "owner", "dq-team");
  }

  @Test
  void mappingFormOpenMetadataUsedToExportIsReadAsTheList() throws JsonProcessingException {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSDataContract contract = read(MAPPING_FORM, issues);

    ODCSSchemaElement orders = contract.getSchema().getFirst();
    ODCSSchemaElement tags = orders.getProperties().getFirst();
    assertTrue(issues.toList().isEmpty(), () -> issues.toList().toString());
    assertProperty(contract.getServers().getFirst().getCustomProperties(), "replicas", 3);
    assertProperty(contract.getRoles().getFirst().getCustomProperties(), "approved", true);
    assertProperty(contract.getQuality().getFirst().getCustomProperties(), "severity", "high");
    assertProperty(orders.getCustomProperties(), "retentionDays", 30);
    assertProperty(tags.getItems().getCustomProperties(), "maxLength", 64);
    assertProperty(tags.getQuality().getFirst().getCustomProperties(), "owner", "dq-team");
  }

  @Test
  void mappingWithSeveralKeysBecomesOneEntryPerKeyInOrder() {
    ObjectNode rule = YAML.createObjectNode();
    rule.putObject("customProperties").put("severity", "high").put("threshold", 0.5);

    assertTrue(ODCSCustomProperties.toPropertyList(rule));

    JsonNode list = rule.get("customProperties");
    assertEquals(2, list.size());
    assertEquals("severity", list.get(0).get("property").asText());
    assertEquals("high", list.get(0).get("value").asText());
    assertEquals("threshold", list.get(1).get("property").asText());
    assertEquals(0.5, list.get(1).get("value").asDouble());
  }

  @Test
  void listFormAndMissingPropertiesAreLeftUnchanged() {
    ObjectNode listForm = YAML.createObjectNode();
    listForm.putArray("customProperties").addObject().put("property", "a").put("value", "b");
    JsonNode before = listForm.deepCopy();

    assertFalse(ODCSCustomProperties.toPropertyList(listForm));
    assertFalse(ODCSCustomProperties.toPropertyList(YAML.createObjectNode()));
    assertEquals(before, listForm);
  }

  private static void assertProperty(
      List<ODCSCustomProperty> properties, String property, Object value) {
    assertEquals(1, properties.size(), () -> properties.toString());
    assertEquals(property, properties.getFirst().getProperty());
    assertEquals(value, properties.getFirst().getValue());
  }

  private static ODCSDataContract read(String yaml, ODCSImportIssues issues)
      throws JsonProcessingException {
    return ODCSLenientReader.read(YAML, YAML.readTree(yaml), issues).orElseThrow();
  }
}
