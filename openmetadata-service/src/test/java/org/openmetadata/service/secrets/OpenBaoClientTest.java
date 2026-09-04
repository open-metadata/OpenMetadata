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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Exercises {@link OpenBaoClient} against a stub HTTP server rather than mocks, so the real Jersey
 * request path, header handling and JSON parsing are covered without needing a container.
 *
 * <p>The cases here are the response-classification table from the design: they are what stands
 * between a misconfigured mount and silently discarded credentials.
 */
class OpenBaoClientTest {

  /** Self-signed certificate used only to exercise the CA-bundle parse path. */
  private static final String CERT_FIXTURE =
      "-----BEGIN CERTIFICATE-----\n"
          + "MIIDFTCCAf2gAwIBAgIUCDJ2mFosGJO5M2BnrgaQvR1o6howDQYJKoZIhvcNAQEL\n"
          + "BQAwGjEYMBYGA1UEAwwPb3BlbmJhby10ZXN0LWNhMB4XDTI2MDgyMzIwMTYzNVoX\n"
          + "DTM2MDgyMDIwMTYzNVowGjEYMBYGA1UEAwwPb3BlbmJhby10ZXN0LWNhMIIBIjAN\n"
          + "BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwmubKfnwBHxSsmCqg441lvElJGvq\n"
          + "0uSpfZBcDtjVZj43Ysct8cUm6w2NvEWYxEj5gYZMY3QYZBmKYbszkfoY33Zmi2wo\n"
          + "59Aj6Ewclj3Zx5IoqDPP9I0xEBMbI8Ago2AkHCggEx8JY9phPMiDDwKiXBBsCxYL\n"
          + "gM8wWgX61wk487zWlQ1ccpzoMO41+VfXIY1yWLTCmsbj5JazX5tsA2v+sg+nvqSB\n"
          + "7i9iRIQbU9JlvgrB+a7/dkmevyu0beNkMRUZkrp6Kai3VxElKKPc/sIX8AR+jI65\n"
          + "n0htVfwoZDVJgYnuFGx/l7j8DzSCk1b8TVCo9KNiRjUtvHP6Dmpz4WzVwwIDAQAB\n"
          + "o1MwUTAdBgNVHQ4EFgQUJGb5ID+s6nVLyXhdA+eP4m+ZiQowHwYDVR0jBBgwFoAU\n"
          + "JGb5ID+s6nVLyXhdA+eP4m+ZiQowDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0B\n"
          + "AQsFAAOCAQEAhM9jVGJIdfQv9qT16worN5lSXBMoE6ku/rtCV4xwUFbTyyqwxSMZ\n"
          + "CALxvXcyxHJAuBMe+fkwsBRz3ZkLf0mmNGNXnPq0DKUxAv3S+Y6+7W7THxW9WF0C\n"
          + "GZXHHlNh9mDWbby9PmYKT4Tm2SFv9rWCrBwraShMhD9KnWLrPrAB+5GjGPzbPu6K\n"
          + "Xt/6o30oqkpBe0ErstaS2sk2EMbD1RDFzZIHDXT8CTcWcDZSoayeZ7VqldAz0ueT\n"
          + "md9WO21VF1+RoxnqsEuLEp3Y+4u/gOKkWXXhGSPwmTD3n/E3v1e5T590ygXbZ7U+\n"
          + "41r9aAulfBA3v69Ukjb6QAB8YesvsQQZMw==\n"
          + "-----END CERTIFICATE-----\n";

  private HttpServer server;
  private String address;
  private final Map<String, StubResponse> routes = new ConcurrentHashMap<>();
  private final Map<String, String> lastHeaders = new ConcurrentHashMap<>();
  private final AtomicInteger loginCount = new AtomicInteger();
  private final Map<String, String> lastBody = new ConcurrentHashMap<>();
  private final List<String> tokensSeen = new java.util.concurrent.CopyOnWriteArrayList<>();

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
    tokensSeen.clear();
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
      int n = loginCount.incrementAndGet();
      byte[] minted =
          String.format("{\"auth\":{\"client_token\":\"token-%d\",\"lease_duration\":1200}}", n)
              .getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, minted.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(minted);
      }
      return;
    }
    String token = exchange.getRequestHeaders().getFirst("X-Vault-Token");
    if (token != null) {
      tokensSeen.add(token);
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

  /**
   * Config builder with defaults, so a test names only what it varies. The record has 12 positional
   * fields and mis-counting them silently produces a config that tests nothing.
   */
  private OpenBaoClient.OpenBaoConfig config(final String mount, final String caCertPath) {
    return new OpenBaoClient.OpenBaoConfig(
        address, mount, "", "token", "t0ken", "", "", "", caCertPath, false, 2000, 2000);
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

  /** A proxy in front of OpenBao can turn a rejected token into a 401, so it must retry too. */
  @Test
  void appRoleReAuthenticatesOnUnauthorizedAsWellAsForbidden() {
    stub("/v1/openmetadata/data/svc/p401", 401, "{\"errors\":[\"missing client token\"]}");
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
    assertThrows(OpenBaoClient.OpenBaoRequestException.class, () -> client.read("svc/p401"));
    assertEquals(2, loginCount.get(), "a 401 must trigger the same single re-auth as a 403");
  }

  @Test
  void tokenAuthDoesNotRetryOnUnauthorized() {
    stub("/v1/openmetadata/data/svc/p401", 401, "{\"errors\":[\"missing client token\"]}");
    assertThrows(OpenBaoClient.OpenBaoRequestException.class, () -> tokenClient().read("svc/p401"));
    assertEquals(0, loginCount.get(), "token auth has no login to repeat");
  }

  /**
   * The retry must go out under the refreshed token. Reading the field inside the call instead of
   * passing it in would let the two diverge, and the re-auth would be skipped.
   */
  @Test
  void theRetryIsSentWithTheRefreshedToken() {
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
    // Construction logs in as token-1; the rejected read forces a second login minting token-2.
    // Replaying the captured token instead of the refreshed one would resend token-1.
    assertEquals(
        "token-2",
        tokensSeen.get(tokensSeen.size() - 1),
        "the retry must carry the token from the re-authentication, not the rejected one");
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
  void missingTokenIsRejectedByNameRatherThanAsAMountProblem() {
    OpenBaoClient.OpenBaoConfigurationException error =
        assertThrows(
            OpenBaoClient.OpenBaoConfigurationException.class,
            () ->
                new OpenBaoClient(
                    new OpenBaoClient.OpenBaoConfig(
                        address,
                        "openmetadata",
                        "",
                        "token",
                        "",
                        "",
                        "",
                        "",
                        "",
                        false,
                        2000,
                        2000)));
    assertTrue(error.getMessage().contains("baoToken"), "must name the missing parameter");
  }

  @Test
  void missingAppRoleCredentialsAreRejectedByName() {
    OpenBaoClient.OpenBaoConfigurationException error =
        assertThrows(
            OpenBaoClient.OpenBaoConfigurationException.class,
            () ->
                new OpenBaoClient(
                    new OpenBaoClient.OpenBaoConfig(
                        address,
                        "openmetadata",
                        "",
                        "approle",
                        "",
                        "",
                        "",
                        "",
                        "",
                        false,
                        2000,
                        2000)));
    assertTrue(error.getMessage().contains("baoRoleId"), "must name the missing parameter");
  }

  /** A wrong mount must not let entity deletion report success while nothing is removed. */
  @Test
  void deleteOnAMissingMountFailsRatherThanReportingSuccess() {
    stub(
        "/v1/typo/metadata/svc/password",
        404,
        "{\"errors\":[\"no handler for route \\\"typo/metadata/svc/password\\\". route entry not found.\"]}");
    OpenBaoClient client =
        new OpenBaoClient(
            new OpenBaoClient.OpenBaoConfig(
                address, "typo", "", "token", "t0ken", "", "", "", "", false, 2000, 2000));
    assertThrows(
        OpenBaoClient.OpenBaoConfigurationException.class,
        () -> client.deleteAllVersions("svc/password"));
  }

  @Test
  void deleteOnAnAlreadyAbsentSecretStillSucceeds() {
    stub("/v1/openmetadata/metadata/svc/gone2", 404, "{\"errors\":[]}");
    tokenClient().deleteAllVersions("svc/gone2");
  }

  @Test
  void emptyCaCertBundleIsRejectedNamingTheFile(@TempDir Path tempDir) throws IOException {
    Path emptyPem = Files.writeString(tempDir.resolve("empty.pem"), "");
    OpenBaoClient.OpenBaoConfigurationException error =
        assertThrows(
            OpenBaoClient.OpenBaoConfigurationException.class,
            () -> new OpenBaoClient(config("openmetadata", emptyPem.toString())));
    assertTrue(
        error.getMessage().contains(emptyPem.toString()),
        "the operator needs to know which file was unusable");
  }

  @Test
  void unreadableCaCertPathIsRejectedNamingTheFile(@TempDir Path tempDir) {
    Path missing = tempDir.resolve("nope.pem");
    OpenBaoClient.OpenBaoConfigurationException error =
        assertThrows(
            OpenBaoClient.OpenBaoConfigurationException.class,
            () -> new OpenBaoClient(config("openmetadata", missing.toString())));
    assertTrue(error.getMessage().contains(missing.toString()));
  }

  @Test
  void validCaCertBundleIsAccepted(@TempDir Path tempDir) throws IOException {
    Path pem = Files.writeString(tempDir.resolve("ca.pem"), CERT_FIXTURE);
    stub("/v1/openmetadata/config", 200, "{\"data\":{}}");
    // Asserts the bundle parses into a trust store. The stub speaks plain HTTP, so this covers the
    // parse path rather than the handshake - which is the part that can fail on operator input.
    new OpenBaoClient(config("openmetadata", pem.toString())).verifyMount();
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
