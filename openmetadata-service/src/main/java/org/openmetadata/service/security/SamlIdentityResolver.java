package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.SecurityUtil.requireEmailWithDomain;
import static org.openmetadata.service.security.SecurityUtil.validateConfiguredEmailDomain;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.exception.AuthenticationException;

@Slf4j
public class SamlIdentityResolver {

  public interface SamlAssertionAccessor {
    Collection<String> getAttribute(String attributeName);

    String getNameId();
  }

  public record ResolvedSamlIdentity(
      String userName, String email, String displayName, boolean emailFirstFlow) {}

  private final AuthenticationConfiguration authenticationConfiguration;
  private final AuthorizerConfiguration authorizerConfiguration;
  private final Function<SamlAssertionAccessor, String> legacyDisplayNameExtractor;
  private final Supplier<String> defaultDomainSupplier;

  public SamlIdentityResolver(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration,
      Function<SamlAssertionAccessor, String> legacyDisplayNameExtractor,
      Supplier<String> defaultDomainSupplier) {
    this.authenticationConfiguration = authenticationConfiguration;
    this.authorizerConfiguration = authorizerConfiguration;
    this.legacyDisplayNameExtractor = legacyDisplayNameExtractor;
    this.defaultDomainSupplier = defaultDomainSupplier;
  }

  public ResolvedSamlIdentity resolve(SamlAssertionAccessor assertionAccessor) {
    if (shouldUseEmailFirstFlow()) {
      // emailClaim is an explicit opt-in; a missing email attribute fails authentication
      // rather than silently falling back to the NameID flow with a different identity.
      String email =
          extractAttributeFromAssertion(
              assertionAccessor, authenticationConfiguration.getEmailClaim());
      if (nullOrEmpty(email)) {
        throw new AuthenticationException(
            String.format(
                "Authentication failed: email attribute '%s' not found in SAML assertion",
                authenticationConfiguration.getEmailClaim()));
      }

      // A misconfigured attribute can yield a non-email value; reject it here so downstream
      // provisioning never splits on a missing '@'.
      email = requireEmailWithDomain(email);
      validateConfiguredEmailDomain(
          email,
          getAllowedEmailDomains(),
          authorizerConfiguration.getPrincipalDomain(),
          authorizerConfiguration.getAllowedDomains(),
          authorizerConfiguration.getEnforcePrincipalDomain());

      String displayNameAttr =
          extractAttributeFromAssertion(
              assertionAccessor, authenticationConfiguration.getDisplayNameClaim());
      String displayName = nullOrEmpty(displayNameAttr) ? null : displayNameAttr;

      LOG.debug("SAML email-first flow: email={}, displayName={}", email, displayName);
      return new ResolvedSamlIdentity(null, email, displayName, true);
    }

    String nameId = assertionAccessor.getNameId();
    if (nullOrEmpty(nameId)) {
      throw new AuthenticationException(
          "SAML authentication failed: NameID not found in assertion");
    }

    String email =
        requireEmailWithDomain(
            nameId.contains("@")
                ? nameId
                : String.format("%s@%s", nameId, defaultDomainSupplier.get()));
    validateConfiguredEmailDomain(
        email,
        getAllowedEmailDomains(),
        authorizerConfiguration.getPrincipalDomain(),
        authorizerConfiguration.getAllowedDomains(),
        authorizerConfiguration.getEnforcePrincipalDomain());
    return new ResolvedSamlIdentity(
        nameId.contains("@") ? nameId.split("@")[0] : nameId,
        email,
        legacyDisplayNameExtractor.apply(assertionAccessor),
        false);
  }

  private boolean shouldUseLegacyFlow() {
    List<String> claimsMapping = authenticationConfiguration.getJwtPrincipalClaimsMapping();
    return claimsMapping != null && !claimsMapping.isEmpty();
  }

  private boolean shouldUseEmailFirstFlow() {
    return !nullOrEmpty(authenticationConfiguration.getEmailClaim()) && !shouldUseLegacyFlow();
  }

  private List<String> getAllowedEmailDomains() {
    return authorizerConfiguration.getAllowedEmailDomains() != null
        ? new ArrayList<>(authorizerConfiguration.getAllowedEmailDomains())
        : new ArrayList<>();
  }

  private String extractAttributeFromAssertion(
      SamlAssertionAccessor assertionAccessor, String attributeName) {
    if (nullOrEmpty(attributeName)) {
      return null;
    }
    try {
      Collection<String> values = assertionAccessor.getAttribute(attributeName);
      if (values != null && !values.isEmpty()) {
        return values.iterator().next();
      }
    } catch (Exception e) {
      LOG.debug(
          "Could not extract attribute '{}' from SAML assertion: {}",
          attributeName,
          e.getMessage());
    }
    return null;
  }
}
