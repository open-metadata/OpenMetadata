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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.jwt.JWTTokenGenerator.ROLES_CLAIM;

import com.auth0.jwt.interfaces.Claim;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.system.TestLoginDomainCheck;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.SecurityUtil;

/**
 * Performs a dry-run "Test Login" against a candidate (unsaved) security configuration.
 *
 * <p>This resolves the identity, roles, teams and domain outcome that a real login WOULD produce,
 * by reusing the exact same validation ({@link JwtFilter#validateJwtAndGetClaims}) and resolution
 * ({@link SecurityUtil}) used by the live authentication filter. It deliberately performs ZERO side
 * effects: it never creates or updates a user, never issues an OpenMetadata JWT/refresh token, and
 * never starts a session. All callers must already be authorized as an admin — this class issues no
 * credentials of its own.
 */
@Slf4j
public final class TestLoginService {
  private static final String STAGE_TOKEN_VALIDATED = "TOKEN_VALIDATED";
  private static final String STAGE_CLAIMS_EXTRACTED = "CLAIMS_EXTRACTED";
  private static final String STAGE_DOMAIN_CHECKED = "DOMAIN_CHECKED";

  private TestLoginService() {}

  /** Validate a browser-obtained OIDC id_token against the candidate config and resolve identity. */
  public static TestLoginResult resolveFromIdToken(
      SecurityConfiguration securityConfig, String idToken) {
    AuthenticationConfiguration authConfig = securityConfig.getAuthenticationConfiguration();
    AuthorizerConfiguration authzConfig = securityConfig.getAuthorizerConfiguration();
    TestLoginResult result;
    try {
      Map<String, Claim> claims = validateToken(authConfig, authzConfig, idToken);
      result = resolveIdentityFromClaims(authConfig, authzConfig, claims);
    } catch (Exception e) {
      LOG.debug("Test login token validation failed", e);
      result = failure(STAGE_TOKEN_VALIDATED, "Token validation failed: " + rootMessage(e));
    }
    return result;
  }

  private static Map<String, Claim> validateToken(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authzConfig, String idToken) {
    JwtFilter transientFilter = new JwtFilter(authConfig, authzConfig);
    return transientFilter.validateJwtAndGetClaims(idToken);
  }

  /**
   * Resolve the identity that the given claims would produce under the candidate config. Pure (no
   * network, no persistence) so it can be unit-tested with synthetic claims for each provider.
   */
  public static TestLoginResult resolveIdentityFromClaims(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authzConfig,
      Map<String, Claim> claims) {
    Map<String, String> mapping = buildClaimsMapping(authConfig.getJwtPrincipalClaimsMapping());
    List<String> order = listOrEmpty(authConfig.getJwtPrincipalClaims());
    TestLoginResult result;
    try {
      String principal = SecurityUtil.findUserNameFromClaims(mapping, order, claims);
      String email =
          SecurityUtil.findEmailFromClaims(
              mapping, order, claims, authzConfig.getPrincipalDomain());
      result = buildResolved(authConfig, authzConfig, claims, mapping, order, principal, email);
    } catch (Exception e) {
      LOG.debug("Test login could not resolve identity from claims", e);
      result =
          failure(
              STAGE_CLAIMS_EXTRACTED, "Could not resolve identity from claims: " + rootMessage(e));
    }
    return result;
  }

  private static TestLoginResult buildResolved(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authzConfig,
      Map<String, Claim> claims,
      Map<String, String> mapping,
      List<String> order,
      String principal,
      String email) {
    TestLoginDomainCheck domainCheck = checkDomain(authzConfig, mapping, order, claims, email);
    boolean domainOk = Boolean.TRUE.equals(domainCheck.getPassed());
    TestLoginResult result =
        new TestLoginResult()
            .withStage(STAGE_DOMAIN_CHECKED)
            .withResolvedPrincipal(principal)
            .withResolvedEmail(email)
            .withMappedRoles(resolveRoles(authzConfig, claims))
            .withMappedTeams(
                listOrEmpty(
                    SecurityUtil.findTeamsFromClaims(authConfig.getJwtTeamClaimMapping(), claims)))
            .withDomainCheck(domainCheck)
            .withStatus(domainOk ? TestLoginResult.Status.SUCCESS : TestLoginResult.Status.FAILED);
    if (!domainOk) {
      result.withErrors(
          List.of("The resolved identity does not satisfy the configured principal-domain rules."));
    }
    return result;
  }

  private static TestLoginDomainCheck checkDomain(
      AuthorizerConfiguration authzConfig,
      Map<String, String> mapping,
      List<String> order,
      Map<String, Claim> claims,
      String email) {
    boolean enforce = authzConfig.getEnforcePrincipalDomain();
    boolean passed = true;
    try {
      SecurityUtil.validateDomainEnforcement(
          mapping,
          order,
          claims,
          authzConfig.getPrincipalDomain(),
          authzConfig.getAllowedDomains(),
          enforce);
    } catch (Exception e) {
      LOG.debug("Test login domain enforcement rejected the resolved identity", e);
      passed = false;
    }
    return new TestLoginDomainCheck()
        .withEnforced(enforce)
        .withPrincipalDomain(authzConfig.getPrincipalDomain())
        .withResolvedDomain(domainOf(email))
        .withPassed(passed);
  }

  private static List<String> resolveRoles(
      AuthorizerConfiguration authzConfig, Map<String, Claim> claims) {
    List<String> roles = List.of();
    if (authzConfig.getUseRolesFromProvider() && claims.containsKey(ROLES_CLAIM)) {
      List<String> claimRoles = claims.get(ROLES_CLAIM).asList(String.class);
      if (!nullOrEmpty(claimRoles)) {
        roles = claimRoles;
      }
    }
    return roles;
  }

  private static Map<String, String> buildClaimsMapping(List<String> rawMapping) {
    return listOrEmpty(rawMapping).stream()
        .map(s -> s.split(":"))
        .filter(parts -> parts.length == 2)
        .collect(Collectors.toMap(parts -> parts[0], parts -> parts[1]));
  }

  private static String domainOf(String email) {
    String domain = "";
    if (!nullOrEmpty(email) && email.contains("@")) {
      domain = email.substring(email.indexOf('@') + 1);
    }
    return domain;
  }

  private static TestLoginResult failure(String stage, String message) {
    return new TestLoginResult()
        .withStatus(TestLoginResult.Status.FAILED)
        .withStage(stage)
        .withErrors(List.of(message));
  }

  private static String rootMessage(Throwable t) {
    String message = t.getMessage();
    return nullOrEmpty(message) ? t.getClass().getSimpleName() : message;
  }
}
