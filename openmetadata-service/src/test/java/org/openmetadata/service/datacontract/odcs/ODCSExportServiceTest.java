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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSElementExtension;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;

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
  void unknownBinaryLengthsDoNotMakeANativeContractUnexportable() {
    DataContract contract =
        contract()
            .withSchema(
                List.of(
                    new Column()
                        .withName("payload")
                        .withDataType(ColumnDataType.BINARY)
                        .withDataLength(-1)));
    ODCSExportService.Result result = exporter.export(contract, "v3.1.0");
    assertTrue(result.valid(), result.issues().toString());
    assertFalse(result.document().at("/schema/0/properties/0").has("logicalTypeOptions"));
  }

  @Test
  void legacyElementMetadataIsAttachedBeforeValidation() {
    DataContract contract =
        contract()
            .withSchema(
                List.of(new Column().withName("email").withDataType(ColumnDataType.VARCHAR)))
            .withOdcsElementExtensions(
                List.of(
                    new ODCSElementExtension()
                        .withElement("email")
                        .withTransformSourceObjects(List.of("source.email"))));
    JsonNode document = exporter.export(contract, "v3.1.0").requireValid();
    assertEquals(
        "source.email", document.at("/schema/0/properties/0/transformSourceObjects/0").asText());
  }

  private static DataContract contract() {
    return new DataContract().withId(UUID.randomUUID()).withName("customers_contract");
  }
}
