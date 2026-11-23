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

package org.openmetadata.service.datacontract.sla;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import jakarta.json.Json;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.RefreshFrequencyDeserializer;

class RefreshFrequencyDeserializerTest {
  private final ObjectMapper json =
      new ObjectMapper().registerModule(RefreshFrequencyDeserializer.module());
  private final ObjectMapper yaml =
      new YAMLMapper().registerModule(RefreshFrequencyDeserializer.module());

  @ParameterizedTest
  @ValueSource(strings = {"15.5", "15.000000000000000001", "2147483648", "null", "\"15\""})
  void nativeReadersRejectLossyMinuteIntervals(String interval) {
    String request =
        "{\"sla\":{\"refreshFrequency\":{\"unit\":\"minute\",\"interval\":%s}}}"
            .formatted(interval);
    assertThrows(
        JsonMappingException.class, () -> json.readValue(request, CreateDataContract.class));

    String yamlRequest =
        "sla:\n  refreshFrequency: {interval: %s, unit: minute}".formatted(interval);
    assertThrows(
        JsonMappingException.class, () -> yaml.readValue(yamlRequest, CreateDataContract.class));
  }

  @ParameterizedTest
  @ValueSource(ints = {Integer.MIN_VALUE, -1, 0, 15, Integer.MAX_VALUE})
  void nativeMinuteIntervalsKeepTheSignedIntegerRange(int interval) throws Exception {
    String input = "{\"interval\":%d.0,\"unit\":\"minute\"}".formatted(interval);
    RefreshFrequency frequency = json.readValue(input, RefreshFrequency.class);

    assertEquals(interval, frequency.getInterval());
    assertEquals(RefreshFrequency.Unit.MINUTE, frequency.getUnit());
  }

  @Test
  void patchValidatesTheFinalUnitBeforeIntegerCoercion() {
    DataContract stored =
        new DataContract()
            .withSla(
                new ContractSLA()
                    .withRefreshFrequency(
                        new RefreshFrequency()
                            .withUnit(RefreshFrequency.Unit.HOUR)
                            .withInterval(1)));
    var patch =
        Json.createPatchBuilder()
            .replace("/sla/refreshFrequency/interval", Json.createValue(15.5))
            .replace("/sla/refreshFrequency/unit", "minute")
            .build();

    assertThrows(
        IllegalArgumentException.class,
        () -> JsonUtils.applyPatch(stored, patch, DataContract.class));
  }

  @Test
  void existingHourCoercionAndAdditionalPropertiesArePreserved() throws Exception {
    String input =
        """
        {"interval": 15.5, "unit": "hour", "extension": {"key": "value"}}
        """;
    RefreshFrequency frequency = json.readValue(input, RefreshFrequency.class);

    assertEquals(15, frequency.getInterval());
    assertEquals(RefreshFrequency.Unit.HOUR, frequency.getUnit());
    assertEquals(Map.of("key", "value"), frequency.getAdditionalProperties().get("extension"));
  }
}
