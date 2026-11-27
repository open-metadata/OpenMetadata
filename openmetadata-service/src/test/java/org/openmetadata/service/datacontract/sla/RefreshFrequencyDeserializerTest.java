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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import jakarta.json.Json;
import jakarta.json.JsonValue;
import java.util.List;
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
import org.openmetadata.service.JsonPatchProvider;

class RefreshFrequencyDeserializerTest {
  private static final List<String> UNITS = List.of("minute", "hour", "day");

  private final ObjectMapper json = new JsonPatchProvider().getContext(CreateDataContract.class);
  private final ObjectMapper yaml =
      new YAMLMapper().registerModule(RefreshFrequencyDeserializer.module());

  @ParameterizedTest
  @ValueSource(
      strings = {
        "0.25",
        "15.5",
        "15.000000000000000001",
        "2147483648",
        "\"15\"",
        "NaN",
        "Infinity",
        "-Infinity"
      })
  void nativeReadersRejectLossyIntervalsAcrossUnits(String interval) {
    for (String unit : UNITS) {
      String request =
          "{\"sla\":{\"refreshFrequency\":{\"unit\":\"%s\",\"interval\":%s}}}"
              .formatted(unit, interval);
      assertThrows(
          JsonMappingException.class, () -> json.readValue(request, CreateDataContract.class));

      String yamlRequest =
          "sla:\n  refreshFrequency: {interval: %s, unit: %s}".formatted(interval, unit);
      assertThrows(
          JsonMappingException.class, () -> yaml.readValue(yamlRequest, CreateDataContract.class));
    }
  }

  @Test
  void minuteRejectsMissingOrNullIntervalAcrossReadersAndPatch() {
    for (String jsonBody :
        List.of(
            "{\"sla\":{\"refreshFrequency\":{\"unit\":\"minute\",\"interval\":null}}}",
            "{\"sla\":{\"refreshFrequency\":{\"unit\":\"minute\"}}}")) {
      assertThrows(
          JsonMappingException.class, () -> json.readValue(jsonBody, CreateDataContract.class));
    }
    for (String yamlBody :
        List.of(
            "sla:\n  refreshFrequency: {interval: null, unit: minute}",
            "sla:\n  refreshFrequency: {unit: minute}")) {
      assertThrows(
          JsonMappingException.class, () -> yaml.readValue(yamlBody, CreateDataContract.class));
    }

    DataContract stored =
        new DataContract()
            .withSla(
                new ContractSLA()
                    .withRefreshFrequency(
                        new RefreshFrequency()
                            .withUnit(RefreshFrequency.Unit.MINUTE)
                            .withInterval(15)));
    var removePatch = Json.createPatchBuilder().remove("/sla/refreshFrequency/interval").build();
    var nullPatch =
        Json.createPatchBuilder().replace("/sla/refreshFrequency/interval", JsonValue.NULL).build();

    assertThrows(
        IllegalArgumentException.class,
        () -> JsonUtils.applyPatch(stored, removePatch, DataContract.class));
    assertThrows(
        IllegalArgumentException.class,
        () -> JsonUtils.applyPatch(stored, nullPatch, DataContract.class));
  }

  @Test
  void legacyUnitsAllowMissingOrNullIntervalOnReadAndUnrelatedPatch() {
    for (String legacyJson :
        List.of(
            "{\"sla\":{\"refreshFrequency\":{\"unit\":\"hour\"}}}",
            "{\"sla\":{\"refreshFrequency\":{\"unit\":\"hour\",\"interval\":null}}}")) {
      DataContract stored = JsonUtils.readValue(legacyJson, DataContract.class);

      assertEquals(RefreshFrequency.Unit.HOUR, stored.getSla().getRefreshFrequency().getUnit());
      assertNull(stored.getSla().getRefreshFrequency().getInterval());

      var descriptionPatch =
          Json.createPatchBuilder().add("/description", "Updated description").build();
      DataContract patched = JsonUtils.applyPatch(stored, descriptionPatch, DataContract.class);

      assertEquals("Updated description", patched.getDescription());
      assertEquals(RefreshFrequency.Unit.HOUR, patched.getSla().getRefreshFrequency().getUnit());
      assertNull(patched.getSla().getRefreshFrequency().getInterval());
    }
  }

  @ParameterizedTest
  @ValueSource(ints = {Integer.MIN_VALUE, -1, 0, 15, Integer.MAX_VALUE})
  void nativeIntervalsKeepTheSignedIntegerRangeAcrossUnits(int interval) throws Exception {
    for (String unit : UNITS) {
      String input = "{\"interval\":%d.0,\"unit\":\"%s\"}".formatted(interval, unit);
      RefreshFrequency frequency = json.readValue(input, RefreshFrequency.class);

      assertEquals(interval, frequency.getInterval());
      assertEquals(RefreshFrequency.Unit.fromValue(unit), frequency.getUnit());
    }
  }

  @Test
  void patchRejectsFractionalIntervalsForMinuteAndOtherUnits() {
    DataContract stored =
        new DataContract()
            .withSla(
                new ContractSLA()
                    .withRefreshFrequency(
                        new RefreshFrequency()
                            .withUnit(RefreshFrequency.Unit.HOUR)
                            .withInterval(1)));
    var minutePatch =
        Json.createPatchBuilder()
            .replace("/sla/refreshFrequency/interval", Json.createValue(15.5))
            .replace("/sla/refreshFrequency/unit", "minute")
            .build();
    var hourPatch =
        Json.createPatchBuilder()
            .replace("/sla/refreshFrequency/interval", Json.createValue(0.25))
            .build();

    assertThrows(
        IllegalArgumentException.class,
        () -> JsonUtils.applyPatch(stored, minutePatch, DataContract.class));
    assertThrows(
        IllegalArgumentException.class,
        () -> JsonUtils.applyPatch(stored, hourPatch, DataContract.class));
  }

  @Test
  void wholeHourIntervalPreservesAdditionalProperties() throws Exception {
    String input =
        """
        {"interval": 15, "unit": "hour", "extension": {"key": "value"}}
        """;
    RefreshFrequency frequency = json.readValue(input, RefreshFrequency.class);

    assertEquals(15, frequency.getInterval());
    assertEquals(RefreshFrequency.Unit.HOUR, frequency.getUnit());
    assertEquals(Map.of("key", "value"), frequency.getAdditionalProperties().get("extension"));
  }
}
