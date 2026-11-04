/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.auth0.jwt.interfaces.DecodedJWT;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Checks that a token signed by the identity provider's keys was issued to this deployment. A
 * valid signature does not say that on its own: Google and Microsoft Entra ID sign every
 * application's tokens with the same keys, so another application's ID token for the same person
 * verifies just as well. The audience must name one of our clients, and the issuer must be our
 * provider whenever its discovery document is known to the server. Without a discovery document,
 * as for a public client, an Entra ID token must still come from the tenant the deployment names:
 * a multi-tenant application registration accepts sign-ins from every tenant.
 */
final class ProviderTokenValidator {
  private static final String TENANT_ID_PLACEHOLDER = "{tenantid}";
  private static final String TENANT_ID_CLAIM = "tid";
  private static final String GOOGLE_ISSUER = "https://accounts.google.com";
  private static final String GOOGLE_SCHEMELESS_ISSUER = "accounts.google.com";

  private final Set<String> clientIds;
  private final Supplier<Optional<String>> providerIssuer;
  private final String tenantId;

  ProviderTokenValidator(Set<String> clientIds, Supplier<Optional<String>> providerIssuer) {
    this(clientIds, providerIssuer, null);
  }

  /** {@code tenantId} is the Entra ID tenant tokens must come from, or null for any tenant. */
  ProviderTokenValidator(
      Set<String> clientIds, Supplier<Optional<String>> providerIssuer, String tenantId) {
    this.clientIds = Set.copyOf(clientIds);
    this.providerIssuer = providerIssuer;
    this.tenantId = tenantId;
  }

  /** For deployments with no OIDC client configured, where there is nothing to compare against. */
  static ProviderTokenValidator acceptingAnyProviderToken() {
    return new ProviderTokenValidator(Set.of(), Optional::empty);
  }

  void validate(DecodedJWT token) {
    requireIssuedToOurClient(token);
    providerIssuer.get().ifPresent(issuer -> requireIssuedBy(issuer, token));
    requireOurTenant(token);
  }

  private void requireOurTenant(DecodedJWT token) {
    if (tenantId == null) {
      return;
    }
    String tokenTenant = token.getClaim(TENANT_ID_CLAIM).asString();
    if (!SecurityUtil.sameIdentifier(tenantId, tokenTenant)) {
      throw AuthenticationException.getInvalidTokenException(
          String.format("Token tenant '%s' is not the tenant configured for sign-in", tokenTenant));
    }
  }

  private void requireIssuedToOurClient(DecodedJWT token) {
    if (!clientIds.isEmpty() && !isIssuedToOurClient(token)) {
      throw AuthenticationException.getInvalidTokenException(
          String.format(
              "Token audience %s does not include a client configured for this deployment",
              listOrEmpty(token.getAudience())));
    }
  }

  private boolean isIssuedToOurClient(DecodedJWT token) {
    return listOrEmpty(token.getAudience()).stream().anyMatch(clientIds::contains);
  }

  private static void requireIssuedBy(String providerIssuer, DecodedJWT token) {
    if (!isIssuedBy(providerIssuer, token)) {
      throw AuthenticationException.getInvalidTokenException(
          String.format(
              "Token issuer '%s' is not the configured identity provider", token.getIssuer()));
    }
  }

  private static boolean isIssuedBy(String providerIssuer, DecodedJWT token) {
    String expectedIssuer = withTokenTenant(providerIssuer, token);
    String issuer = token.getIssuer();
    return expectedIssuer.equals(issuer) || isGoogleSchemelessIssuer(expectedIssuer, issuer);
  }

  /** Multi-tenant Entra ID discovery names the issuer as a template filled in by each tenant. */
  private static String withTokenTenant(String providerIssuer, DecodedJWT token) {
    String tenantId = token.getClaim(TENANT_ID_CLAIM).asString();
    return tenantId == null
        ? providerIssuer
        : providerIssuer.replace(TENANT_ID_PLACEHOLDER, tenantId);
  }

  /** Google documents both forms as the issuer of its ID tokens. */
  private static boolean isGoogleSchemelessIssuer(String expectedIssuer, String issuer) {
    return GOOGLE_ISSUER.equals(expectedIssuer) && GOOGLE_SCHEMELESS_ISSUER.equals(issuer);
  }
}
