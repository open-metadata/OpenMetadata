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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

/**
 * Which identity provider an authentication configuration points at.
 *
 * <p>Only the fields that identify the active provider count. The UI drops the blocks and fields
 * of providers that are not selected, so comparing every field would report a provider switch
 * after any save.
 */
final class IdentityProviderIdentity {
  static final String PROVIDER = "/provider";
  static final String CLIENT_TYPE = "/clientType";
  private static final String LDAP_BLOCK = "/ldapConfiguration";
  private static final String SAML_BLOCK = "/samlConfiguration";
  private static final String OIDC_BLOCK = "/oidcConfiguration";
  private static final Set<AuthProvider> NON_OIDC_PROVIDERS =
      Set.of(AuthProvider.BASIC, AuthProvider.OPENMETADATA, AuthProvider.LDAP, AuthProvider.SAML);
  private static final List<String> OIDC_PUBLIC_IDENTITY = List.of("/authority", "/clientId");
  private static final List<String> OIDC_CONFIDENTIAL_IDENTITY =
      List.of(
          "/authority", "/clientId", "/oidcConfiguration/id", "/oidcConfiguration/discoveryUri");

  private IdentityProviderIdentity() {}

  static JsonNode of(JsonNode authentication) {
    AuthProvider provider = providerOf(authentication);
    ObjectNode identity = JsonNodeFactory.instance.objectNode();
    identity.put(PROVIDER, provider.value());
    identity.put(CLIENT_TYPE, clientTypeOf(authentication).value());
    for (String pointer : identifyingPointers(provider, authentication)) {
      identity.set(pointer, JsonPointers.valueAt(authentication, pointer));
    }
    return SettingValues.canonical(identity);
  }

  static boolean sameProvider(JsonNode left, JsonNode right) {
    return of(left).equals(of(right));
  }

  /** Whether {@code pointer} lies outside the blocks of providers the configuration does not use. */
  static boolean isInActiveBlock(String pointer, JsonNode authentication) {
    AuthProvider provider = providerOf(authentication);
    boolean active = true;
    if (JsonPointers.isUnder(pointer, LDAP_BLOCK)) {
      active = provider == AuthProvider.LDAP;
    } else if (JsonPointers.isUnder(pointer, SAML_BLOCK)) {
      active = provider == AuthProvider.SAML;
    } else if (JsonPointers.isUnder(pointer, OIDC_BLOCK)) {
      active = usesOidcBlock(provider, authentication);
    }
    return active;
  }

  private static List<String> identifyingPointers(AuthProvider provider, JsonNode authentication) {
    return switch (provider) {
      case BASIC, OPENMETADATA -> List.of();
      case LDAP -> List.of("/ldapConfiguration/host");
      case SAML -> List.of("/samlConfiguration/idp/entityId");
      default -> clientTypeOf(authentication) == ClientType.CONFIDENTIAL
          ? OIDC_CONFIDENTIAL_IDENTITY
          : OIDC_PUBLIC_IDENTITY;
    };
  }

  private static boolean usesOidcBlock(AuthProvider provider, JsonNode authentication) {
    return !NON_OIDC_PROVIDERS.contains(provider)
        && clientTypeOf(authentication) == ClientType.CONFIDENTIAL;
  }

  /** Basic and openmetadata are two historical names of the same password authenticator. */
  private static AuthProvider providerOf(JsonNode authentication) {
    String value = JsonPointers.valueAt(authentication, PROVIDER).asText("");
    AuthProvider provider =
        value.isBlank() ? AuthProvider.BASIC : AuthProvider.fromValue(value.strip());
    return provider == AuthProvider.OPENMETADATA ? AuthProvider.BASIC : provider;
  }

  private static ClientType clientTypeOf(JsonNode authentication) {
    String value = JsonPointers.valueAt(authentication, CLIENT_TYPE).asText("");
    return value.isBlank() ? ClientType.PUBLIC : ClientType.fromValue(value.strip());
  }
}
