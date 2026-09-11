package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;

@Execution(ExecutionMode.CONCURRENT)
class JwtIdentityResolverTest {

  @Test
  void testResolveUsesEmailFirstFlowWhenConfigured() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "email",
            Map.of(),
            List.of("preferred_username"),
            "openmetadata.org",
            email -> "john_a1b2");

    JwtIdentityResolver.ResolvedIdentity identity =
        resolver.resolve(claims(Map.of("email", "john@y.com")), false);

    assertEquals("john_a1b2", identity.userName());
    assertEquals("john@y.com", identity.email());
    assertTrue(identity.emailFirstFlow());
  }

  @Test
  void testResolveFallsBackToLegacyClaimsWhenEmailClaimMissing() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "email",
            Map.of(),
            List.of("preferred_username"),
            "openmetadata.org",
            email -> "ignored");

    JwtIdentityResolver.ResolvedIdentity identity =
        resolver.resolve(claims(Map.of("preferred_username", "legacy-user")), false);

    assertEquals("legacy-user", identity.userName());
    assertEquals("legacy-user@openmetadata.org", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveThrowsWhenEmailClaimMissingAndNoFallbackExists() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver("email", Map.of(), List.of(), "openmetadata.org", email -> "john");

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () -> resolver.resolve(claims(Map.of("preferred_username", "legacy-user")), false));

    assertTrue(exception.getMessage().contains("email claim 'email' not found"));
  }

  @Test
  void testResolveDoesNotFallBackWhenUserResolutionFails() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "email",
            Map.of(),
            List.of("preferred_username"),
            "openmetadata.org",
            email -> {
              throw new AuthenticationException("User with email " + email + " is not registered");
            });

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () ->
                resolver.resolve(
                    claims(Map.of("email", "victim@attacker.org", "preferred_username", "victim")),
                    false));

    assertTrue(exception.getMessage().contains("not registered"));
  }

  @Test
  void testResolveUsesLegacyFlowForBotUsers() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "email", Map.of(), List.of("sub"), "openmetadata.org", email -> "ignored");

    JwtIdentityResolver.ResolvedIdentity identity =
        resolver.resolve(claims(Map.of("sub", "bot-service", "bot", true)), true);

    assertEquals("bot-service", identity.userName());
    assertEquals("bot-service@openmetadata.org", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveUsesLegacyFlowWhenClaimsMappingExists() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "email",
            Map.of("username", "preferred_username", "email", "mail"),
            List.of("sub"),
            "openmetadata.org",
            email -> "ignored");

    JwtIdentityResolver.ResolvedIdentity identity =
        resolver.resolve(
            claims(Map.of("preferred_username", "mapped-user", "mail", "mapped@company.com")),
            false);

    assertEquals("mapped-user", identity.userName());
    assertEquals("mapped@company.com", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveRejectsExplicitlyUnverifiedEmailOnRequestPath() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "email", Map.of(), List.of(), "openmetadata.org", email -> "victim");

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () ->
                resolver.resolve(
                    claims(Map.of("email", "victim@company.com", "email_verified", false)), false));

    assertTrue(exception.getMessage().contains("not verified"));
  }

  @Test
  void testResolveAcceptsEmailWhenVerifiedClaimAbsentOrTrue() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver("email", Map.of(), List.of(), "openmetadata.org", email -> "john");

    assertEquals(
        "john", resolver.resolve(claims(Map.of("email", "john@company.com")), false).userName());
    assertEquals(
        "john",
        resolver
            .resolve(claims(Map.of("email", "john@company.com", "email_verified", true)), false)
            .userName());
  }

  @Test
  void testLegacyFlowRejectsUnverifiedEmail() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "", Map.of(), List.of("preferred_username"), "openmetadata.org", email -> "john");

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () ->
                resolver.resolve(
                    claims(
                        Map.of(
                            "preferred_username",
                            "john",
                            "email",
                            "john@y.com",
                            "email_verified",
                            false)),
                    false));

    assertTrue(
        exception.getMessage().contains("not verified"),
        "Expected an unverified-email rejection but got: " + exception.getMessage());
  }

  @Test
  void testLegacyFlowAllowsVerifiedEmail() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "", Map.of(), List.of("preferred_username"), "openmetadata.org", email -> "john");

    JwtIdentityResolver.ResolvedIdentity identity =
        resolver.resolve(
            claims(
                Map.of(
                    "preferred_username", "john", "email", "john@y.com", "email_verified", true)),
            false);

    assertEquals("john", identity.userName());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testBotTokensAreUnaffectedByTheVerifiedEmailGuard() {
    JwtIdentityResolver resolver =
        new JwtIdentityResolver(
            "", Map.of(), List.of("preferred_username"), "openmetadata.org", email -> "ingestion");

    // OpenMetadata-issued bot tokens carry no email_verified claim; the guard must stay inert.
    JwtIdentityResolver.ResolvedIdentity identity =
        resolver.resolve(claims(Map.of("preferred_username", "ingestion-bot")), true);

    assertEquals("ingestion-bot", identity.userName());
  }

  private static Map<String, Claim> claims(Map<String, Object> values) {
    String token = JWT.create().withPayload(values).sign(Algorithm.none());
    return JWT.decode(token).getClaims();
  }
}
