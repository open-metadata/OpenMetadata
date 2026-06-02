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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.JwtFilter.BOT_CLAIM;
import static org.openmetadata.service.security.JwtFilter.EMAIL_CLAIM_KEY;
import static org.openmetadata.service.security.JwtFilter.USERNAME_CLAIM_KEY;

import com.auth0.jwt.interfaces.Claim;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMap.Builder;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.security.Principal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public final class SecurityUtil {
  public static final String DEFAULT_PRINCIPAL_DOMAIN = "openmetadata.org";

  /**
   * Name of the short-lived cookie used to hand the access token to the SPA after an SSO callback.
   * The token is delivered out-of-band (never as a URL query parameter) to avoid leaking it through
   * browser history, the Referer header, or proxy/server access logs.
   */
  public static final String AUTH_TOKEN_COOKIE = "omAuthToken";

  private static final int AUTH_TOKEN_COOKIE_MAX_AGE_SECONDS = 60;
  private static final String SAME_SITE_ATTRIBUTE = "SameSite";
  private static final String SAME_SITE_STRICT = "Strict";

  private SecurityUtil() {}

  /**
   * Canonicalizes a JAX-RS request path so that endpoint allow-list checks cannot be bypassed via
   * matrix parameters (e.g. {@code v1/users/login;v1%2fusers%2flogin}) or stray leading/trailing
   * slashes. Matrix parameters are stripped from every path segment and the result is anchored to
   * the exact decoded resource path.
   */
  public static String normalizeRequestPath(String path) {
    String result = StringUtils.EMPTY;
    if (!nullOrEmpty(path)) {
      String stripped = StringUtils.strip(path, "/");
      String[] segments = stripped.split("/");
      List<String> normalizedSegments = new ArrayList<>(segments.length);
      for (String segment : segments) {
        normalizedSegments.add(stripMatrixParameters(segment));
      }
      result = String.join("/", normalizedSegments);
    }
    return result;
  }

  private static String stripMatrixParameters(String segment) {
    int matrixSeparatorIndex = segment.indexOf(';');
    return matrixSeparatorIndex >= 0 ? segment.substring(0, matrixSeparatorIndex) : segment;
  }

  /**
   * Sets the access token in a short-lived, Secure, SameSite=Strict cookie scoped to the app root.
   * The SPA reads this cookie on the callback page and immediately removes it. Keeping the token out
   * of the redirect URL prevents it from being persisted in browser history, leaked via the Referer
   * header on outbound navigation, or recorded in access logs.
   */
  public static void addAuthTokenCookie(HttpServletResponse response, String accessToken) {
    Cookie authTokenCookie = new Cookie(AUTH_TOKEN_COOKIE, accessToken);
    authTokenCookie.setHttpOnly(false);
    authTokenCookie.setSecure(true);
    authTokenCookie.setPath("/");
    authTokenCookie.setMaxAge(AUTH_TOKEN_COOKIE_MAX_AGE_SECONDS);
    authTokenCookie.setAttribute(SAME_SITE_ATTRIBUTE, SAME_SITE_STRICT);
    response.addCookie(authTokenCookie);
  }

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
      email =
          jwtClaim.contains("@")
              ? jwtClaim
              : String.format("%s@%s", jwtClaim, defaulPrincipalClaim);
    }
    return email.toLowerCase();
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
      if (allowedDomains == null || allowedDomains.isEmpty()) {
        // Validate against the principal domain if allowed domains are not supplied
        if (!domain.equals(principalDomain)) {
          throw AuthenticationException.invalidEmailMessage(principalDomain);
        }
      }
      // Validate against allowed domains if supplied
      else if (!allowedDomains.contains(domain)) {
        throw AuthenticationException.invalidEmailMessage(domain);
      }
    }
  }

  public static void writeJsonResponse(HttpServletResponse response, String message)
      throws IOException {
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getOutputStream().print(message);
    response.getOutputStream().flush();
    response.setStatus(HttpServletResponse.SC_OK);
  }

  public static boolean isBot(Map<String, Claim> claims) {
    return claims.containsKey(BOT_CLAIM) && Boolean.TRUE.equals(claims.get(BOT_CLAIM).asBoolean());
  }

  public static boolean isBotW(Map<String, ?> claims) {
    Claim isBotClaim = (Claim) claims.get("isBot");
    return isBotClaim != null && Boolean.TRUE.equals(isBotClaim.asBoolean());
  }
}
