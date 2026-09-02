package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;

@Execution(ExecutionMode.CONCURRENT)
class OidcIdentityResolverTest {

  @Test
  void testResolveUsesEmailFirstFlowWhenConfigured() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(true, List.of("preferred_username"), new ArrayList<>(), "email", "name"),
            authzConfig(Set.of(), Set.of(), false),
            Map.of(),
            List.of("preferred_username"),
            "openmetadata.org");

    OidcIdentityResolver.ResolvedOidcIdentity identity =
        resolver.resolve(Map.of("email", "john@company.com", "name", "John Doe"));

    assertEquals("john@company.com", identity.email());
    assertEquals("John Doe", identity.displayName());
    assertTrue(identity.emailFirstFlow());
  }

  @Test
  void testResolveFallsBackToLegacyClaimsWhenEmailClaimMissing() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(true, List.of("preferred_username"), new ArrayList<>(), "email", "name"),
            authzConfig(Set.of(), Set.of(), false),
            Map.of(),
            List.of("preferred_username"),
            "openmetadata.org");

    OidcIdentityResolver.ResolvedOidcIdentity identity =
        resolver.resolve(Map.of("preferred_username", "legacy-user", "given_name", "Legacy"));

    assertEquals("legacy-user", identity.userName());
    assertEquals("legacy-user@openmetadata.org", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveThrowsWhenEmailClaimMissingAndNoFallbackExists() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(true, List.of(), new ArrayList<>(), "email", "name"),
            authzConfig(Set.of(), Set.of(), false),
            Map.of(),
            List.of(),
            "openmetadata.org");

    org.openmetadata.service.security.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.security.AuthenticationException.class,
            () -> resolver.resolve(Map.of("preferred_username", "legacy-user")));

    assertTrue(exception.getMessage().contains("email claim 'email' not found"));
  }

  @Test
  void testResolveUsesLegacyFlowWhenClaimsMappingExists() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(
                true,
                List.of("preferred_username"),
                List.of("username:preferred_username", "email:mail"),
                "email",
                "name"),
            authzConfig(Set.of(), Set.of(), false),
            Map.of("username", "preferred_username", "email", "mail"),
            List.of("preferred_username"),
            "openmetadata.org");

    OidcIdentityResolver.ResolvedOidcIdentity identity =
        resolver.resolve(Map.of("preferred_username", "mapped-user", "mail", "mapped@company.com"));

    assertEquals("mapped-user", identity.userName());
    assertEquals("mapped@company.com", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveUsesLegacyFlowWhenEmailClaimIsNotConfigured() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(true, List.of("preferred_username"), new ArrayList<>(), null, "name"),
            authzConfig(null, Set.of(), false),
            Map.of(),
            List.of("preferred_username"),
            "openmetadata.org");

    OidcIdentityResolver.ResolvedOidcIdentity identity =
        resolver.resolve(Map.of("preferred_username", "legacy-user", "name", "Legacy User"));

    assertEquals("legacy-user", identity.userName());
    assertEquals("legacy-user@openmetadata.org", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveValidatesAllowedEmailDomains() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(true, List.of(), new ArrayList<>(), "email", "name"),
            authzConfig(Set.of("company.com"), Set.of(), false),
            Map.of(),
            List.of(),
            "openmetadata.org");

    org.openmetadata.service.security.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.security.AuthenticationException.class,
            () -> resolver.resolve(Map.of("email", "john@other.com", "name", "John Doe")));

    assertTrue(exception.getMessage().contains("not in allowed list"));
  }

  @Test
  void testResolveRejectsExplicitlyUnverifiedEmail() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(true, List.of(), new ArrayList<>(), "email", "name"),
            authzConfig(Set.of(), Set.of(), false),
            Map.of(),
            List.of(),
            "openmetadata.org");

    // The shared SecurityUtil guard reports auth failures with the security AuthenticationException
    org.openmetadata.service.security.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.security.AuthenticationException.class,
            () ->
                resolver.resolve(
                    Map.of("email", "john@company.com", "email_verified", Boolean.FALSE)));

    assertTrue(exception.getMessage().contains("not verified"));
  }

  @Test
  void testResolveAcceptsEmailWhenVerifiedClaimAbsentOrTrue() {
    OidcIdentityResolver resolver =
        new OidcIdentityResolver(
            authConfig(true, List.of(), new ArrayList<>(), "email", "name"),
            authzConfig(Set.of(), Set.of(), false),
            Map.of(),
            List.of(),
            "openmetadata.org");

    assertEquals("john@company.com", resolver.resolve(Map.of("email", "john@company.com")).email());
    assertEquals(
        "john@company.com",
        resolver
            .resolve(Map.of("email", "john@company.com", "email_verified", Boolean.TRUE))
            .email());
  }

  private static AuthenticationConfiguration authConfig(
      boolean enableSelfSignup,
      List<String> principalClaims,
      List<String> principalClaimsMapping,
      String emailClaim,
      String displayNameClaim) {
    return new AuthenticationConfiguration()
        .withEnableSelfSignup(enableSelfSignup)
        .withJwtPrincipalClaims(principalClaims)
        .withJwtPrincipalClaimsMapping(principalClaimsMapping)
        .withEmailClaim(emailClaim)
        .withDisplayNameClaim(displayNameClaim);
  }

  private static AuthorizerConfiguration authzConfig(
      Set<String> allowedEmailDomains, Set<String> allowedDomains, boolean enforcePrincipalDomain) {
    return new AuthorizerConfiguration()
        .withAllowedEmailDomains(allowedEmailDomains)
        .withAllowedDomains(allowedDomains)
        .withPrincipalDomain("openmetadata.org")
        .withEnforcePrincipalDomain(enforcePrincipalDomain)
        .withAdminPrincipals(Set.of());
  }
}
