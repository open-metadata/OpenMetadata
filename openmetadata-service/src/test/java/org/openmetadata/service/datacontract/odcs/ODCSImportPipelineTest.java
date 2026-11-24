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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;

class ODCSImportPipelineTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final List<String> V3_VERSIONS = List.of("v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0");

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void publishedInputDoesNotReceiveLegacyRepairs(String version) {
    ObjectNode source = document(version);
    JsonNode before = source.deepCopy();
    ODCSImportIssues issues = new ODCSImportIssues();
    ODCSImportService.Document imported =
        ODCSImportService.read(JSON, source, issues).orElseThrow();
    assertEquals(version, imported.version());
    assertEquals(
        "id", imported.contract().getSchema().getFirst().getProperties().getFirst().getName());
    assertEquals(before, source);
    assertFalse(issues.hasBlocking());
    assertTrue(
        issues.toList().stream()
            .noneMatch(issue -> issue.getMessage().contains("Normalized legacy")));
  }

  static Stream<Arguments> malformedRootRules() {
    return V3_VERSIONS.stream()
        .flatMap(
            version ->
                Stream.of(false, true)
                    .flatMap(
                        schema ->
                            Stream.of(
                                    "42",
                                    "null",
                                    "[]",
                                    "{\"column\":42}",
                                    "{\"column\":null}",
                                    "{\"column\":[]}")
                                .map(rule -> Arguments.of(version, schema, rule))));
  }

  @ParameterizedTest
  @MethodSource("malformedRootRules")
  void invalidLegacyReferencesAreRejectedBeforeProjection(
      String version, boolean withSchema, String rule) throws Exception {
    ObjectNode source = document(version);
    if (!withSchema) source.remove("schema");
    source.putArray("quality").add(JSON.readTree(rule));
    JsonNode before = source.deepCopy();
    ODCSImportIssues issues = new ODCSImportIssues();
    assertTrue(ODCSImportService.read(JSON, source, issues).isEmpty());
    assertTrue(issues.hasBlocking());
    assertTrue(issues.toList().getFirst().getMessage().contains("must be objects"));
    assertEquals(before, source);
  }

  @ParameterizedTest
  @ValueSource(strings = {"null", "42", "true", "[]", "{}", "\"3.1.0\"", "\"v3.2.0\""})
  void invalidVersionDiagnosticsRemainAtTheDocumentBoundary(String version) throws Exception {
    ObjectNode source = document("v3.1.0");
    source.set("apiVersion", JSON.readTree(version));
    ODCSImportIssues issues = new ODCSImportIssues();
    assertTrue(ODCSImportService.read(JSON, source, issues).isEmpty());
    assertEquals("apiVersion", issues.toList().getFirst().getPath());
    assertTrue(issues.hasBlocking());
  }

  private static ObjectNode document(String version) {
    DataContract contract =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName("pipeline_contract")
            .withSchema(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    return (ObjectNode)
        new ODCSExportService(ignored -> List.of()).export(contract, version).requireValid();
  }
}
