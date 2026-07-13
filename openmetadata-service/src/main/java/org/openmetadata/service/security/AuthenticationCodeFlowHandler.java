package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findTeamsFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.trustedRedirects;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;
import static org.pac4j.core.util.CommonHelper.assertNotNull;
import static org.pac4j.core.util.CommonHelper.isNotEmpty;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.BadJWTException;
import com.nimbusds.oauth2.sdk.AuthorizationCode;
import com.nimbusds.oauth2.sdk.AuthorizationCodeGrant;
import com.nimbusds.oauth2.sdk.AuthorizationGrant;
import com.nimbusds.oauth2.sdk.ErrorObject;
import com.nimbusds.oauth2.sdk.TokenErrorResponse;
import com.nimbusds.oauth2.sdk.TokenRequest;
import com.nimbusds.oauth2.sdk.TokenResponse;
import com.nimbusds.oauth2.sdk.auth.ClientAuthentication;
import com.nimbusds.oauth2.sdk.auth.ClientAuthenticationMethod;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.ClientSecretPost;
import com.nimbusds.oauth2.sdk.auth.PrivateKeyJWT;
import com.nimbusds.oauth2.sdk.auth.Secret;
import com.nimbusds.oauth2.sdk.http.HTTPRequest;
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.nimbusds.oauth2.sdk.id.State;
import com.nimbusds.oauth2.sdk.pkce.CodeChallenge;
import com.nimbusds.oauth2.sdk.pkce.CodeChallengeMethod;
import com.nimbusds.oauth2.sdk.pkce.CodeVerifier;
import com.nimbusds.oauth2.sdk.token.AccessToken;
import com.nimbusds.openid.connect.sdk.AuthenticationErrorResponse;
import com.nimbusds.openid.connect.sdk.AuthenticationRequest;
import com.nimbusds.openid.connect.sdk.AuthenticationResponse;
import com.nimbusds.openid.connect.sdk.AuthenticationResponseParser;
import com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse;
import com.nimbusds.openid.connect.sdk.Nonce;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponse;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponseParser;
import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import com.nimbusds.openid.connect.sdk.token.OIDCTokens;
import com.nimbusds.openid.connect.sdk.validators.BadJWTExceptions;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.time.Instant;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.session.SessionRefreshInProgressException;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.core.util.CommonHelper;
import org.pac4j.oidc.client.AzureAd2Client;
import org.pac4j.oidc.client.GoogleOidcClient;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.AzureAd2OidcConfiguration;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.config.PrivateKeyJWTClientAuthnMethodConfig;
import org.pac4j.oidc.credentials.OidcCredentials;

@Slf4j
public class AuthenticationCodeFlowHandler implements AuthServeletHandler {
  private static final Collection<ClientAuthenticationMethod> SUPPORTED_METHODS =
      Arrays.asList(
          ClientAuthenticationMethod.CLIENT_SECRET_POST,
          ClientAuthenticationMethod.CLIENT_SECRET_BASIC,
          ClientAuthenticationMethod.PRIVATE_KEY_JWT,
          ClientAuthenticationMethod.NONE);

  public static final String DEFAULT_PRINCIPAL_DOMAIN = "openmetadata.org";
  public static final String REDIRECT_URI_KEY = "redirectUri";

  public static final String OIDC_CREDENTIAL_PROFILE = "oidcCredentialProfile";
  public static final String SESSION_REDIRECT_URI = "sessionRedirectUri";
  public static final String SESSION_SSO_CALLBACK_URL = "googleCallbackUrl";

  private static volatile AuthenticationCodeFlowHandler latestInstance;

  private OidcClient client;
  private List<String> claimsOrder;
  private Map<String, String> claimsMapping;
  private String teamClaimMapping;
  private String serverUrl;
  private ClientAuthentication clientAuthentication;
  private String principalDomain;
  private int tokenValidity;
  private String maxAge;
  private String promptType;
  private AuthenticationConfiguration authenticationConfiguration;
  private AuthorizerConfiguration authorizerConfiguration;
  private final SessionService sessionService;

  private static volatile java.util.function.Predicate<String> mcpStateChecker;

  public static void setMcpStateChecker(java.util.function.Predicate<String> checker) {
    mcpStateChecker = checker;
  }

  public static boolean isMcpState(String state) {
    java.util.function.Predicate<String> checker = mcpStateChecker;
    if (checker == null || state == null) {
      return false;
    }
    try {
      return checker.test(state);
    } catch (Exception e) {
      LOG.debug("MCP state check failed: {}", e.getMessage());
      return false;
    }
  }

  public AuthenticationCodeFlowHandler(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration,
      SessionService sessionService) {
    // Assert oidcConfig and Callback Url
    CommonHelper.assertNotNull(
        "OidcConfiguration", authenticationConfiguration.getOidcConfiguration());
    CommonHelper.assertNotBlank(
        "CallbackUrl", authenticationConfiguration.getOidcConfiguration().getCallbackUrl());
    CommonHelper.assertNotBlank(
        "ServerUrl", authenticationConfiguration.getOidcConfiguration().getServerUrl());

    // Build Required Params
    this.authenticationConfiguration = authenticationConfiguration;
    this.authorizerConfiguration = authorizerConfiguration;
    this.sessionService = sessionService;
    initializeFields();
    latestInstance = this;
  }

  public static AuthenticationCodeFlowHandler getInstance() {
    AuthenticationCodeFlowHandler instance = latestInstance;
    if (instance == null) {
      throw new IllegalStateException(
          "AuthenticationCodeFlowHandler has not been initialized. "
              + "Ensure an OIDC AuthServeletHandler is created via AuthServeletHandlerFactory first.");
    }
    return instance;
  }

  public static HttpSession getHttpSession(HttpServletRequest request, boolean createSession) {
    HttpSession session = request.getSession(false);
    if (session == null && createSession) {
      session = request.getSession(true);
    }
    return session;
  }

  public OidcClient getClient() {
    return client;
  }

  public synchronized void updateConfiguration(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration) {
    this.authenticationConfiguration = authenticationConfiguration;
    this.authorizerConfiguration = authorizerConfiguration;
    initializeFields();
  }

  private void initializeFields() {
    this.client = buildOidcClient(authenticationConfiguration.getOidcConfiguration());
    client.setCallbackUrl(authenticationConfiguration.getOidcConfiguration().getCallbackUrl());

    this.serverUrl = authenticationConfiguration.getOidcConfiguration().getServerUrl();
    this.claimsOrder = authenticationConfiguration.getJwtPrincipalClaims();
    this.claimsMapping =
        listOrEmpty(authenticationConfiguration.getJwtPrincipalClaimsMapping()).stream()
            .map(s -> s.split(":"))
            .collect(Collectors.toMap(s -> s[0], s -> s[1]));
    validatePrincipalClaimsMapping(claimsMapping);
    this.teamClaimMapping = authenticationConfiguration.getJwtTeamClaimMapping();
    this.principalDomain = authorizerConfiguration.getPrincipalDomain();
    this.tokenValidity = authenticationConfiguration.getOidcConfiguration().getTokenValidity();
    this.maxAge = authenticationConfiguration.getOidcConfiguration().getMaxAge();
    this.promptType = authenticationConfiguration.getOidcConfiguration().getPrompt();
    this.clientAuthentication = getClientAuthentication(client.getConfiguration());
  }

  private static OidcClient buildOidcClient(OidcClientConfig clientConfig) {
    String id = clientConfig.getId();
    String secret = clientConfig.getSecret();
    if (CommonHelper.isNotBlank(id) && CommonHelper.isNotBlank(secret)) {
      OidcConfiguration configuration = new OidcConfiguration();
      configuration.setClientId(id);

      configuration.setResponseMode("query");

      // Add Secret
      if (CommonHelper.isNotBlank(secret)) {
        configuration.setSecret(secret);
      }

      // Response Type
      String responseType = clientConfig.getResponseType();
      if (CommonHelper.isNotBlank(responseType)) {
        configuration.setResponseType(responseType);
      }

      String scope = clientConfig.getScope();
      if (CommonHelper.isNotBlank(scope)) {
        configuration.setScope(scope);
      }

      String discoveryUri = clientConfig.getDiscoveryUri();
      if (CommonHelper.isNotBlank(discoveryUri)) {
        configuration.setDiscoveryURI(discoveryUri);
      }

      String useNonce = clientConfig.getUseNonce();
      if (CommonHelper.isNotBlank(useNonce)) {
        configuration.setUseNonce(Boolean.parseBoolean(useNonce));
      }

      String jwsAlgo = clientConfig.getPreferredJwsAlgorithm();
      if (CommonHelper.isNotBlank(jwsAlgo)) {
        configuration.setPreferredJwsAlgorithm(JWSAlgorithm.parse(jwsAlgo));
      }

      String maxClockSkew = clientConfig.getMaxClockSkew();
      if (CommonHelper.isNotBlank(maxClockSkew)) {
        configuration.setMaxClockSkew(Integer.parseInt(maxClockSkew));
      }

      String clientAuthenticationMethod =
          clientConfig.getClientAuthenticationMethod() != null
              ? clientConfig.getClientAuthenticationMethod().value()
              : null;
      if (CommonHelper.isNotBlank(clientAuthenticationMethod)) {
        configuration.setClientAuthenticationMethod(
            ClientAuthenticationMethod.parse(clientAuthenticationMethod));
      }

      // Disable PKCE
      configuration.setDisablePkce(clientConfig.getDisablePkce());

      try {
        MCPConfiguration mcpConfig = SecurityConfigurationManager.getCurrentMcpConfig();
        if (mcpConfig != null) {
          if (mcpConfig.getConnectTimeout() != null) {
            configuration.setConnectTimeout(mcpConfig.getConnectTimeout());
          }
          if (mcpConfig.getReadTimeout() != null) {
            configuration.setReadTimeout(mcpConfig.getReadTimeout());
          }
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to configure OIDC client HTTP timeouts from MCP config: {}", e.getMessage());
      }

      // Add Custom Params
      if (clientConfig.getCustomParams() != null) {
        for (int j = 1; j <= 5; ++j) {
          if (clientConfig.getCustomParams().containsKey(String.format("customParamKey%d", j))) {
            configuration.addCustomParam(
                clientConfig.getCustomParams().get(String.format("customParamKey%d", j)),
                clientConfig.getCustomParams().get(String.format("customParamValue%d", j)));
          }
        }
      }

      String type = clientConfig.getType();
      OidcClient oidcClient;
      if ("azure".equalsIgnoreCase(type)) {
        AzureAd2OidcConfiguration azureAdConfiguration =
            new AzureAd2OidcConfiguration(configuration);
        azureAdConfiguration.setDisablePkce(configuration.isDisablePkce());
        String tenant = clientConfig.getTenant();
        if (CommonHelper.isNotBlank(tenant)) {
          azureAdConfiguration.setTenant(tenant);
        }

        oidcClient = new AzureAd2Client(azureAdConfiguration);
      } else if ("google".equalsIgnoreCase(type)) {
        oidcClient = new GoogleOidcClient(configuration);
        // Google needs it as param
        oidcClient.getConfiguration().getCustomParams().put("access_type", "offline");
      } else {
        oidcClient = new OidcClient(configuration);
      }

      oidcClient.setName(String.format("OMOidcClient%s", oidcClient.getName()));
      return oidcClient;
    }
    throw new IllegalArgumentException(
        "Client ID and Client Secret is required to create OidcClient");
  }

  // Login
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      String requestedRedirectUri = req.getParameter(REDIRECT_URI_KEY);

      // Determine the redirect URI to store in the pending session based on the flow:
      // 1. MCP OAuth flow: requestedRedirectUri contains /mcp/callback
      //    - MCP handles its own final redirect
      // 2. Web login flow: any other redirect URI
      String redirectUri;
      String expectedMcpCallback = serverUrl + "/mcp/callback";
      if (requestedRedirectUri != null && requestedRedirectUri.equals(expectedMcpCallback)) {
        redirectUri = requestedRedirectUri;
        LOG.debug(
            "MCP OAuth flow detected - using registered callback URL, final redirect: {}",
            redirectUri);
      } else {
        redirectUri = requireRedirectUri(requestedRedirectUri);
      }

      Optional<UserSession> activeSession = sessionService.getActiveSession(req, resp);
      if (activeSession.isPresent()) {
        User user = getSessionUser(activeSession.get());
        if (user != null) {
          JWTAuthMechanism jwtAuthMechanism = generateJwtToken(user, activeSession.get());
          sendRedirectWithToken(resp, redirectUri, user, jwtAuthMechanism.getJWTToken());
          return;
        }
        sessionService.revokeSession(req, resp);
      }

      Map<String, String> params = buildLoginParams();
      params.put(OidcConfiguration.REDIRECT_URI, client.getCallbackUrl());

      PendingLoginContext pendingLoginContext = addStateAndNonceParameters(params);
      sessionService.createPendingSession(
          req,
          resp,
          authenticationConfiguration.getProvider().value(),
          redirectUri,
          pendingLoginContext.state(),
          pendingLoginContext.nonce(),
          pendingLoginContext.pkceVerifier());

      if (!nullOrEmpty(promptType)) {
        params.put(OidcConfiguration.PROMPT, promptType);
      }

      if (!nullOrEmpty(maxAge)) {
        params.put(OidcConfiguration.MAX_AGE, maxAge);
      }

      String location = buildLoginAuthenticationRequestUrl(params);
      LOG.debug("Authentication request url: {}", location);
      resp.sendRedirect(location);
    } catch (IllegalArgumentException e) {
      try {
        org.openmetadata.service.security.SecurityUtil.writeErrorResponse(
            resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
      } catch (IOException ioException) {
        LOG.error("Failed to write invalid redirect response", ioException);
      }
    } catch (Exception e) {
      getErrorMessage(resp, new TechnicalException(e));
    }
  }

  // Callback
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    try {
      UserSession pendingSession =
          sessionService
              .getPendingSession(req, resp)
              .orElseThrow(() -> new TechnicalException("No pending session found for callback"));

      LOG.debug(
          "Performing Auth Callback For User Session: {} ",
          SessionService.truncateId(pendingSession.getId()));
      String computedCallbackUrl = client.getCallbackUrl();
      Map<String, List<String>> parameters = retrieveCallbackParameters(req);
      AuthenticationResponse response =
          AuthenticationResponseParser.parse(new URI(computedCallbackUrl), parameters);

      if (response instanceof AuthenticationErrorResponse authenticationErrorResponse) {
        LOG.error(
            "Bad authentication response, error={}", authenticationErrorResponse.getErrorObject());
        throw new TechnicalException("Bad authentication response");
      }

      LOG.debug("Authentication response successful");
      AuthenticationSuccessResponse successResponse = (AuthenticationSuccessResponse) response;

      OIDCProviderMetadata metadata = client.getConfiguration().getProviderMetadata();
      if (metadata.supportsAuthorizationResponseIssuerParam()
          && !metadata.getIssuer().equals(successResponse.getIssuer())) {
        throw new TechnicalException("Issuer mismatch, possible mix-up attack.");
      }

      // Optional state validation
      validateStateIfRequired(pendingSession, resp, successResponse);

      // Build Credentials
      OidcCredentials credentials = buildCredentials(successResponse);

      // Validations
      validateAndSendTokenRequest(pendingSession, credentials, computedCallbackUrl);

      if (credentials.getIdToken() == null) {
        throw new TechnicalException("ID token not returned by OIDC provider");
      }

      validateNonceIfRequired(pendingSession, credentials.getIdToken().getJWTClaimsSet());

      Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
      claims.putAll(credentials.getIdToken().getJWTClaimsSet().getClaims());

      String userName = findUserNameFromClaims(claimsMapping, claimsOrder, claims);
      String email = findEmailFromClaims(claimsMapping, claimsOrder, claims, principalDomain);
      User user = getOrCreateOidcUser(userName, email, claims);

      Entity.getUserRepository().updateUserLastLoginTime(user, System.currentTimeMillis());
      if (Entity.getAuditLogRepository() != null) {
        Entity.getAuditLogRepository()
            .writeAuthEvent(AuditLogRepository.AUTH_EVENT_LOGIN, user.getName(), user.getId());
      }

      org.openmetadata.schema.auth.RefreshToken refreshToken =
          TokenUtil.getRefreshToken(user.getId(), UUID.randomUUID());
      Entity.getTokenRepository().insertToken(refreshToken);
      Optional<UserSession> maybeActiveSession =
          sessionService.activatePendingSession(
              req,
              resp,
              pendingSession,
              user,
              refreshToken.getToken().toString(),
              credentials.getRefreshToken() != null
                  ? credentials.getRefreshToken().getValue()
                  : null);
      if (maybeActiveSession.isEmpty()) {
        Entity.getTokenRepository().deleteToken(refreshToken.getToken().toString());
        throw new TechnicalException("Failed to activate OIDC session");
      }
      UserSession activeSession = maybeActiveSession.get();

      JWTAuthMechanism jwtAuthMechanism = generateJwtToken(user, activeSession);
      sendRedirectWithToken(
          resp, pendingSession.getRedirectUri(), user, jwtAuthMechanism.getJWTToken());
    } catch (IllegalArgumentException e) {
      try {
        org.openmetadata.service.security.SecurityUtil.writeErrorResponse(
            resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
      } catch (IOException ioException) {
        LOG.error("Failed to write invalid redirect response", ioException);
      }
    } catch (Exception e) {
      getErrorMessage(resp, e);
    }
  }

  // Logout
  public void handleLogout(
      HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) {
    try {
      LOG.debug("Performing application logout");
      UserSession session = sessionService.getSession(httpServletRequest).orElse(null);
      if (session != null) {
        if (session.getUsername() != null) {
          SubjectCache.invalidateUser(session.getUsername());
        }
        String refreshToken = sessionService.decryptOmRefreshToken(session);
        if (refreshToken != null) {
          Entity.getTokenRepository().deleteToken(refreshToken);
        }
        if (session.getUserId() != null
            && session.getUsername() != null
            && Entity.getAuditLogRepository() != null) {
          try {
            Entity.getAuditLogRepository()
                .writeAuthEvent(
                    AuditLogRepository.AUTH_EVENT_LOGOUT,
                    session.getUsername(),
                    UUID.fromString(session.getUserId()));
          } catch (Exception e) {
            LOG.debug("Could not write logout audit event for user {}", session.getUsername(), e);
          }
        }
      }
      sessionService.revokeSession(httpServletRequest, httpServletResponse);
      httpServletResponse.sendRedirect(serverUrl + "/logout");
    } catch (Exception ex) {
      LOG.error("[Auth Logout] Error while performing logout", ex);
    }
  }

  // Refresh
  public void handleRefresh(
      HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) {
    UserSession leasedSession = null;
    try {
      UserSession session =
          sessionService.acquireRefreshLease(httpServletRequest, httpServletResponse).orElse(null);
      leasedSession = session;
      if (session == null) {
        httpServletResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        writeJsonResponse(
            httpServletResponse, JsonUtils.pojoToJson(Map.of("error", "No active session")));
        return;
      }

      User user = getSessionUser(session);
      String currentRefreshToken = sessionService.decryptOmRefreshToken(session);
      if (user == null || nullOrEmpty(currentRefreshToken)) {
        sessionService.revokeSession(httpServletRequest, httpServletResponse);
        httpServletResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        writeJsonResponse(
            httpServletResponse,
            JsonUtils.pojoToJson(Map.of("error", "No refresh token in session")));
        return;
      }

      org.openmetadata.schema.auth.RefreshToken rotatedRefreshToken =
          validateAndReturnNewRefresh(user.getId(), session);
      Optional<UserSession> completedSession =
          completeRefresh(
              httpServletRequest,
              httpServletResponse,
              session,
              currentRefreshToken,
              rotatedRefreshToken.getToken().toString());
      if (completedSession.isEmpty()) {
        return;
      }
      JWTAuthMechanism jwtAuthMechanism = generateJwtToken(user, completedSession.get());

      JwtResponse jwtResponse = new JwtResponse();
      jwtResponse.setTokenType("Bearer");
      jwtResponse.setAccessToken(jwtAuthMechanism.getJWTToken());
      jwtResponse.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
      httpServletResponse.setStatus(HttpServletResponse.SC_OK);
      writeJsonResponse(httpServletResponse, JsonUtils.pojoToJson(jwtResponse));
    } catch (SessionRefreshInProgressException e) {
      try {
        httpServletResponse.setHeader("Retry-After", Integer.toString(e.getRetryAfterSeconds()));
        org.openmetadata.service.security.SecurityUtil.writeErrorResponse(
            httpServletResponse, HttpServletResponse.SC_SERVICE_UNAVAILABLE, e.getMessage());
      } catch (IOException ioException) {
        LOG.error("[Auth Refresh] Failed to write refresh contention response", ioException);
      }
    } catch (Exception e) {
      sessionService.releaseRefreshLease(leasedSession);
      getErrorMessage(httpServletResponse, new TechnicalException(e));
    }
  }

  private String buildLoginAuthenticationRequestUrl(final Map<String, String> params) {
    // Build authentication request query string
    String queryString;
    try {
      queryString =
          AuthenticationRequest.parse(
                  params.entrySet().stream()
                      .collect(
                          Collectors.toMap(
                              Map.Entry::getKey, e -> Collections.singletonList(e.getValue()))))
              .toQueryString();
    } catch (Exception e) {
      throw new TechnicalException(e);
    }
    return client.getConfiguration().getProviderMetadata().getAuthorizationEndpointURI().toString()
        + '?'
        + queryString;
  }

  private Map<String, String> buildLoginParams() {
    Map<String, String> authParams = new HashMap<>();
    authParams.put(OidcConfiguration.SCOPE, client.getConfiguration().getScope());
    authParams.put(OidcConfiguration.RESPONSE_TYPE, client.getConfiguration().getResponseType());
    authParams.put(OidcConfiguration.RESPONSE_MODE, "query");
    authParams.putAll(client.getConfiguration().getCustomParams());
    authParams.put(OidcConfiguration.CLIENT_ID, client.getConfiguration().getClientId());

    return new HashMap<>(authParams);
  }

  private void validateAndSendTokenRequest(
      UserSession session, OidcCredentials oidcCredentials, String computedCallbackUrl)
      throws URISyntaxException {
    if (oidcCredentials.getCode() != null) {
      LOG.debug(
          "Initiating Token Request - Session: {}, redirect_uri: {}",
          session.getId(),
          computedCallbackUrl);
      CodeVerifier verifier =
          nullOrEmpty(session.getPkceVerifier())
              ? null
              : new CodeVerifier(session.getPkceVerifier());
      TokenRequest request =
          createTokenRequest(
              new AuthorizationCodeGrant(
                  oidcCredentials.getCode(), new URI(computedCallbackUrl), verifier));
      executeAuthorizationCodeTokenRequest(session, request, oidcCredentials);
    }
  }

  private void validateStateIfRequired(
      UserSession session,
      HttpServletResponse resp,
      AuthenticationSuccessResponse successResponse) {
    if (client.getConfiguration().isWithState()) {
      String requestState = session.getState();
      if (CommonHelper.isBlank(requestState)) {
        throw new TechnicalException("Missing state parameter in session");
      }

      State responseState = successResponse.getState();
      if (responseState == null) {
        throw new TechnicalException("Missing state parameter");
      }

      LOG.debug("Request state: {}/response state: {}", requestState, responseState);
      if (!MessageDigest.isEqual(
          requestState.getBytes(StandardCharsets.UTF_8),
          responseState.getValue().getBytes(StandardCharsets.UTF_8))) {
        throw new TechnicalException(
            "State parameter is different from the one sent in authentication request.");
      }
    }
  }

  private OidcCredentials buildCredentials(AuthenticationSuccessResponse successResponse) {
    OidcCredentials credentials = new OidcCredentials();
    // get authorization code
    AuthorizationCode code = successResponse.getAuthorizationCode();
    if (code != null) {
      credentials.setCode(code);
    }
    // get ID token
    JWT idToken = successResponse.getIDToken();
    if (idToken != null) {
      credentials.setIdToken(idToken);
    }
    // get access token
    AccessToken accessToken = successResponse.getAccessToken();
    if (accessToken != null) {
      credentials.setAccessToken(accessToken);
    }

    return credentials;
  }

  private void validateNonceIfRequired(UserSession session, JWTClaimsSet claimsSet)
      throws BadJOSEException {
    if (client.getConfiguration().isUseNonce()) {
      String expectedNonce = session.getNonce();
      if (CommonHelper.isNotBlank(expectedNonce)) {
        String tokenNonce;
        try {
          tokenNonce = claimsSet.getStringClaim("nonce");
        } catch (java.text.ParseException e) {
          throw new BadJWTException("Invalid JWT nonce (nonce) claim: " + e.getMessage());
        }

        if (tokenNonce == null) {
          throw BadJWTExceptions.MISSING_NONCE_CLAIM_EXCEPTION;
        }

        if (!MessageDigest.isEqual(
            expectedNonce.getBytes(StandardCharsets.UTF_8),
            tokenNonce.getBytes(StandardCharsets.UTF_8))) {
          throw new BadJWTException("Unexpected JWT nonce (nonce) claim");
        }
      } else {
        throw new TechnicalException("Missing nonce parameter from session.");
      }
    }
  }

  protected Map<String, List<String>> retrieveCallbackParameters(HttpServletRequest request) {
    Map<String, String[]> requestParameters = request.getParameterMap();
    Map<String, List<String>> map = new HashMap<>();
    for (var entry : requestParameters.entrySet()) {
      map.put(entry.getKey(), Arrays.asList(entry.getValue()));
    }
    return map;
  }

  private ClientAuthentication getClientAuthentication(OidcConfiguration configuration) {
    ClientID clientID = new ClientID(configuration.getClientId());
    ClientAuthentication clientAuthenticationMechanism = null;
    if (configuration.getSecret() != null) {
      // check authentication methods
      List<ClientAuthenticationMethod> metadataMethods =
          configuration.findProviderMetadata().getTokenEndpointAuthMethods();

      ClientAuthenticationMethod preferredMethod = getPreferredAuthenticationMethod(configuration);

      final ClientAuthenticationMethod chosenMethod;
      if (isNotEmpty(metadataMethods)) {
        if (preferredMethod != null) {
          if (metadataMethods.contains(preferredMethod)) {
            chosenMethod = preferredMethod;
          } else {
            throw new TechnicalException(
                "Preferred authentication method ("
                    + preferredMethod
                    + ") not supported "
                    + "by provider according to provider metadata ("
                    + metadataMethods
                    + ").");
          }
        } else {
          chosenMethod = firstSupportedMethod(metadataMethods);
        }
      } else {
        chosenMethod =
            preferredMethod != null ? preferredMethod : ClientAuthenticationMethod.getDefault();
        LOG.info(
            "Provider metadata does not provide Token endpoint authentication methods. Using: {}",
            chosenMethod);
      }

      if (ClientAuthenticationMethod.CLIENT_SECRET_POST.equals(chosenMethod)) {
        Secret clientSecret = new Secret(configuration.getSecret());
        clientAuthenticationMechanism = new ClientSecretPost(clientID, clientSecret);
      } else if (ClientAuthenticationMethod.CLIENT_SECRET_BASIC.equals(chosenMethod)) {
        Secret clientSecret = new Secret(configuration.getSecret());
        clientAuthenticationMechanism = new ClientSecretBasic(clientID, clientSecret);
      } else if (ClientAuthenticationMethod.PRIVATE_KEY_JWT.equals(chosenMethod)) {
        PrivateKeyJWTClientAuthnMethodConfig privateKetJwtConfig =
            configuration.getPrivateKeyJWTClientAuthnMethodConfig();
        assertNotNull("privateKetJwtConfig", privateKetJwtConfig);
        JWSAlgorithm jwsAlgo = privateKetJwtConfig.getJwsAlgorithm();
        assertNotNull("privateKetJwtConfig.getJwsAlgorithm()", jwsAlgo);
        PrivateKey privateKey = privateKetJwtConfig.getPrivateKey();
        assertNotNull("privateKetJwtConfig.getPrivateKey()", privateKey);
        String keyID = privateKetJwtConfig.getKeyID();
        try {
          clientAuthenticationMechanism =
              new PrivateKeyJWT(
                  clientID,
                  configuration.findProviderMetadata().getTokenEndpointURI(),
                  jwsAlgo,
                  privateKey,
                  keyID,
                  null);
        } catch (final JOSEException e) {
          throw new TechnicalException(
              "Cannot instantiate private key JWT client authentication method", e);
        }
      }
    }

    return clientAuthenticationMechanism;
  }

  private static ClientAuthenticationMethod getPreferredAuthenticationMethod(
      OidcConfiguration config) {
    ClientAuthenticationMethod configurationMethod = config.getClientAuthenticationMethod();
    if (configurationMethod == null) {
      return null;
    }

    if (!SUPPORTED_METHODS.contains(configurationMethod)) {
      throw new TechnicalException(
          "Configured authentication method (" + configurationMethod + ") is not supported.");
    }

    return configurationMethod;
  }

  private ClientAuthenticationMethod firstSupportedMethod(
      final List<ClientAuthenticationMethod> metadataMethods) {
    Optional<ClientAuthenticationMethod> firstSupported =
        metadataMethods.stream().filter(SUPPORTED_METHODS::contains).findFirst();
    if (firstSupported.isPresent()) {
      return firstSupported.get();
    } else {
      throw new TechnicalException(
          "None of the Token endpoint provider metadata authentication methods are supported: "
              + metadataMethods);
    }
  }

  @SneakyThrows
  public static void getErrorMessage(HttpServletResponse resp, Exception e) {
    LOG.error("[Auth Callback Servlet] Failed in Auth Login : {}", e.getMessage(), e);
    org.openmetadata.service.security.SecurityUtil.writeErrorResponse(
        resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
  }

  private void sendRedirectWithToken(
      HttpServletResponse response, String redirectUri, User user, String accessToken)
      throws IOException {
    String targetRedirectUri =
        nullOrEmpty(redirectUri) ? serverUrl + "/auth/callback" : redirectUri;
    String validatedRedirectUri = requireRedirectUri(targetRedirectUri);
    response.sendRedirect(
        org.openmetadata.service.security.SecurityUtil.buildRedirectWithToken(
            validatedRedirectUri, accessToken, user.getEmail(), user.getName()));
  }

  private User getOrCreateOidcUser(String userName, String email, Map<String, Object> claims) {
    // Extract teams from claims if configured (supports array claims like groups)
    List<String> teamsFromClaim = findTeamsFromClaims(teamClaimMapping, claims);

    try {
      // Fetch user with teams relationship loaded to preserve existing team memberships
      User user =
          Entity.getEntityByName(Entity.USER, userName, "id,roles,teams", Include.NON_DELETED);

      boolean shouldBeAdmin = getAdminPrincipals().contains(userName);
      boolean needsUpdate = false;

      LOG.debug(
          "OIDC login - Username: {}, Email: {}, Should be admin: {}, Current admin status: {}",
          userName,
          email,
          shouldBeAdmin,
          user.getIsAdmin());

      if (shouldBeAdmin && !Boolean.TRUE.equals(user.getIsAdmin())) {
        LOG.debug("Updating user {} to admin based on adminPrincipals", userName);
        user.setIsAdmin(true);
        needsUpdate = true;
      }

      // Assign teams from claims if provided (this only adds, doesn't remove existing teams)
      boolean teamsAssigned = UserUtil.assignTeamsFromClaim(user, teamsFromClaim);
      needsUpdate = needsUpdate || teamsAssigned;

      if (needsUpdate) {
        UserUtil.addOrUpdateUser(user);
      }

      return user;
    } catch (EntityNotFoundException e) {
      LOG.debug("User not found, will create new user: {}", userName);
    }

    if (authenticationConfiguration.getEnableSelfSignup()) {
      boolean isAdmin = getAdminPrincipals().contains(userName);
      LOG.debug("Creating new OIDC user - Username: {}, isAdmin: {}", userName, isAdmin);

      String domain = email.split("@")[1];

      // Validate email domain against allowed registration domains
      Set<String> allowedDomains = authorizerConfiguration.getAllowedEmailRegistrationDomains();
      if (allowedDomains != null
          && !allowedDomains.isEmpty()
          && !allowedDomains.contains("all")
          && !allowedDomains.contains(domain)) {
        LOG.warn(
            "SECURITY: Blocked OAuth signup for disallowed domain: {} (user: {})", domain, email);
        throw new AuthenticationException("Email domain not allowed for self-signup: " + domain);
      }

      User newUser =
          UserUtil.getUser(
                  userName, new CreateUser().withName(userName).withEmail(email).withIsBot(false))
              .withIsAdmin(isAdmin)
              .withIsEmailVerified(true);

      // Assign default role if configured
      String defaultRoleName = authorizerConfiguration.getDefaultOAuthRole();
      if (defaultRoleName != null && !defaultRoleName.isEmpty()) {
        try {
          Role defaultRole =
              Entity.getEntityByName(Entity.ROLE, defaultRoleName, "", Include.NON_DELETED);
          newUser.setRoles(List.of(defaultRole.getEntityReference()));
          LOG.debug("Assigned default OAuth role '{}' to new user: {}", defaultRoleName, userName);
        } catch (EntityNotFoundException ex) {
          LOG.error(
              "Default OAuth role '{}' not found. User will be created without roles.",
              defaultRoleName);
        }
      }

      // Assign teams from claims if provided
      UserUtil.assignTeamsFromClaim(newUser, teamsFromClaim);

      return UserUtil.addOrUpdateUser(newUser);
    }
    throw new AuthenticationException("User not found and self-signup is disabled");
  }

  private Set<String> getAdminPrincipals() {
    return new HashSet<>(authorizerConfiguration.getAdminPrincipals());
  }

  @SneakyThrows
  private void executeAuthorizationCodeTokenRequest(
      UserSession session, TokenRequest request, OidcCredentials credentials) {
    HTTPResponse httpResponse = executeTokenHttpRequest(request);
    OIDCTokenResponse tokenSuccessResponse = parseTokenResponseFromHttpResponse(httpResponse);
    populateCredentialsFromTokenResponse(tokenSuccessResponse, credentials);

    Date expirationTime = credentials.getIdToken().getJWTClaimsSet().getExpirationTime();
    if (expirationTime != null
        && expirationTime.before(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime())) {
      LOG.warn(
          "OIDC provider returned an expired ID token for session {}. Proceeding with claim extraction.",
          session.getId());
    }
  }

  public static boolean isJWT(String token) {
    return token.split("\\.").length == 3;
  }

  // Delegate to SecurityUtil which has the stronger validation (rejects unrecognized keys)
  public static void validatePrincipalClaimsMapping(Map<String, String> mapping) {
    SecurityUtil.validatePrincipalClaimsMapping(mapping);
  }

  private HTTPResponse executeTokenHttpRequest(TokenRequest request) throws IOException {
    HTTPRequest tokenHttpRequest = request.toHTTPRequest();
    client.getConfiguration().configureHttpRequest(tokenHttpRequest);

    HTTPResponse httpResponse = tokenHttpRequest.send();
    LOG.debug("Token response: status={}", httpResponse.getStatusCode());

    return httpResponse;
  }

  private TokenRequest createTokenRequest(final AuthorizationGrant grant) {
    if (clientAuthentication != null) {
      return new TokenRequest(
          client.getConfiguration().findProviderMetadata().getTokenEndpointURI(),
          this.clientAuthentication,
          grant);
    } else {
      return new TokenRequest(
          client.getConfiguration().findProviderMetadata().getTokenEndpointURI(),
          new ClientID(client.getConfiguration().getClientId()),
          grant);
    }
  }

  private PendingLoginContext addStateAndNonceParameters(Map<String, String> params) {
    String state = null;
    String nonce = null;
    String pkceVerifier = null;

    if (client.getConfiguration().isWithState()) {
      state = new State(CommonHelper.randomString(32)).getValue();
      params.put(OidcConfiguration.STATE, state);
    }

    if (client.getConfiguration().isUseNonce()) {
      nonce = new Nonce().getValue();
      params.put(OidcConfiguration.NONCE, nonce);
    }

    CodeChallengeMethod pkceMethod = client.getConfiguration().findPkceMethod();
    if (pkceMethod == null && !client.getConfiguration().isDisablePkce()) {
      pkceMethod = CodeChallengeMethod.S256;
    }
    if (pkceMethod != null) {
      CodeVerifier verifier = new CodeVerifier(CommonHelper.randomString(43));
      pkceVerifier = verifier.getValue();
      params.put(
          OidcConfiguration.CODE_CHALLENGE, CodeChallenge.compute(pkceMethod, verifier).getValue());
      params.put(OidcConfiguration.CODE_CHALLENGE_METHOD, pkceMethod.getValue());
    }

    return new PendingLoginContext(state, nonce, pkceVerifier);
  }

  private void populateCredentialsFromTokenResponse(
      OIDCTokenResponse tokenSuccessResponse, OidcCredentials credentials) {
    OIDCTokens oidcTokens = tokenSuccessResponse.getOIDCTokens();
    credentials.setAccessToken(oidcTokens.getAccessToken());
    if (oidcTokens.getRefreshToken() != null) {
      credentials.setRefreshToken(oidcTokens.getRefreshToken());
    }
    if (oidcTokens.getIDToken() != null) {
      credentials.setIdToken(oidcTokens.getIDToken());
    }
  }

  private OIDCTokenResponse parseTokenResponseFromHttpResponse(HTTPResponse httpResponse)
      throws com.nimbusds.oauth2.sdk.ParseException {
    TokenResponse response = OIDCTokenResponseParser.parse(httpResponse);
    if (response instanceof TokenErrorResponse tokenErrorResponse) {
      ErrorObject errorObject = tokenErrorResponse.getErrorObject();
      throw new TechnicalException(
          "Bad token response, error="
              + errorObject.getCode()
              + ","
              + " description="
              + errorObject.getDescription());
    }
    LOG.debug("Token response successful");
    return (OIDCTokenResponse) response;
  }

  private String requireRedirectUri(String redirectUri) {
    return org.openmetadata.service.security.SecurityUtil.validateRedirectUri(
        redirectUri,
        trustedRedirects(
            authenticationConfiguration.getCallbackUrl(),
            serverUrl + "/auth/callback",
            serverUrl + "/mcp/callback"));
  }

  private User getSessionUser(UserSession session) {
    try {
      if (!nullOrEmpty(session.getUserId())) {
        return Entity.getUserRepository()
            .get(
                null,
                UUID.fromString(session.getUserId()),
                Entity.getUserRepository().getFieldsWithUserAuth("id,name,email,roles,isAdmin"));
      }
      if (!nullOrEmpty(session.getUsername())) {
        return Entity.getEntityByName(
            Entity.USER, session.getUsername(), "id,name,email,roles,isAdmin", Include.NON_DELETED);
      }
    } catch (Exception e) {
      LOG.debug(
          "Failed to load session user for session {}",
          SessionService.truncateId(session.getId()),
          e);
    }
    return null;
  }

  private JWTAuthMechanism generateJwtToken(User user, UserSession session) {
    return JWTTokenGenerator.getInstance()
        .generateJWTTokenForSession(
            user.getName(),
            getRoleListFromUser(user),
            !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
            user.getEmail(),
            tokenValidity,
            ServiceTokenType.OM_USER,
            session.getId());
  }

  private org.openmetadata.schema.auth.RefreshToken validateAndReturnNewRefresh(
      UUID currentUserId, UserSession session) {
    String requestRefreshToken = sessionService.decryptOmRefreshToken(session);
    org.openmetadata.schema.auth.RefreshToken storedRefreshToken =
        (org.openmetadata.schema.auth.RefreshToken)
            Entity.getTokenRepository().findByToken(requestRefreshToken);
    if (storedRefreshToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new BadRequestException("Expired token. Please login again.");
    }
    Entity.getTokenRepository().deleteToken(requestRefreshToken);
    org.openmetadata.schema.auth.RefreshToken newRefreshToken =
        TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    Entity.getTokenRepository().insertToken(newRefreshToken);
    return newRefreshToken;
  }

  private Optional<UserSession> completeRefresh(
      HttpServletRequest request,
      HttpServletResponse response,
      UserSession session,
      String previousRefreshToken,
      String updatedRefreshToken)
      throws IOException {
    Optional<UserSession> completedSession =
        sessionService.completeRefresh(session, updatedRefreshToken, null);
    if (completedSession.isEmpty() || completedSession.get().getStatus() != SessionStatus.ACTIVE) {
      deleteOrphanedRefreshToken(previousRefreshToken, updatedRefreshToken);
      sessionService.revokeSession(request, response);
      org.openmetadata.service.security.SecurityUtil.writeErrorResponse(
          response, HttpServletResponse.SC_UNAUTHORIZED, "Session revoked during refresh");
      return Optional.empty();
    }
    cleanupUnusedRefreshToken(previousRefreshToken, updatedRefreshToken, completedSession.get());
    return completedSession;
  }

  private void cleanupUnusedRefreshToken(
      String previousRefreshToken, String updatedRefreshToken, UserSession completedSession) {
    if (updatedRefreshToken == null || updatedRefreshToken.equals(previousRefreshToken)) {
      return;
    }
    String persistedRefreshToken = sessionService.decryptOmRefreshToken(completedSession);
    if (!updatedRefreshToken.equals(persistedRefreshToken)) {
      deleteRefreshTokenIfPresent(updatedRefreshToken);
    }
  }

  private void deleteOrphanedRefreshToken(String previousRefreshToken, String updatedRefreshToken) {
    if (updatedRefreshToken != null && !updatedRefreshToken.equals(previousRefreshToken)) {
      deleteRefreshTokenIfPresent(updatedRefreshToken);
    }
  }

  private void deleteRefreshTokenIfPresent(String refreshToken) {
    if (refreshToken != null) {
      Entity.getTokenRepository().deleteToken(refreshToken);
    }
  }

  private record PendingLoginContext(String state, String nonce, String pkceVerifier) {}

  public static void validateConfig(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authzConfig) {
    try {
      CommonHelper.assertNotNull("OidcConfiguration", authConfig.getOidcConfiguration());
      CommonHelper.assertNotBlank(
          "CallbackUrl", authConfig.getOidcConfiguration().getCallbackUrl());
      CommonHelper.assertNotBlank("ServerUrl", authConfig.getOidcConfiguration().getServerUrl());
      validatePrincipalClaimsMapping(
          listOrEmpty(authConfig.getJwtPrincipalClaimsMapping()).stream()
              .map(s -> s.split(":"))
              .collect(Collectors.toMap(s -> s[0], s -> s[1])));

      OidcClient validationClient = buildOidcClient(authConfig.getOidcConfiguration());
      validationClient.setCallbackUrl(authConfig.getOidcConfiguration().getCallbackUrl());

      if (validationClient == null) {
        throw new IllegalArgumentException("Failed to initialize OIDC client");
      }

      OIDCProviderMetadata providerMetadata =
          validationClient.getConfiguration().findProviderMetadata();
      if (providerMetadata == null) {
        throw new IllegalArgumentException("Failed to retrieve provider metadata from server URL");
      }

      if (providerMetadata.getAuthorizationEndpointURI() == null) {
        throw new IllegalArgumentException("Authorization endpoint not found in provider metadata");
      }

      if (providerMetadata.getTokenEndpointURI() == null) {
        throw new IllegalArgumentException("Token endpoint not found in provider metadata");
      }

    } catch (Exception e) {
      throw new IllegalArgumentException(
          "OIDC configuration validation failed: " + e.getMessage(), e);
    }
  }
}
