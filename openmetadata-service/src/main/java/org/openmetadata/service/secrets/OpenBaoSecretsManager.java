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

import com.google.common.annotations.VisibleForTesting;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;

/**
 * Stores OpenMetadata secrets in OpenBao's KV v2 engine.
 *
 * <p>Also serves HashiCorp Vault: OpenBao is a fork of it and keeps the same KV v2 paths and {@code
 * X-Vault-*} headers, so one implementation covers both. Only OpenBao is covered by automated tests.
 */
@Slf4j
public class OpenBaoSecretsManager extends ExternalSecretsManager implements AutoCloseable {

  private static OpenBaoSecretsManager instance = null;

  public static final String ADDRESS = "baoAddress";
  public static final String MOUNT = "baoMount";
  public static final String NAMESPACE = "baoNamespace";
  public static final String AUTH_METHOD = "baoAuthMethod";
  public static final String TOKEN = "baoToken";
  public static final String ROLE_ID = "baoRoleId";
  public static final String SECRET_ID = "baoSecretId";
  public static final String AUTH_PATH = "baoAuthPath";
  public static final String CA_CERT_PATH = "baoCaCertPath";
  public static final String SKIP_TLS_VERIFY = "baoSkipTlsVerify";
  public static final String CONNECT_TIMEOUT_MS = "baoConnectTimeoutMs";
  public static final String READ_TIMEOUT_MS = "baoReadTimeoutMs";

  private static final String DEFAULT_MOUNT = "secret";
  private static final int DEFAULT_CONNECT_TIMEOUT_MS = 5000;
  private static final int DEFAULT_READ_TIMEOUT_MS = 10000;

  /**
   * Characters legal in a KV v2 path segment, applied to prefix and cluster name.
   *
   * <p>Deliberately matches what OpenBao accepts rather than being stricter: dots are valid in KV v2
   * paths (verified), and a deployment already running as {@code prod.eu-west-1} on another provider
   * must not be refused a boot purely by switching to this one. What is excluded is what would break
   * the URL or the path structure - whitespace, {@code /}, {@code %} and friends.
   */
  private static final Pattern LEGAL_PATH = Pattern.compile("[A-Za-z0-9._\\-]*");

  private static final String DEFAULT_AUTH_METHOD = "token";

  private final OpenBaoClient client;

  private OpenBaoSecretsManager(final SecretsConfig secretsConfig) {
    super(SecretsManagerProvider.MANAGED_OPENBAO, secretsConfig);

    final String address = parameter(secretsConfig, ADDRESS, "");
    if (nullOrEmpty(address)) {
      throw new SecretsManagerException(
          "Using the OpenBao Secrets Manager we found a missing or empty `baoAddress` parameter. "
              + "Review your configuration.");
    }
    validatePathComponents(secretsConfig);

    this.client =
        new OpenBaoClient(
            new OpenBaoClient.OpenBaoConfig(
                address,
                parameter(secretsConfig, MOUNT, DEFAULT_MOUNT),
                parameter(secretsConfig, NAMESPACE, ""),
                parameter(secretsConfig, AUTH_METHOD, DEFAULT_AUTH_METHOD),
                parameter(secretsConfig, TOKEN, ""),
                parameter(secretsConfig, ROLE_ID, ""),
                parameter(secretsConfig, SECRET_ID, ""),
                parameter(secretsConfig, AUTH_PATH, ""),
                parameter(secretsConfig, CA_CERT_PATH, ""),
                Boolean.parseBoolean(parameter(secretsConfig, SKIP_TLS_VERIFY, "false")),
                intParameter(secretsConfig, CONNECT_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS),
                intParameter(secretsConfig, READ_TIMEOUT_MS, DEFAULT_READ_TIMEOUT_MS)));
    verifyMountOrRelease();
  }

  /**
   * Probes the mount, releasing the client's connection pool if the probe fails.
   *
   * <p>Without this a failed boot leaves an orphaned Jersey client - and its pool threads - behind
   * with no reference able to close it, which matters most in tests that construct many managers.
   */
  private void verifyMountOrRelease() {
    try {
      client.verifyMount();
    } catch (RuntimeException e) {
      client.close();
      throw e;
    }
  }

  /** Releases the underlying client. The singleton lives for the process, so tests are the caller. */
  @Override
  public void close() {
    client.close();
  }

  /**
   * Test-only constructor taking an already-built client, so the manager can be exercised without a
   * live OpenBao.
   *
   * <p>Needed because {@link OpenBaoClient#verifyMount()} does real I/O. This is unlike {@code
   * AzureKVSecretsManager}, whose {@code buildClient()} performs none and can therefore be
   * constructed with fake credentials; the applicable precedent is {@code KubernetesSecretsManager},
   * which carries a {@code skipInit} flag for the same reason.
   */
  @VisibleForTesting
  OpenBaoSecretsManager(final SecretsConfig secretsConfig, final OpenBaoClient client) {
    super(SecretsManagerProvider.MANAGED_OPENBAO, secretsConfig);
    this.client = client;
  }

  /**
   * Rejects a prefix or cluster name that would produce an illegal KV v2 path.
   *
   * <p>{@code buildSecretId} applies its sanitising pattern only to the id values - prefix and
   * cluster name are interpolated raw - so without this a space or {@code %} in either surfaces as a
   * broken path (or a {@code String.format} failure) at the first save rather than at boot.
   *
   * <p>Lives here rather than on the client because prefix and cluster name are the manager's
   * {@code SecretsConfig}, which the client never sees.
   */
  private static void validatePathComponents(final SecretsConfig secretsConfig) {
    rejectIllegal("clusterName", secretsConfig.clusterName());
    rejectIllegal("prefix", secretsConfig.prefix());
  }

  private static void rejectIllegal(final String field, final String value) {
    if (!nullOrEmpty(value) && !LEGAL_PATH.matcher(value).matches()) {
      throw new SecretsManagerException(
          String.format(
              "The OpenBao Secrets Manager cannot build a valid KV v2 path from %s [%s]. "
                  + "Only letters, digits, `.`, `-` and `_` are allowed.",
              field, value));
    }
  }

  private static String parameter(
      final SecretsConfig secretsConfig, final String key, final String fallback) {
    String result = fallback;
    if (secretsConfig != null && secretsConfig.parameters() != null) {
      final Map<String, Object> properties = secretsConfig.parameters().getAdditionalProperties();
      final Object value = properties != null ? properties.get(key) : null;
      if (value != null && !nullOrEmpty(value.toString())) {
        result = value.toString().trim();
      }
    }
    return result;
  }

  private static int intParameter(
      final SecretsConfig secretsConfig, final String key, final int fallback) {
    final String raw = parameter(secretsConfig, key, "");
    int result = fallback;
    if (!nullOrEmpty(raw)) {
      try {
        final int parsed = Integer.parseInt(raw);
        result = parsed > 0 ? parsed : fallback;
      } catch (NumberFormatException e) {
        LOG.warn("Ignoring unparseable {}=[{}]; using default {}ms", key, raw, fallback);
      }
    }
    return result;
  }

  /**
   * KV v2 paths are relative to the mount, but {@code buildSecretId} emits a leading separator.
   *
   * <p>Stripping it here rather than overriding {@code builSecretsIdConfig()} with {@code
   * needsStartingSeparator = FALSE} is deliberate: that same flag also separates the prefix from the
   * cluster name, so turning it off would concatenate them ({@code team} + {@code prod} ->
   * {@code teamprod}), letting two distinct deployments collide on one path and overwrite each
   * other's credentials.
   */
  private static String toKvPath(final String secretName) {
    String path = secretName == null ? "" : secretName;
    while (path.startsWith("/")) {
      path = path.substring(1);
    }
    return path;
  }

  @Override
  void storeOrUpdateSecret(final String secretName, final String secretValue) {
    // KV v2 POST creates or versions in a single call, so the inherited read-then-branch would only
    // double the request count and require read permission on every write.
    throttle();
    storeSecret(secretName, secretValue);
  }

  @Override
  void storeSecret(final String secretName, final String secretValue) {
    client.write(toKvPath(secretName), cleanNullOrEmpty(secretValue));
  }

  @Override
  void updateSecret(final String secretName, final String secretValue) {
    storeSecret(secretName, secretValue);
  }

  /**
   * Returns {@code null} when the secret is absent, because {@link
   * ExternalSecretsManager#existSecret} treats a null return as "does not exist" and uses it to
   * decide between create and update. Callers that are <em>resolving</em> a stored reference must go
   * through {@link #getSecretValue} instead, which fails loudly.
   */
  @Override
  String getSecret(final String secretName) {
    return client.read(toKvPath(secretName)).orElse(null);
  }

  /**
   * Resolves a stored {@code secret:} reference, failing if it no longer points at anything.
   *
   * <p>The base implementation returns whatever {@link #getSecret} gives it, which would hand a null
   * credential to bot authentication mechanisms and the ingestion-bot JWT - surfacing much later as
   * an unrelated auth failure. A reference that does not resolve is a real error, unlike the
   * existence probe above.
   */
  @Override
  public String getSecretValue(final String secretWithPrefix) {
    final String secretName = secretWithPrefix.split(SECRET_FIELD_PREFIX, 2)[1];
    final Optional<String> value = client.read(toKvPath(secretName));
    if (value.isEmpty()) {
      throw new SecretsManagerException(
          String.format(
              "Secret [%s] is referenced by OpenMetadata but does not exist in OpenBao. "
                  + "It may have been deleted out of band, or the service was renamed.",
              secretName));
    }
    return value.get();
  }

  @Override
  protected void deleteSecretInternal(final String secretName) {
    client.deleteAllVersions(toKvPath(secretName));
  }

  /**
   * Always false, deliberately.
   *
   * <p>Not-found is a value on this provider, not an exception: {@link OpenBaoClient#read} returns
   * an empty {@code Optional}, {@link #getSecret} turns that into {@code null}, and {@code
   * existSecret} reads it from there. Nothing throws a "not found" exception for this method to
   * classify, so returning true for any exception would misreport a genuine read failure - a
   * permission error, say - as a missing secret and silently overwrite a live credential.
   */
  @Override
  protected boolean isNotFoundException(final Exception exception) {
    return false;
  }

  public static OpenBaoSecretsManager getInstance(final SecretsConfig secretsConfig) {
    if (instance == null) {
      instance = new OpenBaoSecretsManager(secretsConfig);
    }
    return instance;
  }

  @VisibleForTesting
  static OpenBaoSecretsManager currentInstance() {
    return instance;
  }

  @VisibleForTesting
  static void resetInstance() {
    instance = null;
  }

  @VisibleForTesting
  static String kvPathForTest(final String secretName) {
    return toKvPath(secretName);
  }
}
