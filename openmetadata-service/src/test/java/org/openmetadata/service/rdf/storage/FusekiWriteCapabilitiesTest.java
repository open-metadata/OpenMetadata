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
package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpHeaders;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Header fixtures are the OPTIONS {@code /<dataset>/data} responses captured from real servers:
 * the shipped {@code docker/rdf-store} image, a dataset created through {@code POST /$/datasets} on
 * that image, Apache Jena Fuseki 6.2.0 without the extension, a dataset served with
 * {@code fuseki:serviceReadGraphStore}, and a path with no dataset behind it.
 */
class FusekiWriteCapabilitiesTest {
  private static final String SERVER = "http://fuseki:3030";
  private static final String DATASET = "openmetadata";
  private static final String ALLOW = FusekiWriteCapabilities.ALLOW;
  private static final String READ_WRITE = "GET,HEAD,OPTIONS,PUT,POST";
  private static final long CLIENT_BUDGET = 16L * 1024 * 1024;
  private static final long CLIENT_DEADLINE = 48_000;

  private static final Map<String, List<String>> PROVISIONED =
      Map.of(
          FusekiWriteCapabilities.REQUEST_ID,
          List.of("3"),
          FusekiWriteCapabilities.DEADLINE,
          List.of("50000"),
          FusekiWriteCapabilities.LIMIT,
          List.of("67108864"),
          FusekiWriteCapabilities.UNION,
          List.of("true"),
          FusekiWriteCapabilities.QUERY,
          List.of("50000"),
          FusekiWriteCapabilities.UPDATE,
          List.of("50000"),
          ALLOW,
          List.of(READ_WRITE));

  private static final Map<String, List<String>> CREATED_THROUGH_ADMIN_API =
      Map.of(
          FusekiWriteCapabilities.REQUEST_ID,
          List.of("2"),
          FusekiWriteCapabilities.DEADLINE,
          List.of("50000"),
          FusekiWriteCapabilities.LIMIT,
          List.of("67108864"),
          FusekiWriteCapabilities.UNION,
          List.of("false"),
          FusekiWriteCapabilities.QUERY,
          List.of("0"),
          FusekiWriteCapabilities.UPDATE,
          List.of("0"),
          ALLOW,
          List.of(READ_WRITE));

  private static final Map<String, List<String>> STOCK_FUSEKI =
      Map.of(FusekiWriteCapabilities.REQUEST_ID, List.of("1"), ALLOW, List.of(READ_WRITE));

  private static final Map<String, List<String>> READ_ONLY_GRAPH_STORE =
      Map.of(FusekiWriteCapabilities.REQUEST_ID, List.of("9"), ALLOW, List.of("GET,HEAD,OPTIONS"));

  private static final Map<String, List<String>> NO_DATASET_AT_PATH =
      Map.of(ALLOW, List.of("GET, HEAD, OPTIONS"));

  @Test
  void provisionedDatasetAdvertisesServerBoundsAndMeetsEveryGuarantee() {
    final FusekiWriteCapabilities capabilities = negotiate(200, PROVISIONED);

    assertEquals(new FusekiWriteCapabilities(50000, 67108864, List.of()), capabilities);
  }

  @Test
  void stockFusekiIsUsableWithTheClientsOwnBudgetAndDeadline() {
    final FusekiWriteCapabilities capabilities = negotiate(200, STOCK_FUSEKI);

    assertEquals(CLIENT_BUDGET, Math.min(CLIENT_BUDGET, capabilities.maxBytes()));
    assertEquals(CLIENT_DEADLINE, Math.min(capabilities.timeoutMillis(), CLIENT_DEADLINE));
    assertEquals(1, capabilities.missingGuarantees().size());
    assertTrue(
        capabilities.missingGuarantees().getFirst().contains("Graph Store extension"),
        capabilities.missingGuarantees().toString());
  }

  @Test
  void datasetCreatedThroughTheAdminApiNamesEachMissingTimeoutAndLeavesUnionToTheProbe() {
    final FusekiWriteCapabilities capabilities = negotiate(200, CREATED_THROUGH_ADMIN_API);

    assertEquals(67108864, capabilities.maxBytes());
    final String missing = String.join(" | ", capabilities.missingGuarantees());
    assertEquals(2, capabilities.missingGuarantees().size(), missing);
    assertTrue(missing.contains("arq:queryTimeout"), missing);
    assertTrue(missing.contains("arq:updateTimeout"), missing);
  }

  @Test
  void readOnlyGraphStoreFailsNamingTheMethodsItAllows() {
    final IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> negotiate(200, READ_ONLY_GRAPH_STORE));

    assertTrue(failure.getMessage().contains("'" + DATASET + "'"), failure.getMessage());
    assertTrue(failure.getMessage().contains("read-only"), failure.getMessage());
    assertTrue(failure.getMessage().contains("GET,HEAD,OPTIONS"), failure.getMessage());
  }

  @Test
  void writableGraphStoreIsRecognisedWhateverTheListSpacing() {
    final Map<String, List<String>> headers = new HashMap<>(STOCK_FUSEKI);
    headers.put(ALLOW, List.of("GET, HEAD, OPTIONS, PUT, POST"));

    assertEquals(1, negotiate(200, headers).missingGuarantees().size());
  }

  @Test
  void graphStoreWithoutAnAllowHeaderIsNotJudgedReadOnly() {
    final Map<String, List<String>> headers = new HashMap<>(STOCK_FUSEKI);
    headers.remove(ALLOW);

    assertEquals(1, negotiate(200, headers).missingGuarantees().size());
  }

  @Test
  void eachAbsentOrInvalidAdvertisedValueDegradesInsteadOfFailing() {
    for (String header :
        List.of(
            FusekiWriteCapabilities.QUERY,
            FusekiWriteCapabilities.UPDATE,
            FusekiWriteCapabilities.DEADLINE,
            FusekiWriteCapabilities.LIMIT)) {
      for (String replacement : new String[] {null, "invalid"}) {
        final Map<String, List<String>> headers = new HashMap<>(PROVISIONED);
        headers.remove(header);
        if (replacement != null) {
          headers.put(header, List.of(replacement));
        }

        final FusekiWriteCapabilities capabilities = negotiate(200, headers);

        assertEquals(1, capabilities.missingGuarantees().size(), header + "=" + replacement);
      }
    }
  }

  @Test
  void unreadableServerBoundFallsBackToTheClientBound() {
    final Map<String, List<String>> headers = new HashMap<>(PROVISIONED);
    headers.put(FusekiWriteCapabilities.LIMIT, List.of("invalid"));
    headers.put(FusekiWriteCapabilities.DEADLINE, List.of("0"));

    final FusekiWriteCapabilities capabilities = negotiate(200, headers);

    assertEquals(CLIENT_BUDGET, Math.min(CLIENT_BUDGET, capabilities.maxBytes()));
    assertEquals(CLIENT_DEADLINE, Math.min(capabilities.timeoutMillis(), CLIENT_DEADLINE));
  }

  @Test
  void pathWithNoDatasetFailsNamingTheMissingDataset() {
    final IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> negotiate(200, NO_DATASET_AT_PATH));

    assertTrue(
        failure.getMessage().contains("'" + DATASET + "' does not exist"), failure.getMessage());
    assertTrue(failure.getMessage().contains(SERVER), failure.getMessage());
  }

  @Test
  void extensionHeadersAloneProveTheDatasetEvenWithoutARequestId() {
    final Map<String, List<String>> headers = new HashMap<>(PROVISIONED);
    headers.remove(FusekiWriteCapabilities.REQUEST_ID);

    assertTrue(negotiate(200, headers).missingGuarantees().isEmpty());
  }

  @Test
  void rejectedCredentialsFailAsACredentialsProblem() {
    final IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> negotiate(401, Map.of()));

    assertTrue(failure.getMessage().contains("credentials"), failure.getMessage());
  }

  @Test
  void forbiddenUserFailsAsAnAuthorizationProblem() {
    final IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> negotiate(403, Map.of()));

    assertTrue(failure.getMessage().contains("not authorized"), failure.getMessage());
  }

  @Test
  void notFoundFailsNamingTheMissingDataset() {
    final IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> negotiate(404, Map.of()));

    assertTrue(
        failure.getMessage().contains("'" + DATASET + "' does not exist"), failure.getMessage());
  }

  @Test
  void otherErrorStatusFailsWithTheStatus() {
    final IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> negotiate(503, Map.of()));

    assertTrue(failure.getMessage().contains("HTTP 503"), failure.getMessage());
  }

  private static FusekiWriteCapabilities negotiate(
      final int status, final Map<String, List<String>> headers) {
    return FusekiWriteCapabilities.negotiate(
        status, HttpHeaders.of(headers, (name, value) -> true), SERVER, DATASET);
  }
}
