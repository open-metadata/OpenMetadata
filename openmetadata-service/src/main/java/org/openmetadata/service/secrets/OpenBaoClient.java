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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Minimal client for OpenBao's (and HashiCorp Vault's) KV v2 engine.
 *
 * <p>Deliberately hand-rolled on the {@code jersey-client} and Jackson already present in this
 * module rather than pulling in a Vault SDK: the surface needed is six calls, and a new runtime
 * dependency is a far larger ask of this repository than this class is. The interface is narrow so
 * the transport can be swapped without touching {@link OpenBaoSecretsManager}.
 */
@Slf4j
public class OpenBaoClient implements AutoCloseable {

  private static final String TOKEN_HEADER = "X-Vault-Token";
  private static final String NAMESPACE_HEADER = "X-Vault-Namespace";
  private static final String KV_VALUE_KEY = "value";
  private static final String DEFAULT_AUTH_PATH = "approle";
  private static final String DATA_SEGMENT = "data";
  private static final String METADATA_SEGMENT = "metadata";
  private static final String CONFIG_SEGMENT = "config";
  private static final String TLS_PROTOCOL = "TLS";
  private static final String CERTIFICATE_TYPE = "X.509";

  private final String address;
  private final String mount;
  private final String namespace;
  private final AuthMethod authMethod;
  private final String staticToken;
  private final String roleId;
  private final String secretId;
  private final String authPath;
  private final Client client;

  /**
   * Current auth token. Volatile rather than a map: there is exactly one token in flight, so the
   * project's bounded-cache rule is satisfied by construction rather than by an eviction policy.
   */
  private volatile String currentToken;

  /**
   * Serialises re-authentication. Reads are deliberately not rate-limited upstream, so an expired
   * token under load would otherwise produce one login per in-flight request and could burn through
   * an AppRole's {@code secret_id_num_uses} budget.
   */
  private final Object reauthLock = new Object();

  public enum AuthMethod {
    TOKEN,
    APPROLE;

    static AuthMethod from(final String value) {
      final AuthMethod result;
      if (nullOrEmpty(value)) {
        result = TOKEN;
      } else {
        result = parse(value.trim());
      }
      return result;
    }

    private static AuthMethod parse(final String value) {
      try {
        return AuthMethod.valueOf(value.toUpperCase(Locale.ROOT));
      } catch (IllegalArgumentException e) {
        throw new OpenBaoConfigurationException(
            String.format(
                "Unknown OpenBao `baoAuthMethod` [%s]. Supported values are `token` and `approle`.",
                value));
      }
    }
  }

  /** The mount, address or credentials are wrong. Never raised for a merely missing secret. */
  public static class OpenBaoConfigurationException extends RuntimeException {
    public OpenBaoConfigurationException(final String message) {
      super(message);
    }

    public OpenBaoConfigurationException(final String message, final Throwable cause) {
      super(message, cause);
    }
  }

  /** Any other failure talking to OpenBao. Never raised for a merely missing secret. */
  public static class OpenBaoRequestException extends RuntimeException {
    public OpenBaoRequestException(final String message) {
      super(message);
    }

    public OpenBaoRequestException(final String message, final Throwable cause) {
      super(message, cause);
    }
  }

  /** Immutable view of the provider parameters this client needs. */
  public record OpenBaoConfig(
      String address,
      String mount,
      String namespace,
      String authMethod,
      String token,
      String roleId,
      String secretId,
      String authPath,
      String caCertPath,
      boolean skipTlsVerify,
      int connectTimeoutMs,
      int readTimeoutMs) {}

  public OpenBaoClient(final OpenBaoConfig config) {
    this.address = stripTrailingSlash(config.address());
    this.mount = stripSlashes(config.mount());
    this.namespace = config.namespace();
    this.authMethod = AuthMethod.from(config.authMethod());
    this.staticToken = config.token();
    this.roleId = config.roleId();
    this.secretId = config.secretId();
    this.authPath = resolveAuthPath(config.authPath());
    this.client = buildClient(config);
    authenticate();
  }

  private static String resolveAuthPath(final String configured) {
    return nullOrEmpty(configured) ? DEFAULT_AUTH_PATH : stripSlashes(configured);
  }

  private static Client buildClient(final OpenBaoConfig config) {
    final ClientBuilder builder =
        ClientBuilder.newBuilder()
            .connectTimeout(config.connectTimeoutMs(), TimeUnit.MILLISECONDS)
            .readTimeout(config.readTimeoutMs(), TimeUnit.MILLISECONDS);
    if (config.skipTlsVerify()) {
      warnTlsDisabled(config.address());
      builder.sslContext(insecureSslContext()).hostnameVerifier((hostname, session) -> true);
    } else if (!nullOrEmpty(config.caCertPath())) {
      builder.sslContext(sslContextFromCaCert(config.caCertPath()));
    }
    return builder.build();
  }

  private static void warnTlsDisabled(final String address) {
    // Loud, because a silently-insecure secrets backend is worse than none: the operator believes
    // credentials are protected in transit when they are not.
    LOG.warn(
        "OpenBao TLS certificate verification is DISABLED for [{}] via `baoSkipTlsVerify`. Traffic "
            + "carrying credentials is exposed to interception. Do not use this outside development.",
        address);
  }

  private static SSLContext insecureSslContext() {
    try {
      final SSLContext context = SSLContext.getInstance(TLS_PROTOCOL);
      context.init(null, new TrustManager[] {new TrustEverythingManager()}, new SecureRandom());
      return context;
    } catch (GeneralSecurityException e) {
      throw new OpenBaoConfigurationException(
          "Failed to build an SSL context with certificate verification disabled", e);
    }
  }

  private static SSLContext sslContextFromCaCert(final String caCertPath) {
    try (InputStream in = Files.newInputStream(Path.of(caCertPath))) {
      final KeyStore trustStore = trustStoreOf(loadCertificates(in, caCertPath));
      final TrustManagerFactory factory =
          TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
      factory.init(trustStore);
      final SSLContext context = SSLContext.getInstance(TLS_PROTOCOL);
      context.init(null, factory.getTrustManagers(), null);
      return context;
    } catch (GeneralSecurityException | IOException e) {
      throw new OpenBaoConfigurationException(
          String.format("Failed to load `baoCaCertPath` [%s]: %s", caCertPath, e.getMessage()), e);
    }
  }

  private static Collection<? extends Certificate> loadCertificates(
      final InputStream in, final String caCertPath) throws GeneralSecurityException {
    final Collection<? extends Certificate> certificates =
        CertificateFactory.getInstance(CERTIFICATE_TYPE).generateCertificates(in);
    if (certificates.isEmpty()) {
      throw new OpenBaoConfigurationException(
          String.format("No certificates found in `baoCaCertPath` [%s]", caCertPath));
    }
    return certificates;
  }

  private static KeyStore trustStoreOf(final Collection<? extends Certificate> certificates)
      throws GeneralSecurityException, IOException {
    final KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
    trustStore.load(null, null);
    int index = 0;
    for (Certificate certificate : certificates) {
      trustStore.setCertificateEntry("openbao-ca-" + index++, certificate);
    }
    return trustStore;
  }

  /**
   * Confirms the configured mount is reachable, so a typo fails at boot rather than once per read.
   *
   * <p>Probes {@code /v1/{mount}/config} rather than {@code /v1/sys/mounts}: a least-privilege token
   * is refused {@code sys/mounts}, so that endpoint would fail for a correctly configured
   * deployment.
   */
  public void verifyMount() {
    final int status;
    try (Response response = request(mountUrl(CONFIG_SEGMENT), currentToken).get()) {
      status = response.getStatus();
    } catch (ProcessingException e) {
      throw new OpenBaoConfigurationException(
          String.format(
              "Unable to reach OpenBao at [%s] to verify mount [%s]: %s",
              address, mount, e.getMessage()),
          e);
    }
    if (status != Response.Status.OK.getStatusCode()) {
      throw mountNotReadable(status);
    }
  }

  private OpenBaoConfigurationException mountNotReadable(final int status) {
    // A scoped token gets 403 for a mount its policy does not cover, because the ACL check runs
    // ahead of mount routing - so a wrong mount name and a wrong policy look identical here. Name
    // both, or the operator debugs the wrong one.
    return new OpenBaoConfigurationException(
        String.format(
            "OpenBao mount [%s] at [%s] is not readable (HTTP %d). The mount may not exist, or the "
                + "token's policy may lack `read` on `%s/%s`.",
            mount, address, status, mount, CONFIG_SEGMENT));
  }

  /**
   * Reads a secret.
   *
   * <p>{@link Optional#empty()} means <em>verified absent</em>, never "unknown" - every other
   * outcome throws. This is the single place not-found is decided, and it keys on the response
   * <em>body</em>, not the status code: OpenBao answers 404 both for a missing secret and (for a
   * root-equivalent token) for a missing mount. Treating those alike would route every write on a
   * misconfigured mount to the create branch and discard credentials with no error.
   */
  public Optional<String> read(final String path) {
    final Optional<String> result;
    try (Response response =
        send("read", token -> request(secretUrl(DATA_SEGMENT, path), token).get())) {
      final int status = response.getStatus();
      if (status == Response.Status.OK.getStatusCode()) {
        result = valueOf(readBody(response));
      } else if (status == Response.Status.NOT_FOUND.getStatusCode()) {
        result = classifyNotFound(readBody(response));
      } else {
        throw requestFailure("read", status);
      }
    }
    return result;
  }

  private static Optional<String> valueOf(final JsonNode body) {
    final JsonNode value = body.path(DATA_SEGMENT).path(DATA_SEGMENT).path(KV_VALUE_KEY);
    return value.isMissingNode() || value.isNull() ? Optional.empty() : Optional.of(value.asText());
  }

  private Optional<String> classifyNotFound(final JsonNode body) {
    final JsonNode errors = body.path("errors");
    if (errors.isArray() && !errors.isEmpty()) {
      throw new OpenBaoConfigurationException(
          String.format(
              "OpenBao returned 404 with errors while reading from mount [%s] at [%s]. This means "
                  + "the mount does not exist rather than that the secret is missing.",
              mount, address));
    }
    // Either the secret was never written, or its latest version is soft-deleted. Both are
    // genuinely absent as far as OpenMetadata is concerned.
    return Optional.empty();
  }

  /** Creates the secret, or adds a new version if it exists. Idempotent in one call. */
  public void write(final String path, final String value) {
    final String payload = JsonUtils.pojoToJson(Map.of(DATA_SEGMENT, Map.of(KV_VALUE_KEY, value)));
    try (Response response =
        send(
            "write",
            token ->
                request(secretUrl(DATA_SEGMENT, path), token)
                    .post(Entity.entity(payload, MediaType.APPLICATION_JSON)))) {
      final int status = response.getStatus();
      if (status != Response.Status.OK.getStatusCode()
          && status != Response.Status.NO_CONTENT.getStatusCode()) {
        throw requestFailure("write", status);
      }
    }
  }

  /**
   * Removes every version and the metadata.
   *
   * <p>Deliberately not {@code DELETE .../data/{path}}, which soft-deletes only the latest version
   * and leaves the value recoverable. An entity deletion in OpenMetadata means the credential is
   * gone; leaving readable plaintext history behind would defeat the reason an operator chose an
   * external store. This is irreversible.
   *
   * <p>A 404 is tolerated so that deleting an entity whose secrets are already gone - a partially
   * completed earlier delete, say - does not block the entity delete.
   */
  public void deleteAllVersions(final String path) {
    try (Response response =
        send("delete", token -> request(secretUrl(METADATA_SEGMENT, path), token).delete())) {
      final int status = response.getStatus();
      if (status == Response.Status.NOT_FOUND.getStatusCode()) {
        // Same discrimination as read(): an empty errors array means the secret is already gone
        // (fine, the delete is idempotent), while a populated one means the mount is wrong - and
        // silently reporting success there would leave live credentials behind on every delete.
        classifyNotFound(readBody(response));
      } else if (status != Response.Status.NO_CONTENT.getStatusCode()
          && status != Response.Status.OK.getStatusCode()) {
        throw requestFailure("delete", status);
      }
    }
  }

  /**
   * Runs a call, translating transport failures so they name the backend.
   *
   * <p>Without this a connect refusal or read timeout escapes as a bare {@code ProcessingException}
   * naming neither the address nor the mount - and on the resolution path it would reach the REST
   * layer untranslated, unlike every other failure mode here.
   */
  private Response send(final String operation, final Function<String, Response> call) {
    try {
      return withRetry(call);
    } catch (ProcessingException e) {
      throw new OpenBaoRequestException(
          String.format(
              "OpenBao %s could not reach [%s] (mount [%s]): %s",
              operation, address, mount, e.getMessage()),
          e);
    }
  }

  /**
   * Runs a call, re-authenticating once if the token was rejected.
   *
   * <p>Bounded to a single retry, and only for AppRole - under token auth there is no login to
   * repeat, so a rejection is final. No background renewal thread: this client lives in a
   * process-global singleton, where a daemon thread would outlive any request able to report its
   * failure.
   *
   * <p>The token is passed into the call rather than read from the field inside it. Reading the
   * field twice would let another thread rotate it between the capture and the request, so the
   * token compared below would not be the one the server actually rejected - and a re-authentication
   * that was genuinely needed would be skipped.
   */
  private Response withRetry(final Function<String, Response> call) {
    final String tokenUsed = currentToken;
    Response response = call.apply(tokenUsed);
    if (isTokenRejected(response.getStatus()) && authMethod == AuthMethod.APPROLE) {
      response.close();
      reauthenticateOnce(tokenUsed);
      response = call.apply(currentToken);
    }
    return response;
  }

  /**
   * A rejected token, as opposed to a rejected request.
   *
   * <p>OpenBao answers an expired or invalid token with 403, but a fronting proxy or gateway can
   * turn that into a 401, so both count. The Python ingestion client treats them the same way.
   */
  private static boolean isTokenRejected(final int status) {
    return status == Response.Status.FORBIDDEN.getStatusCode()
        || status == Response.Status.UNAUTHORIZED.getStatusCode();
  }

  /**
   * Re-authenticates only if nobody else already did.
   *
   * <p>Serialising alone is not enough: N concurrent requests all holding the same expired token
   * would each take the lock in turn and each perform a login, which is exactly the stampede that
   * can exhaust an AppRole's {@code secret_id_num_uses}. Comparing against the token the caller
   * actually used collapses those N logins into one.
   */
  private void reauthenticateOnce(final String tokenUsed) {
    synchronized (reauthLock) {
      if (Objects.equals(tokenUsed, currentToken)) {
        authenticate();
      }
    }
  }

  private void authenticate() {
    if (authMethod == AuthMethod.TOKEN) {
      requireParameter(staticToken, "baoToken", "token");
      currentToken = staticToken;
    } else {
      requireParameter(roleId, "baoRoleId", "approle");
      requireParameter(secretId, "baoSecretId", "approle");
      currentToken = loginWithAppRole();
    }
  }

  /**
   * Fails on a missing credential before any request is made.
   *
   * <p>Without this an unset token reaches the server as an empty {@code X-Vault-Token}, and the
   * first symptom is {@code verifyMount()}'s 403 - which advises the operator to check the mount
   * name and the policy, neither of which is the actual problem.
   */
  private static void requireParameter(
      final String value, final String key, final String forAuthMethod) {
    if (nullOrEmpty(value)) {
      throw new OpenBaoConfigurationException(
          String.format(
              "OpenBao `baoAuthMethod` is `%s` but `%s` is missing or empty. Review your "
                  + "configuration.",
              forAuthMethod, key));
    }
  }

  private String loginWithAppRole() {
    final String loginUrl = String.format("%s/v1/auth/%s/login", address, authPath);
    final String payload = JsonUtils.pojoToJson(Map.of("role_id", roleId, "secret_id", secretId));
    try (Response response =
        namespaced(client.target(loginUrl).request(MediaType.APPLICATION_JSON))
            .post(Entity.entity(payload, MediaType.APPLICATION_JSON))) {
      if (response.getStatus() != Response.Status.OK.getStatusCode()) {
        throw new OpenBaoConfigurationException(
            String.format(
                "OpenBao AppRole login at [%s] failed with HTTP %d. Check `baoRoleId`, "
                    + "`baoSecretId` and `baoAuthPath`.",
                loginUrl, response.getStatus()));
      }
      return tokenFrom(readBody(response), loginUrl);
    }
  }

  private static String tokenFrom(final JsonNode body, final String loginUrl) {
    final JsonNode auth = body.path("auth");
    final String token = auth.path("client_token").asText(null);
    if (nullOrEmpty(token)) {
      throw new OpenBaoConfigurationException(
          String.format("OpenBao AppRole login at [%s] returned no client_token", loginUrl));
    }
    LOG.debug(
        "Authenticated to OpenBao via AppRole; lease_duration={}s",
        auth.path("lease_duration").asInt(0));
    return token;
  }

  private Invocation.Builder request(final String url, final String token) {
    return namespaced(
        client.target(url).request(MediaType.APPLICATION_JSON).header(TOKEN_HEADER, token));
  }

  private Invocation.Builder namespaced(final Invocation.Builder builder) {
    // An empty namespace header is not the same as no namespace header - OSS deployments reject it.
    return nullOrEmpty(namespace) ? builder : builder.header(NAMESPACE_HEADER, namespace);
  }

  private String mountUrl(final String segment) {
    return String.format("%s/v1/%s/%s", address, mount, segment);
  }

  private String secretUrl(final String segment, final String path) {
    return String.format("%s/v1/%s/%s/%s", address, mount, segment, path);
  }

  private static JsonNode readBody(final Response response) {
    final String raw = response.hasEntity() ? response.readEntity(String.class) : "";
    return JsonUtils.readTree(nullOrEmpty(raw) ? "{}" : raw);
  }

  /**
   * Carries the status and the operation but never the response body: OpenBao error payloads can
   * name paths and policies, and this message reaches logs and API responses.
   */
  private OpenBaoRequestException requestFailure(final String operation, final int status) {
    return new OpenBaoRequestException(
        String.format(
            "OpenBao %s failed with HTTP %d against mount [%s] at [%s]",
            operation, status, mount, address));
  }

  /** Releases the Jersey connection pool. */
  @Override
  public void close() {
    client.close();
  }

  private static String stripTrailingSlash(final String value) {
    String result = value == null ? "" : value.trim();
    while (result.endsWith("/")) {
      result = result.substring(0, result.length() - 1);
    }
    return result;
  }

  private static String stripSlashes(final String value) {
    String result = value == null ? "" : value.trim();
    while (result.startsWith("/")) {
      result = result.substring(1);
    }
    return stripTrailingSlash(result);
  }

  /** Trusts any certificate. Only ever installed when {@code baoSkipTlsVerify} is set. */
  private static final class TrustEverythingManager implements X509TrustManager {
    @Override
    public void checkClientTrusted(final X509Certificate[] chain, final String authType) {
      // Intentionally empty: verification is disabled by explicit operator opt-in.
    }

    @Override
    public void checkServerTrusted(final X509Certificate[] chain, final String authType) {
      // Intentionally empty: verification is disabled by explicit operator opt-in.
    }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
      return new X509Certificate[0];
    }
  }
}
