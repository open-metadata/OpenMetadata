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
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.security.SecurityUtil.buildPrincipalClaimsMapping;
import static org.openmetadata.service.security.SecurityUtil.getClaimAsList;
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
import jakarta.ws.rs.core.PathSegment;
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
import java.util.Optional;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.Invalidatable;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.OAuthDAOs;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.credentials.CredentialUnavailableException;
import org.openmetadata.service.security.credentials.CredentialVerifier;
import org.openmetadata.service.security.credentials.Credentials;
import org.openmetadata.service.security.credentials.OmCredential;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.saml.JwtTokenCacheManager;
import org.openmetadata.service.security.session.SessionProviders;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.UserUtil;

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
  private static final Set<String> MULTI_TENANT_AUTHORITIES =
      Set.of("common", "organizations", "consumers");
  private static final Pattern TENANT_ID =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  // The path segment after the tenant in a v2 endpoint authority, as in .../{tenant}/v2.0.
  private static final String AUTHORITY_VERSION_SEGMENT = "v2.0";
  private static final String EMAIL_SEPARATOR = "@";

  // Integration tests match the first two word for word.
  private static final String BOT_TOKEN_MISMATCH =
      "The given token does not match the current bot's token!";
  private static final String INVALID_PERSONAL_ACCESS_TOKEN = "Invalid personal access token!";
  private static final String UNRECOGNIZED_TOKEN = "Unrecognized token type!";
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

  /** Looked up per check: the server installs its verifier after the first filter is built. */
  private final Supplier<CredentialVerifier> credentialVerifier;

  private String emailClaim;
  private String displayNameClaim;
  private List<String> allowedEmailDomains;

  /**
   * Email-to-username resolution cache for the email-first flow. This mapping decides which
   * principal a request runs as, so a stale entry is an authorization bug, not just a stale read:
   * if an address is reassigned, a replica still holding the old mapping would run the new holder
   * as the previous owner. Three things bound that. Entries are only written for an email a
   * stored account actually owns. Local user writes invalidate through {@link
   * #invalidateResolvedEmailIdentity}, and that fans out to other replicas over the cache
   * invalidation channel when Redis is configured. The short TTL is the backstop for deployments
   * with no shared cache, and for changes made outside a running server -- the {@code
   * change-email} ops command runs in its own process and cannot reach any replica's memory.
   */
  private static final Cache<String, String> EMAIL_TO_USERNAME_CACHE =
      CacheBuilder.newBuilder().maximumSize(10_000).expireAfterWrite(60, TimeUnit.SECONDS).build();

  /**
   * Drops resolved-identity entries for a user when any replica reports a write to that user.
   * Registered with {@link CacheBundle}, which fans both local mutations and remote pub/sub
   * messages out to every registered layer.
   */
  private static final Invalidatable EMAIL_IDENTITY_INVALIDATOR =
      (type, id, fqn) -> {
        if (!USER.equals(type) || fqn == null) {
          return;
        }
        String userName = EntityInterfaceUtil.unquoteName(fqn);
        EMAIL_TO_USERNAME_CACHE.asMap().values().removeIf(userName::equals);
      };

  public static Invalidatable emailIdentityInvalidator() {
    return EMAIL_IDENTITY_INVALIDATOR;
  }

  public static void invalidateResolvedEmailIdentity(String email) {
    if (email != null) {
      EMAIL_TO_USERNAME_CACHE.invalidate(email.toLowerCase(Locale.ROOT));
    }
  }

  private record ResolvedIdentity(String userName, String email, boolean usedEmailFirstFlow) {}

  /** A token that passed {@link #authenticate}, with the identity it was minted for. */
  private record AuthenticatedToken(
      DecodedJWT jwt, Map<String, Claim> claims, ResolvedIdentity identity, boolean isBot) {}

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

  @SuppressWarnings("unused")
  private JwtFilter() {
    this.credentialVerifier = Credentials::verifier;
  }

  @SneakyThrows
  public JwtFilter(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration) {
    this.credentialVerifier = Credentials::verifier;
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
    this.jwkProvider =
        new MultiUrlJwkProvider(publicKeyUrlsBuilder.build(), this::providerKeySetUrls);
    this.serverSideOidcClient =
        authenticationConfiguration.getClientType() == ClientType.CONFIDENTIAL
            ? authenticationConfiguration.getOidcConfiguration()
            : null;
    this.providerTokenValidator =
        new ProviderTokenValidator(
            clientIdsOf(authenticationConfiguration),
            this::providerIssuer,
            publicClientEntraTenant(authenticationConfiguration));

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

  /**
   * Warns only about deprecated settings that are now redundant, i.e. once the replacement is
   * configured. 'jwtPrincipalClaims' ships with a non-empty default and still drives the legacy
   * flow when 'emailClaim' is unset, so warning about it unconditionally would tell every
   * untouched deployment to remove configuration it still depends on.
   */
  private void logDeprecationWarnings(AuthenticationConfiguration config) {
    boolean emailFirstConfigured = !nullOrEmpty(config.getEmailClaim());
    if (emailFirstConfigured && !nullOrEmpty(config.getJwtPrincipalClaims())) {
      LOG.warn(
          "DEPRECATED: 'jwtPrincipalClaims' is deprecated and no longer used now that "
              + "'emailClaim' is configured. It can be removed; this will be removed in a "
              + "future version.");
    }

    // Empty by default, so this only fires for a deployment that explicitly set it. Note it also
    // suppresses the email-first flow, which is worth saying out loud.
    if (!nullOrEmpty(config.getJwtPrincipalClaimsMapping())) {
      LOG.warn(
          "DEPRECATED: 'jwtPrincipalClaimsMapping' configuration is deprecated and keeps "
              + "identity resolution on the legacy flow. Use 'emailClaim' and "
              + "'displayNameClaim' instead. This will be removed in a future version.");
    }
  }

  /**
   * Other distributions' tests build the filter through this signature. It checks tokens against
   * the installed verifier, as the production constructor does.
   */
  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      boolean enforcePrincipalDomain) {
    this(
        jwkProvider,
        jwtPrincipalClaims,
        principalDomain,
        enforcePrincipalDomain,
        Credentials::verifier);
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      boolean enforcePrincipalDomain,
      Supplier<CredentialVerifier> credentialVerifier) {
    this(
        jwkProvider,
        jwtPrincipalClaims,
        principalDomain,
        enforcePrincipalDomain,
        null,
        credentialVerifier);
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      List<String> jwtPrincipalClaims,
      String principalDomain,
      boolean enforcePrincipalDomain,
      AuthProvider providerType,
      Supplier<CredentialVerifier> credentialVerifier) {
    this.credentialVerifier = credentialVerifier;
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
      ProviderTokenValidator providerTokenValidator,
      Supplier<CredentialVerifier> credentialVerifier) {
    this(jwkProvider, jwtPrincipalClaims, principalDomain, false, credentialVerifier);
    this.providerTokenValidator = providerTokenValidator;
  }

  @VisibleForTesting
  JwtFilter(
      JwkProvider jwkProvider,
      String emailClaim,
      String displayNameClaim,
      List<String> allowedEmailDomains,
      Supplier<CredentialVerifier> credentialVerifier) {
    this.credentialVerifier = credentialVerifier;
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
      List<String> allowedEmailDomains,
      Supplier<CredentialVerifier> credentialVerifier) {
    this(
        jwkProvider,
        jwtPrincipalClaims,
        principalDomain,
        enforcePrincipalDomain,
        credentialVerifier);
    this.emailClaim = emailClaim;
    this.displayNameClaim = displayNameClaim;
    this.allowedEmailDomains = allowedEmailDomains;
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
    ActiveDomainContext.clear();

    try {
      String tokenFromHeader = extractToken(requestContext.getHeaders());
      LOG.debug("Authorization header present: {}", !nullOrEmpty(tokenFromHeader));
      AuthenticatedToken authenticated = authenticate(tokenFromHeader);
      String tokenKeyId = authenticated.jwt().getKeyId();
      Map<String, Claim> claims = authenticated.claims();
      boolean isBotUser = authenticated.isBot();
      ResolvedIdentity resolvedIdentity = authenticated.identity();
      String userName = resolvedIdentity.userName();
      String email = resolvedIdentity.email();

      String impersonateUser = requestContext.getHeaderString(IMPERSONATE_USER_HEADER);
      String activePersona = requestContext.getHeaderString(ACTIVE_PERSONA_HEADER);
      String impersonatedBy = null;

      if (impersonateUser != null && !impersonateUser.isEmpty()) {
        if (!isBotUser) {
          throw new ImpersonationDeniedException("Only bot users can impersonate other users");
        }
        impersonatedBy = userName;
        User impersonatedUser = resolveImpersonationTarget(impersonatedBy, impersonateUser);
        userName = impersonatedUser.getName();
        email = impersonatedUser.getEmail();
      }

      checkValidationsForToken(
          claims,
          tokenFromHeader,
          tokenKeyId,
          userName,
          email,
          resolvedIdentity.usedEmailFirstFlow());

      CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName, email);
      String scheme = requestContext.getUriInfo().getRequestUri().getScheme();
      // The persisted navbar selection is a UI view preference: bot tokens (including impersonated
      // requests) and personal access tokens (scripts, SDK) list without it.
      EntityReference activeDomain =
          ActiveDomainContext.resolve(userName, isBotUser || isPersonalAccessToken(claims));
      CatalogSecurityContext catalogSecurityContext =
          new CatalogSecurityContext(
              catalogPrincipal,
              scheme,
              SecurityContext.DIGEST_AUTH,
              getUserRolesFromClaims(claims, isBotUser, tokenKeyId),
              isBotUser,
              impersonatedBy,
              activePersona,
              activeDomain);
      LOG.debug("SecurityContext {}", catalogSecurityContext);
      requestContext.setSecurityContext(catalogSecurityContext);

      if (impersonatedBy != null) {
        ImpersonationContext.setImpersonatedBy(impersonatedBy);
      } else {
        ImpersonationContext.clear();
      }
      ActivePersonaContext.setActivePersona(activePersona);
      ActiveDomainContext.setActiveDomain(activeDomain);
    } catch (Throwable t) {
      ImpersonationContext.clear();
      ActivePersonaContext.clear();
      ActiveDomainContext.clear();
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
      throw new ImpersonationTargetNotFoundException(
          "Cannot impersonate non-existent user: " + targetName);
    }
    ImpersonationAuthorizer.authorize(botName, target);
    return target;
  }

  /**
   * The legacy claim flow names the user after a claim's local part, so a provider token for any
   * address with that local part would resolve to the account of that name. When {@code
   * allowedEmailDomains} is set, the address the request runs as must be in an allowed domain: the
   * token's email when it carries one, otherwise {@code userName@principalDomain}, the address the
   * legacy flow builds. Either way, a provider token never resolves to a bot account.
   */
  private void validateLegacyProviderIdentity(Map<String, Claim> claims, String userName) {
    String claimedEmail = claimedEmail(claims);
    if (!nullOrEmpty(allowedEmailDomains)) {
      // With no email claim the legacy flow runs as userName@principalDomain (principalDomain
      // carries
      // the allowedEmailDomains fallback), so check that derived address rather than skipping the
      // allowlist for a bare principal claim.
      String emailToCheck =
          claimedEmail != null ? claimedEmail : userName + EMAIL_SEPARATOR + principalDomain;
      validateConfiguredEmailDomain(
          emailToCheck,
          allowedEmailDomains,
          principalDomain,
          allowedDomains,
          enforcePrincipalDomain);
    } else if (enforcePrincipalDomain) {
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

  /** The email the provider asserted, or null when the principal claims carry none. */
  private String claimedEmail(Map<String, Claim> claims) {
    String value =
        nullOrEmpty(jwtPrincipalClaimsMapping)
            ? SecurityUtil.getFirstMatchJwtClaim(jwtPrincipalClaims, claims)
            : SecurityUtil.getClaimOrObject(
                claims.get(jwtPrincipalClaimsMapping.get(EMAIL_CLAIM_KEY)));
    return value != null && value.contains(EMAIL_SEPARATOR) ? value : null;
  }

  /**
   * The checks that follow {@link #validateJwtAndGetClaims}: the logout denylist, the email and
   * principal domain rules, and the session binding. The stored-credential check already ran
   * there, against the token's own principal, so {@code impersonatedBy} is not consulted. The
   * parameter stays because other distributions call this signature.
   */
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
        resolvedIdentity.usedEmailFirstFlow());
  }

  private void checkValidationsForToken(
      Map<String, Claim> claims,
      String tokenFromHeader,
      String tokenKeyId,
      String userName,
      String email,
      boolean usedEmailFirstFlow) {
    // the case where OMD generated the Token for the Client in case OM generated Token
    validateTokenIsNotUsedAfterLogout(tokenFromHeader);
    validateMcpAccessTokenIsActive(tokenFromHeader, claims, tokenKeyId);

    // OM-issued tokens minted before JWTTokenGenerator mirrored the provider's claim shape carry a
    // bare preferred_username, which getFirstMatchJwtClaim-based domain extraction turns into an
    // empty domain. Unlimited-expiry bot tokens from that era are still in use, so OM-issued tokens
    // stay exempt - consistent with how bot tokens are already handled (validateDomainEnforcement
    // returns early for isBot=true tokens). The isInternallyIssuedToken check is guarded by
    // enforcePrincipalDomain to avoid the singleton lookup where enforcement is disabled.
    if (usedEmailFirstFlow) {
      // OM-issued tokens (sessions, PATs) carry emails that predate any allowedEmailDomains
      // config; enforcing the domain list on them would lock out the seeded admin and
      // grandfathered users. Domain restrictions apply to IdP-issued tokens only.
      if (!isInternallyIssuedToken(claims, tokenKeyId)) {
        validateConfiguredEmailDomain(
            email, allowedEmailDomains, principalDomain, allowedDomains, enforcePrincipalDomain);
      }
    } else if (!isBot(claims) && !isInternallyIssuedToken(claims, tokenKeyId)) {
      validateLegacyProviderIdentity(claims, userName);
    }

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

  /**
   * The principal name an HTTP request carrying these claims is authenticated as: resolved from
   * the email when {@code emailClaim} is configured, from the legacy principal claims otherwise.
   * Any other entry point that binds an identity to a token (the push-feed handshake) must use
   * this, or a user whose stored name differs from the token claim authenticates over HTTP yet
   * loses the socket.
   */
  public String resolveUserName(Map<String, Claim> claims) {
    return resolveIdentity(claims, isBot(claims)).userName();
  }

  /** Caching wrapper around {@link UserUtil#resolveUserName}; this runs on every request. */
  private String resolveUserNameForEmail(String email) {
    String cached = EMAIL_TO_USERNAME_CACHE.getIfPresent(email);
    if (cached != null) {
      return cached;
    }
    UserUtil.ResolvedUserName resolved = UserUtil.resolveUserName(email);
    // A name no account owns is a first-login bootstrap guess. Caching it would outlive the guess:
    // creation does not invalidate this cache, so a later account taking that name -- for someone
    // else's email -- would inherit the mapping and the requests authorized under it.
    if (resolved.backedByAccount()) {
      EMAIL_TO_USERNAME_CACHE.put(email, resolved.userName());
    }
    return resolved.userName();
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
  // ADR:2026-10-13-provider-token-is-authoritative-for-roles-and-admin
  private Set<String> getUserRolesFromClaims(
      Map<String, Claim> claims, boolean isBot, String tokenKeyId) {
    if (!useRolesFromProvider || isBot || isInternallyIssuedToken(claims, tokenKeyId)) {
      return null;
    }
    return new HashSet<>(getClaimAsList(claims.get(ROLES_CLAIM)));
  }

  /**
   * Verifies the token and returns its claims. This includes the stored-credential check, so a bot
   * JWT or a personal access token is accepted only while the database stores it.
   *
   * @throws AuthenticationException the token is invalid, expired, unrecognized or not current
   * @throws CredentialUnavailableException the stored-credential check could not be confirmed
   */
  public Map<String, Claim> validateJwtAndGetClaims(String token) {
    return authenticate(token).claims();
  }

  /**
   * Signature, expiry and issuer only, with no stored-credential check. For probes and dry runs
   * that grant no access: anything that authenticates a request calls {@link
   * #validateJwtAndGetClaims}.
   */
  public Map<String, Claim> verifySignatureOnly(String token) {
    return extractClaims(decodeAndVerify(token));
  }

  /**
   * Signature, expiry and issuer, then the token's own identity, then the stored-credential check
   * of that identity. A caller swaps to an impersonation target only afterwards, so a bot token is
   * always checked against the bot.
   */
  private AuthenticatedToken authenticate(String token) {
    DecodedJWT jwt = decodeAndVerify(token);
    Map<String, Claim> claims = extractClaims(jwt);
    boolean isBotUser = isBot(claims);
    ResolvedIdentity identity = resolveIdentity(claims, isBotUser);
    OmCredential credential =
        OmCredential.classify(
            isSignedWithOpenMetadataKey(jwt), isBotUser, tokenTypeOf(claims), identity.userName());
    credentialVerifier.get().require(credential, token, rejectionMessage(credential, isBotUser));
    return new AuthenticatedToken(jwt, claims, identity, isBotUser);
  }

  private static String rejectionMessage(OmCredential credential, boolean isBotUser) {
    String message = isBotUser ? BOT_TOKEN_MISMATCH : INVALID_PERSONAL_ACCESS_TOKEN;
    if (credential instanceof OmCredential.Unrecognized) {
      message = UNRECOGNIZED_TOKEN;
    }
    return message;
  }

  private static String tokenTypeOf(Map<String, Claim> claims) {
    Claim tokenType = claims.get(TOKEN_TYPE);
    return tokenType == null ? null : tokenType.asString();
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
    return isOpenMetadataKeyId(jwt.getKeyId());
  }

  private static boolean isOpenMetadataKeyId(String tokenKeyId) {
    String openMetadataKeyId = JWTTokenGenerator.getInstance().getKid();
    return !nullOrEmpty(openMetadataKeyId) && openMetadataKeyId.equals(tokenKeyId);
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

  @VisibleForTesting
  List<URL> providerKeySetUrls() {
    return codeFlowHandler().map(AuthenticationCodeFlowHandler::getProviderKeySetUrl).stream()
        .toList();
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

  private static boolean isPersonalAccessToken(Map<String, Claim> claims) {
    return ServiceTokenType.PERSONAL_ACCESS.value().equals(tokenTypeOf(claims));
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

  /**
   * An MCP OAuth access token is stored when issued and deleted when revoked or when its client is
   * deleted, so one missing from the store is refused on every server. Only a token OpenMetadata
   * signed is looked up, a provider's own token may carry a client_id claim too, and it is picked by
   * our key id like the signature check, not by the current issuer, which can change.
   * ADR:2026-10-29-mcp-access-tokens-are-stored-so-revoke-reaches-every-server
   */
  private void validateMcpAccessTokenIsActive(
      String token, Map<String, Claim> claims, String tokenKeyId) {
    boolean isMcpAccessToken =
        claims.containsKey(JWTTokenGenerator.CLIENT_ID_CLAIM) && isOpenMetadataKeyId(tokenKeyId);
    if (isMcpAccessToken
        && Entity.getCollectionDAO()
                .oauthAccessTokenDAO()
                .findByTokenHash(OAuthDAOs.hashToken(token))
            == null) {
      throw AuthenticationException.getInvalidTokenException("Token has been revoked.");
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
    if (!SessionProviders.isSameProvider(sessionProvider, providerType.value())) {
      LOG.warn(
          "Rejecting session {} issued by provider {} — the configured provider is now {}",
          SessionService.truncateId(session.getId()),
          sessionProvider,
          providerType.value());
      throw AuthenticationException.getInvalidTokenException(
          "Session was issued by a provider that is no longer configured.");
    }
  }

  public CatalogSecurityContext getCatalogSecurityContext(String token) {
    return getCatalogSecurityContext(token, null);
  }

  public CatalogSecurityContext getCatalogSecurityContext(String token, String activePersona) {
    AuthenticatedToken authenticated = authenticate(token);
    Map<String, Claim> claims = authenticated.claims();
    boolean isBotUser = authenticated.isBot();
    ResolvedIdentity resolvedIdentity = authenticated.identity();
    String tokenKeyId = authenticated.jwt().getKeyId();
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
        getUserRolesFromClaims(claims, isBotUser, tokenKeyId),
        isBotUser,
        null,
        activePersona,
        ActiveDomainContext.resolve(
            resolvedIdentity.userName(), isBotUser || isPersonalAccessToken(claims)));
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
