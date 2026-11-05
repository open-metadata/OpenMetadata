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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

class ODCSExportServiceTest {
  private final ODCSExportService exporter = new ODCSExportService(contract -> List.of());

  @Test
  void supportedProfileProducesAValidDocumentAndUnknownVersionsAreRejected() {
    ODCSExportService.Result result = exporter.export(contract(), "v3.1.0");
    assertTrue(result.valid(), result.issues().toString());
    assertEquals("v3.1.0", result.document().path("apiVersion").asText());
    assertThrows(IllegalArgumentException.class, () -> exporter.export(contract(), "v99.0.0"));
  }

  @Test
  void incompatiblePreservedContentIsReportedAndNeverErasedFromTheContract() {
    DataContract contract =
        contract()
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withName("legacy_rule")
                        .withType(ODCSQualityRule.Type.LIBRARY)
                        .withMetric(ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES)
                        .withMustBe(1.0)));
    ODCSExportService.Result result = exporter.export(contract, "v3.1.0");
    assertFalse(result.valid());
    assertTrue(
        result.issues().stream().anyMatch(issue -> issue.contains("metric")),
        result.issues().toString());
    assertEquals("uniqueValues", result.document().at("/schema/0/quality/0/metric").asText());
    assertEquals("uniqueValues", contract.getOdcsQualityRules().getFirst().getMetric().value());
    assertThrows(IllegalArgumentException.class, result::requireValid);
  }

  @Test
  void generationProjectionMatchesThePinnedRuntimeSchema() throws Exception {
    try (var upstream = getClass().getResourceAsStream("/odcs/v3.1.0/schema.json");
        var model =
            getClass()
                .getResourceAsStream(
                    "/json/schema/type/datacontract/odcs/v310/odcsContract.json")) {
      byte[] bytes = upstream.readAllBytes();
      JsonNode generated = new ObjectMapper().readTree(model);
      String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
      assertEquals(digest, generated.path("x-odcs-upstream-sha256").asText());
      assertEquals("v3.1.0", generated.path("x-odcs-version").asText());
      assertFalse(generated.at("/definitions/SchemaObject/properties").has("primaryKey"));
      assertTrue(generated.at("/definitions/SchemaProperty/properties").has("primaryKey"));
    }
  }

  private static DataContract contract() {
    return new DataContract().withId(UUID.randomUUID()).withName("customers_contract");
  }
}
