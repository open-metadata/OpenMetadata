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
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.getClaimAsList;
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
import jakarta.ws.rs.core.PathSegment;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.Provider;
import java.net.URI;
import java.net.URL;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.security.auth.BotTokenCache;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.UserTokenCache;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
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
  public static final String IMPERSONATE_USER_HEADER = "X-Impersonate-User";
  public static final String ACTIVE_PERSONA_HEADER = "X-OpenMetadata-Persona";
  private static final Set<String> NATIVE_PASSWORD_PROVIDER_VALUES =
      Set.of(AuthProvider.BASIC.value(), AuthProvider.OPENMETADATA.value());
  private static final Set<String> MULTI_TENANT_AUTHORITIES =
      Set.of("common", "organizations", "consumers");
  private static final Pattern TENANT_ID =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  // The path segment after the tenant in a v2 endpoint authority, as in .../{tenant}/v2.0.
  private static final String AUTHORITY_VERSION_SEGMENT = "v2.0";
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
  private OidcClientConfig serverSideOidcClient;
  private ProviderTokenValidator providerTokenValidator =
      ProviderTokenValidator.acceptingAnyProviderToken();

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
    this.serverSideOidcClient =
        authenticationConfiguration.getClientType() == ClientType.CONFIDENTIAL
            ? authenticationConfiguration.getOidcConfiguration()
            : null;
    this.providerTokenValidator =
        new ProviderTokenValidator(
            clientIdsOf(authenticationConfiguration),
            this::providerIssuer,
            publicClientEntraTenant(authenticationConfiguration));

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
      List<String> jwtPrincipalClaims,
      String principalDomain,
      ProviderTokenValidator providerTokenValidator) {
    this(jwkProvider, jwtPrincipalClaims, principalDomain, false);
    this.providerTokenValidator = providerTokenValidator;
  }

  @SneakyThrows
  @Override
  public void filter(ContainerRequestContext requestContext) {
    if (isExcludedEndpoint(requestContext.getUriInfo())) {
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
      String userName =
          findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims);
      String email =
          findEmailFromClaims(
              jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims, principalDomain);
      boolean isBotUser = isBot(claims);

      String impersonateUser = requestContext.getHeaderString(IMPERSONATE_USER_HEADER);
      String activePersona = requestContext.getHeaderString(ACTIVE_PERSONA_HEADER);
      String impersonatedBy = null;

      if (impersonateUser != null && !impersonateUser.isEmpty()) {
        if (!isBotUser) {
          throw new AuthorizationException("Only bot users can impersonate other users");
        }
        impersonatedBy = userName;
        User impersonatedUser = resolveImpersonationTarget(impersonatedBy, impersonateUser);
        userName = impersonatedUser.getName();
        email = impersonatedUser.getEmail();
      }

      checkValidationsForToken(claims, tokenFromHeader, tokenKeyId, userName, impersonatedBy);

      CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName, email);
      String scheme = requestContext.getUriInfo().getRequestUri().getScheme();
      CatalogSecurityContext catalogSecurityContext =
          new CatalogSecurityContext(
              catalogPrincipal,
              scheme,
              SecurityContext.DIGEST_AUTH,
              getUserRolesFromClaims(claims, isBotUser, tokenKeyId),
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

  /**
   * Resolves the {@code X-Impersonate-User} target and authorizes the swap here, where the header
   * is read, so the grant is enforced at the door and fails closed.
   *
   * <p>{@link Authorizer} entry points check this too. Both are needed: the authorizer covers the
   * paths that reach it, and this covers the ones that never call an authorizer at all - which is
   * how GHSA-3w33-vhhj-h357 slipped through {@code authorizeRequests}. The authorizer-side check is
   * memoized per request, so the duplicate costs one extra lookup on impersonated requests only.
   */
  private User resolveImpersonationTarget(String botName, String targetName) {
    User target;
    try {
      target = Entity.getEntityByName(Entity.USER, targetName, "", Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      LOG.warn("Impersonation target user not found: {}", targetName);
      throw new AuthenticationException("Cannot impersonate non-existent user: " + targetName);
    }
    ImpersonationAuthorizer.authorize(botName, target);
    return target;
  }

  /**
   * Whether the request targets an endpoint that bypasses authentication (and, for the event
   * filter, auditing). Matches the resource path exactly, after dropping matrix parameters from
   * each segment: a substring or raw-path match would let {@code ;x=…} or an encoded separator in
   * an entity name make a different endpoint look like an excluded one.
   */
  public static boolean isExcludedEndpoint(UriInfo uriInfo) {
    String path =
        uriInfo.getPathSegments().stream()
            .map(PathSegment::getPath)
            .collect(Collectors.joining("/"));
    return EXCLUDED_ENDPOINTS.stream().anyMatch(path::equalsIgnoreCase);
  }

  public void checkValidationsForToken(
      Map<String, Claim> claims, String tokenFromHeader, String userName, String impersonatedBy) {
    String tokenKeyId = null;
    try {
      tokenKeyId = JWT.decode(tokenFromHeader).getKeyId();
    } catch (JWTDecodeException e) {
      LOG.debug("Unable to read key id from token during OpenMetadata issuer check", e);
    }
    checkValidationsForToken(claims, tokenFromHeader, tokenKeyId, userName, impersonatedBy);
  }

  private void checkValidationsForToken(
      Map<String, Claim> claims,
      String tokenFromHeader,
      String tokenKeyId,
      String userName,
      String impersonatedBy) {
    // the case where OMD generated the Token for the Client in case OM generated Token
    validateTokenIsNotUsedAfterLogout(tokenFromHeader);

    // OM-issued tokens minted before JWTTokenGenerator mirrored the provider's claim shape carry a
    // bare preferred_username, which getFirstMatchJwtClaim-based domain extraction turns into an
    // empty domain. Unlimited-expiry bot tokens from that era are still in use, so OM-issued tokens
    // stay exempt - consistent with how bot tokens are already handled (validateDomainEnforcement
    // returns early for isBot=true tokens). The isInternallyIssuedToken check is guarded by
    // enforcePrincipalDomain to avoid the singleton lookup where enforcement is disabled.
    if (!isBot(claims) && !isInternallyIssuedToken(claims, tokenKeyId)) {
      validateProviderIdentity(claims, userName);
    }

    // Validate Bot token matches what was created in OM. Under impersonation the presented token
    // belongs to the impersonating bot (impersonatedBy), while userName is the target, so validate
    // the bot's own token against its cache entry instead of skipping - otherwise a rotated (i.e.
    // revoked) bot token keeps working as long as an X-Impersonate-User header is attached.
    if (impersonatedBy != null) {
      validateBotToken(tokenFromHeader, impersonatedBy);
    } else if (isBot(claims)) {
      validateBotToken(tokenFromHeader, userName);
    }

    // validate personal access token
    validatePersonalAccessToken(claims, tokenFromHeader, userName);

    validateSessionBoundToken(claims, userName);
  }

  /**
   * The claim flow names the user after a claim's local part, so a provider token for any address
   * with that local part would resolve to the account of that name. The principal domain is
   * checked when it is enforced, and a provider token never resolves to a bot account.
   */
  private void validateProviderIdentity(Map<String, Claim> claims, String userName) {
    if (enforcePrincipalDomain) {
      validateDomainEnforcement(
          jwtPrincipalClaimsMapping,
          jwtPrincipalClaims,
          claims,
          principalDomain,
          allowedDomains,
          enforcePrincipalDomain);
    }
    rejectProviderTokenForBotAccount(userName);
  }

  /**
   * A provider token names the user after a claim's local part, so one whose local part matches a bot
   * account's name - with or without an email - would otherwise sign in as that bot and inherit its
   * roles. Bots authenticate with their own issued tokens, never through the provider flow, so a
   * provider token must never resolve to a bot account. Uses the cached user context so this stays off
   * the database on the per-request path.
   */
  private static void rejectProviderTokenForBotAccount(String userName) {
    User account;
    try {
      account = SubjectCache.getUserContext(userName);
    } catch (EntityNotFoundException e) {
      // No account holds the name yet: a first login, which provisioning handles. Any other failure
      // propagates, so an unreadable account is refused rather than waved through.
      return;
    }
    if (account != null && Boolean.TRUE.equals(account.getIsBot())) {
      throw new AuthenticationException(
          "Authentication failed: a provider token cannot sign in to a bot account");
    }
  }

  private boolean isInternallyIssuedToken(Map<String, Claim> claims, String tokenKeyId) {
    JWTTokenGenerator tokenGenerator = JWTTokenGenerator.getInstance();
    return SecurityUtil.isOpenMetadataIssuedToken(
        claims, tokenKeyId, tokenGenerator.getIssuer(), tokenGenerator.getKid());
  }

  // null tells the role sync downstream there is nothing to sync from. A token OpenMetadata minted
  // (a session token or a PAT) is one of those: its roles are the ones the user had when it was
  // minted, so syncing from it would restore roles the provider revoked since. In the provider's
  // own token an absent roles claim means no roles - claims without a value are omitted (OIDC Core
  // 5.1), and Entra ID drops the claim once a user's last app role is removed.
  private Set<String> getUserRolesFromClaims(
      Map<String, Claim> claims, boolean isBot, String tokenKeyId) {
    if (!useRolesFromProvider || isBot || isInternallyIssuedToken(claims, tokenKeyId)) {
      return null;
    }
    return new HashSet<>(getClaimAsList(claims.get(ROLES_CLAIM)));
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
    requireIssuedForThisDeployment(jwt);

    return jwt;
  }

  private void requireIssuedForThisDeployment(DecodedJWT jwt) {
    if (!isSignedWithOpenMetadataKey(jwt)) {
      providerTokenValidator.validate(jwt);
    }
  }

  /**
   * Key lookup resolves OpenMetadata's own key id locally before any configured URL, so a verified
   * token carrying it was signed with our key. Unlike {@link #isInternallyIssuedToken}, this does
   * not require the current issuer: long-lived bot tokens minted under an earlier one are still ours.
   */
  private static boolean isSignedWithOpenMetadataKey(DecodedJWT jwt) {
    String openMetadataKeyId = JWTTokenGenerator.getInstance().getKid();
    return !nullOrEmpty(openMetadataKeyId) && openMetadataKeyId.equals(jwt.getKeyId());
  }

  /** The OIDC client IDs this deployment's sign-in flows request tokens for. */
  static Set<String> clientIdsOf(AuthenticationConfiguration authenticationConfiguration) {
    OidcClientConfig oidcClient = authenticationConfiguration.getOidcConfiguration();
    return Stream.of(
            authenticationConfiguration.getClientId(),
            oidcClient == null ? null : oidcClient.getId())
        .filter(clientId -> !nullOrEmpty(clientId) && !clientId.isBlank())
        .collect(Collectors.toUnmodifiableSet());
  }

  /**
   * The Entra ID tenant a public client's authority names, which provider tokens must come from. A
   * confidential client checks the issuer from discovery instead, so it has none. A multi-tenant
   * authority (common, organizations, consumers) restricts nothing on purpose. A tenant named by
   * domain cannot be compared with the token's tenant ID without a discovery lookup.
   */
  @VisibleForTesting
  static String publicClientEntraTenant(AuthenticationConfiguration authenticationConfiguration) {
    if (authenticationConfiguration.getProvider() != AuthProvider.AZURE
        || authenticationConfiguration.getClientType() == ClientType.CONFIDENTIAL
        || nullOrEmpty(authenticationConfiguration.getAuthority())) {
      return null;
    }
    List<String> segments =
        Stream.of(
                URI.create(authenticationConfiguration.getAuthority().trim()).getPath().split("/"))
            .filter(segment -> !segment.isEmpty() && !AUTHORITY_VERSION_SEGMENT.equals(segment))
            .toList();
    String tenant = segments.isEmpty() ? null : segments.get(segments.size() - 1);
    if (tenant == null || MULTI_TENANT_AUTHORITIES.contains(tenant.toLowerCase(Locale.ROOT))) {
      return null;
    }
    if (!TENANT_ID.matcher(tenant).matches()) {
      LOG.warn(
          "Entra ID tokens are accepted from any tenant: the authority names tenant '{}' by domain;"
              + " use the tenant ID to restrict sign-in to it",
          tenant);
      return null;
    }
    return tenant;
  }

  @VisibleForTesting
  Optional<String> providerIssuer() {
    return codeFlowHandler().map(AuthenticationCodeFlowHandler::getProviderIssuer);
  }

  /**
   * The server-side sign-in handler, when it serves this filter's OIDC client. It registers after
   * this filter at startup and is replaced on a configuration change, so it is looked up per use.
   */
  private Optional<AuthenticationCodeFlowHandler> codeFlowHandler() {
    return AuthServeletHandlerRegistry.getHandler() instanceof AuthenticationCodeFlowHandler handler
            && handler.servesClient(serverSideOidcClient)
        ? Optional.of(handler)
        : Optional.empty();
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
    // Existing access tokens remain usable while another request holds the refresh lease.
    final boolean isAuthenticated =
        session.getStatus() == SessionStatus.ACTIVE
            || session.getStatus() == SessionStatus.REFRESHING;
    if (!isAuthenticated
        || session.isExpired(System.currentTimeMillis())
        || nullOrEmpty(session.getUsername())
        || !SecurityUtil.sameIdentifier(session.getUsername(), userName)) {
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
    String userName = findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims);
    String email =
        findEmailFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims, principalDomain);
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName, email);
    boolean isBotUser = isBot(claims);
    return new CatalogSecurityContext(
        catalogPrincipal,
        "https",
        SecurityContext.DIGEST_AUTH,
        getUserRolesFromClaims(claims, isBotUser, JWT.decode(token).getKeyId()),
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
