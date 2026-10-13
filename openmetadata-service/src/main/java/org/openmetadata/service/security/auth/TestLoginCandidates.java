/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Objects;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.CustomTrustManagerConfig;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.TruststoreConfig;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

/**
 * Prepares a candidate configuration for a dry run: the validate checks a Test Login starts with,
 * and the Test Login itself.
 *
 * <p>The SSO form holds masked secrets for an existing configuration, so checking or testing an
 * edit that did not retype the client secret or the LDAP bind password would otherwise fail with
 * the mask. The live secret is restored only while the candidate still targets the SAME client at
 * the SAME provider or directory. Restoring it unconditionally — as a save does — would let an admin
 * who cannot read the secret aim a candidate at an endpoint they control and have the server hand
 * the secret over, silently, since a dry run never changes the live configuration.
 */
public final class TestLoginCandidates {

  private TestLoginCandidates() {}

  /** A copy of the candidate with masked secrets restored where that is safe; never mutates it. */
  public static SecurityConfiguration withLiveSecretsRestored(
      SecurityConfiguration candidate, SecurityConfiguration live) {
    SecurityConfiguration copy = JsonUtils.deepCopy(candidate, SecurityConfiguration.class);
    AuthenticationConfiguration candidateAuth = copy.getAuthenticationConfiguration();
    AuthenticationConfiguration liveAuth =
        live == null ? null : live.getAuthenticationConfiguration();
    if (candidateAuth != null && liveAuth != null) {
      restoreOidcSecret(candidateAuth, liveAuth);
      // The trust store password first: the bind check compares the whole trust store setup.
      restoreTrustStorePassword(
          candidateAuth.getLdapConfiguration(), liveAuth.getLdapConfiguration());
      restoreLdapPassword(candidateAuth.getLdapConfiguration(), liveAuth.getLdapConfiguration());
      restoreSamlSecrets(candidateAuth.getSamlConfiguration(), liveAuth.getSamlConfiguration());
    }
    return copy;
  }

  /** Same trust store file in the same format: the password only ever opens that file. */
  private static void restoreTrustStorePassword(
      LdapConfiguration candidate, LdapConfiguration live) {
    CustomTrustManagerConfig candidateStore = customTrustStoreOf(candidate);
    CustomTrustManagerConfig liveStore = customTrustStoreOf(live);
    if (candidateStore != null
        && liveStore != null
        && isMaskedOrMissing(candidateStore.getTrustStoreFilePassword())
        && Objects.equals(candidateStore.getTrustStoreFilePath(), liveStore.getTrustStoreFilePath())
        && Objects.equals(
            candidateStore.getTrustStoreFileFormat(), liveStore.getTrustStoreFileFormat())) {
      candidateStore.setTrustStoreFilePassword(liveStore.getTrustStoreFilePassword());
    }
  }

  private static CustomTrustManagerConfig customTrustStoreOf(LdapConfiguration ldap) {
    TruststoreConfig trustStore = ldap == null ? null : ldap.getTrustStoreConfig();
    return trustStore == null ? null : trustStore.getCustomTrustManagerConfig();
  }

  /**
   * The SP private key only signs requests to the identity provider, and the key store password
   * only opens the configured key store, so both are restored while the candidate keeps the same
   * service provider, identity provider and key store.
   */
  private static void restoreSamlSecrets(SamlSSOClientConfig candidate, SamlSSOClientConfig live) {
    if (candidate != null && live != null && isSameSamlTrust(candidate, live)) {
      ServiceProviderConfig candidateSp = candidate.getSp();
      if (candidateSp != null && isMaskedOrMissing(candidateSp.getSpPrivateKey())) {
        candidateSp.setSpPrivateKey(live.getSp().getSpPrivateKey());
      }
      restoreKeyStorePassword(candidate.getSecurity(), live.getSecurity());
    }
  }

  private static boolean isSameSamlTrust(SamlSSOClientConfig candidate, SamlSSOClientConfig live) {
    return candidate.getSp() != null
        && live.getSp() != null
        && candidate.getIdp() != null
        && live.getIdp() != null
        && Objects.equals(candidate.getSp().getEntityId(), live.getSp().getEntityId())
        && Objects.equals(candidate.getIdp().getEntityId(), live.getIdp().getEntityId())
        && Objects.equals(candidate.getIdp().getSsoLoginUrl(), live.getIdp().getSsoLoginUrl());
  }

  private static void restoreKeyStorePassword(
      SamlSecurityConfig candidate, SamlSecurityConfig live) {
    if (candidate != null
        && live != null
        && isMaskedOrMissing(candidate.getKeyStorePassword())
        && Objects.equals(candidate.getKeyStoreFilePath(), live.getKeyStoreFilePath())
        && Objects.equals(candidate.getKeyStoreAlias(), live.getKeyStoreAlias())) {
      candidate.setKeyStorePassword(live.getKeyStorePassword());
    }
  }

  private static void restoreOidcSecret(
      AuthenticationConfiguration candidateAuth, AuthenticationConfiguration liveAuth) {
    OidcClientConfig candidate = candidateAuth.getOidcConfiguration();
    OidcClientConfig live = liveAuth.getOidcConfiguration();
    if (candidate != null
        && live != null
        && isMaskedOrMissing(candidate.getSecret())
        && isSameOidcClient(candidate, live)
        && isSameProviderLookup(candidateAuth, liveAuth)) {
      candidate.setSecret(live.getSecret());
    }
  }

  private static void restoreLdapPassword(LdapConfiguration candidate, LdapConfiguration live) {
    if (candidate != null
        && live != null
        && isMaskedOrMissing(candidate.getDnAdminPassword())
        && isSameDirectoryBind(candidate, live)) {
      candidate.setDnAdminPassword(live.getDnAdminPassword());
    }
  }

  /** Same client at the same token endpoint: the secret can only go where it already goes. */
  private static boolean isSameOidcClient(OidcClientConfig candidate, OidcClientConfig live) {
    return Objects.equals(candidate.getId(), live.getId())
        && Objects.equals(candidate.getDiscoveryUri(), live.getDiscoveryUri())
        && Objects.equals(candidate.getTenant(), live.getTenant())
        && Objects.equals(candidate.getType(), live.getType());
  }

  /**
   * Without a discovery URI, the validate checks look a custom provider up from the authority, then
   * the server URL, so those decide where the secret goes as well.
   */
  private static boolean isSameProviderLookup(
      AuthenticationConfiguration candidateAuth, AuthenticationConfiguration liveAuth) {
    OidcClientConfig candidate = candidateAuth.getOidcConfiguration();
    OidcClientConfig live = liveAuth.getOidcConfiguration();
    return !nullOrEmpty(live.getDiscoveryUri())
        || (Objects.equals(candidateAuth.getAuthority(), liveAuth.getAuthority())
            && Objects.equals(candidate.getServerUrl(), live.getServerUrl()));
  }

  /**
   * Same bind account on the same server over the same transport protections, so restoring the
   * password cannot send it somewhere new or over a weaker connection. The trust settings count in
   * full: relaxing only the host-name or certificate checks would let an interceptor accept the
   * bind.
   */
  private static boolean isSameDirectoryBind(LdapConfiguration candidate, LdapConfiguration live) {
    return Objects.equals(candidate.getHost(), live.getHost())
        && Objects.equals(candidate.getPort(), live.getPort())
        && Objects.equals(candidate.getDnAdminPrincipal(), live.getDnAdminPrincipal())
        && Objects.equals(candidate.getSslEnabled(), live.getSslEnabled())
        && Objects.equals(candidate.getTruststoreConfigType(), live.getTruststoreConfigType())
        && Objects.equals(candidate.getTruststoreFormat(), live.getTruststoreFormat())
        && Objects.equals(candidate.getTrustStoreConfig(), live.getTrustStoreConfig());
  }

  private static boolean isMaskedOrMissing(String secret) {
    return secret == null || PasswordEntityMasker.PASSWORD_MASK.equals(secret);
  }
}
