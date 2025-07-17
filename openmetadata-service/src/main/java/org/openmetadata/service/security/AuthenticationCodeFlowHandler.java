package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.JwtFilter.EMAIL_CLAIM_KEY;
import static org.openmetadata.service.security.JwtFilter.USERNAME_CLAIM_KEY;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;
import static org.pac4j.core.util.CommonHelper.assertNotNull;
import static org.pac4j.core.util.CommonHelper.isNotEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.proc.BadJWTException;
import com.nimbusds.oauth2.sdk.AuthorizationCode;
import com.nimbusds.oauth2.sdk.AuthorizationCodeGrant;
import com.nimbusds.oauth2.sdk.AuthorizationGrant;
import com.nimbusds.oauth2.sdk.ErrorObject;
import com.nimbusds.oauth2.sdk.RefreshTokenGrant;
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
import com.nimbusds.oauth2.sdk.token.BearerAccessToken;
import com.nimbusds.oauth2.sdk.token.RefreshToken;
import com.nimbusds.oauth2.sdk.util.JSONObjectUtils;
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
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import net.minidev.json.JSONObject;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.pac4j.core.context.HttpConstants;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.core.util.CommonHelper;
import org.pac4j.core.util.HttpUtils;
import org.pac4j.oidc.client.AzureAd2Client;
import org.pac4j.oidc.client.GoogleOidcClient;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.AzureAd2OidcConfiguration;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.config.PrivateKeyJWTClientAuthnMethodConfig;
import org.pac4j.oidc.credentials.OidcCredentials;

@Slf4j
public class AuthenticationCodeFlowHandler {
  private static final Collection<ClientAuthenticationMethod> SUPPORTED_METHODS =
      Arrays.asList(
          ClientAuthenticationMethod.CLIENT_SECRET_POST,
          ClientAuthenticationMethod.CLIENT_SECRET_BASIC,
          ClientAuthenticationMethod.PRIVATE_KEY_JWT,
          ClientAuthenticationMethod.NONE);

  public static final String DEFAULT_PRINCIPAL_DOMAIN = "openmetadata.org";
  public static final String OIDC_CREDENTIAL_PROFILE = "oidcCredentialProfile";
  public static final String SESSION_REDIRECT_URI = "sessionRedirectUri";
  public static final String REDIRECT_URI_KEY = "redirectUri";
  private final OidcClient client;
  private final List<String> claimsOrder;
  private final Map<String, String> claimsMapping;
  private final String serverUrl;
  private final ClientAuthentication clientAuthentication;
  private final String principalDomain;
  private final int tokenValidity;
  private final String maxAge;
  private final String promptType;

  public AuthenticationCodeFlowHandler(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration) {
    // Assert oidcConfig and Callback Url
    CommonHelper.assertNotNull(
        "OidcConfiguration", authenticationConfiguration.getOidcConfiguration());
    CommonHelper.assertNotBlank(
        "CallbackUrl", authenticationConfiguration.getOidcConfiguration().getCallbackUrl());
    CommonHelper.assertNotBlank(
        "ServerUrl", authenticationConfiguration.getOidcConfiguration().getServerUrl());

    // Build Required Params
    this.client = buildOidcClient(authenticationConfiguration.getOidcConfiguration());
    client.setCallbackUrl(authenticationConfiguration.getOidcConfiguration().getCallbackUrl());
    this.clientAuthentication = getClientAuthentication(client.getConfiguration());
    this.serverUrl = authenticationConfiguration.getOidcConfiguration().getServerUrl();
    this.claimsOrder = authenticationConfiguration.getJwtPrincipalClaims();
    this.claimsMapping =
        listOrEmpty(authenticationConfiguration.getJwtPrincipalClaimsMapping()).stream()
            .map(s -> s.split(":"))
            .collect(Collectors.toMap(s -> s[0], s -> s[1]));
    validatePrincipalClaimsMapping(claimsMapping);
    this.principalDomain = authorizerConfiguration.getPrincipalDomain();
    this.tokenValidity = authenticationConfiguration.getOidcConfiguration().getTokenValidity();
    this.maxAge = authenticationConfiguration.getOidcConfiguration().getMaxAge();
    this.promptType = authenticationConfiguration.getOidcConfiguration().getPrompt();
  }

  private OidcClient buildOidcClient(OidcClientConfig clientConfig) {
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

      String clientAuthenticationMethod = clientConfig.getClientAuthenticationMethod().value();
      if (CommonHelper.isNotBlank(clientAuthenticationMethod)) {
        configuration.setClientAuthenticationMethod(
            ClientAuthenticationMethod.parse(clientAuthenticationMethod));
      }

      // Disable PKCE
      configuration.setDisablePkce(clientConfig.getDisablePkce());

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
      HttpSession session = getHttpSession(req, true);
      checkAndStoreRedirectUriInSession(session, req.getParameter(REDIRECT_URI_KEY));

      LOG.debug("Performing Auth Login For User Session: {} ", session.getId());
      Optional<OidcCredentials> credentials = getUserCredentialsFromSession(session);
      if (credentials.isPresent()) {
        LOG.debug("Auth Tokens Located from Session: {} ", session.getId());
        sendRedirectWithToken(session, resp, credentials.get());
      } else {
        LOG.debug("Performing Auth Code Flow to Idp: {} ", session.getId());
        Map<String, String> params = buildLoginParams();

        params.put(OidcConfiguration.REDIRECT_URI, client.getCallbackUrl());

        addStateAndNonceParameters(client, session, params);

        // This is always used to prompt the user to login
        if (!nullOrEmpty(promptType)) {
          params.put(OidcConfiguration.PROMPT, promptType);
        }

        if (!nullOrEmpty(maxAge)) {
          params.put(OidcConfiguration.MAX_AGE, maxAge);
        }

        String location = buildLoginAuthenticationRequestUrl(params);
        LOG.debug("Authentication request url: {}", location);

        resp.sendRedirect(location);
      }
    } catch (Exception e) {
      getErrorMessage(resp, new TechnicalException(e));
    }
  }

  public static HttpSession getHttpSession(HttpServletRequest request, boolean createSession) {
    HttpSession session = request.getSession(false);
    if (session == null) {
      if (createSession) {
        LOG.debug("Creating new session for user");
        session = request.getSession(true);
      }
    } else {
      LOG.debug("Using existing session: {}", session.getId());
    }
    return session;
  }

  public static void checkAndStoreRedirectUriInSession(HttpSession session, String redirectUri) {
    if (nullOrEmpty(redirectUri)) {
      throw new TechnicalException("Redirect URI is required");
    }

    session.setAttribute(SESSION_REDIRECT_URI, redirectUri);
  }

  // Callback
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    try {
      HttpSession session = getHttpSession(req, false);
      if (session == null) {
        LOG.error("No session found for callback, redirecting to login");
        throw new TechnicalException("No session found for callback, redirecting to login");
      }

      LOG.debug("Performing Auth Callback For User Session: {} ", session.getId());
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
      validateStateIfRequired(session, resp, successResponse);

      // Build Credentials
      OidcCredentials credentials = buildCredentials(successResponse);

      // Validations
      validateAndSendTokenRequest(session, credentials, computedCallbackUrl);

      // Log Error if the Refresh Token is null
      if (credentials.getRefreshToken() == null) {
        LOG.error("Refresh token is null for user session: {}", session.getId());
      }

      validateNonceIfRequired(session, credentials.getIdToken().getJWTClaimsSet());

      // Put Credentials in Session
      session.setAttribute(OIDC_CREDENTIAL_PROFILE, credentials);

      // Redirect
      sendRedirectWithToken(session, resp, credentials);
    } catch (Exception e) {
      getErrorMessage(resp, e);
    }
  }

  // Logout
  public void handleLogout(
      HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) {
    try {
      HttpSession session = getHttpSession(httpServletRequest, false);
      LOG.debug("Performing application logout");
      if (session != null) {
        LOG.debug("Invalidating the session for logout");
        session.invalidate();
        httpServletResponse.sendRedirect(serverUrl + "/logout");
      } else {
        LOG.error("No session store available for this web context");
      }
    } catch (Exception ex) {
      LOG.error("[Auth Logout] Error while performing logout", ex);
    }
  }

  // Refresh
  public void handleRefresh(
      HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) {
    try {
      HttpSession session = getHttpSession(httpServletRequest, false);
      if (session == null) {
        LOG.error("No session found for refresh, redirecting to login");
        throw new TechnicalException("No session found for refresh, redirecting to login");
      }

      LOG.debug("Performing Auth Refresh For User Session: {} ", session.getId());
      Optional<OidcCredentials> credentials = getUserCredentialsFromSession(session);
      if (credentials.isPresent()) {
        LOG.debug("Credentials Found For User Session: {} ", session.getId());
        JwtResponse jwtResponse = new JwtResponse();
        jwtResponse.setAccessToken(credentials.get().getIdToken().getParsedString());
        jwtResponse.setExpiryDuration(
            credentials
                .get()
                .getIdToken()
                .getJWTClaimsSet()
                .getExpirationTime()
                .toInstant()
                .getEpochSecond());
        writeJsonResponse(httpServletResponse, JsonUtils.pojoToJson(jwtResponse));
      } else {
        LOG.debug(
            "Credentials Not Found For User Session: {}, Redirect to Logout ", session.getId());
        this.handleLogout(httpServletRequest, httpServletResponse);
      }
    } catch (Exception e) {
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

  private Optional<OidcCredentials> getUserCredentialsFromSession(HttpSession session) {
    OidcCredentials credentials = (OidcCredentials) session.getAttribute(OIDC_CREDENTIAL_PROFILE);
    if (credentials != null && credentials.getRefreshToken() != null) {
      LOG.trace("Credentials found in session: {}", credentials);
      renewOidcCredentials(session, credentials);
      return Optional.of(credentials);
    } else {
      if (credentials == null) {
        LOG.error("No credentials found against session. ID: {}", session.getId());
      } else {
        LOG.error("No refresh token found against session. ID: {}", session.getId());
      }
    }
    return Optional.empty();
  }

  private void validateAndSendTokenRequest(
      HttpSession session, OidcCredentials oidcCredentials, String computedCallbackUrl)
      throws URISyntaxException {
    if (oidcCredentials.getCode() != null) {
      LOG.debug("Initiating Token Request for User Session: {} ", session.getId());
      CodeVerifier verifier =
          (CodeVerifier) session.getAttribute(client.getCodeVerifierSessionAttributeName());
      // Token request
      TokenRequest request =
          createTokenRequest(
              new AuthorizationCodeGrant(
                  oidcCredentials.getCode(), new URI(computedCallbackUrl), verifier));
      executeAuthorizationCodeTokenRequest(session, request, oidcCredentials);
    }
  }

  private void validateStateIfRequired(
      HttpSession session,
      HttpServletResponse resp,
      AuthenticationSuccessResponse successResponse) {
    if (client.getConfiguration().isWithState()) {
      // Validate state for CSRF mitigation
      State requestState = (State) session.getAttribute(client.getStateSessionAttributeName());
      if (requestState == null || CommonHelper.isBlank(requestState.getValue())) {
        getErrorMessage(resp, new TechnicalException("Missing state parameter"));
        return;
      }

      State responseState = successResponse.getState();
      if (responseState == null) {
        throw new TechnicalException("Missing state parameter");
      }

      LOG.debug("Request state: {}/response state: {}", requestState, responseState);
      if (!requestState.equals(responseState)) {
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

  private void validateNonceIfRequired(HttpSession session, JWTClaimsSet claimsSet)
      throws BadJOSEException {
    if (client.getConfiguration().isUseNonce()) {
      String expectedNonce = (String) session.getAttribute(client.getNonceSessionAttributeName());
      if (CommonHelper.isNotBlank(expectedNonce)) {
        String tokenNonce;
        try {
          tokenNonce = claimsSet.getStringClaim("nonce");
        } catch (java.text.ParseException var10) {
          throw new BadJWTException("Invalid JWT nonce (nonce) claim: " + var10.getMessage());
        }

        if (tokenNonce == null) {
          throw BadJWTExceptions.MISSING_NONCE_CLAIM_EXCEPTION;
        }

        if (!expectedNonce.equals(tokenNonce)) {
          throw new BadJWTException("Unexpected JWT nonce (nonce) claim: " + tokenNonce);
        }
      } else {
        throw new TechnicalException("Missing nonce parameter from Session.");
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
    resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    resp.setContentType("text/html; charset=UTF-8");
    LOG.error("[Auth Callback Servlet] Failed in Auth Login : {}", e.getMessage());
    resp.getOutputStream()
        .println(
            String.format(
                "<p> [Auth Callback Servlet] Failed in Auth Login : %s </p>", e.getMessage()));
  }

  private void sendRedirectWithToken(
      HttpSession httpSession, HttpServletResponse response, OidcCredentials credentials)
      throws ParseException, IOException {
    JWT jwt = credentials.getIdToken();
    Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(jwt.getJWTClaimsSet().getClaims());

    String userName = findUserNameFromClaims(claimsMapping, claimsOrder, claims);
    String email = findEmailFromClaims(claimsMapping, claimsOrder, claims, principalDomain);

    String redirectUri = (String) httpSession.getAttribute(SESSION_REDIRECT_URI);

    String storedUserStr =
        Entity.getCollectionDAO().userDAO().findUserByNameAndEmail(userName, email);
    if (storedUserStr != null) {
      User user = JsonUtils.readValue(storedUserStr, User.class);
      Entity.getUserRepository().updateUserLastLoginTime(user, System.currentTimeMillis());
    }
    String url =
        String.format(
            "%s?id_token=%s&email=%s&name=%s",
            redirectUri, credentials.getIdToken().getParsedString(), email, userName);
    response.sendRedirect(url);
  }

  private void renewOidcCredentials(HttpSession httpSession, OidcCredentials credentials) {
    LOG.debug("Renewing Credentials for User Session {}", httpSession.getId());
    if (client.getConfiguration() instanceof AzureAd2OidcConfiguration azureAd2OidcConfiguration) {
      refreshAccessTokenAzureAd2Token(azureAd2OidcConfiguration, credentials);
    } else {
      refreshTokenRequest(httpSession, credentials);
    }
    httpSession.setAttribute(OIDC_CREDENTIAL_PROFILE, credentials);
  }

  public void refreshTokenRequest(HttpSession httpSession, OidcCredentials credentials) {
    var refreshToken = credentials.getRefreshToken();
    if (refreshToken != null) {
      try {
        final var request = createTokenRequest(new RefreshTokenGrant(refreshToken));
        HTTPResponse httpResponse = executeTokenHttpRequest(request);
        if (httpResponse.getStatusCode() == 200) {
          JSONObject jsonObjectResponse = httpResponse.getContentAsJSONObject();
          String idTokenKey = "id_token";
          if (jsonObjectResponse.containsKey(idTokenKey)) {
            Object value = jsonObjectResponse.get(idTokenKey);
            if (value == null) {
              throw new com.nimbusds.oauth2.sdk.ParseException(
                  "JSON object member with key " + idTokenKey + " has null value");
            } else {
              LOG.info("Found a JWT token in the response, trying to parse it");
              OIDCTokenResponse tokenSuccessResponse =
                  parseTokenResponseFromHttpResponse(httpResponse);
              // Populate credentials
              populateCredentialsFromTokenResponse(tokenSuccessResponse, credentials);
            }
          } else {
            // Note: since the id_token is not present, we must receive accessToken
            // We can do better and get userInfo from
            // client.getConfiguration().findProviderMetadata().getUserInfoEndpointURI()
            // but currently we are just return the OM created token in the response
            String accessToken = JSONObjectUtils.getString(jsonObjectResponse, "access_token");
            LOG.info(
                "Found an access token in the response, trying to parse it, Value : {}",
                accessToken);
            OIDCTokenResponse tokenSuccessResponse =
                parseTokenResponseFromHttpResponse(httpResponse);
            // Populate credentials
            populateCredentialsFromTokenResponse(tokenSuccessResponse, credentials);

            OidcCredentials storedCredentials =
                (OidcCredentials) httpSession.getAttribute(OIDC_CREDENTIAL_PROFILE);

            // Get the claims from the stored credentials
            Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
            claims.putAll(storedCredentials.getIdToken().getJWTClaimsSet().getClaims());

            String username = findUserNameFromClaims(claimsMapping, claimsOrder, claims);
            User user = Entity.getEntityByName(Entity.USER, username, "id", Include.NON_DELETED);

            // Create a JWT here
            JWTAuthMechanism jwtAuthMechanism =
                JWTTokenGenerator.getInstance()
                    .generateJWTToken(
                        username,
                        getRoleListFromUser(user),
                        !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
                        user.getEmail(),
                        tokenValidity,
                        false,
                        ServiceTokenType.OM_USER);
            // Set the access token to the new JWT token
            credentials.setIdToken(SignedJWT.parse(jwtAuthMechanism.getJWTToken()));
          }
          return;
        } else {
          throw new TechnicalException(
              String.format(
                  "Failed to refresh id_token, response code:%s , Error : %s",
                  httpResponse.getStatusCode(), httpResponse.getContent()));
        }

      } catch (final IOException | com.nimbusds.oauth2.sdk.ParseException e) {
        throw new TechnicalException(e);
      } catch (ParseException e) {
        throw new RuntimeException(e);
      }
    }
    throw new BadRequestException("No refresh token available");
  }

  public static boolean isJWT(String token) {
    return token.split("\\.").length == 3;
  }

  private void refreshAccessTokenAzureAd2Token(
      AzureAd2OidcConfiguration azureConfig, OidcCredentials azureAdProfile) {

    HttpURLConnection connection = null;
    try {
      RefreshToken refreshToken = azureAdProfile.getRefreshToken();
      if (refreshToken == null || refreshToken.getValue() == null) {
        throw new TechnicalException("No refresh token available to request new access token.");
      }

      Map<String, String> headers = new HashMap<>();
      headers.put(
          HttpConstants.CONTENT_TYPE_HEADER, HttpConstants.APPLICATION_FORM_ENCODED_HEADER_VALUE);
      headers.put(HttpConstants.ACCEPT_HEADER, HttpConstants.APPLICATION_JSON);

      URL tokenEndpointURL = azureConfig.findProviderMetadata().getTokenEndpointURI().toURL();
      connection = HttpUtils.openPostConnection(tokenEndpointURL, headers);

      String requestBody = azureConfig.makeOauth2TokenRequest(refreshToken.getValue());
      byte[] bodyBytes = requestBody.getBytes(StandardCharsets.UTF_8);
      connection.setFixedLengthStreamingMode(bodyBytes.length);

      try (BufferedWriter out =
          new BufferedWriter(
              new OutputStreamWriter(connection.getOutputStream(), StandardCharsets.UTF_8))) {
        out.write(requestBody);
      }

      int responseCode = connection.getResponseCode();
      if (responseCode != 200) {
        String error = HttpUtils.buildHttpErrorMessage(connection);
        LOG.warn("Token refresh failed ({}): {}", responseCode, error);
        throw new TechnicalException("Token refresh failed with status: " + responseCode);
      }

      String body = HttpUtils.readBody(connection);
      Map<String, Object> res = JsonUtils.readValue(body, new TypeReference<>() {});

      azureAdProfile.setAccessToken(new BearerAccessToken((String) res.get("access_token")));
      azureAdProfile.setRefreshToken(new RefreshToken((String) res.get("refresh_token")));

      if (res.containsKey("id_token")) {
        azureAdProfile.setIdToken(SignedJWT.parse((String) res.get("id_token")));
      }

    } catch (IOException | ParseException e) {
      throw new TechnicalException("Exception while refreshing Azure AD token", e);
    } finally {
      HttpUtils.closeConnection(connection);
    }
  }

  public static void validatePrincipalClaimsMapping(Map<String, String> mapping) {
    if (!nullOrEmpty(mapping)) {
      String username = mapping.get(USERNAME_CLAIM_KEY);
      String email = mapping.get(EMAIL_CLAIM_KEY);
      if (nullOrEmpty(username) || nullOrEmpty(email)) {
        throw new IllegalArgumentException(
            "Invalid JWT Principal Claims Mapping. Both username and email should be present");
      }
    }
    // If emtpy, jwtPrincipalClaims will be used so no need to validate
  }

  private HTTPResponse executeTokenHttpRequest(TokenRequest request) throws IOException {
    HTTPRequest tokenHttpRequest = request.toHTTPRequest();
    client.getConfiguration().configureHttpRequest(tokenHttpRequest);

    HTTPResponse httpResponse = tokenHttpRequest.send();
    LOG.debug(
        "Token response: status={}, content={}",
        httpResponse.getStatusCode(),
        httpResponse.getContent());

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

  private void addStateAndNonceParameters(
      OidcClient client, HttpSession session, Map<String, String> params) {
    // Init state for CSRF mitigation
    if (client.getConfiguration().isWithState()) {
      State state = new State(CommonHelper.randomString(10));
      params.put(OidcConfiguration.STATE, state.getValue());
      session.setAttribute(client.getStateSessionAttributeName(), state);
    }

    // Init nonce for replay attack mitigation
    if (client.getConfiguration().isUseNonce()) {
      Nonce nonce = new Nonce();
      params.put(OidcConfiguration.NONCE, nonce.getValue());
      session.setAttribute(client.getNonceSessionAttributeName(), nonce.getValue());
    }

    CodeChallengeMethod pkceMethod = client.getConfiguration().findPkceMethod();

    // Use Default PKCE method if not disabled
    if (pkceMethod == null && !client.getConfiguration().isDisablePkce()) {
      pkceMethod = CodeChallengeMethod.S256;
    }
    if (pkceMethod != null) {
      CodeVerifier verfifier = new CodeVerifier(CommonHelper.randomString(43));
      session.setAttribute(client.getCodeVerifierSessionAttributeName(), verfifier);
      params.put(
          OidcConfiguration.CODE_CHALLENGE,
          CodeChallenge.compute(pkceMethod, verfifier).getValue());
      params.put(OidcConfiguration.CODE_CHALLENGE_METHOD, pkceMethod.getValue());
    }
  }

  @SneakyThrows
  private void executeAuthorizationCodeTokenRequest(
      HttpSession session, TokenRequest request, OidcCredentials credentials) {
    HTTPResponse httpResponse = executeTokenHttpRequest(request);
    OIDCTokenResponse tokenSuccessResponse = parseTokenResponseFromHttpResponse(httpResponse);

    // Populate credentials
    populateCredentialsFromTokenResponse(tokenSuccessResponse, credentials);

    // Check expiry, azure on first go itself is returning a expried token sometimes
    Date expirationTime = credentials.getIdToken().getJWTClaimsSet().getExpirationTime();
    if (expirationTime != null
        && expirationTime.before(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime())) {
      renewOidcCredentials(session, credentials);
    }
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
}
