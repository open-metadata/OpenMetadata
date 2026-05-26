/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for the /v1/system/search/fitness endpoint.
 *
 * <p>Verifies the endpoint returns a structured {@code SearchClusterFitnessReport} when called by
 * an admin and reports cluster identity plus signals derived from the live ES/OS test container.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class SearchClusterFitnessResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void admin_can_fetch_fitness_report_with_signals_and_sizing() throws Exception {
    final OpenMetadataClient client = SdkClients.adminClient();

    final String body =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/search/fitness",
                null,
                RequestOptions.builder().build());

    assertThat(body).as("fitness endpoint should return a non-empty body").isNotBlank();

    final JsonNode report = MAPPER.readTree(body);

    assertThat(report.get("overallVerdict").asText())
        .as("overall verdict must be present")
        .isIn("READY", "STRAINED", "OVERLOADED", "UNKNOWN");
    assertThat(report.get("summary").asText()).isNotBlank();
    assertThat(report.has("generatedAtMillis")).isTrue();
    assertThat(report.has("clusterStatus")).isTrue();

    final JsonNode signals = report.get("signals");
    assertThat(signals).as("signals array must be present").isNotNull();
    assertThat(signals.isArray()).isTrue();

    final JsonNode indices = report.get("indices");
    assertThat(indices).as("indices array must be present").isNotNull();
    assertThat(indices.isArray()).isTrue();

    final JsonNode sizing = report.get("sizingGuidance");
    assertThat(sizing).as("sizing guidance must be present").isNotNull();
    assertThat(sizing.has("recommendedDataNodes")).isTrue();
    assertThat(sizing.has("recommendedHeapPerNodeBytes")).isTrue();
    assertThat(sizing.has("rationale")).isTrue();
    assertThat(sizing.get("rationale").asText()).isNotBlank();
  }
}
