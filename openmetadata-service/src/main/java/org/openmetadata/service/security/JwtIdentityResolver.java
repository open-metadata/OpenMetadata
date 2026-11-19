package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.JwtFilter.EMAIL_CLAIM_KEY;
import static org.openmetadata.service.security.SecurityUtil.extractEmailFromClaim;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.validateEmailVerifiedClaim;

import com.auth0.jwt.interfaces.Claim;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

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
    return resolve(claims, isBotUser, false);
  }

  /** The internal-token flag must come from verification against OpenMetadata's signing key. */
  public ResolvedIdentity resolve(
      Map<String, Claim> claims, boolean isBotUser, boolean internallyIssued) {
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

    String userName = resolveLegacyUserName(claims, internallyIssued);
    String email = resolveLegacyEmail(claims, internallyIssued, isBotUser);
    // The legacy path resolves identity from the claims too, so it needs the same guard: a
    // provider that says the address is unverified must not reach an account through it either.
    validateEmailVerifiedClaim(claims, email);
    return new ResolvedIdentity(userName, email, false);
  }

  /**
   * The principal claims describe the provider's tokens. Ours name the account they were minted
   * for, and an email's local part can belong to another account.
   */
  private String resolveLegacyUserName(Map<String, Claim> claims, boolean internallyIssued) {
    Optional<String> mintedUserName =
        internallyIssued ? JWTTokenGenerator.mintedUserName(claims) : Optional.empty();
    return mintedUserName.orElseGet(
        () -> findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims));
  }

  private String resolveLegacyEmail(
      Map<String, Claim> claims, boolean internallyIssued, boolean isBotUser) {
    if (internallyIssued && isBotUser && !nullOrEmpty(jwtPrincipalClaimsMapping)) {
      Optional<String> botEmail = mappedEmail(claims);
      if (botEmail.isPresent()) {
        return botEmail.get();
      }
    }
    if (internallyIssued
        && nullOrEmpty(jwtPrincipalClaimsMapping)
        && claims.containsKey(EMAIL_CLAIM_KEY)) {
      return extractEmailFromClaim(claims, EMAIL_CLAIM_KEY);
    }
    return findEmailFromClaims(
        jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims, principalDomain);
  }

  /**
   * Bot resolution skips the mapping and takes the first claim in the order. In a bot token we
   * minted under a mapping, that claim can hold the bare name (for example {@code upn}, or {@code
   * email} under {@code username:email}), which would become {@code <name>@<principalDomain>} -
   * another address than the bot's. We always write the stored email into the mapped email claim,
   * so read it there; a token without an address in it keeps the previous resolution. Relies on
   * the generator writing that claim after the username claim
   * (ADR:2026-11-03-an-openmetadata-token-resolves-to-the-account-it-names, v2).
   */
  private Optional<String> mappedEmail(Map<String, Claim> claims) {
    String emailClaim = jwtPrincipalClaimsMapping.get(EMAIL_CLAIM_KEY);
    Claim claim = nullOrEmpty(emailClaim) ? null : claims.get(emailClaim);
    String value = claim == null ? null : claim.asString();
    return value != null && value.contains("@")
        ? Optional.of(extractEmailFromClaim(claims, emailClaim))
        : Optional.empty();
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
