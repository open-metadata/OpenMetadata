/*
 *  Copyright 2021 Collate
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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.JwtFilter.BOT_CLAIM;
import static org.openmetadata.service.security.JwtFilter.EMAIL_CLAIM_KEY;
import static org.openmetadata.service.security.JwtFilter.USERNAME_CLAIM_KEY;

import com.auth0.jwt.interfaces.Claim;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMap.Builder;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.WebServiceException;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public final class SecurityUtil {
  public static final String DEFAULT_PRINCIPAL_DOMAIN = "openmetadata.org";
  public static final String ISSUER_CLAIM = "iss";
  public static final String EMAIL_VERIFIED_CLAIM = "email_verified";

  private SecurityUtil() {}

  public static String getUserName(SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    return principal == null ? null : principal.getName().split("[/@]")[0];
  }

  public static String getImpersonatedByUser(SecurityContext securityContext) {
    if (securityContext instanceof CatalogSecurityContext catalogSecurityContext) {
      return catalogSecurityContext.impersonatedUser() != null
          ? getUserName(securityContext)
          : null;
    }
    return null;
  }

  public static LoginConfiguration getLoginConfiguration() {
    return SettingsCache.getSetting(SettingsType.LOGIN_CONFIGURATION, LoginConfiguration.class);
  }

  public static Map<String, String> authHeaders(String username) {
    Builder<String, String> builder = ImmutableMap.builder();
    if (username != null) {
      builder.put(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER, username);
    }
    return builder.build();
  }

  public static MultivaluedMap<String, Object> authHeadersMM(String username) {
    MultivaluedMap<String, Object> headers = new MultivaluedHashMap<>();
    headers.add(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER, username);
    return headers;
  }

  public static String getPrincipalName(Map<String, String> authHeaders) {
    // Get username from the email address
    if (authHeaders == null) {
      return null;
    }
    String principal =
        authHeaders.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER);
    return principal == null ? null : principal.split("@")[0];
  }

  public static String getDomain(OpenMetadataApplicationConfig config) {
    String principalDomain = config.getAuthorizerConfiguration().getPrincipalDomain();
    return CommonUtil.nullOrEmpty(principalDomain) ? DEFAULT_PRINCIPAL_DOMAIN : principalDomain;
  }

  public static String resolvePrincipalDomain(
      String principalDomain, Set<String> allowedEmailDomains, Set<String> allowedDomains) {
    if (!nullOrEmpty(principalDomain)) {
      return principalDomain;
    }
    if (allowedEmailDomains != null && !allowedEmailDomains.isEmpty()) {
      return allowedEmailDomains.stream().sorted().findFirst().orElse(null);
    }
    if (allowedDomains != null && !allowedDomains.isEmpty()) {
      return allowedDomains.stream().sorted().findFirst().orElse(null);
    }
    return null;
  }

  public static Invocation.Builder addHeaders(WebTarget target, Map<String, String> headers) {
    if (headers != null) {
      return target
          .request()
          .header(
              CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER,
              headers.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER));
    }
    return target.request();
  }

  public static String findUserNameFromClaims(
      Map<String, String> jwtPrincipalClaimsMapping,
      List<String> jwtPrincipalClaimsOrder,
      Map<String, ?> claims) {
    String userName;

    if (!nullOrEmpty(jwtPrincipalClaimsMapping) && !isBotW(claims)) {
      // We have a mapping available so we will use that
      String usernameClaim = jwtPrincipalClaimsMapping.get(USERNAME_CLAIM_KEY);
      String userNameClaimValue = getClaimOrObject(claims.get(usernameClaim));
      if (!nullOrEmpty(userNameClaimValue)) {
        userName =
            userNameClaimValue.contains("@")
                ? userNameClaimValue.split("@")[0]
                : userNameClaimValue;
      } else {
        throw new AuthenticationException("Invalid JWT token, 'username' claim is not present");
      }
    } else {
      String jwtClaim = getFirstMatchJwtClaim(jwtPrincipalClaimsOrder, claims);
      userName = jwtClaim.contains("@") ? jwtClaim.split("@")[0] : jwtClaim;
    }
    return userName.toLowerCase();
  }

  public static String findEmailFromClaims(
      Map<String, String> jwtPrincipalClaimsMapping,
      List<String> jwtPrincipalClaimsOrder,
      Map<String, ?> claims,
      String defaulPrincipalClaim) {
    String email;

    if (!nullOrEmpty(jwtPrincipalClaimsMapping) && !isBotW(claims)) {
      // We have a mapping available so we will use that
      String emailClaim = jwtPrincipalClaimsMapping.get(EMAIL_CLAIM_KEY);
      String emailClaimValue = getClaimOrObject(claims.get(emailClaim));
      if (!nullOrEmpty(emailClaimValue) && emailClaimValue.contains("@")) {
        email = emailClaimValue;
      } else {
        throw new AuthenticationException(
            String.format(
                "Invalid JWT token, 'email' claim is not present or invalid : %s",
                emailClaimValue));
      }
    } else {
      String jwtClaim = getFirstMatchJwtClaim(jwtPrincipalClaimsOrder, claims);
      if (jwtClaim.contains("@")) {
        email = jwtClaim;
      } else if (!nullOrEmpty(defaulPrincipalClaim)) {
        email = String.format("%s@%s", jwtClaim, defaulPrincipalClaim);
      } else {
        throw new AuthenticationException(
            String.format(
                "JWT claim value '%s' is not an email address and no domain is configured. "
                    + "Configure 'emailClaim' for direct email resolution, "
                    + "or set 'allowedEmailDomains' / 'principalDomain' for domain construction.",
                jwtClaim));
      }
    }
    return email.toLowerCase();
  }

  public static String extractEmailFromClaim(Map<String, ?> claims, String emailClaim) {
    if (nullOrEmpty(emailClaim)) {
      throw new AuthenticationException("Authentication failed: emailClaim is not configured");
    }

    Object claimValue = claims.get(emailClaim);
    String claimString = getClaimOrObject(claimValue);

    if (claimValue == null || claimString.isEmpty()) {
      throw new AuthenticationException(
          String.format("Authentication failed: email claim '%s' not found in token", emailClaim));
    }

    String email = claimString.toLowerCase();

    if (!email.contains("@") || !isValidEmail(email)) {
      throw new AuthenticationException(
          String.format("Authentication failed: invalid email format in claim '%s'", emailClaim));
    }

    return email;
  }

  public static String extractDisplayNameFromClaim(Map<String, ?> claims, String displayNameClaim) {
    if (!nullOrEmpty(displayNameClaim)) {
      Object claimValue = claims.get(displayNameClaim);
      if (claimValue != null) {
        String value = getClaimOrObject(claimValue);
        if (!nullOrEmpty(value)) {
          return value.trim();
        }
      }
    }
    return extractDisplayNameFromClaims(claims);
  }

  public static boolean isEmailRegistrationDomainAllowed(
      String email, Set<String> allowedRegistrationDomains) {
    if (allowedRegistrationDomains == null
        || allowedRegistrationDomains.isEmpty()
        || allowedRegistrationDomains.contains("all")) {
      return true;
    }
    if (email == null || !email.contains("@")) {
      return false;
    }
    String domain = email.substring(email.indexOf('@') + 1);
    return allowedRegistrationDomains.stream().anyMatch(domain::equalsIgnoreCase);
  }

  /**
   * Boundary guard for the email-first flows. Every downstream consumer splits on '@' (username
   * generation, bot/user domains, domain enforcement), so a value that is not an email must be
   * rejected here as an authentication failure rather than surfacing later as a 500.
   */
  public static String requireEmailWithDomain(String email) {
    if (nullOrEmpty(email) || !isValidEmail(email.toLowerCase(Locale.ROOT))) {
      throw new AuthenticationException(
          String.format("Authentication failed: '%s' is not a valid email address", email));
    }
    return email.toLowerCase(Locale.ROOT);
  }

  /**
   * Rejects a token whose identity provider explicitly marked the email unverified. Absent claims
   * are accepted: many providers omit email_verified entirely, and email-first identity must keep
   * working for them. Shared by the request path and the OIDC login callback so an unverified
   * address cannot be mapped onto an existing account through either route.
   */
  public static void validateEmailVerifiedClaim(Map<String, ?> claims, String email) {
    Object claimValue = claims == null ? null : claims.get(EMAIL_VERIFIED_CLAIM);
    if (claimValue == null) {
      return;
    }
    String value =
        claimValue instanceof Claim claim
            ? String.valueOf(claim.as(Object.class))
            : String.valueOf(claimValue);
    if ("false".equalsIgnoreCase(value)) {
      throw new AuthenticationException(
          String.format(
              "Authentication failed: email '%s' is not verified by the identity provider", email));
    }
  }

  private static boolean isValidEmail(String email) {
    return email.matches("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
  }

  public static String getClaimOrObject(Object obj) {
    if (obj == null) {
      return "";
    }

    if (obj instanceof Claim c) {
      return c.asString();
    } else if (obj instanceof String s) {
      return s;
    }

    return StringUtils.EMPTY;
  }

  public static List<String> findTeamsFromClaims(
      String jwtTeamClaimMapping, Map<String, ?> claims) {
    if (nullOrEmpty(jwtTeamClaimMapping) || claims == null) {
      return new ArrayList<>();
    }

    if (claims.containsKey(jwtTeamClaimMapping)) {
      return getClaimAsList(claims.get(jwtTeamClaimMapping));
    }

    return new ArrayList<>();
  }

  @SuppressWarnings("unchecked")
  public static List<String> getClaimAsList(Object obj) {
    List<String> result = new ArrayList<>();
    if (obj == null) {
      return result;
    }

    if (obj instanceof Claim claim) {
      List<String> listValue = claim.asList(String.class);
      if (listValue != null && !listValue.isEmpty()) {
        result.addAll(listValue);
      } else {
        String stringValue = claim.asString();
        if (!nullOrEmpty(stringValue)) {
          result.add(stringValue);
        }
      }
    } else if (obj instanceof Collection<?> collection) {
      for (Object item : collection) {
        if (item != null) {
          result.add(item.toString());
        }
      }
    } else if (obj instanceof String s && !nullOrEmpty(s)) {
      result.add(s);
    } else if (obj instanceof Object[] array) {
      for (Object item : array) {
        if (item != null) {
          result.add(item.toString());
        }
      }
    }

    return result;
  }

  public static String getFirstMatchJwtClaim(
      List<String> jwtPrincipalClaimsOrder, Map<String, ?> claims) {
    return jwtPrincipalClaimsOrder.stream()
        .filter(claims::containsKey)
        .findFirst()
        .map(claims::get)
        .map(SecurityUtil::getClaimOrObject)
        .orElseThrow(
            () ->
                new AuthenticationException(
                    "Invalid JWT token, none of the following claims are present "
                        + jwtPrincipalClaimsOrder));
  }

  /**
   * Extracts display name from SSO claims with profile scope.
   *
   * <p>This method attempts to extract a user's display name from SSO token claims in the
   * following priority order:
   *
   * <ol>
   *   <li>Direct 'name' claim (if present)
   *   <li>Combination of 'given_name' + 'family_name' (if both present)
   *   <li>Returns null if neither pattern is found
   * </ol>
   *
   * @param claims Map of claims from the SSO token (typically from profile scope)
   * @return The extracted display name, or null if no suitable claims found
   */
  public static String extractDisplayNameFromClaims(Map<String, ?> claims) {
    if (claims == null || claims.isEmpty()) {
      return null;
    }

    // Try direct name claims (name, displayName, displayname)
    String nameClaim = getClaimOrObject(claims.get("name"));
    if (!nullOrEmpty(nameClaim)) {
      return nameClaim.trim();
    }

    String displayName = getClaimOrObject(claims.get("displayName"));
    if (!nullOrEmpty(displayName)) {
      return displayName.trim();
    }

    String displayNameClaim = getClaimOrObject(claims.get("displayname"));
    if (!nullOrEmpty(displayNameClaim)) {
      return displayNameClaim.trim();
    }

    // Fall back to combining first + last name variations
    String givenName = getClaimOrObject(claims.get("given_name"));
    if (nullOrEmpty(givenName)) {
      givenName = getClaimOrObject(claims.get("givenname"));
    }
    if (nullOrEmpty(givenName)) {
      givenName = getClaimOrObject(claims.get("firstname"));
    }

    String familyName = getClaimOrObject(claims.get("family_name"));
    if (nullOrEmpty(familyName)) {
      familyName = getClaimOrObject(claims.get("familyname"));
    }
    if (nullOrEmpty(familyName)) {
      familyName = getClaimOrObject(claims.get("lastname"));
    }

    if (!nullOrEmpty(givenName) && !nullOrEmpty(familyName)) {
      return (givenName.trim() + " " + familyName.trim()).trim();
    } else if (!nullOrEmpty(givenName)) {
      return givenName.trim();
    } else if (!nullOrEmpty(familyName)) {
      return familyName.trim();
    }

    // No suitable display name found
    return null;
  }

  /**
   * Builds the principal-claims mapping (logical name -> claim name) from the configured
   * "name:claim" entries. Shared by {@link JwtFilter} and the SSO Test Login dry-run so both resolve
   * identities with identical semantics.
   */
  public static Map<String, String> buildPrincipalClaimsMapping(
      List<String> jwtPrincipalClaimsMapping) {
    return listOrEmpty(jwtPrincipalClaimsMapping).stream()
        .map(s -> s.split(":"))
        .filter(parts -> parts.length == 2)
        .collect(Collectors.toMap(s -> s[0], s -> s[1]));
  }

  public static void validatePrincipalClaimsMapping(Map<String, String> mapping) {
    if (!nullOrEmpty(mapping)) {
      String username = mapping.get(USERNAME_CLAIM_KEY);
      String email = mapping.get(EMAIL_CLAIM_KEY);

      // Validate that both username and email are present
      if (nullOrEmpty(username) || nullOrEmpty(email)) {
        throw new IllegalArgumentException(
            "Invalid JWT Principal Claims Mapping. Both username and email should be present");
      }

      // Validate that only username and email keys are present (no other keys allowed)
      for (String key : mapping.keySet()) {
        if (!USERNAME_CLAIM_KEY.equals(key) && !EMAIL_CLAIM_KEY.equals(key)) {
          throw new IllegalArgumentException(
              String.format(
                  "Invalid JWT Principal Claims Mapping. Only username and email keys are allowed, but found: %s",
                  key));
        }
      }
    }
    // If emtpy, jwtPrincipalClaims will be used so no need to validate
  }

  public static void validateDomainEnforcement(
      Map<String, String> jwtPrincipalClaimsMapping,
      List<String> jwtPrincipalClaimsOrder,
      Map<String, Claim> claims,
      String principalDomain,
      Set<String> allowedDomains,
      boolean enforcePrincipalDomain) {
    String domain = StringUtils.EMPTY;

    if (!nullOrEmpty(jwtPrincipalClaimsMapping) && !isBotW(claims)) {
      // We have a mapping available so we will use that
      String emailClaim = jwtPrincipalClaimsMapping.get(EMAIL_CLAIM_KEY);
      String emailClaimValue = getClaimOrObject(claims.get(emailClaim));
      if (!nullOrEmpty(emailClaimValue)) {
        if (emailClaimValue.contains("@")) {
          domain = emailClaimValue.split("@")[1];
        }
      } else {
        throw new AuthenticationException("Invalid JWT token, 'email' claim is not present");
      }
    } else {
      String jwtClaim = getFirstMatchJwtClaim(jwtPrincipalClaimsOrder, claims);
      if (jwtClaim.contains("@")) {
        domain = jwtClaim.split("@")[1];
      }
    }

    // Validate
    if (isBot(claims)) {
      // Bots don't need to be validated
      return;
    }
    if (enforcePrincipalDomain) {
      // Domains are case-insensitive; IdPs (e.g. Azure preferred_username/UPN) preserve the
      // casing configured in the tenant, which rarely matches the configured domain verbatim
      Set<String> expectedDomains = allowedDomains;
      if (nullOrEmpty(expectedDomains)) {
        expectedDomains = nullOrEmpty(principalDomain) ? Set.of() : Set.of(principalDomain);
      }
      if (expectedDomains.stream().noneMatch(domain::equalsIgnoreCase)) {
        throw AuthenticationException.invalidEmailMessage(domain, expectedDomains);
      }
    }
  }

  public static void writeJsonResponse(HttpServletResponse response, String message)
      throws IOException {
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getOutputStream().print(message);
    response.getOutputStream().flush();
  }

  public static void writeErrorResponse(HttpServletResponse response, int status, String message)
      throws IOException {
    response.setStatus(status);
    writeJsonResponse(
        response,
        JsonUtils.pojoToJson(Map.of("error", message == null ? StringUtils.EMPTY : message)));
  }

  /**
   * Writes a failure on a servlet auth path with the status the failure actually deserves. These
   * paths have no JAX-RS exception mapper, so a bare {@code 500 + e.getMessage()} catch-all reports a
   * rejected credential as a server bug — which is how a login by a deleted user came back as a 500 —
   * and puts the exception text on the wire while doing it. A rejected credential is the caller's
   * 4xx; only the rest is a 500, and that one carries a generic message because an unclassified
   * exception's text is an internal detail. Callers log the failure before delegating here, so
   * nothing is lost.
   */
  public static void writeFailureResponse(HttpServletResponse response, Throwable failure) {
    // Default generic: an unclassified failure is a server fault whose message is an internal
    // detail. It stays in the log, not on the wire.
    int status = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
    String message = "Authentication service error";
    // EntityNotFoundException is checked first on purpose: it extends the SDK's WebServiceException
    // with NOT_FOUND, and answering 404 on a login endpoint tells an unauthenticated caller which
    // accounts exist. A user that no longer resolves is a rejected credential, not a lookup miss.
    if (failure instanceof EntityNotFoundException) {
      status = HttpServletResponse.SC_UNAUTHORIZED;
      message = "Invalid credentials";
    } else if (carriesResponseStatus(failure)) {
      status = responseStatusOf(failure);
      message = failure.getMessage();
    }
    try {
      writeErrorResponse(response, status, message);
    } catch (IOException e) {
      LOG.error("Error writing error response", e);
    }
  }

  /**
   * Three unrelated hierarchies carry an intended HTTP status and none of them share a supertype:
   * JAX-RS {@link WebApplicationException}, {@link AuthenticationException}, and the SDK's {@link
   * WebServiceException} (the parent of {@code CustomExceptionMessage}, which is what the basic and
   * LDAP authenticators throw for a rejected credential). Missing any one of them reports a 4xx as a
   * 500.
   */
  private static boolean carriesResponseStatus(Throwable failure) {
    return failure instanceof WebApplicationException
        || failure instanceof AuthenticationException
        || failure instanceof WebServiceException;
  }

  private static int responseStatusOf(Throwable failure) {
    if (failure instanceof WebApplicationException webApplicationException) {
      return webApplicationException.getResponse().getStatus();
    }
    if (failure instanceof AuthenticationException authenticationException) {
      return authenticationException.getResponse().getStatus();
    }
    return ((WebServiceException) failure).getResponse().getStatus();
  }

  public static void writeMessageResponse(HttpServletResponse response, int status, String message)
      throws IOException {
    response.setStatus(status);
    writeJsonResponse(
        response,
        JsonUtils.pojoToJson(Map.of("message", message == null ? StringUtils.EMPTY : message)));
  }

  public static boolean isBot(Map<String, Claim> claims) {
    return claims.containsKey(BOT_CLAIM) && Boolean.TRUE.equals(claims.get(BOT_CLAIM).asBoolean());
  }

  public static boolean isBotW(Map<String, ?> claims) {
    Claim isBotClaim = (Claim) claims.get("isBot");
    return isBotClaim != null && Boolean.TRUE.equals(isBotClaim.asBoolean());
  }

  /**
   * Returns true only when the token was provably minted by OpenMetadata itself. A token qualifies
   * when its key id matches OpenMetadata's own signing key id and its issuer matches OpenMetadata's
   * configured issuer. The key id is the trust anchor: the signature has already been verified
   * against the public key served for that key id, so a matching key id proves OpenMetadata's
   * private key produced the signature - an external identity provider cannot forge it. The issuer
   * check is defense in depth against a key id collision in a multi-source JWK provider.
   */
  public static boolean isOpenMetadataIssuedToken(
      Map<String, Claim> claims,
      String tokenKeyId,
      String openMetadataIssuer,
      String openMetadataKeyId) {
    boolean issuedByOpenMetadata = false;
    if (!nullOrEmpty(openMetadataIssuer) && !nullOrEmpty(openMetadataKeyId)) {
      boolean keyIdMatches = openMetadataKeyId.equals(tokenKeyId);
      boolean issuerMatches = openMetadataIssuer.equals(getClaimOrObject(claims.get(ISSUER_CLAIM)));
      issuedByOpenMetadata = keyIdMatches && issuerMatches;
    }
    return issuedByOpenMetadata;
  }

  public static String validateRedirectUri(
      String redirectUri, Collection<String> trustedRedirects) {
    if (StringUtils.isBlank(redirectUri)) {
      throw new IllegalArgumentException("Redirect URI is required");
    }

    List<URI> trustedUris =
        new ArrayList<>(
            trustedRedirects == null
                ? List.of()
                : trustedRedirects.stream()
                    .filter(StringUtils::isNotBlank)
                    .map(SecurityUtil::parseTrustedRedirectUri)
                    .toList());
    if (trustedUris.isEmpty()) {
      throw new IllegalArgumentException("No trusted redirect URI is configured");
    }

    String normalizedRedirect = redirectUri.trim();
    if (normalizedRedirect.startsWith("//")) {
      throw new IllegalArgumentException("Redirect URI must be same-origin");
    }

    URI candidate = parseTrustedRedirectUri(normalizedRedirect);
    List<URI> normalizedCandidates;
    if (!candidate.isAbsolute()) {
      String rawPath = candidate.getRawPath();
      if (nullOrEmpty(rawPath) || !rawPath.startsWith("/")) {
        throw new IllegalArgumentException("Redirect URI must be absolute or root-relative");
      }
      normalizedCandidates =
          trustedUris.stream()
              .map(trustedUri -> parseTrustedRedirectUri(canonicalize(trustedUri, candidate)))
              .toList();
    } else {
      if (!nullOrEmpty(candidate.getRawUserInfo())) {
        throw new IllegalArgumentException("Redirect URI must not contain user-info");
      }
      normalizedCandidates = List.of(candidate.normalize());
    }

    URI matchedTrustedUri =
        trustedUris.stream()
            .map(URI::normalize)
            .filter(
                trustedUri ->
                    normalizedCandidates.stream()
                        .anyMatch(candidateUri -> sameRedirect(trustedUri, candidateUri)))
            .findFirst()
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        "Redirect URI must exactly match a trusted redirect URI"));
    return matchedTrustedUri.toString();
  }

  private static String canonicalize(URI trustedBase, URI candidate) {
    URI resolved = trustedBase.resolve(candidate);
    try {
      return new URI(
              trustedBase.getScheme(),
              null,
              trustedBase.getHost(),
              trustedBase.getPort(),
              resolved.getPath(),
              resolved.getQuery(),
              resolved.getFragment())
          .toString();
    } catch (URISyntaxException e) {
      throw new IllegalArgumentException("Redirect URI cannot be canonicalized", e);
    }
  }

  public static String buildRedirectWithToken(
      String redirectUri, String accessToken, String email, String name) {
    String fragment =
        "id_token="
            + URLEncoder.encode(accessToken, StandardCharsets.UTF_8)
            + "&email="
            + URLEncoder.encode(email, StandardCharsets.UTF_8)
            + "&name="
            + URLEncoder.encode(name, StandardCharsets.UTF_8);
    return redirectUri + "#" + fragment;
  }

  public static Set<String> trustedRedirects(String... trustedRedirects) {
    LinkedHashSet<String> redirects = new LinkedHashSet<>();
    if (trustedRedirects == null) {
      return redirects;
    }
    for (String trustedRedirect : trustedRedirects) {
      if (StringUtils.isNotBlank(trustedRedirect)) {
        redirects.add(trustedRedirect);
      }
    }
    return redirects;
  }

  private static URI parseTrustedRedirectUri(String value) {
    try {
      return new URI(value);
    } catch (URISyntaxException e) {
      throw new IllegalArgumentException("Redirect URI is invalid", e);
    }
  }

  private static boolean sameRedirect(URI trustedUri, URI candidate) {
    if (StringUtils.isBlank(trustedUri.getHost()) || StringUtils.isBlank(candidate.getHost())) {
      return false;
    }
    return StringUtils.equalsIgnoreCase(trustedUri.getScheme(), candidate.getScheme())
        && StringUtils.equalsIgnoreCase(trustedUri.getHost(), candidate.getHost())
        && normalizedPort(trustedUri) == normalizedPort(candidate)
        && StringUtils.equals(normalizedPath(trustedUri), normalizedPath(candidate))
        && StringUtils.equals(trustedUri.getRawQuery(), candidate.getRawQuery())
        && StringUtils.equals(trustedUri.getRawFragment(), candidate.getRawFragment());
  }

  private static String normalizedPath(URI uri) {
    String path = uri.normalize().getPath();
    return nullOrEmpty(path) ? "/" : path;
  }

  private static int normalizedPort(URI uri) {
    if (uri.getPort() != -1) {
      return uri.getPort();
    }
    return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
  }

  public static void validateEmailDomain(String email, List<String> allowedEmailDomains) {
    if (allowedEmailDomains == null || allowedEmailDomains.isEmpty()) {
      return;
    }

    requireEmailWithDomain(email);

    String domain = email.substring(email.indexOf("@") + 1).toLowerCase();

    boolean allowed = allowedEmailDomains.stream().anyMatch(d -> d.equalsIgnoreCase(domain));

    if (!allowed) {
      throw new AuthenticationException(
          String.format("Authentication failed: domain '%s' not in allowed list", domain));
    }
  }

  public static void validateConfiguredEmailDomain(
      String email,
      List<String> allowedEmailDomains,
      String principalDomain,
      Set<String> allowedDomains,
      Boolean enforcePrincipalDomain) {
    if (allowedEmailDomains != null && !allowedEmailDomains.isEmpty()) {
      validateEmailDomain(email, allowedEmailDomains);
      return;
    }

    if (!Boolean.TRUE.equals(enforcePrincipalDomain)) {
      return;
    }

    if (allowedDomains != null && !allowedDomains.isEmpty()) {
      validateEmailDomain(email, new ArrayList<>(allowedDomains));
      return;
    }

    String effectivePrincipalDomain =
        nullOrEmpty(principalDomain) ? DEFAULT_PRINCIPAL_DOMAIN : principalDomain;
    validateEmailDomain(email, List.of(effectivePrincipalDomain));
  }
}
