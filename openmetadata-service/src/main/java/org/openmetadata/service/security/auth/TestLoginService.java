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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.system.TestLoginDomainCheck;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.EmailFirstUserProvisioner;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.JwtIdentityResolver;
import org.openmetadata.service.security.OidcIdentityResolver;
import org.openmetadata.service.security.SamlIdentityResolver;
import org.openmetadata.service.security.SecurityUtil;

/**
 * Performs a dry-run "Test Login" against a candidate (unsaved) security configuration.
 *
 * <p>Identity is resolved through the very same resolvers the live login paths use — {@link
 * JwtIdentityResolver} for a browser-held id_token, {@link OidcIdentityResolver} for the OIDC login
 * callback, {@link SamlIdentityResolver} for SAML — so the dry-run cannot drift from real login about
 * which claim wins, whether email-first applies, or whether an unverified email is rejected. Those
 * resolvers are pure; the write boundary they feed, {@link EmailFirstUserProvisioner}, is the one
 * class this service must never reach.
 *
 * <p>It therefore performs ZERO side effects: it never creates or updates a user, never issues an
 * OpenMetadata JWT/refresh token, and never starts a session. All callers must already be authorized
 * as an admin — this class issues no credentials of its own.
 *
 * <p>Each login path enforces its domain rules differently, so every entry point supplies the rule
 * its live counterpart applies. Where that rule lives inside a resolver, the resolver runs against a
 * relaxed copy of the authorizer config (see {@link #withDomainEnforcementRelaxed}) and the rule is
 * applied separately — otherwise a domain violation would throw before there is any identity to show,
 * and the admin would get a bare failure instead of "we resolved you as X, and rule Y rejects it".
 */
@Slf4j
public final class TestLoginService {

  /** One login path's live domain rule. The live validators reject a domain only by throwing. */
  @FunctionalInterface
  private interface DomainRule {
    void enforce(String email);
  }

  private record ResolutionContext(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authzConfig,
      TestLoginProtocol protocol,
      TestLoginStageRecorder recorder) {}

  /** What a resolver produced for one login, before any provisioning would occur. */
  private record Resolution(
      String principal,
      String email,
      List<String> roles,
      List<String> teams,
      DomainRule domainRule) {}

  /** Identity a credential-based login resolved from the candidate directory or user store. */
  public record ResolvedCredentialIdentity(
      String userName, String email, List<String> roles, List<String> teams) {}

  private TestLoginService() {}

  /** Validate a browser-obtained OIDC id_token against the candidate config and resolve identity. */
  public static TestLoginResult resolveFromIdToken(
      SecurityConfiguration securityConfig, String idToken) {
    ResolutionContext ctx = contextFor(securityConfig, TestLoginProtocol.OIDC, newOidcRecorder());
    recordBrowserRoundTrip(ctx.recorder());
    return validateToken(ctx, idToken)
        .map(claims -> resolve(ctx, () -> resolveJwtClaims(ctx, claims)))
        .orElseGet(() -> failure(ctx.protocol(), ctx.recorder()));
  }

  private static Optional<Map<String, Claim>> validateToken(ResolutionContext ctx, String idToken) {
    Optional<Map<String, Claim>> claims = Optional.empty();
    try {
      // Intentionally a fresh, uncached JwtFilter built from the CANDIDATE config:
      // it must validate against the candidate's publicKeyUrls (not the live ones).
      // Constructing it triggers a JWKS fetch from the candidate IdP; this endpoint
      // is admin-only and low-frequency, and a slow/unreachable candidate authority
      // will fail this single request rather than affect live authentication.
      JwtFilter transientFilter = new JwtFilter(ctx.authConfig(), ctx.authzConfig());
      claims = Optional.of(transientFilter.validateJwtAndGetClaims(idToken));
      ctx.recorder().pass(TestLoginStage.TOKEN_VALIDATED);
    } catch (Exception e) {
      // JwtFilter's constructor and validateJwtAndGetClaims are @SneakyThrows, so a JWKS fetch
      // failure arrives as a checked exception; every failure must become a typed result rather
      // than a 500.
      LOG.debug("Test login token validation failed", e);
      ctx.recorder()
          .fail(TestLoginStage.TOKEN_VALIDATED, "Token validation failed: " + rootMessage(e));
    }
    return claims;
  }

  /**
   * Resolve the identity that the given claims would produce under the candidate config. Pure (no
   * network, no persistence) so it can be unit-tested with synthetic claims for each provider.
   */
  public static TestLoginResult resolveIdentityFromClaims(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authzConfig,
      Map<String, Claim> claims) {
    ResolutionContext ctx =
        new ResolutionContext(authConfig, authzConfig, TestLoginProtocol.OIDC, newOidcRecorder());
    recordBrowserRoundTrip(ctx.recorder());
    ctx.recorder().pass(TestLoginStage.TOKEN_VALIDATED);
    return resolve(ctx, () -> resolveJwtClaims(ctx, claims));
  }

  /**
   * Resolve the identity an OIDC authorization-code login would produce from the claims the
   * candidate provider returned. Mirrors the login callback rather than the request filter, so it
   * exercises {@link OidcIdentityResolver} exactly as a real sign-in does.
   */
  public static TestLoginResult resolveOidcCallbackIdentity(
      SecurityConfiguration securityConfig,
      Map<String, Object> claims,
      TestLoginStageRecorder recorder) {
    ResolutionContext ctx = contextFor(securityConfig, TestLoginProtocol.OIDC, recorder);
    return resolve(ctx, () -> resolveOidcClaims(ctx, claims));
  }

  /**
   * Resolve the identity a SAML login would produce from a candidate-validated assertion. The
   * accessor is the same view {@link SamlIdentityResolver} takes on the live path, so attribute
   * precedence and the NameID fallback behave identically.
   *
   * @param defaultDomain domain appended to a NameID that is not an email, derived from the
   *     CANDIDATE config — never the live one
   * @param teams team names the assertion's team attribute carries
   */
  public static TestLoginResult resolveSamlIdentity(
      SecurityConfiguration securityConfig,
      SamlIdentityResolver.SamlAssertionAccessor assertion,
      String defaultDomain,
      List<String> teams,
      TestLoginStageRecorder recorder) {
    ResolutionContext ctx = contextFor(securityConfig, TestLoginProtocol.SAML, recorder);
    return resolve(ctx, () -> resolveSamlAssertion(ctx, assertion, defaultDomain, teams));
  }

  /**
   * Build the result for a credential-based (LDAP/Basic) login that has already been verified
   * against the candidate. Roles and teams are supplied by the caller because they come from a
   * directory lookup rather than from token claims.
   */
  public static TestLoginResult resolveCredentialIdentity(
      SecurityConfiguration securityConfig,
      TestLoginProtocol protocol,
      ResolvedCredentialIdentity identity,
      TestLoginStageRecorder recorder) {
    ResolutionContext ctx = contextFor(securityConfig, protocol, recorder);
    return resolve(
        ctx,
        () ->
            new Resolution(
                identity.userName(),
                identity.email(),
                listOrEmpty(identity.roles()),
                listOrEmpty(identity.teams()),
                credentialDomainRule(protocol, ctx.authzConfig())));
  }

  private static Resolution resolveJwtClaims(ResolutionContext ctx, Map<String, Claim> claims) {
    // The username resolver is deliberately the pure local-part derivation: this must not touch
    // the database, and the dry-run is validating configuration rather than predicting the stored
    // username of an account that may not exist yet. JwtIdentityResolver applies no domain rule,
    // so it gets the real authorizer config — its principal-domain fallback depends on it.
    JwtIdentityResolver.ResolvedIdentity identity =
        new JwtIdentityResolver(
                ctx.authConfig().getEmailClaim(),
                principalClaimsMapping(ctx.authConfig()),
                listOrEmpty(ctx.authConfig().getJwtPrincipalClaims()),
                principalDomainOf(ctx.authzConfig()),
                TestLoginService::localPartOf)
            .resolve(claims, SecurityUtil.isBot(claims));
    return new Resolution(
        identity.userName(),
        identity.email(),
        rolesFromClaims(ctx.authzConfig(), claims),
        teamsFromClaims(ctx.authConfig(), claims),
        requestFilterDomainRule(ctx, claims, identity.emailFirstFlow()));
  }

  private static Resolution resolveOidcClaims(ResolutionContext ctx, Map<String, Object> claims) {
    OidcIdentityResolver.ResolvedOidcIdentity identity =
        new OidcIdentityResolver(
                ctx.authConfig(),
                withDomainEnforcementRelaxed(ctx.authzConfig()),
                principalClaimsMapping(ctx.authConfig()),
                listOrEmpty(ctx.authConfig().getJwtPrincipalClaims()),
                principalDomainOf(ctx.authzConfig()))
            .resolve(claims);
    return new Resolution(
        userNameOrLocalPart(identity.userName(), identity.email()),
        identity.email(),
        rolesFromClaims(ctx.authzConfig(), claims),
        teamsFromClaims(ctx.authConfig(), claims),
        configuredEmailDomainRule(ctx.authzConfig()));
  }

  private static Resolution resolveSamlAssertion(
      ResolutionContext ctx,
      SamlIdentityResolver.SamlAssertionAccessor assertion,
      String defaultDomain,
      List<String> teams) {
    SamlIdentityResolver.ResolvedSamlIdentity identity =
        new SamlIdentityResolver(
                ctx.authConfig(),
                withDomainEnforcementRelaxed(ctx.authzConfig()),
                accessor -> null,
                () -> defaultDomain)
            .resolve(assertion);
    // SAML has no provider-roles channel; team membership comes from the assertion's attributes.
    return new Resolution(
        userNameOrLocalPart(identity.userName(), identity.email()),
        identity.email(),
        List.of(),
        listOrEmpty(teams),
        configuredEmailDomainRule(ctx.authzConfig()));
  }

  private static TestLoginResult resolve(ResolutionContext ctx, Supplier<Resolution> resolver) {
    ctx.recorder().pass(TestLoginStage.CLAIMS_EXTRACTED);
    return resolveOrRecordFailure(ctx, resolver)
        .map(resolution -> buildResolved(ctx, resolution))
        .orElseGet(() -> failure(ctx.protocol(), ctx.recorder()));
  }

  private static Optional<Resolution> resolveOrRecordFailure(
      ResolutionContext ctx, Supplier<Resolution> resolver) {
    Optional<Resolution> resolution = Optional.empty();
    try {
      resolution = Optional.of(resolver.get());
      ctx.recorder().pass(TestLoginStage.IDENTITY_RESOLVED, resolution.get().email());
    } catch (RuntimeException e) {
      LOG.debug("Test login could not resolve an identity", e);
      ctx.recorder()
          .fail(
              TestLoginStage.IDENTITY_RESOLVED,
              "Could not resolve identity from claims: " + rootMessage(e));
    }
    return resolution;
  }

  private static TestLoginResult buildResolved(ResolutionContext ctx, Resolution resolution) {
    ctx.recorder().pass(TestLoginStage.ROLES_MAPPED);
    TestLoginDomainCheck domainCheck = checkDomain(ctx, resolution);
    TestLoginStageRecorder recorder = ctx.recorder();
    return new TestLoginResult()
        .withProtocol(ctx.protocol())
        .withStage(recorder.furthestReached())
        .withStages(recorder.toStageResults())
        .withResolvedPrincipal(resolution.principal())
        .withResolvedEmail(resolution.email())
        .withMappedRoles(resolution.roles())
        .withMappedTeams(resolution.teams())
        .withDomainCheck(domainCheck)
        .withErrors(recorder.failureMessages())
        .withStatus(
            recorder.hasFailure() ? TestLoginResult.Status.FAILED : TestLoginResult.Status.SUCCESS);
  }

  private static TestLoginDomainCheck checkDomain(ResolutionContext ctx, Resolution resolution) {
    Optional<String> rejection = domainRejectionOf(resolution.domainRule(), resolution.email());
    rejection.ifPresentOrElse(
        reason -> ctx.recorder().fail(TestLoginStage.DOMAIN_CHECKED, reason),
        () -> ctx.recorder().pass(TestLoginStage.DOMAIN_CHECKED));
    String domain = domainOf(resolution.email());
    return new TestLoginDomainCheck()
        .withEnforced(Boolean.TRUE.equals(ctx.authzConfig().getEnforcePrincipalDomain()))
        .withPrincipalDomain(ctx.authzConfig().getPrincipalDomain())
        // Report only a domain actually derived; an empty string reads like a failed check.
        .withResolvedDomain(nullOrEmpty(domain) ? null : domain)
        .withPassed(rejection.isEmpty());
  }

  private static Optional<String> domainRejectionOf(DomainRule rule, String email) {
    Optional<String> rejection = Optional.empty();
    try {
      rule.enforce(email);
    } catch (RuntimeException e) {
      LOG.debug("Test login domain rule rejected the resolved identity", e);
      rejection = Optional.of(rootMessage(e));
    }
    return rejection;
  }

  /**
   * The rule the request filter applies to a browser-held id_token: email-first logins are checked
   * against allowedEmailDomains, legacy logins against the principal-domain rules.
   */
  private static DomainRule requestFilterDomainRule(
      ResolutionContext ctx, Map<String, Claim> claims, boolean emailFirstFlow) {
    AuthorizerConfiguration authz = ctx.authzConfig();
    DomainRule legacyRule =
        email ->
            SecurityUtil.validateDomainEnforcement(
                principalClaimsMapping(ctx.authConfig()),
                listOrEmpty(ctx.authConfig().getJwtPrincipalClaims()),
                claims,
                authz.getPrincipalDomain(),
                authz.getAllowedDomains(),
                Boolean.TRUE.equals(authz.getEnforcePrincipalDomain()));
    return emailFirstFlow ? configuredEmailDomainRule(authz) : legacyRule;
  }

  /** The rule every interactive login path applies before provisioning: OIDC, SAML and LDAP. */
  private static DomainRule configuredEmailDomainRule(AuthorizerConfiguration authz) {
    return email ->
        SecurityUtil.validateConfiguredEmailDomain(
            email,
            authz.getAllowedEmailDomains() == null
                ? new ArrayList<>()
                : new ArrayList<>(authz.getAllowedEmailDomains()),
            authz.getPrincipalDomain(),
            authz.getAllowedDomains(),
            authz.getEnforcePrincipalDomain());
  }

  /**
   * Basic login authenticates an account that already exists and applies no domain rule — only
   * registration does. LDAP runs the same pre-provisioning check as the other interactive paths.
   */
  private static DomainRule credentialDomainRule(
      TestLoginProtocol protocol, AuthorizerConfiguration authz) {
    return protocol == TestLoginProtocol.LDAP ? configuredEmailDomainRule(authz) : email -> {};
  }

  /**
   * A copy of the authorizer config with the domain rules switched off. {@link
   * SecurityUtil#validateConfiguredEmailDomain} is a no-op when no allowedEmailDomains are set and
   * enforcePrincipalDomain is false, so a resolver given this copy yields the identity without
   * throwing — leaving the dry-run free to apply and report the real rule itself.
   */
  private static AuthorizerConfiguration withDomainEnforcementRelaxed(
      AuthorizerConfiguration authzConfig) {
    return JsonUtils.deepCopy(authzConfig, AuthorizerConfiguration.class)
        .withAllowedEmailDomains(null)
        .withEnforcePrincipalDomain(false);
  }

  private static ResolutionContext contextFor(
      SecurityConfiguration securityConfig,
      TestLoginProtocol protocol,
      TestLoginStageRecorder recorder) {
    return new ResolutionContext(
        securityConfig.getAuthenticationConfiguration(),
        securityConfig.getAuthorizerConfiguration(),
        protocol,
        recorder);
  }

  private static TestLoginStageRecorder newOidcRecorder() {
    return TestLoginStageRecorder.forProtocol(TestLoginProtocol.OIDC);
  }

  private static void recordBrowserRoundTrip(TestLoginStageRecorder recorder) {
    recorder.pass(TestLoginStage.STARTED);
    recorder.pass(TestLoginStage.REDIRECTED);
    recorder.pass(TestLoginStage.TOKEN_RECEIVED);
  }

  private static Map<String, String> principalClaimsMapping(
      AuthenticationConfiguration authConfig) {
    return SecurityUtil.buildPrincipalClaimsMapping(authConfig.getJwtPrincipalClaimsMapping());
  }

  /** Same derivation the live OIDC handler uses for its principal-domain fallback. */
  private static String principalDomainOf(AuthorizerConfiguration authz) {
    return SecurityUtil.resolvePrincipalDomain(
        authz.getPrincipalDomain(), authz.getAllowedEmailDomains(), authz.getAllowedDomains());
  }

  private static List<String> rolesFromClaims(
      AuthorizerConfiguration authzConfig, Map<String, ?> claims) {
    if (!Boolean.TRUE.equals(authzConfig.getUseRolesFromProvider())
        || !claims.containsKey(ROLES_CLAIM)) {
      return List.of();
    }
    // Same reader as the login path - a provider that emits a lone role as a scalar string must
    // not be reported here as having no roles when login would grant it.
    return SecurityUtil.getClaimAsList(claims.get(ROLES_CLAIM));
  }

  private static List<String> teamsFromClaims(
      AuthenticationConfiguration authConfig, Map<String, ?> claims) {
    return listOrEmpty(
        SecurityUtil.findTeamsFromClaims(authConfig.getJwtTeamClaimMapping(), claims));
  }

  /** Pure stand-in for the request path's repository lookup; see resolveJwtClaims. */
  private static String localPartOf(String email) {
    return email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
  }

  /**
   * The email-first resolvers leave userName null on purpose — the live path fills it from the user
   * repository. The dry-run must not query the database, so it reports the local part, which is what
   * provisioning derives for an account that does not exist yet.
   */
  private static String userNameOrLocalPart(String userName, String email) {
    if (!nullOrEmpty(userName)) {
      return userName;
    }
    return nullOrEmpty(email) ? null : localPartOf(email);
  }

  private static String domainOf(String email) {
    String domain = "";
    if (!nullOrEmpty(email) && email.contains("@")) {
      domain = email.substring(email.indexOf('@') + 1);
    }
    return domain;
  }

  /** Build a failed result carrying the stage timeline recorded so far. */
  public static TestLoginResult failure(
      TestLoginProtocol protocol, TestLoginStageRecorder recorder) {
    return new TestLoginResult()
        .withStatus(TestLoginResult.Status.FAILED)
        .withProtocol(protocol)
        .withStage(recorder.furthestReached())
        .withStages(recorder.toStageResults())
        .withErrors(recorder.failureMessages());
  }

  public static String rootMessage(Throwable t) {
    String message = t.getMessage();
    return nullOrEmpty(message) ? t.getClass().getSimpleName() : message;
  }
}
