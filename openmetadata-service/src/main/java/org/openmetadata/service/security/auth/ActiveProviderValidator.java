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

package org.openmetadata.service.security.auth;

import jakarta.ws.rs.BadRequestException;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.util.ValidatorUtil;

/**
 * Bean-validates a security configuration with the blocks of inactive providers left out.
 *
 * <p>Bean validation cascades into every nested block present in the payload, so an instance that
 * once touched LDAP and still carries a partially-filled {@code ldapConfiguration} could not save
 * its SAML configuration — the request was rejected over required LDAP fields that the active
 * provider never reads. That also made {@code GET} responses un-resubmittable, because {@code GET}
 * omits fields the cascade demanded. Only validation ignores those blocks; they are still stored.
 */
public final class ActiveProviderValidator {
  private ActiveProviderValidator() {}

  /**
   * Validates {@code root}, which holds {@code authConfig}, and throws a 400 on violations.
   *
   * <p>The inactive blocks are detached from the instance that is about to be persisted rather than
   * validating a Jackson deep copy of it: a round trip re-applies the schema defaults that
   * jsonschema2pojo emits as field initializers, so a {@code @NotNull} field that has a default
   * (for example {@code provider}, which defaults to {@code basic}) would be repaired in the copy
   * and left unenforced on the object actually saved.
   */
  public static void validate(Object root, AuthenticationConfiguration authConfig) {
    boolean hasActiveProvider = authConfig != null && authConfig.getProvider() != null;
    ProviderConfigurations detached = hasActiveProvider ? detach(authConfig) : null;
    try {
      String violations = ValidatorUtil.validate(root);
      if (violations != null) {
        throw new BadRequestException("Invalid security configuration: " + violations);
      }
    } finally {
      if (detached != null) {
        detached.restoreTo(authConfig);
      }
    }
  }

  private static ProviderConfigurations detach(AuthenticationConfiguration authConfig) {
    ProviderConfigurations detached =
        new ProviderConfigurations(
            authConfig.getLdapConfiguration(),
            authConfig.getSamlConfiguration(),
            authConfig.getOidcConfiguration());
    clearInactiveProviderConfigurations(authConfig);
    return detached;
  }

  /** The provider blocks lifted off an {@link AuthenticationConfiguration} for validation. */
  private record ProviderConfigurations(
      LdapConfiguration ldap, SamlSSOClientConfig saml, OidcClientConfig oidc) {

    void restoreTo(AuthenticationConfiguration authConfig) {
      authConfig.setLdapConfiguration(ldap);
      authConfig.setSamlConfiguration(saml);
      authConfig.setOidcConfiguration(oidc);
    }
  }

  private static void clearInactiveProviderConfigurations(AuthenticationConfiguration authConfig) {
    AuthProvider provider = authConfig.getProvider();
    if (provider != AuthProvider.LDAP) {
      authConfig.setLdapConfiguration(null);
    }
    if (provider != AuthProvider.SAML) {
      authConfig.setSamlConfiguration(null);
    }
    // oidcConfiguration is also the confidential client's block: a public client never reads it,
    // whatever the provider, so its required fields must not gate a public-client save either.
    if (!usesOidcConfiguration(provider) || authConfig.getClientType() != ClientType.CONFIDENTIAL) {
      authConfig.setOidcConfiguration(null);
    }
  }

  /**
   * Only these providers carry their settings somewhere other than {@code oidcConfiguration}, so
   * naming them — rather than listing the OIDC providers — keeps a new OIDC provider working here
   * without an edit.
   */
  private static boolean usesOidcConfiguration(AuthProvider provider) {
    return switch (provider) {
      case BASIC, LDAP, SAML, OPENMETADATA -> false;
      default -> true;
    };
  }
}
