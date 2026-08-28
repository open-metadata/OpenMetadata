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
import static org.openmetadata.service.security.SecurityUtil.buildPrincipalClaimsMapping;
import static org.openmetadata.service.security.SecurityUtil.isBot;
import static org.openmetadata.service.security.SecurityUtil.validateConfiguredEmailDomain;
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
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
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
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
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
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.security.auth.BotTokenCache;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.UserTokenCache;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.JwtTokenCacheManager;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.EntityUtil.Fields;

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
  public static final String IMPERSONATE_USER_HEADER = "X-Impersonate-User";
  public static final String ACTIVE_PERSONA_HEADER = "X-OpenMetadata-Persona";
  private static final Set<String> NATIVE_PASSWORD_PROVIDER_VALUES =
      Set.of(AuthProvider.BASIC.value(), AuthProvider.OPENMETADATA.value());
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

  private String emailClaim;
  private String displayNameClaim;
  private List<String> allowedEmailDomains;

  /**
   * Email-to-username resolution cache for the email-first flow. Static so that repository-level
   * user mutations can invalidate entries; the TTL bounds staleness for changes that bypass the
   * invalidation hooks (e.g. direct DB edits or other replicas).
   */
  private static final Cache<String, String> EMAIL_TO_USERNAME_CACHE =
      CacheBuilder.newBuilder().maximumSize(10_000).expireAfterWrite(5, TimeUnit.MINUTES).build();

  public static void invalidateResolvedEmailIdentity(String email) {
    if (email != null) {
      EMAIL_TO_USERNAME_CACHE.invalidate(email.toLowerCase(Locale.ROOT));
    }
  }

  private record ResolvedIdentity(String userName, String email, boolean usedEmailFirstFlow) {}

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
        buildPrincipalClaimsMapping(authenticationConfiguration.getJwtPrincipalClaimsMapping());
    validatePrincipalClaimsMapping(jwtPrincipalClaimsMapping);
    this.jwtTeamClaimMapping = authenticationConfiguration.getJwtTeamClaimMapping();

    ImmutableList.Builder<URL> publicKeyUrlsBuilder = ImmutableList.builder();
    for (String publicKeyUrlStr : authenticationConfiguration.getPublicKeyUrls()) {
      publicKeyUrlsBuilder.add(URI.create(publicKeyUrlStr).toURL());
    }
    this.jwkProvider = new MultiUrlJwkProvider(publicKeyUrlsBuilder.build());

    this.principalDomain =
        SecurityUtil.resolvePrincipalDomain(
            authorizerConfiguration.getPrincipalDomain(),
            authorizerConfiguration.getAllowedEmailDomains(),
            authorizerConfiguration.getAllowedDomains());
    this.allowedDomains = authorizerConfiguration.getAllowedDomains();
    this.enforcePrincipalDomain =
        Boolean.TRUE.equals(authorizerConfiguration.getEnforcePrincipalDomain());
    this.useRolesFromProvider = authorizerConfiguration.getUseRolesFromProvider();
    this.tokenValidationAlgorithm = authenticationConfiguration.getTokenValidationAlgorithm();

    this.emailClaim = authenticationConfiguration.getEmailClaim();
    this.displayNameClaim = authenticationConfiguration.getDisplayNameClaim();
    Set<String> emailDomainsSet = authorizerConfiguration.getAllowedEmailDomains();
    this.allowedEmailDomains =
        emailDomainsSet != null ? new ArrayList<>(emailDomainsSet) : new ArrayList<>();

    logDeprecationWarnings(authenticationConfiguration);
  }

  private void logDeprecationWarnings(AuthenticationConfiguration config) {
    if (config.getJwtPrincipalClaims() != null && !config.getJwtPrincipalClaims().isEmpty()) {
      LOG.warn(
          "DEPRECATED: 'jwtPrincipalClaims' configuration is deprecated. "
              + "Use 'emailClaim' instead. This will be removed in a future version.");
    }

    if (config.getJwtPrincipalClaimsMapping() != null
        && !config.getJwtPrincipalClaimsMapping().isEmpty()) {
      LOG.warn(
          "DEPRECATED: 'jwtPrincipalClaimsMapping' configuration is deprecated. "
              + "Use 'emailClaim' and 'displayNameClaim' instead. This will be removed in a future version.");
    }
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      boolean enforcePrincipalDomain) {
    this(jwkProvider, jwtPrincipalClaims, principalDomain, enforcePrincipalDomain, null);
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      boolean enforcePrincipalDomain,
      AuthProvider providerType) {
    this.jwkProvider = jwkProvider;
    this.jwtPrincipalClaims = jwtPrincipalClaims;
    this.principalDomain = principalDomain;
    this.enforcePrincipalDomain = enforcePrincipalDomain;
    this.providerType = providerType;
    this.tokenValidationAlgorithm = AuthenticationConfiguration.TokenValidationAlgorithm.RS_256;
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      String emailClaim,
      String displayNameClaim,
      List<String> allowedEmailDomains) {
    this.jwkProvider = jwkProvider;
    this.emailClaim = emailClaim;
    this.displayNameClaim = displayNameClaim;
    this.allowedEmailDomains = allowedEmailDomains;
    this.jwtPrincipalClaimsMapping = null;
    this.jwtPrincipalClaims = new ArrayList<>();
    this.tokenValidationAlgorithm = AuthenticationConfiguration.TokenValidationAlgorithm.RS_256;
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      boolean enforcePrincipalDomain,
      String emailClaim,
      String displayNameClaim,
      List<String> allowedEmailDomains) {
    this(jwkProvider, jwtPrincipalClaims, principalDomain, enforcePrincipalDomain);
    this.emailClaim = emailClaim;
    this.displayNameClaim = displayNameClaim;
    this.allowedEmailDomains = allowedEmailDomains;
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
    ActivePersonaContext.clear();

    try {
      String tokenFromHeader = extractToken(requestContext.getHeaders());
      LOG.debug("Authorization header present: {}", !nullOrEmpty(tokenFromHeader));
      DecodedJWT decodedJwt = decodeAndVerify(tokenFromHeader);
      String tokenKeyId = decodedJwt.getKeyId();
      Map<String, Claim> claims = extractClaims(decodedJwt);
      boolean isBotUser = isBot(claims);
      ResolvedIdentity resolvedIdentity = resolveIdentity(claims, isBotUser);
      String userName = resolvedIdentity.userName();
      String email = resolvedIdentity.email();

      String impersonateUser = requestContext.getHeaderString(IMPERSONATE_USER_HEADER);
      String activePersona = requestContext.getHeaderString(ACTIVE_PERSONA_HEADER);
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

      checkValidationsForToken(
          claims,
          tokenFromHeader,
          tokenKeyId,
          userName,
          email,
          impersonatedBy,
          resolvedIdentity.usedEmailFirstFlow());

      CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName, email);
      String scheme = requestContext.getUriInfo().getRequestUri().getScheme();
      CatalogSecurityContext catalogSecurityContext =
          new CatalogSecurityContext(
              catalogPrincipal,
              scheme,
              SecurityContext.DIGEST_AUTH,
              getUserRolesFromClaims(claims, isBotUser),
              isBotUser,
              impersonatedBy,
              activePersona);
      LOG.debug("SecurityContext {}", catalogSecurityContext);
      requestContext.setSecurityContext(catalogSecurityContext);

      if (impersonatedBy != null) {
        ImpersonationContext.setImpersonatedBy(impersonatedBy);
      } else {
        ImpersonationContext.clear();
      }
      ActivePersonaContext.setActivePersona(activePersona);
    } catch (Throwable t) {
      ImpersonationContext.clear();
      ActivePersonaContext.clear();
      throw t;
    } finally {
      RequestLatencyContext.endAuthOperation(authSample);
    }
  }

  public void checkValidationsForToken(
      Map<String, Claim> claims, String tokenFromHeader, String userName, String impersonatedBy) {
    String tokenKeyId = null;
    try {
      tokenKeyId = JWT.decode(tokenFromHeader).getKeyId();
    } catch (JWTDecodeException e) {
      LOG.debug("Unable to read key id from token during OpenMetadata issuer check", e);
    }
    ResolvedIdentity resolvedIdentity = resolveIdentity(claims, isBot(claims));
    checkValidationsForToken(
        claims,
        tokenFromHeader,
        tokenKeyId,
        userName,
        resolvedIdentity.email(),
        impersonatedBy,
        resolvedIdentity.usedEmailFirstFlow());
  }

  private void checkValidationsForToken(
      Map<String, Claim> claims,
      String tokenFromHeader,
      String tokenKeyId,
      String userName,
      String email,
      String impersonatedBy,
      boolean usedEmailFirstFlow) {
    // the case where OMD generated the Token for the Client in case OM generated Token
    validateTokenIsNotUsedAfterLogout(tokenFromHeader);

    // OM-issued tokens (PATs, session tokens, user tokens) set preferred_username to the bare
    // username without an @domain suffix, which causes getFirstMatchJwtClaim-based domain
    // extraction to return an empty domain and fail enforcement. Since OM owns the user identity
    // these tokens are trusted and domain enforcement is skipped — consistent with how bot tokens
    // are already handled (validateDomainEnforcement returns early for isBot=true tokens).
    // The isInternallyIssuedToken check is guarded by enforcePrincipalDomain to avoid the
    // singleton lookup on deployments where enforcement is disabled.
    if (usedEmailFirstFlow) {
      // OM-issued tokens (sessions, PATs) carry emails that predate any allowedEmailDomains
      // config; enforcing the domain list on them would lock out the seeded admin and
      // grandfathered users. Domain restrictions apply to IdP-issued tokens only.
      if (!isInternallyIssuedToken(claims, tokenKeyId)) {
        validateConfiguredEmailDomain(
            email, allowedEmailDomains, principalDomain, allowedDomains, enforcePrincipalDomain);
      }
    } else if (enforcePrincipalDomain && !isInternallyIssuedToken(claims, tokenKeyId)) {
      validateDomainEnforcement(
          jwtPrincipalClaimsMapping,
          jwtPrincipalClaims,
          claims,
          principalDomain,
          allowedDomains,
          enforcePrincipalDomain);
    }

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

  private ResolvedIdentity resolveIdentity(Map<String, Claim> claims, boolean isBotUser) {
    JwtIdentityResolver.ResolvedIdentity resolvedIdentity =
        new JwtIdentityResolver(
                emailClaim,
                jwtPrincipalClaimsMapping,
                jwtPrincipalClaims,
                principalDomain,
                this::resolveUserNameForEmail)
            .resolve(claims, isBotUser);
    return new ResolvedIdentity(
        resolvedIdentity.userName(), resolvedIdentity.email(), resolvedIdentity.emailFirstFlow());
  }

  private String resolveUserNameForEmail(String email) {
    String cached = EMAIL_TO_USERNAME_CACHE.getIfPresent(email);
    if (cached != null) {
      return cached;
    }
    UserRepository userRepository = Entity.getUserRepository();
    try {
      String username =
          userRepository.getActiveUserByEmailForAuth(email, new Fields(Set.of("name"))).getName();
      EMAIL_TO_USERNAME_CACHE.put(email, username);
      return username;
    } catch (EntityNotFoundException e) {
      String candidate = email.split("@")[0];
      // First-login bootstrap is only safe when no account already owns the candidate name;
      // otherwise an unregistered email would resolve to another user's identity.
      if (userRepository.checkUserNameExists(candidate)) {
        throw new AuthenticationException(
            String.format(
                "User with email %s is not registered. Contact your administrator.", email));
      }
      return candidate;
    }
  }

  private boolean isInternallyIssuedToken(Map<String, Claim> claims, String tokenKeyId) {
    JWTTokenGenerator tokenGenerator = JWTTokenGenerator.getInstance();
    return SecurityUtil.isOpenMetadataIssuedToken(
        claims, tokenKeyId, tokenGenerator.getIssuer(), tokenGenerator.getKid());
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
    return extractClaims(decodeAndVerify(token));
  }

  @SneakyThrows
  private DecodedJWT decodeAndVerify(String token) {
    DecodedJWT jwt;
    try {
      jwt = JWT.decode(token);
    } catch (JWTDecodeException e) {
      throw AuthenticationException.getInvalidTokenException("Invalid token.");
    }

    if (jwt.getExpiresAt() != null
        && jwt.getExpiresAt().before(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime())) {
      throw AuthenticationException.getExpiredTokenException();
    }

    Jwk jwk = jwkProvider.get(jwt.getKeyId());
    Algorithm algorithm = createAlgorithmFromJwk(tokenValidationAlgorithm, jwk);
    try {
      algorithm.verify(jwt);
    } catch (RuntimeException runtimeException) {
      throw AuthenticationException.getInvalidTokenException(
          "Invalid token. Token verification failed. Public key mismatch.", runtimeException);
    }

    return jwt;
  }

  private static Map<String, Claim> extractClaims(DecodedJWT jwt) {
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
    validateSessionProviderIsCurrent(session);
    try {
      sessionService.recordSessionAccess(session);
    } catch (Exception e) {
      LOG.warn("Failed to record session access for session {}", session.getId(), e);
    }
  }

  /**
   * Sessions record the provider that authenticated them. Swapping {@code AUTHENTICATION_PROVIDER}
   * decommissions that provider, so sessions minted under it must stop working immediately instead of
   * living on until natural expiry — otherwise off-boarding a user by moving IdPs leaves their old
   * token valid for up to a week. Checked per request against this pod's current config, so it holds
   * on every pod without a session sweep.
   */
  private void validateSessionProviderIsCurrent(UserSession session) {
    String sessionProvider = session.getProvider();
    if (nullOrEmpty(sessionProvider) || providerType == null) {
      return;
    }
    if (!isSameProvider(sessionProvider, providerType.value())) {
      LOG.warn(
          "Rejecting session {} issued by provider {} — the configured provider is now {}",
          SessionService.truncateId(session.getId()),
          sessionProvider,
          providerType.value());
      throw AuthenticationException.getInvalidTokenException(
          "Session was issued by a provider that is no longer configured.");
    }
  }

  /**
   * {@code basic} and {@code openmetadata} are two historical names for the same native-password
   * authenticator — {@code SecurityConfigurationManager.isNativePasswordProvider} treats them
   * interchangeably and one servlet handler serves both. Renaming one to the other is not a provider
   * swap and must not log the whole deployment out.
   */
  private static boolean isSameProvider(String sessionProvider, String configuredProvider) {
    return sessionProvider.equalsIgnoreCase(configuredProvider)
        || (isNativePasswordProviderValue(sessionProvider)
            && isNativePasswordProviderValue(configuredProvider));
  }

  private static boolean isNativePasswordProviderValue(String provider) {
    return NATIVE_PASSWORD_PROVIDER_VALUES.contains(provider.toLowerCase(Locale.ROOT));
  }

  public CatalogSecurityContext getCatalogSecurityContext(String token) {
    Map<String, Claim> claims = validateJwtAndGetClaims(token);
    boolean isBotUser = isBot(claims);
    ResolvedIdentity resolvedIdentity = resolveIdentity(claims, isBotUser);
    String tokenKeyId = null;
    try {
      tokenKeyId = JWT.decode(token).getKeyId();
    } catch (JWTDecodeException e) {
      LOG.debug("Unable to read key id from token during OpenMetadata issuer check", e);
    }
    if (resolvedIdentity.usedEmailFirstFlow() && !isInternallyIssuedToken(claims, tokenKeyId)) {
      validateConfiguredEmailDomain(
          resolvedIdentity.email(),
          allowedEmailDomains,
          principalDomain,
          allowedDomains,
          enforcePrincipalDomain);
    }
    CatalogPrincipal catalogPrincipal =
        new CatalogPrincipal(resolvedIdentity.userName(), resolvedIdentity.email());
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
