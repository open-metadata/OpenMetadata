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
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.isBot;
import static org.openmetadata.service.security.SecurityUtil.validateDomainEnforcement;
import static org.openmetadata.service.security.SecurityUtil.validatePrincipalClaimsMapping;
import static org.openmetadata.service.security.jwt.JWTTokenGenerator.ROLES_CLAIM;
import static org.openmetadata.service.security.jwt.JWTTokenGenerator.TOKEN_TYPE;
import static org.openmetadata.service.security.jwt.JWTTokenGenerator.getAlgorithmFromPublicKey;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableList;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.Provider;
import java.net.URI;
import java.net.URL;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.security.auth.BotTokenCache;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.UserTokenCache;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.JwtTokenCacheManager;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

@Slf4j
@Provider
@Priority(Priorities.AUTHENTICATION)
public class JwtFilter implements ContainerRequestFilter {
  public static final String EMAIL_CLAIM_KEY = "email";
  public static final String USERNAME_CLAIM_KEY = "username";
  public static final String AUTHORIZATION_HEADER = "Authorization";
  public static final String TOKEN_PREFIX = "Bearer";
  public static final String BOT_CLAIM = "isBot";
  public static final String IMPERSONATED_USER_CLAIM = "impersonatedUser";
  @Getter private List<String> jwtPrincipalClaims;
  @Getter private Map<String, String> jwtPrincipalClaimsMapping;
  @Getter private String jwtTeamClaimMapping;
  private JwkProvider jwkProvider;
  private String principalDomain;
  private Set<String> allowedDomains;
  private boolean enforcePrincipalDomain;
  private AuthProvider providerType;
  private boolean useRolesFromProvider = false;
  private AuthenticationConfiguration.TokenValidationAlgorithm tokenValidationAlgorithm;

  public static final List<String> EXCLUDED_ENDPOINTS =
      List.of(
          "v1/system/config/jwks",
          "v1/system/config/authorizer",
          "v1/system/config/customUiThemePreference",
          "v1/system/config/auth",
          "v1/system/config/rdf",
          "v1/system/health",
          "v1/users/signup",
          "v1/system/version",
          "v1/users/registrationConfirmation",
          "v1/users/resendRegistrationToken",
          "v1/users/generatePasswordResetLink",
          "v1/users/password/reset",
          "v1/users/login",
          "v1/users/refresh",
          "v1/collate/apps/support/redeem-code");

  @SuppressWarnings("unused")
  private JwtFilter() {}

  @SneakyThrows
  public JwtFilter(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration) {
    this.providerType = authenticationConfiguration.getProvider();
    // Cannot remove  Principal Claims listing since that is , breaking change for existing users
    this.jwtPrincipalClaims = authenticationConfiguration.getJwtPrincipalClaims();
    this.jwtPrincipalClaimsMapping =
        listOrEmpty(authenticationConfiguration.getJwtPrincipalClaimsMapping()).stream()
            .map(s -> s.split(":"))
            .collect(Collectors.toMap(s -> s[0], s -> s[1]));
    validatePrincipalClaimsMapping(jwtPrincipalClaimsMapping);
    this.jwtTeamClaimMapping = authenticationConfiguration.getJwtTeamClaimMapping();

    ImmutableList.Builder<URL> publicKeyUrlsBuilder = ImmutableList.builder();
    for (String publicKeyUrlStr : authenticationConfiguration.getPublicKeyUrls()) {
      publicKeyUrlsBuilder.add(URI.create(publicKeyUrlStr).toURL());
    }
    this.jwkProvider = new MultiUrlJwkProvider(publicKeyUrlsBuilder.build());

    this.principalDomain = authorizerConfiguration.getPrincipalDomain();
    this.allowedDomains = authorizerConfiguration.getAllowedDomains();
    this.enforcePrincipalDomain = authorizerConfiguration.getEnforcePrincipalDomain();
    this.useRolesFromProvider = authorizerConfiguration.getUseRolesFromProvider();
    this.tokenValidationAlgorithm = authenticationConfiguration.getTokenValidationAlgorithm();
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      boolean enforcePrincipalDomain) {
    this.jwkProvider = jwkProvider;
    this.jwtPrincipalClaims = jwtPrincipalClaims;
    this.principalDomain = principalDomain;
    this.enforcePrincipalDomain = enforcePrincipalDomain;
    this.tokenValidationAlgorithm = AuthenticationConfiguration.TokenValidationAlgorithm.RS_256;
  }

  @SneakyThrows
  @Override
  public void filter(ContainerRequestContext requestContext) {
    UriInfo uriInfo = requestContext.getUriInfo();
    if (EXCLUDED_ENDPOINTS.stream()
        .anyMatch(endpoint -> uriInfo.getPath().equalsIgnoreCase(endpoint))) {
      return;
    }

    Timer.Sample authSample = RequestLatencyContext.startAuthOperation();
    ImpersonationContext.clear();

    try {
      String tokenFromHeader = extractToken(requestContext.getHeaders());
      LOG.debug("Authorization header present: {}", !nullOrEmpty(tokenFromHeader));
      Map<String, Claim> claims = validateJwtAndGetClaims(tokenFromHeader);
      String userName =
          findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims);
      String email =
          findEmailFromClaims(
              jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims, principalDomain);
      boolean isBotUser = isBot(claims);

      String impersonateUser = requestContext.getHeaderString("X-Impersonate-User");
      String impersonatedBy = null;

      if (impersonateUser != null && !impersonateUser.isEmpty()) {
        if (!isBotUser) {
          throw new AuthorizationException("Only bot users can impersonate other users");
        }
        impersonatedBy = userName;
        try {
          User impersonatedUser =
              Entity.getEntityByName(Entity.USER, impersonateUser, "", Include.NON_DELETED);
          userName = impersonatedUser.getName();
          email = impersonatedUser.getEmail();
        } catch (Exception e) {
          LOG.warn("Impersonation target user not found: {}", impersonateUser);
          throw new AuthenticationException(
              "Cannot impersonate non-existent user: " + impersonateUser);
        }
      }

      checkValidationsForToken(claims, tokenFromHeader, userName, impersonatedBy);

      CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName, email);
      String scheme = requestContext.getUriInfo().getRequestUri().getScheme();
      CatalogSecurityContext catalogSecurityContext =
          new CatalogSecurityContext(
              catalogPrincipal,
              scheme,
              SecurityContext.DIGEST_AUTH,
              getUserRolesFromClaims(claims, isBotUser),
              isBotUser,
              impersonatedBy);
      LOG.debug("SecurityContext {}", catalogSecurityContext);
      requestContext.setSecurityContext(catalogSecurityContext);

      if (impersonatedBy != null) {
        ImpersonationContext.setImpersonatedBy(impersonatedBy);
      } else {
        ImpersonationContext.clear();
      }
    } catch (Throwable t) {
      ImpersonationContext.clear();
      throw t;
    } finally {
      RequestLatencyContext.endAuthOperation(authSample);
    }
  }

  public void checkValidationsForToken(
      Map<String, Claim> claims, String tokenFromHeader, String userName, String impersonatedBy) {
    // the case where OMD generated the Token for the Client in case OM generated Token
    validateTokenIsNotUsedAfterLogout(tokenFromHeader);

    // Validate Domain
    validateDomainEnforcement(
        jwtPrincipalClaimsMapping,
        jwtPrincipalClaims,
        claims,
        principalDomain,
        allowedDomains,
        enforcePrincipalDomain);

    // Validate Bot token matches what was created in OM
    // Skip validation for impersonation tokens - they are generated dynamically and not stored in
    // cache
    if (impersonatedBy == null && isBot(claims)) {
      validateBotToken(tokenFromHeader, userName);
    }

    // validate personal access token
    validatePersonalAccessToken(claims, tokenFromHeader, userName);

    validateSessionBoundToken(claims, userName);
  }

  private Set<String> getUserRolesFromClaims(Map<String, Claim> claims, boolean isBot) {
    Set<String> userRoles = new HashSet<>();
    // Re-sync user roles from token
    if (useRolesFromProvider && !isBot && claims.containsKey(ROLES_CLAIM)) {
      List<String> roles = claims.get(ROLES_CLAIM).asList(String.class);
      if (!nullOrEmpty(roles)) {
        userRoles = new HashSet<>(claims.get(ROLES_CLAIM).asList(String.class));
      }
    }
    return userRoles;
  }

  @SneakyThrows
  public Map<String, Claim> validateJwtAndGetClaims(String token) {
    // Decode JWT Token
    DecodedJWT jwt;
    try {
      jwt = JWT.decode(token);
    } catch (JWTDecodeException e) {
      throw AuthenticationException.getInvalidTokenException("Invalid token.");
    }

    // Check if expired
    // If expiresAt is set to null, treat it as never expiring token
    if (jwt.getExpiresAt() != null
        && jwt.getExpiresAt().before(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime())) {
      throw AuthenticationException.getExpiredTokenException();
    }

    // Validate JWT with public key
    Jwk jwk = jwkProvider.get(jwt.getKeyId());
    Algorithm algorithm = createAlgorithmFromJwk(tokenValidationAlgorithm, jwk);
    try {
      algorithm.verify(jwt);
    } catch (RuntimeException runtimeException) {
      throw AuthenticationException.getInvalidTokenException(
          "Invalid token. Token verification failed. Public key mismatch.", runtimeException);
    }

    Map<String, Claim> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(jwt.getClaims());

    return claims;
  }

  protected static String extractToken(MultivaluedMap<String, String> headers) {
    String source = headers.getFirst(AUTHORIZATION_HEADER);
    return extractTokenFromString(source);
  }

  public static String extractToken(String tokenFromHeader) {
    return extractTokenFromString(tokenFromHeader);
  }

  private static String extractTokenFromString(String tokenString) {
    if (nullOrEmpty(tokenString)) {
      throw AuthenticationException.getTokenNotPresentException();
    }
    if (tokenString.startsWith(TOKEN_PREFIX)) {
      if (tokenString.length() <= TOKEN_PREFIX.length() + 1) {
        throw AuthenticationException.getTokenNotPresentException();
      }
      return tokenString.substring(TOKEN_PREFIX.length() + 1);
    }
    throw AuthenticationException.getTokenNotPresentException();
  }

  private void validateBotToken(String tokenFromHeader, String userName) {
    if (tokenFromHeader.equals(BotTokenCache.getToken(userName))) {
      return;
    }
    throw AuthenticationException.getInvalidTokenException(
        "The given token does not match the current bot's token!");
  }

  private void validatePersonalAccessToken(
      Map<String, Claim> claims, String tokenFromHeader, String userName) {
    Claim tokenTypeClaim = claims.get(TOKEN_TYPE);
    String tokenType = tokenTypeClaim == null ? StringUtils.EMPTY : tokenTypeClaim.asString();
    if (claims.containsKey(TOKEN_TYPE)
        && ServiceTokenType.PERSONAL_ACCESS.value().equals(tokenType)) {
      Set<String> userTokens = UserTokenCache.getToken(userName);
      if (userTokens != null && userTokens.contains(tokenFromHeader)) {
        return;
      }
      throw AuthenticationException.getInvalidTokenException("Invalid personal access token!");
    }
  }

  private void validateTokenIsNotUsedAfterLogout(String authToken) {
    // Only OMD generated Tokens
    if (AuthProvider.BASIC.equals(providerType)
        || AuthProvider.OPENMETADATA.equals(providerType)
        || AuthProvider.SAML.equals(providerType)) {
      LogoutRequest previouslyLoggedOutEvent =
          JwtTokenCacheManager.getInstance().getLogoutEventForToken(authToken);
      if (previouslyLoggedOutEvent != null) {
        throw AuthenticationException.invalidTokenMessage();
      }
    }
  }

  private void validateSessionBoundToken(Map<String, Claim> claims, String userName) {
    Claim sessionClaim = claims.get(JWTTokenGenerator.SESSION_ID_CLAIM);
    String sessionId = sessionClaim == null ? null : sessionClaim.asString();
    if (nullOrEmpty(sessionId)) {
      return;
    }

    SessionService sessionService = AuthServeletHandlerRegistry.getSessionService();
    if (sessionService == null) {
      throw AuthenticationException.getInvalidTokenException("Session service is not available.");
    }

    UserSession session =
        sessionService
            .getFreshSessionById(sessionId)
            .orElseThrow(
                () -> AuthenticationException.getInvalidTokenException("Invalid session."));
    if (session.getStatus() != SessionStatus.ACTIVE
        || session.isExpired(System.currentTimeMillis())
        || nullOrEmpty(session.getUsername())
        || !session.getUsername().equalsIgnoreCase(userName)) {
      throw AuthenticationException.getInvalidTokenException("Invalid session.");
    }
    try {
      sessionService.recordSessionAccess(session);
    } catch (Exception e) {
      LOG.warn("Failed to record session access for session {}", session.getId(), e);
    }
  }

  public CatalogSecurityContext getCatalogSecurityContext(String token) {
    Map<String, Claim> claims = validateJwtAndGetClaims(token);
    String userName = findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims);
    String email =
        findEmailFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims, principalDomain);
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName, email);
    boolean isBotUser = isBot(claims);
    return new CatalogSecurityContext(
        catalogPrincipal,
        "https",
        SecurityContext.DIGEST_AUTH,
        getUserRolesFromClaims(claims, isBotUser),
        isBotUser);
  }

  private Algorithm createAlgorithmFromJwk(
      AuthenticationConfiguration.TokenValidationAlgorithm tokenValidationAlgorithm, Jwk jwk) {
    try {
      var publicKey = jwk.getPublicKey();
      return getAlgorithmFromPublicKey(tokenValidationAlgorithm, publicKey);
    } catch (Exception e) {
      // Wrap in RuntimeException to match the expected behavior in tests
      throw new RuntimeException("Failed to create algorithm from JWK: " + e.getMessage(), e);
    }
  }
}
