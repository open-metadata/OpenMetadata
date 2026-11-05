package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;

@Execution(ExecutionMode.CONCURRENT)
class SamlIdentityResolverTest {

  @Test
  void testResolveUsesEmailFirstFlowWhenConfigured() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(new java.util.ArrayList<>(), "email", "displayName"),
            authzConfig(Set.of(), Set.of(), false),
            assertion -> "Legacy Display",
            () -> "openmetadata.org");

    SamlIdentityResolver.ResolvedSamlIdentity identity =
        resolver.resolve(
            new TestAssertion(
                Map.of("email", List.of("john@company.com"), "displayName", List.of("John Doe")),
                "ignored"));

    assertEquals("john@company.com", identity.email());
    assertEquals("John Doe", identity.displayName());
    assertTrue(identity.emailFirstFlow());
  }

  @Test
  void testResolveUsesEmailLocalPartWhenDisplayNameAttributeMissing() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(new java.util.ArrayList<>(), "email", "displayName"),
            authzConfig(null, Set.of(), false),
            assertion -> "Legacy Display",
            () -> "openmetadata.org");

    SamlIdentityResolver.ResolvedSamlIdentity identity =
        resolver.resolve(
            new TestAssertion(Map.of("email", List.of("john@company.com")), "ignored"));

    assertEquals("john@company.com", identity.email());
    assertNull(identity.displayName());
    assertTrue(identity.emailFirstFlow());
  }

  @Test
  void testResolveFailsWhenEmailAttributeMissingInEmailFirstFlow() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(new java.util.ArrayList<>(), "email", "displayName"),
            authzConfig(Set.of(), Set.of(), false),
            assertion -> "Legacy Display",
            () -> "openmetadata.org");

    org.openmetadata.service.exception.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.exception.AuthenticationException.class,
            () -> resolver.resolve(new TestAssertion(Map.of(), "legacy.user@company.com")));

    assertTrue(exception.getMessage().contains("email attribute 'email' not found"));
  }

  @Test
  void testResolveUsesLegacyFlowWhenEmailClaimIsNotConfigured() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(new java.util.ArrayList<>(), null, "displayName"),
            authzConfig(Set.of(), Set.of(), false),
            assertion -> "Legacy Display",
            () -> "openmetadata.org");

    SamlIdentityResolver.ResolvedSamlIdentity identity =
        resolver.resolve(
            new TestAssertion(
                Map.of("email", List.of("john@company.com")), "legacy.user@company.com"));

    assertEquals("legacy.user", identity.userName());
    assertEquals("legacy.user@company.com", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveUsesDefaultDomainForLegacyNameIdWithoutEmail() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(new java.util.ArrayList<>(), null, "displayName"),
            authzConfig(Set.of(), Set.of(), false),
            assertion -> null,
            () -> "openmetadata.org");

    SamlIdentityResolver.ResolvedSamlIdentity identity =
        resolver.resolve(new TestAssertion(Map.of(), "legacy-user"));

    assertEquals("legacy-user", identity.userName());
    assertEquals("legacy-user@openmetadata.org", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveThrowsWhenNameIdIsMissingAndEmailFirstCannotResolve() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(new java.util.ArrayList<>(), null, "displayName"),
            authzConfig(Set.of(), Set.of(), false),
            assertion -> null,
            () -> "openmetadata.org");

    org.openmetadata.service.exception.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.exception.AuthenticationException.class,
            () -> resolver.resolve(new TestAssertion(Map.of(), null)));

    assertTrue(exception.getMessage().contains("NameID not found"));
  }

  @Test
  void testResolveUsesLegacyFlowWhenClaimsMappingExists() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(List.of("username:preferred_username"), "email", "displayName"),
            authzConfig(Set.of(), Set.of(), false),
            assertion -> "Legacy Display",
            () -> "openmetadata.org");

    SamlIdentityResolver.ResolvedSamlIdentity identity =
        resolver.resolve(
            new TestAssertion(
                Map.of("email", List.of("john@company.com")), "legacy.user@company.com"));

    assertEquals("legacy.user", identity.userName());
    assertEquals("legacy.user@company.com", identity.email());
    assertFalse(identity.emailFirstFlow());
  }

  @Test
  void testResolveValidatesAllowedEmailDomains() {
    SamlIdentityResolver resolver =
        new SamlIdentityResolver(
            authConfig(new java.util.ArrayList<>(), "email", "displayName"),
            authzConfig(Set.of("company.com"), Set.of(), false),
            assertion -> "Legacy Display",
            () -> "openmetadata.org");

    org.openmetadata.service.security.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.security.AuthenticationException.class,
            () ->
                resolver.resolve(
                    new TestAssertion(Map.of("email", List.of("john@other.com")), "ignored")));

    assertTrue(exception.getMessage().contains("not in allowed list"));
  }

  private static AuthenticationConfiguration authConfig(
      List<String> principalClaimsMapping, String emailClaim, String displayNameClaim) {
    return new AuthenticationConfiguration()
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

  private record TestAssertion(Map<String, List<String>> attributes, String nameId)
      implements SamlIdentityResolver.SamlAssertionAccessor {

    @Override
    public Collection<String> getAttribute(String attributeName) {
      return attributes.get(attributeName);
    }

    @Override
    public String getNameId() {
      return nameId;
    }
  }
}
