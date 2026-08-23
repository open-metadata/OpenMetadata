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
package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Exercises {@link OpenBaoClient} against a stub HTTP server rather than mocks, so the real Jersey
 * request path, header handling and JSON parsing are covered without needing a container.
 *
 * <p>The cases here are the response-classification table from the design: they are what stands
 * between a misconfigured mount and silently discarded credentials.
 */
class OpenBaoClientTest {

  private HttpServer server;
  private String address;
  private final Map<String, StubResponse> routes = new ConcurrentHashMap<>();
  private final Map<String, String> lastHeaders = new ConcurrentHashMap<>();
  private final AtomicInteger loginCount = new AtomicInteger();
  private final Map<String, String> lastBody = new ConcurrentHashMap<>();

  private record StubResponse(int status, String body) {}

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", this::handle);
    server.start();
    address = "http://127.0.0.1:" + server.getAddress().getPort();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
    routes.clear();
    lastHeaders.clear();
    lastBody.clear();
    loginCount.set(0);
  }

  private void handle(HttpExchange exchange) throws IOException {
    String path = exchange.getRequestURI().getPath();
    lastBody.put(
        path, new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
    exchange
        .getRequestHeaders()
        .forEach((key, values) -> lastHeaders.put(key, String.join(",", values)));
    if (path.endsWith("/login")) {
      loginCount.incrementAndGet();
    }
    StubResponse stub = routes.getOrDefault(path, new StubResponse(404, "{\"errors\":[]}"));
    byte[] payload = stub.body().getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(stub.status(), payload.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(payload);
    }
  }

  private void stub(String path, int status, String body) {
    routes.put(path, new StubResponse(status, body));
  }

  private OpenBaoClient tokenClient() {
    return tokenClient("");
  }

  private OpenBaoClient tokenClient(String namespace) {
    return new OpenBaoClient(
        new OpenBaoClient.OpenBaoConfig(
            address,
            "openmetadata",
            namespace,
            "token",
            "t0ken",
            "",
            "",
            "",
            "",
            false,
            2000,
            2000));
  }

  @Test
  void readReturnsTheStoredValue() {
    stub(
        "/v1/openmetadata/data/svc/password",
        200,
        "{\"data\":{\"data\":{\"value\":\"s3cret\"},\"metadata\":{\"version\":1}}}");
    assertEquals(Optional.of("s3cret"), tokenClient().read("svc/password"));
  }

  @Test
  void missingSecretIsAbsentRatherThanAnError() {
    stub("/v1/openmetadata/data/svc/absent", 404, "{\"errors\":[]}");
    assertTrue(
        tokenClient().read("svc/absent").isEmpty(),
        "A 404 with an empty errors array is a genuinely missing secret");
  }

  @Test
  void softDeletedSecretIsAbsentRatherThanAnError() {
    stub(
        "/v1/openmetadata/data/svc/soft",
        404,
        "{\"data\":{\"data\":null,\"metadata\":{\"deletion_time\":\"2026-01-01T00:00:00Z\","
            + "\"destroyed\":false,\"version\":2}}}");
    assertTrue(
        tokenClient().read("svc/soft").isEmpty(),
        "A soft-deleted latest version must read as absent, not as a failure");
  }

  /**
   * The case that separates a correct implementation from one that silently discards credentials: a
   * 404 carrying errors means the mount is wrong, and must never be reported as a missing secret.
   */
  @Test
  void missingMountIsAConfigurationErrorNotAMissingSecret() {
    stub(
        "/v1/typo/data/svc/password",
        404,
        "{\"errors\":[\"no handler for route \\\"typo/data/svc/password\\\". route entry not found.\"]}");
    OpenBaoClient client =
        new OpenBaoClient(
            new OpenBaoClient.OpenBaoConfig(
                address, "typo", "", "token", "t0ken", "", "", "", "", false, 2000, 2000));
    assertThrows(
        OpenBaoClient.OpenBaoConfigurationException.class,
        () -> client.read("svc/password"),
        "A 404 naming a routing error means the mount does not exist and must fail loudly");
  }

  @Test
  void forbiddenIsAReadFailureNotAMissingSecret() {
    stub("/v1/openmetadata/data/svc/denied", 403, "{\"errors\":[\"permission denied\"]}");
    assertThrows(
        OpenBaoClient.OpenBaoRequestException.class,
        () -> tokenClient().read("svc/denied"),
        "A permission failure must surface, never be mistaken for an absent secret");
  }

  @Test
  void tokenAuthDoesNotRetryOnForbidden() {
    stub("/v1/openmetadata/data/svc/denied", 403, "{\"errors\":[\"permission denied\"]}");
    assertThrows(
        OpenBaoClient.OpenBaoRequestException.class, () -> tokenClient().read("svc/denied"));
    assertEquals(0, loginCount.get(), "Token auth has no login to repeat, so it must not retry");
  }

  @Test
  void appRoleReAuthenticatesOnceWhenTheTokenIsRejected() {
    stub(
        "/v1/auth/approle/login",
        200,
        "{\"auth\":{\"client_token\":\"fresh\",\"lease_duration\":1200}}");
    stub("/v1/openmetadata/data/svc/denied", 403, "{\"errors\":[\"permission denied\"]}");
    OpenBaoClient client =
        new OpenBaoClient(
            new OpenBaoClient.OpenBaoConfig(
                address,
                "openmetadata",
                "",
                "approle",
                "",
                "role",
                "secret",
                "",
                "",
                false,
                2000,
                2000));
    assertThrows(OpenBaoClient.OpenBaoRequestException.class, () -> client.read("svc/denied"));
    assertEquals(
        2, loginCount.get(), "One login at construction plus exactly one retry, never a loop");
  }

  @Test
  void namespaceHeaderIsOmittedWhenBlank() {
    stub("/v1/openmetadata/data/svc/p", 200, "{\"data\":{\"data\":{\"value\":\"v\"}}}");
    tokenClient().read("svc/p");
    assertFalse(
        lastHeaders.containsKey("X-vault-namespace"),
        "A blank namespace must omit the header entirely; an empty one is rejected by OSS servers");
  }

  @Test
  void namespaceHeaderIsSentWhenConfigured() {
    stub("/v1/openmetadata/data/svc/p", 200, "{\"data\":{\"data\":{\"value\":\"v\"}}}");
    tokenClient("team-a").read("svc/p");
    assertEquals("team-a", lastHeaders.get("X-vault-namespace"));
  }

  @Test
  void verifyMountAcceptsAReadableMount() {
    stub("/v1/openmetadata/config", 200, "{\"data\":{\"max_versions\":0}}");
    tokenClient().verifyMount();
  }

  /** A scoped token gets 403 here, so the message has to name the policy as well as the mount. */
  @Test
  void verifyMountNamesBothCausesWhenForbidden() {
    stub("/v1/openmetadata/config", 403, "{\"errors\":[\"permission denied\"]}");
    OpenBaoClient.OpenBaoConfigurationException error =
        assertThrows(
            OpenBaoClient.OpenBaoConfigurationException.class, () -> tokenClient().verifyMount());
    assertTrue(error.getMessage().contains("may not exist"), "must offer the wrong-mount cause");
    assertTrue(error.getMessage().contains("policy"), "must offer the wrong-policy cause");
  }

  @Test
  void errorMessagesNeverLeakTheResponseBodyOrTheToken() {
    stub(
        "/v1/openmetadata/data/svc/denied",
        403,
        "{\"errors\":[\"permission denied on secret/supersecret-path\"]}");
    OpenBaoClient.OpenBaoRequestException error =
        assertThrows(
            OpenBaoClient.OpenBaoRequestException.class, () -> tokenClient().read("svc/denied"));
    assertFalse(
        error.getMessage().contains("supersecret-path"),
        "Response bodies name paths and policies and must not reach logs or API responses");
    assertFalse(error.getMessage().contains("t0ken"), "The auth token must never appear");
  }

  /**
   * The {@code {"data":{"value":...}}} envelope is the contract the Python ingestion reader depends
   * on ({@code data.data.value}); getting it wrong would break cross-language resolution silently.
   */
  @Test
  void writeSendsTheValueUnderTheKvValueKey() {
    stub("/v1/openmetadata/data/svc/password", 200, "{\"data\":{\"version\":1}}");
    tokenClient().write("svc/password", "p4ss");
    JsonNode sent = JsonUtils.readTree(lastBody.get("/v1/openmetadata/data/svc/password"));
    assertEquals("p4ss", sent.path("data").path("value").asText());
  }

  @Test
  void deleteToleratesAnAlreadyAbsentPath() {
    stub("/v1/openmetadata/metadata/svc/gone", 404, "{\"errors\":[]}");
    tokenClient().deleteAllVersions("svc/gone");
  }

  @Test
  void unknownAuthMethodIsRejectedByName() {
    OpenBaoClient.OpenBaoConfigurationException error =
        assertThrows(
            OpenBaoClient.OpenBaoConfigurationException.class,
            () ->
                new OpenBaoClient(
                    new OpenBaoClient.OpenBaoConfig(
                        address,
                        "openmetadata",
                        "",
                        "kerberos",
                        "",
                        "",
                        "",
                        "",
                        "",
                        false,
                        2000,
                        2000)));
    assertTrue(error.getMessage().contains("kerberos"));
  }

  @Test
  void serverErrorsSurfaceRatherThanReadingAsAbsent() {
    for (int status : List.of(500, 503)) {
      stub("/v1/openmetadata/data/svc/boom", status, "{\"errors\":[\"internal\"]}");
      assertThrows(
          OpenBaoClient.OpenBaoRequestException.class,
          () -> tokenClient().read("svc/boom"),
          "HTTP " + status + " must not be mistaken for a missing secret");
    }
  }
}
