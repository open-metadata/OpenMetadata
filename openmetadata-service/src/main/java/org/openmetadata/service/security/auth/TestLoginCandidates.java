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

import java.util.Objects;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

/**
 * Prepares a candidate configuration for a Test Login.
 *
 * <p>The SSO form holds masked secrets for an existing configuration, so testing an edit that did
 * not retype the client secret or the LDAP bind password would otherwise fail with the mask. The
 * live secret is restored only while the candidate still targets the SAME client at the SAME
 * provider or directory. Restoring it unconditionally — as a save does — would let an admin who
 * cannot read the secret aim a candidate at an endpoint they control and have the server hand the
 * secret over, silently, since a test never changes the live configuration.
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
      restoreOidcSecret(candidateAuth.getOidcConfiguration(), liveAuth.getOidcConfiguration());
      restoreLdapPassword(candidateAuth.getLdapConfiguration(), liveAuth.getLdapConfiguration());
    }
    return copy;
  }

  private static void restoreOidcSecret(OidcClientConfig candidate, OidcClientConfig live) {
    if (candidate != null
        && live != null
        && isMaskedOrMissing(candidate.getSecret())
        && isSameOidcClient(candidate, live)) {
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
