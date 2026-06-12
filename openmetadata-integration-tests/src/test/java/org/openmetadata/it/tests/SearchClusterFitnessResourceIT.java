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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for the /v1/system/search/fitness endpoint.
 *
 * <p>Verifies the admin happy path produces a structured report and that non-admin callers are
 * rejected — the endpoint is admin-only and must not be invokable by lower-privilege roles.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class SearchClusterFitnessResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String FITNESS_PATH = "/v1/system/search/fitness";
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  @Test
  void admin_can_fetch_fitness_report() throws Exception {
    final OpenMetadataClient client = SdkClients.adminClient();

    final String body =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, FITNESS_PATH, null, RequestOptions.builder().build());

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
    assertThat(sizing.has("verdict")).isTrue();
    assertThat(sizing.get("verdict").asText())
        .as("sizing verdict reflects whether OM data was found")
        .isIn("ADEQUATE", "UNDERSIZED", "INSUFFICIENT_DATA");
    assertThat(sizing.has("rationale")).isTrue();
    assertThat(sizing.get("rationale").asText()).isNotBlank();
    // recommendedDataNodes / recommendedHeapPerNodeBytes are intentionally omitted when sizing
    // verdict is INSUFFICIENT_DATA (no OpenMetadata indices found yet). Only assert they're
    // present when sizing actually computed against observed data.
    if (!"INSUFFICIENT_DATA".equals(sizing.get("verdict").asText())) {
      assertThat(sizing.has("recommendedDataNodes")).isTrue();
      assertThat(sizing.has("recommendedHeapPerNodeBytes")).isTrue();
    }
  }

  @Test
  void non_admin_cannot_fetch_fitness_report() throws Exception {
    String token =
        JwtAuthProvider.tokenFor(
            "data-consumer@open-metadata.org",
            "data-consumer@open-metadata.org",
            new String[] {"DataConsumer"},
            3600);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + FITNESS_PATH))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode())
        .as("DataConsumer must not be able to call admin-only fitness endpoint")
        .isIn(401, 403);
  }

  @Test
  void unauthenticated_request_is_rejected() throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + FITNESS_PATH))
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).as("unauthenticated request must be rejected").isEqualTo(401);
  }
}
