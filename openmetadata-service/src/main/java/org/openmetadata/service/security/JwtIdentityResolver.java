package org.openmetadata.service.security;

import static org.openmetadata.service.security.SecurityUtil.extractEmailFromClaim;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.validateEmailVerifiedClaim;

import com.auth0.jwt.interfaces.Claim;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class JwtIdentityResolver {

  public record ResolvedIdentity(String userName, String email, boolean emailFirstFlow) {}

  private final String emailClaim;
  private final Map<String, String> jwtPrincipalClaimsMapping;
  private final List<String> jwtPrincipalClaims;
  private final String principalDomain;
  private final Function<String, String> userNameResolver;

  public JwtIdentityResolver(
      String emailClaim,
      Map<String, String> jwtPrincipalClaimsMapping,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      Function<String, String> userNameResolver) {
    this.emailClaim = emailClaim;
    this.jwtPrincipalClaimsMapping = jwtPrincipalClaimsMapping;
    this.jwtPrincipalClaims = jwtPrincipalClaims;
    this.principalDomain = principalDomain;
    this.userNameResolver = userNameResolver;
  }

  public ResolvedIdentity resolve(Map<String, Claim> claims, boolean isBotUser) {
    if (shouldUseEmailFirstFlow(isBotUser)) {
      String email = null;
      try {
        email = extractEmailFromClaim(claims, emailClaim);
      } catch (AuthenticationException ex) {
        // Only a missing/invalid email CLAIM may fall back to the legacy flow (e.g. OM
        // impersonation tokens carry no email claim). Failures below, after the email is known,
        // are user-state failures and must propagate — falling back would let an unknown email
        // resolve to another account's username.
        if (!canFallbackToLegacyFlow()) {
          throw ex;
        }
        LOG.warn(
            "Email-first claim resolution failed for claim '{}': {}. Falling back to legacy JWT principal claims.",
            emailClaim,
            ex.getMessage());
      }
      if (email != null) {
        // An IdP that explicitly marks the address unverified must not be able to map it onto an
        // existing account: without this, a public-client token could inherit that user's access.
        validateEmailVerifiedClaim(claims, email);
        String userName = userNameResolver.apply(email);
        LOG.debug("Email-first flow: email={}, userName={}", email, userName);
        return new ResolvedIdentity(userName, email, true);
      }
    }

    String userName = findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims);
    String email =
        findEmailFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims, principalDomain);
    // The legacy path resolves identity from the claims too, so it needs the same guard: a
    // provider that says the address is unverified must not reach an account through it either.
    validateEmailVerifiedClaim(claims, email);
    return new ResolvedIdentity(userName, email, false);
  }

  private boolean shouldUseEmailFirstFlow(boolean isBotUser) {
    if (isBotUser) {
      return false;
    }
    if (emailClaim == null || emailClaim.isEmpty()) {
      return false;
    }
    return jwtPrincipalClaimsMapping == null || jwtPrincipalClaimsMapping.isEmpty();
  }

  private boolean canFallbackToLegacyFlow() {
    return jwtPrincipalClaims != null && !jwtPrincipalClaims.isEmpty();
  }
}
