package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.oauth2.sdk.AuthorizationCode;
import com.nimbusds.oauth2.sdk.RefreshTokenGrant;
import com.nimbusds.oauth2.sdk.ResponseMode;
import com.nimbusds.oauth2.sdk.auth.ClientAuthentication;
import com.nimbusds.oauth2.sdk.auth.ClientAuthenticationMethod;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.ClientSecretPost;
import com.nimbusds.oauth2.sdk.auth.PrivateKeyJWT;
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.oauth2.sdk.id.Issuer;
import com.nimbusds.oauth2.sdk.id.State;
import com.nimbusds.oauth2.sdk.pkce.CodeChallengeMethod;
import com.nimbusds.oauth2.sdk.pkce.CodeVerifier;
import com.nimbusds.oauth2.sdk.token.AccessToken;
import com.nimbusds.oauth2.sdk.token.BearerAccessToken;
import com.nimbusds.oauth2.sdk.token.RefreshToken;
import com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse;
import com.nimbusds.openid.connect.sdk.SubjectType;
import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.OutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URI;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.UserUtil;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.oidc.client.AzureAd2Client;
import org.pac4j.oidc.client.GoogleOidcClient;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.AzureAd2OidcConfiguration;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.config.PrivateKeyJWTClientAuthnMethodConfig;
import org.pac4j.oidc.credentials.OidcCredentials;
import sun.misc.Unsafe;

@ExtendWith(MockitoExtension.class)
class AuthenticationCodeFlowHandlerTest {

  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private HttpSession session;
  @Mock private ServletOutputStream outputStream;

  @Test
  void buildOidcClientAllowsMissingClientAuthenticationMethodForGoogle() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcClientConfig clientConfig = new OidcClientConfig();
    clientConfig.setId("google-client");
    clientConfig.setSecret("google-secret");
    clientConfig.setType("google");
    clientConfig.setScope("openid profile email");
    clientConfig.setResponseType("code");
    clientConfig.setUseNonce("true");
    clientConfig.setPreferredJwsAlgorithm("RS256");
    clientConfig.setMaxClockSkew("42");

    OidcClient client =
        invokePrivate(
            handler, "buildOidcClient", new Class<?>[] {OidcClientConfig.class}, clientConfig);

    assertInstanceOf(GoogleOidcClient.class, client);
    assertEquals("google-client", client.getConfiguration().getClientId());
    assertEquals("google-secret", client.getConfiguration().getSecret());
    assertEquals("query", client.getConfiguration().getResponseMode());
    assertEquals("code", client.getConfiguration().getResponseType());
    assertEquals("openid profile email", client.getConfiguration().getScope());
    assertTrue(client.getConfiguration().isUseNonce());
    assertEquals(JWSAlgorithm.RS256, client.getConfiguration().getPreferredJwsAlgorithm());
    assertEquals(42, client.getConfiguration().getMaxClockSkew());
    assertEquals("offline", client.getConfiguration().getCustomParams().get("access_type"));
  }

  @Test
  void buildOidcClientCreatesAzureClientAndCustomParams() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcClientConfig clientConfig = new OidcClientConfig();
    clientConfig.setId("azure-client");
    clientConfig.setSecret("azure-secret");
    clientConfig.setType("azure");
    clientConfig.setTenant("organizations");
    clientConfig.setDisablePkce(true);
    clientConfig.setClientAuthenticationMethod(
        OidcClientConfig.ClientAuthenticationMethod.CLIENT_SECRET_POST);
    Map<String, String> customParams = new HashMap<>();
    customParams.put("customParamKey1", "resource");
    customParams.put("customParamValue1", "graph");
    clientConfig.setCustomParams(customParams);

    OidcClient client =
        invokePrivate(
            handler, "buildOidcClient", new Class<?>[] {OidcClientConfig.class}, clientConfig);

    assertInstanceOf(AzureAd2Client.class, client);
    AzureAd2OidcConfiguration configuration =
        assertInstanceOf(AzureAd2OidcConfiguration.class, client.getConfiguration());
    assertEquals("organizations", configuration.getTenant());
    assertTrue(configuration.isDisablePkce());
    assertEquals("graph", configuration.getCustomParams().get("resource"));
    assertEquals(
        ClientAuthenticationMethod.CLIENT_SECRET_POST,
        configuration.getClientAuthenticationMethod());
  }

  @Test
  void buildOidcClientRejectsMissingCredentials() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcClientConfig clientConfig = new OidcClientConfig();
    clientConfig.setId("client");
    clientConfig.setSecret("");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                invokePrivate(
                    handler,
                    "buildOidcClient",
                    new Class<?>[] {OidcClientConfig.class},
                    clientConfig));

    assertTrue(exception.getMessage().contains("Client ID and Client Secret"));
  }

  @Test
  void getClientAuthenticationPrefersConfiguredClientSecretPost() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id",
            "client-secret",
            List.of(
                ClientAuthenticationMethod.CLIENT_SECRET_POST,
                ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    configuration.setClientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST);

    ClientAuthentication authentication =
        invokePrivate(
            handler,
            "getClientAuthentication",
            new Class<?>[] {OidcConfiguration.class},
            configuration);

    assertInstanceOf(ClientSecretPost.class, authentication);
  }

  @Test
  void getClientAuthenticationFallsBackToMetadataSupportedMethod() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", "client-secret", List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));

    ClientAuthentication authentication =
        invokePrivate(
            handler,
            "getClientAuthentication",
            new Class<?>[] {OidcConfiguration.class},
            configuration);

    assertInstanceOf(ClientSecretBasic.class, authentication);
  }

  @Test
  void getClientAuthenticationBuildsPrivateKeyJwtWhenConfigured() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", "client-secret", List.of(ClientAuthenticationMethod.PRIVATE_KEY_JWT));
    configuration.setClientAuthenticationMethod(ClientAuthenticationMethod.PRIVATE_KEY_JWT);
    PrivateKeyJWTClientAuthnMethodConfig privateKeyConfig =
        new PrivateKeyJWTClientAuthnMethodConfig(
            JWSAlgorithm.RS256,
            KeyPairGenerator.getInstance("RSA").generateKeyPair().getPrivate(),
            "test-key");
    configuration.setPrivateKeyJWTClientAuthnMethodConfig(privateKeyConfig);

    ClientAuthentication authentication =
        invokePrivate(
            handler,
            "getClientAuthentication",
            new Class<?>[] {OidcConfiguration.class},
            configuration);

    assertInstanceOf(PrivateKeyJWT.class, authentication);
  }

  @Test
  void getClientAuthenticationRejectsUnsupportedConfiguredMethod() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", "client-secret", List.of(ClientAuthenticationMethod.CLIENT_SECRET_JWT));
    configuration.setClientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_JWT);

    TechnicalException exception =
        assertThrows(
            TechnicalException.class,
            () ->
                invokePrivate(
                    handler,
                    "getClientAuthentication",
                    new Class<?>[] {OidcConfiguration.class},
                    configuration));

    assertTrue(exception.getMessage().contains("Configured authentication method"));
  }

  @Test
  void getClientAuthenticationRejectsUnsupportedMetadataMethods() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", "client-secret", List.of(ClientAuthenticationMethod.CLIENT_SECRET_JWT));

    TechnicalException exception =
        assertThrows(
            TechnicalException.class,
            () ->
                invokePrivate(
                    handler,
                    "getClientAuthentication",
                    new Class<?>[] {OidcConfiguration.class},
                    configuration));

    assertTrue(exception.getMessage().contains("None of the Token endpoint provider metadata"));
  }

  @Test
  void getHttpSessionReusesExistingSessionAndCreatesWhenMissing() {
    when(request.getSession(false)).thenReturn(session);
    when(session.getId()).thenReturn("existing-session");

    assertEquals(session, AuthenticationCodeFlowHandler.getHttpSession(request, true));

    when(request.getSession(false)).thenReturn(null);
    when(request.getSession(true)).thenReturn(session);

    assertEquals(session, AuthenticationCodeFlowHandler.getHttpSession(request, true));
    assertNull(AuthenticationCodeFlowHandler.getHttpSession(request, false));
  }

  @Test
  void checkAndStoreRedirectUriRequiresValue() {
    assertThrows(
        TechnicalException.class,
        () -> AuthenticationCodeFlowHandler.checkAndStoreRedirectUriInSession(session, null));

    AuthenticationCodeFlowHandler.checkAndStoreRedirectUriInSession(
        session, "https://app.example.com/callback");

    verify(session)
        .setAttribute(
            AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI, "https://app.example.com/callback");
  }

  @Test
  void validatePrincipalClaimsMappingRequiresUsernameAndEmail() {
    Map<String, String> mapping = Map.of("sub", "subject");
    assertThrows(
        IllegalArgumentException.class,
        () -> AuthenticationCodeFlowHandler.validatePrincipalClaimsMapping(mapping));

    assertDoesNotThrow(
        () ->
            AuthenticationCodeFlowHandler.validatePrincipalClaimsMapping(
                Map.of("username", "preferred_username", "email", "mail")));
  }

  @Test
  void retrieveCallbackParametersCopiesAllValues() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    when(request.getParameterMap())
        .thenReturn(
            Map.of("code", new String[] {"auth-code"}, "scope", new String[] {"openid", "email"}));

    Map<String, List<String>> parameters =
        invokePrivate(
            handler,
            "retrieveCallbackParameters",
            new Class<?>[] {HttpServletRequest.class},
            request);

    assertEquals(List.of("auth-code"), parameters.get("code"));
    assertEquals(List.of("openid", "email"), parameters.get("scope"));
  }

  @Test
  void addStateAndNonceParametersStoresCsrfReplayAndPkceValues() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", null, List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    configuration.setWithState(true);
    configuration.setUseNonce(true);
    configuration.setPkceMethod(CodeChallengeMethod.S256);
    OidcClient client = oidcClient(configuration, "TestOidcClient");
    Map<String, String> params = new HashMap<>();

    invokePrivate(
        handler,
        "addStateAndNonceParameters",
        new Class<?>[] {OidcClient.class, HttpSession.class, Map.class},
        client,
        session,
        params);

    assertNotNull(params.get(OidcConfiguration.STATE));
    assertNotNull(params.get(OidcConfiguration.NONCE));
    assertNotNull(params.get(OidcConfiguration.CODE_CHALLENGE));
    assertEquals("S256", params.get(OidcConfiguration.CODE_CHALLENGE_METHOD));
    ArgumentCaptor<State> stateCaptor = ArgumentCaptor.forClass(State.class);
    verify(session).setAttribute(eq(client.getStateSessionAttributeName()), stateCaptor.capture());
    assertEquals(params.get(OidcConfiguration.STATE), stateCaptor.getValue().getValue());
    verify(session)
        .setAttribute(client.getNonceSessionAttributeName(), params.get(OidcConfiguration.NONCE));
    verify(session).setAttribute(eq(client.getCodeVerifierSessionAttributeName()), any());
  }

  @Test
  void validateStateIfRequiredWritesErrorWhenSessionStateMissing() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", null, List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    configuration.setWithState(true);
    setField(handler, "client", oidcClient(configuration, "StateClient"));

    AuthenticationSuccessResponse successResponse =
        new AuthenticationSuccessResponse(
            URI.create("https://openmetadata.example.com/callback"),
            new AuthorizationCode("auth-code"),
            null,
            null,
            new State("response-state"),
            null,
            ResponseMode.QUERY);

    TechnicalException exception =
        assertThrows(
            TechnicalException.class,
            () ->
                invokePrivate(
                    handler,
                    "validateStateIfRequired",
                    new Class<?>[] {
                      HttpSession.class,
                      HttpServletResponse.class,
                      AuthenticationSuccessResponse.class
                    },
                    session,
                    response,
                    successResponse));

    assertEquals("Missing state parameter", exception.getMessage());
  }

  @Test
  void validateStateIfRequiredRejectsMismatchedState() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", null, List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    configuration.setWithState(true);
    OidcClient client = oidcClient(configuration, "StateClient");
    setField(handler, "client", client);
    when(session.getAttribute(client.getStateSessionAttributeName())).thenReturn(new State("sent"));
    AuthenticationSuccessResponse successResponse =
        new AuthenticationSuccessResponse(
            URI.create("https://openmetadata.example.com/callback"),
            new AuthorizationCode("auth-code"),
            null,
            null,
            new State("received"),
            null,
            ResponseMode.QUERY);

    TechnicalException exception =
        assertThrows(
            TechnicalException.class,
            () ->
                invokePrivate(
                    handler,
                    "validateStateIfRequired",
                    new Class<?>[] {
                      HttpSession.class,
                      HttpServletResponse.class,
                      AuthenticationSuccessResponse.class
                    },
                    session,
                    response,
                    successResponse));

    assertTrue(exception.getMessage().contains("State parameter is different"));
  }

  @Test
  void validateNonceIfRequiredRejectsMissingAndUnexpectedNonce() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", null, List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    configuration.setUseNonce(true);
    OidcClient client = oidcClient(configuration, "NonceClient");
    setField(handler, "client", client);

    TechnicalException missingSessionNonce =
        assertThrows(
            TechnicalException.class,
            () ->
                invokePrivate(
                    handler,
                    "validateNonceIfRequired",
                    new Class<?>[] {HttpSession.class, JWTClaimsSet.class},
                    session,
                    new JWTClaimsSet.Builder().claim("nonce", "expected").build()));
    assertTrue(missingSessionNonce.getMessage().contains("Missing nonce"));

    when(session.getAttribute(client.getNonceSessionAttributeName())).thenReturn("expected");
    com.nimbusds.jwt.proc.BadJWTException badNonce =
        assertThrows(
            com.nimbusds.jwt.proc.BadJWTException.class,
            () ->
                invokePrivate(
                    handler,
                    "validateNonceIfRequired",
                    new Class<?>[] {HttpSession.class, JWTClaimsSet.class},
                    session,
                    new JWTClaimsSet.Builder().claim("nonce", "unexpected").build()));
    assertTrue(badNonce.getMessage().contains("Unexpected JWT nonce"));
  }

  @Test
  void createTokenRequestUsesClientAuthenticationWhenAvailable() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", "client-secret", List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    OidcClient client = oidcClient(configuration, "TokenClient");
    setField(handler, "client", client);
    setField(
        handler,
        "clientAuthentication",
        new ClientSecretBasic(
            new com.nimbusds.oauth2.sdk.id.ClientID("client-id"),
            new com.nimbusds.oauth2.sdk.auth.Secret("client-secret")));

    com.nimbusds.oauth2.sdk.TokenRequest requestWithAuthentication =
        invokePrivate(
            handler,
            "createTokenRequest",
            new Class<?>[] {com.nimbusds.oauth2.sdk.AuthorizationGrant.class},
            new RefreshTokenGrant(new com.nimbusds.oauth2.sdk.token.RefreshToken("refresh-token")));

    assertNotNull(requestWithAuthentication.getClientAuthentication());
    assertNull(requestWithAuthentication.getClientID());

    setField(handler, "clientAuthentication", null);

    com.nimbusds.oauth2.sdk.TokenRequest requestWithClientId =
        invokePrivate(
            handler,
            "createTokenRequest",
            new Class<?>[] {com.nimbusds.oauth2.sdk.AuthorizationGrant.class},
            new RefreshTokenGrant(new com.nimbusds.oauth2.sdk.token.RefreshToken("refresh-token")));

    assertNull(requestWithClientId.getClientAuthentication());
    assertEquals("client-id", requestWithClientId.getClientID().getValue());
  }

  @Test
  void buildCredentialsCopiesAuthorizationArtifacts() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    SignedJWT idToken =
        new SignedJWT(
            new JWSHeader(JWSAlgorithm.HS256), new JWTClaimsSet.Builder().subject("user").build());
    AccessToken accessToken = new BearerAccessToken("access-token");
    AuthenticationSuccessResponse successResponse =
        new AuthenticationSuccessResponse(
            URI.create("https://openmetadata.example.com/callback"),
            new AuthorizationCode("auth-code"),
            idToken,
            accessToken,
            new State("state"),
            null,
            ResponseMode.QUERY);

    org.pac4j.oidc.credentials.OidcCredentials credentials =
        invokePrivate(
            handler,
            "buildCredentials",
            new Class<?>[] {AuthenticationSuccessResponse.class},
            successResponse);

    assertEquals("auth-code", credentials.getCode().getValue());
    assertEquals(idToken, credentials.getIdToken());
    assertEquals(accessToken, credentials.getAccessToken());
  }

  @Test
  void handleLoginRedirectsToProviderWithSecurityParameters() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", null, List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    configuration.setWithState(true);
    configuration.setUseNonce(true);
    configuration.setPkceMethod(CodeChallengeMethod.S256);
    configuration.addCustomParam("resource", "https://graph.microsoft.com");
    OidcClient client = oidcClient(configuration, "LoginClient");
    setField(handler, "client", client);
    setField(handler, "promptType", "login");
    setField(handler, "maxAge", "600");

    when(request.getSession(false)).thenReturn(null);
    when(request.getSession(true)).thenReturn(session);
    when(request.getParameter(AuthenticationCodeFlowHandler.REDIRECT_URI_KEY))
        .thenReturn("https://app.example.com/post-login");
    when(session.getAttribute(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE))
        .thenReturn(null);
    when(session.getId()).thenReturn("session-id");

    handler.handleLogin(request, response);

    verify(session)
        .setAttribute(
            AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI,
            "https://app.example.com/post-login");
    ArgumentCaptor<String> redirectCaptor = ArgumentCaptor.forClass(String.class);
    verify(response).sendRedirect(redirectCaptor.capture());
    String location = redirectCaptor.getValue();
    assertTrue(location.startsWith("https://issuer.example.com/authorize?"));
    assertTrue(location.contains("client_id=client-id"));
    assertTrue(location.contains("redirect_uri=https%3A%2F%2Fopenmetadata.example.com%2Fcallback"));
    assertTrue(location.contains("prompt=login"));
    assertTrue(location.contains("max_age=600"));
    assertTrue(location.contains("resource=https%3A%2F%2Fgraph.microsoft.com"));
    assertTrue(location.contains("state="));
    assertTrue(location.contains("nonce="));
    assertTrue(location.contains("code_challenge="));
  }

  @Test
  void handleCallbackWithoutSessionReturnsErrorResponse() {
    AuthenticationCodeFlowHandler handler =
        assertDoesNotThrow(AuthenticationCodeFlowHandlerTest::newHandler);
    assertDoesNotThrow(() -> when(response.getOutputStream()).thenReturn(outputStream));
    when(request.getSession(false)).thenReturn(null);

    handler.handleCallback(request, response);

    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
  }

  @Test
  void isJwtRecognizesThreePartTokens() {
    assertTrue(AuthenticationCodeFlowHandler.isJWT("a.b.c"));
    assertFalse(AuthenticationCodeFlowHandler.isJWT("a.b"));
  }

  @Test
  void handleCallbackCompletesTokenExchangeAndRedirectsUser() throws Exception {
    String nonce = "expected-nonce";
    String idToken =
        signedJwt(
            new JWTClaimsSet.Builder()
                .subject("oidc-user")
                .claim("preferred_username", "oidc-user")
                .claim("email", "oidc-user@example.com")
                .claim("nonce", nonce)
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                .build());
    try (TokenServer tokenServer =
            startTokenServer(
                200,
                JsonUtils.pojoToJson(
                    Map.of(
                        "access_token", "provider-access-token",
                        "refresh_token", "provider-refresh-token",
                        "token_type", "Bearer",
                        "expires_in", 3600,
                        "id_token", idToken)));
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      AuthenticationCodeFlowHandler handler = newHandler();
      OidcConfiguration configuration =
          configuredOidcConfiguration(
              "client-id",
              "client-secret",
              List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC),
              tokenServer.tokenEndpoint());
      configuration.setWithState(true);
      configuration.setUseNonce(true);
      configuration.setDisablePkce(true);
      OidcClient client = oidcClient(configuration, "CallbackClient");
      setField(handler, "client", client);
      setField(handler, "claimsOrder", List.of("preferred_username", "email"));
      setField(
          handler, "claimsMapping", Map.of("username", "preferred_username", "email", "email"));
      setField(handler, "principalDomain", "example.com");
      setField(handler, "authorizerConfiguration", authorizerConfiguration(Set.of()));

      when(request.getSession(false)).thenReturn(session);
      when(request.getParameterMap())
          .thenReturn(Map.of("code", new String[] {"auth-code"}, "state", new String[] {"csrf"}));
      when(session.getAttribute(client.getStateSessionAttributeName()))
          .thenReturn(new State("csrf"));
      when(session.getAttribute(client.getNonceSessionAttributeName())).thenReturn(nonce);
      when(session.getAttribute(client.getCodeVerifierSessionAttributeName()))
          .thenReturn(new CodeVerifier("0123456789abcdef0123456789abcdef0123456789a"));
      when(session.getAttribute(AuthenticationCodeFlowHandler.SESSION_SSO_CALLBACK_URL))
          .thenReturn(client.getCallbackUrl());
      when(session.getAttribute(AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI))
          .thenReturn("https://app.example.com/post-login");
      when(session.getId()).thenReturn("session-id");

      User user = new User();
      user.setId(UUID.randomUUID());
      user.setName("oidc-user");
      user.setEmail("oidc-user@example.com");
      user.setDisplayName("OIDC User");
      user.setIsAdmin(false);
      UserRepository userRepository = mock(UserRepository.class);
      AuditLogRepository auditLogRepository = mock(AuditLogRepository.class);
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER, "oidc-user", "id,roles,teams", Include.NON_DELETED))
          .thenReturn(user);
      entity.when(Entity::getUserRepository).thenReturn(userRepository);
      entity.when(Entity::getAuditLogRepository).thenReturn(auditLogRepository);

      handler.handleCallback(request, response);

      verify(session)
          .setAttribute(
              eq(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE),
              any(OidcCredentials.class));
      verify(session)
          .setAttribute(AuthenticationCodeFlowHandler.SESSION_USER_ID, user.getId().toString());
      verify(session).setAttribute(AuthenticationCodeFlowHandler.SESSION_USERNAME, "oidc-user");
      verify(userRepository).updateUserLastLoginTime(eq(user), anyLong());
      verify(auditLogRepository)
          .writeAuthEvent(AuditLogRepository.AUTH_EVENT_LOGIN, "oidc-user", user.getId());

      ArgumentCaptor<String> redirectCaptor = ArgumentCaptor.forClass(String.class);
      verify(response).sendRedirect(redirectCaptor.capture());
      String redirect = redirectCaptor.getValue();
      assertTrue(redirect.startsWith("https://app.example.com/post-login?id_token="));
      assertTrue(redirect.contains("email=oidc-user%40example.com"));
      assertTrue(redirect.contains("name=oidc-user"));
    }
  }

  @Test
  void handleLogoutWritesAuditEventAndRedirects() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    setField(handler, "serverUrl", "https://openmetadata.example.com");
    when(request.getSession(false)).thenReturn(session);
    when(session.getAttribute(AuthenticationCodeFlowHandler.SESSION_USER_ID))
        .thenReturn("0f1d4b1f-b436-4d9e-a78b-7c3dd7ff60b0");
    when(session.getAttribute(AuthenticationCodeFlowHandler.SESSION_USERNAME))
        .thenReturn("oidc-user");

    AuditLogRepository originalRepository = Entity.getAuditLogRepository();
    AuditLogRepository auditLogRepository = mock(AuditLogRepository.class);
    Entity.setAuditLogRepository(auditLogRepository);
    try {
      handler.handleLogout(request, response);
    } finally {
      Entity.setAuditLogRepository(originalRepository);
    }

    verify(auditLogRepository)
        .writeAuthEvent(
            AuditLogRepository.AUTH_EVENT_LOGOUT,
            "oidc-user",
            UUID.fromString("0f1d4b1f-b436-4d9e-a78b-7c3dd7ff60b0"));
    verify(session).invalidate();
    verify(response).sendRedirect("https://openmetadata.example.com/logout");
  }

  @Test
  void refreshTokenRequestUpdatesCredentialsFromOidcTokenResponse() throws Exception {
    String refreshedIdToken =
        signedJwt(
            new JWTClaimsSet.Builder()
                .subject("refreshed-user")
                .claim("preferred_username", "refreshed-user")
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                .build());
    try (TokenServer tokenServer =
        startTokenServer(
            200,
            JsonUtils.pojoToJson(
                Map.of(
                    "access_token", "refreshed-access-token",
                    "refresh_token", "refreshed-refresh-token",
                    "token_type", "Bearer",
                    "expires_in", 3600,
                    "id_token", refreshedIdToken)))) {
      AuthenticationCodeFlowHandler handler = newHandler();
      setField(
          handler,
          "client",
          oidcClient(
              configuredOidcConfiguration(
                  "client-id",
                  "client-secret",
                  List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC),
                  tokenServer.tokenEndpoint()),
              "RefreshClient"));

      OidcCredentials credentials = new OidcCredentials();
      credentials.setRefreshToken(new RefreshToken("old-refresh-token"));

      handler.refreshTokenRequest(session, credentials);

      assertEquals("refreshed-access-token", credentials.getAccessToken().getValue());
      assertEquals("refreshed-refresh-token", credentials.getRefreshToken().getValue());
      assertEquals("refreshed-user", credentials.getIdToken().getJWTClaimsSet().getSubject());
    }
  }

  @Test
  void refreshTokenRequestBuildsOpenMetadataJwtWhenProviderOmitsIdToken() throws Exception {
    String sessionIdToken =
        signedJwt(
            new JWTClaimsSet.Builder()
                .subject("oidc-user")
                .claim("preferred_username", "oidc-user")
                .claim("email", "oidc-user@example.com")
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                .build());
    String generatedOmJwt =
        signedJwt(
            new JWTClaimsSet.Builder()
                .subject("oidc-user")
                .claim("email", "oidc-user@example.com")
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                .build());
    try (TokenServer tokenServer =
            startTokenServer(
                200,
                JsonUtils.pojoToJson(
                    Map.of(
                        "access_token", "provider-access-token",
                        "refresh_token", "provider-refresh-token",
                        "token_type", "Bearer",
                        "expires_in", 3600)));
        MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<JWTTokenGenerator> tokenGeneratorStatic =
            mockStatic(JWTTokenGenerator.class)) {
      AuthenticationCodeFlowHandler handler = newHandler();
      setField(
          handler,
          "client",
          oidcClient(
              configuredOidcConfiguration(
                  "client-id",
                  "client-secret",
                  List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC),
                  tokenServer.tokenEndpoint()),
              "RefreshClient"));
      setField(handler, "claimsOrder", List.of("preferred_username", "email"));
      setField(
          handler, "claimsMapping", Map.of("username", "preferred_username", "email", "email"));
      setField(handler, "tokenValidity", 600);

      OidcCredentials sessionCredentials = new OidcCredentials();
      sessionCredentials.setIdToken(SignedJWT.parse(sessionIdToken));
      when(session.getAttribute(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE))
          .thenReturn(sessionCredentials);

      User user = new User();
      user.setId(UUID.randomUUID());
      user.setName("oidc-user");
      user.setEmail("oidc-user@example.com");
      user.setIsAdmin(false);
      entity
          .when(() -> Entity.getEntityByName(Entity.USER, "oidc-user", "id", Include.NON_DELETED))
          .thenReturn(user);

      JWTTokenGenerator tokenGenerator = mock(JWTTokenGenerator.class);
      tokenGeneratorStatic.when(JWTTokenGenerator::getInstance).thenReturn(tokenGenerator);
      JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism();
      jwtAuthMechanism.setJWTToken(generatedOmJwt);
      when(tokenGenerator.generateJWTToken(
              eq("oidc-user"),
              eq(Set.of()),
              eq(false),
              eq("oidc-user@example.com"),
              eq(600L),
              eq(false),
              eq(org.openmetadata.schema.auth.ServiceTokenType.OM_USER)))
          .thenReturn(jwtAuthMechanism);

      OidcCredentials credentials = new OidcCredentials();
      credentials.setRefreshToken(new RefreshToken("old-refresh-token"));

      handler.refreshTokenRequest(session, credentials);

      assertEquals("provider-access-token", credentials.getAccessToken().getValue());
      assertEquals("provider-refresh-token", credentials.getRefreshToken().getValue());
      assertEquals(generatedOmJwt, credentials.getIdToken().getParsedString());
    }
  }

  @Test
  void refreshTokenRequestRejectsMissingRefreshToken() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcCredentials credentials = new OidcCredentials();

    assertThrows(
        jakarta.ws.rs.BadRequestException.class,
        () -> handler.refreshTokenRequest(session, credentials));
  }

  @Test
  void refreshTokenRequestThrowsTechnicalExceptionWhenProviderReturnsErrorStatus()
      throws Exception {
    try (TokenServer tokenServer = startTokenServer(500, "{\"error\":\"server_error\"}")) {
      AuthenticationCodeFlowHandler handler = newHandler();
      setField(
          handler,
          "client",
          oidcClient(
              configuredOidcConfiguration(
                  "client-id",
                  "client-secret",
                  List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC),
                  tokenServer.tokenEndpoint()),
              "RefreshFailureClient"));

      OidcCredentials credentials = new OidcCredentials();
      credentials.setRefreshToken(new RefreshToken("old-refresh-token"));

      TechnicalException exception =
          assertThrows(
              TechnicalException.class, () -> handler.refreshTokenRequest(session, credentials));

      assertTrue(exception.getMessage().contains("Failed to refresh id_token"));
    }
  }

  @Test
  void handleRefreshWritesJwtResponseWhenSessionCredentialsCanBeRenewed() throws Exception {
    String refreshedIdToken =
        signedJwt(
            new JWTClaimsSet.Builder()
                .subject("refresh-user")
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                .build());
    try (TokenServer tokenServer =
        startTokenServer(
            200,
            JsonUtils.pojoToJson(
                Map.of(
                    "access_token", "fresh-access-token",
                    "refresh_token", "fresh-refresh-token",
                    "token_type", "Bearer",
                    "expires_in", 3600,
                    "id_token", refreshedIdToken)))) {
      AuthenticationCodeFlowHandler handler = newHandler();
      setField(
          handler,
          "client",
          oidcClient(
              configuredOidcConfiguration(
                  "client-id",
                  "client-secret",
                  List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC),
                  tokenServer.tokenEndpoint()),
              "RefreshHandlerClient"));

      OidcCredentials credentials = new OidcCredentials();
      credentials.setRefreshToken(new RefreshToken("old-refresh-token"));
      when(request.getSession(false)).thenReturn(session);
      when(session.getAttribute(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE))
          .thenReturn(credentials);
      when(session.getId()).thenReturn("refresh-session");
      when(response.getOutputStream()).thenReturn(outputStream);

      handler.handleRefresh(request, response);

      assertEquals("fresh-access-token", credentials.getAccessToken().getValue());
      assertEquals("fresh-refresh-token", credentials.getRefreshToken().getValue());
      assertEquals(refreshedIdToken, credentials.getIdToken().getParsedString());
      verify(session)
          .setAttribute(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE, credentials);
      verify(outputStream).print(org.mockito.ArgumentMatchers.contains(refreshedIdToken));
      verify(response).setStatus(HttpServletResponse.SC_OK);
    }
  }

  @Test
  void handleRefreshWithoutCredentialsFallsBackToLogout() throws Exception {
    AuthenticationCodeFlowHandler handler =
        assertDoesNotThrow(AuthenticationCodeFlowHandlerTest::newHandler);
    assertDoesNotThrow(() -> setField(handler, "serverUrl", "https://openmetadata.example.com"));
    when(request.getSession(false)).thenReturn(session);
    when(session.getAttribute(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE))
        .thenReturn(null);
    when(session.getId()).thenReturn("missing-credentials-session");

    handler.handleRefresh(request, response);

    verify(session).invalidate();
    verify(response).sendRedirect("https://openmetadata.example.com/logout");
  }

  @Test
  void refreshAccessTokenAzureAd2TokenUpdatesAzureProfile() throws Exception {
    String refreshedIdToken =
        signedJwt(
            new JWTClaimsSet.Builder()
                .subject("azure-user")
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                .build());
    try (TokenServer tokenServer =
        startTokenServer(
            200,
            JsonUtils.pojoToJson(
                Map.of(
                    "access_token", "azure-access-token",
                    "refresh_token", "azure-refresh-token",
                    "token_type", "Bearer",
                    "expires_in", 3600,
                    "id_token", refreshedIdToken)))) {
      AuthenticationCodeFlowHandler handler = newHandler();
      OidcCredentials credentials = new OidcCredentials();
      credentials.setRefreshToken(new RefreshToken("azure-old-refresh-token"));

      invokePrivate(
          handler,
          "refreshAccessTokenAzureAd2Token",
          new Class<?>[] {AzureAd2OidcConfiguration.class, OidcCredentials.class},
          azureOidcConfiguration(tokenServer.tokenEndpoint()),
          credentials);

      assertEquals("azure-access-token", credentials.getAccessToken().getValue());
      assertEquals("azure-refresh-token", credentials.getRefreshToken().getValue());
      assertEquals(refreshedIdToken, credentials.getIdToken().getParsedString());
    }
  }

  @Test
  void refreshAccessTokenAzureAd2TokenRejectsMissingRefreshToken() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcCredentials credentials = new OidcCredentials();

    TechnicalException exception =
        assertThrows(
            TechnicalException.class,
            () ->
                invokePrivate(
                    handler,
                    "refreshAccessTokenAzureAd2Token",
                    new Class<?>[] {AzureAd2OidcConfiguration.class, OidcCredentials.class},
                    azureOidcConfiguration(URI.create("https://issuer.example.com/token")),
                    credentials));

    assertTrue(exception.getMessage().contains("No refresh token available"));
  }

  @Test
  void validateConfigRejectsMissingOidcConfiguration() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                AuthenticationCodeFlowHandler.validateConfig(
                    new AuthenticationConfiguration(), authorizerConfiguration(Set.of())));

    assertTrue(exception.getMessage().contains("OIDC configuration validation failed"));
  }

  @Test
  void validateConfigAcceptsReachableOidcDiscoveryDocument() throws Exception {
    try (OidcDiscoveryServer server =
        startDiscoveryServer(
            oidcDiscoveryMetadata(
                "https://issuer.example.com/authorize", "https://issuer.example.com/token"))) {
      assertDoesNotThrow(
          () ->
              AuthenticationCodeFlowHandler.validateConfig(
                  oidcAuthConfig(server.discoveryUri()), authorizerConfiguration(Set.of("admin"))));
    }
  }

  @Test
  void constructorInitializesFieldsFromDiscoveryDocument() throws Exception {
    try (OidcDiscoveryServer server =
        startDiscoveryServer(
            oidcDiscoveryMetadata(
                "https://issuer.example.com/authorize", "https://issuer.example.com/token"))) {
      AuthenticationCodeFlowHandler handler =
          newInitializedHandler(
              oidcAuthConfig(server.discoveryUri()), authorizerConfiguration(Set.of("admin")));

      assertNotNull(handler);
      assertNotNull(readField(handler, "client"));
      assertEquals("https://openmetadata.example.com", readField(handler, "serverUrl"));
      assertNotNull(readField(handler, "clientAuthentication"));
    }
  }

  @Test
  void validateConfigRejectsDiscoveryDocumentWithoutAuthorizationEndpoint() throws Exception {
    try (OidcDiscoveryServer server =
        startDiscoveryServer(oidcDiscoveryMetadata(null, "https://issuer.example.com/token"))) {
      IllegalArgumentException exception =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  AuthenticationCodeFlowHandler.validateConfig(
                      oidcAuthConfig(server.discoveryUri()),
                      authorizerConfiguration(Set.of("admin"))));

      assertTrue(exception.getMessage().contains("Authorization endpoint"));
    }
  }

  @Test
  void validateConfigRejectsDiscoveryDocumentWithoutTokenEndpoint() throws Exception {
    try (OidcDiscoveryServer server =
        startDiscoveryServer(oidcDiscoveryMetadata("https://issuer.example.com/authorize", null))) {
      IllegalArgumentException exception =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  AuthenticationCodeFlowHandler.validateConfig(
                      oidcAuthConfig(server.discoveryUri()),
                      authorizerConfiguration(Set.of("admin"))));

      assertTrue(exception.getMessage().contains("Token endpoint"));
    }
  }

  @Test
  void parseTokenResponseRejectsOauthErrors() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    HTTPResponse httpResponse = new HTTPResponse(400);
    httpResponse.setContentType("application/json");
    httpResponse.setContent("{\"error\":\"invalid_grant\",\"error_description\":\"bad code\"}");

    TechnicalException exception =
        assertThrows(
            TechnicalException.class,
            () ->
                invokePrivate(
                    handler,
                    "parseTokenResponseFromHttpResponse",
                    new Class<?>[] {HTTPResponse.class},
                    httpResponse));

    assertTrue(exception.getMessage().contains("invalid_grant"));
    assertTrue(exception.getMessage().contains("bad code"));
  }

  @Test
  void getOrCreateOidcUserCreatesSelfSignupUserWhenEnabled() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setEnableSelfSignup(true);
    setField(handler, "authenticationConfiguration", authConfig);
    AuthorizerConfiguration authorizer = authorizerConfiguration(Set.of("new-user"));
    authorizer.setAllowedEmailRegistrationDomains(Set.of("all"));
    setField(handler, "authorizerConfiguration", authorizer);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<UserUtil> userUtil = mockStatic(UserUtil.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER, "new-user", "id,roles,teams", Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byName("new-user"));
      User draftUser = new User();
      userUtil
          .when(() -> UserUtil.user("new-user", "example.com", "new-user"))
          .thenReturn(draftUser);
      userUtil.when(() -> UserUtil.assignTeamsFromClaim(draftUser, List.of())).thenReturn(false);
      User persistedUser = new User();
      persistedUser.setName("new-user");
      persistedUser.setEmail("new-user@example.com");
      persistedUser.setDisplayName("New User");
      persistedUser.setIsAdmin(true);
      userUtil.when(() -> UserUtil.addOrUpdateUser(draftUser)).thenReturn(persistedUser);

      User user =
          invokePrivate(
              handler,
              "getOrCreateOidcUser",
              new Class<?>[] {String.class, String.class, Map.class},
              "new-user",
              "new-user@example.com",
              Map.of());

      assertEquals(persistedUser, user);
      assertEquals(Boolean.TRUE, draftUser.getIsAdmin());
      assertEquals(Boolean.TRUE, draftUser.getIsEmailVerified());
    }
  }

  @Test
  void getOrCreateOidcUserRejectsMissingUserWhenSelfSignupDisabled() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setEnableSelfSignup(false);
    setField(handler, "authenticationConfiguration", authConfig);
    setField(handler, "authorizerConfiguration", authorizerConfiguration(Set.of()));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER, "missing-user", "id,roles,teams", Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byName("missing-user"));

      AuthenticationException exception =
          assertThrows(
              AuthenticationException.class,
              () ->
                  invokePrivate(
                      handler,
                      "getOrCreateOidcUser",
                      new Class<?>[] {String.class, String.class, Map.class},
                      "missing-user",
                      "missing-user@example.com",
                      Map.of()));

      assertTrue(exception.getMessage().contains("self-signup is disabled"));
    }
  }

  @Test
  void getOrCreateOidcUserUpdatesExistingUserFromAdminAndTeamClaims() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setEnableSelfSignup(true);
    setField(handler, "authenticationConfiguration", authConfig);
    setField(handler, "authorizerConfiguration", authorizerConfiguration(Set.of("existing-user")));
    setField(handler, "teamClaimMapping", "groups");

    User existingUser = new User();
    existingUser.setName("existing-user");
    existingUser.setEmail("existing-user@example.com");
    existingUser.setIsAdmin(false);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<UserUtil> userUtil = mockStatic(UserUtil.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER, "existing-user", "id,roles,teams", Include.NON_DELETED))
          .thenReturn(existingUser);
      userUtil
          .when(() -> UserUtil.assignTeamsFromClaim(existingUser, List.of("analytics", "platform")))
          .thenReturn(true);
      userUtil.when(() -> UserUtil.addOrUpdateUser(existingUser)).thenReturn(existingUser);

      User user =
          invokePrivate(
              handler,
              "getOrCreateOidcUser",
              new Class<?>[] {String.class, String.class, Map.class},
              "existing-user",
              "existing-user@example.com",
              Map.of("groups", List.of("analytics", "platform")));

      assertEquals(existingUser, user);
      assertEquals(Boolean.TRUE, existingUser.getIsAdmin());
      userUtil.verify(() -> UserUtil.addOrUpdateUser(existingUser));
    }
  }

  @Test
  void handleCallbackReturnsErrorWhenProviderRespondsWithAuthenticationError() throws Exception {
    AuthenticationCodeFlowHandler handler = newHandler();
    OidcConfiguration configuration =
        configuredOidcConfiguration(
            "client-id", "client-secret", List.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
    OidcClient client = oidcClient(configuration, "CallbackClient");
    setField(handler, "client", client);
    when(request.getSession(false)).thenReturn(session);
    when(request.getParameterMap())
        .thenReturn(
            Map.of("error", new String[] {"access_denied"}, "state", new String[] {"csrf"}));
    when(response.getOutputStream()).thenReturn(outputStream);

    handler.handleCallback(request, response);

    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    verify(outputStream)
        .println(org.mockito.ArgumentMatchers.contains("Authentication failed. Please try again."));
  }

  @Test
  void getInstanceRequiresInitializationForNoArgAccess() throws Exception {
    AuthenticationCodeFlowHandler previous = setHolderInstance(null);
    try {
      IllegalStateException exception =
          assertThrows(IllegalStateException.class, AuthenticationCodeFlowHandler::getInstance);

      assertTrue(exception.getMessage().contains("not initialized"));
    } finally {
      setHolderInstance(previous);
    }
  }

  @Test
  void getInstanceInitializesSingletonAndUpdateConfigurationRefreshesFields() throws Exception {
    AuthenticationCodeFlowHandler previous = setHolderInstance(null);
    try (OidcDiscoveryServer firstServer =
            startDiscoveryServer(
                oidcDiscoveryMetadata(
                    "https://issuer.example.com/authorize", "https://issuer.example.com/token"));
        OidcDiscoveryServer secondServer =
            startDiscoveryServer(
                oidcDiscoveryMetadata(
                    "https://issuer-2.example.com/authorize",
                    "https://issuer-2.example.com/token"))) {
      AuthenticationConfiguration initialConfig = oidcAuthConfig(firstServer.discoveryUri());
      initialConfig.setJwtPrincipalClaims(List.of("preferred_username", "email"));

      AuthenticationCodeFlowHandler handler =
          AuthenticationCodeFlowHandler.getInstance(
              initialConfig, authorizerConfiguration(Set.of("admin")));

      assertSame(handler, AuthenticationCodeFlowHandler.getInstance());
      assertEquals("https://openmetadata.example.com", readField(handler, "serverUrl"));

      AuthenticationConfiguration updatedConfig = oidcAuthConfig(secondServer.discoveryUri());
      updatedConfig.getOidcConfiguration().setServerUrl("https://openmetadata.updated.example.com");
      updatedConfig.getOidcConfiguration().setPrompt("login");
      updatedConfig.getOidcConfiguration().setMaxAge("600");
      updatedConfig.setJwtPrincipalClaims(List.of("email"));

      AuthorizerConfiguration updatedAuthorizer = authorizerConfiguration(Set.of("updated-admin"));
      updatedAuthorizer.setPrincipalDomain("updated.example.com");

      handler.updateConfiguration(updatedConfig, updatedAuthorizer);

      assertEquals("https://openmetadata.updated.example.com", readField(handler, "serverUrl"));
      assertEquals(List.of("email"), readField(handler, "claimsOrder"));
      assertEquals("login", readField(handler, "promptType"));
      assertEquals("600", readField(handler, "maxAge"));
      assertEquals("updated.example.com", readField(handler, "principalDomain"));
      assertEquals(
          "https://openmetadata.example.com/callback",
          ((OidcClient) readField(handler, "client")).getCallbackUrl());
    } finally {
      setHolderInstance(previous);
    }
  }

  private static AuthenticationCodeFlowHandler newHandler() throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeField.get(null);
    return (AuthenticationCodeFlowHandler)
        unsafe.allocateInstance(AuthenticationCodeFlowHandler.class);
  }

  private static AuthenticationCodeFlowHandler newInitializedHandler(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConfiguration)
      throws Exception {
    Constructor<AuthenticationCodeFlowHandler> constructor =
        AuthenticationCodeFlowHandler.class.getDeclaredConstructor(
            AuthenticationConfiguration.class, AuthorizerConfiguration.class);
    constructor.setAccessible(true);
    return constructor.newInstance(authenticationConfiguration, authorizerConfiguration);
  }

  private static OidcConfiguration configuredOidcConfiguration(
      String clientId, String secret, List<ClientAuthenticationMethod> supportedMethods) {
    return configuredOidcConfiguration(
        clientId, secret, supportedMethods, URI.create("https://issuer.example.com/token"));
  }

  private static OidcConfiguration configuredOidcConfiguration(
      String clientId,
      String secret,
      List<ClientAuthenticationMethod> supportedMethods,
      URI tokenEndpoint) {
    OidcConfiguration configuration = new OidcConfiguration();
    configuration.setClientId(clientId);
    if (secret != null) {
      configuration.setSecret(secret);
    }
    configuration.setScope("openid profile");
    configuration.setResponseType("code");
    configuration.setResponseMode("query");
    configuration.setProviderMetadata(providerMetadata(supportedMethods, tokenEndpoint));
    return configuration;
  }

  private static OidcClient oidcClient(OidcConfiguration configuration, String name) {
    OidcClient client = new OidcClient(configuration);
    client.setName(name);
    client.setCallbackUrl("https://openmetadata.example.com/callback");
    return client;
  }

  private static AzureAd2OidcConfiguration azureOidcConfiguration(URI tokenEndpoint) {
    AzureAd2OidcConfiguration configuration = new AzureAd2OidcConfiguration();
    configuration.setClientId("azure-client");
    configuration.setSecret("azure-secret");
    configuration.setTenant("organizations");
    configuration.setProviderMetadata(
        providerMetadata(List.of(ClientAuthenticationMethod.CLIENT_SECRET_POST), tokenEndpoint));
    return configuration;
  }

  private static OIDCProviderMetadata providerMetadata(
      List<ClientAuthenticationMethod> supportedMethods, URI tokenEndpoint) {
    OIDCProviderMetadata metadata =
        new OIDCProviderMetadata(
            new Issuer("https://issuer.example.com"),
            List.of(SubjectType.PUBLIC),
            URI.create("https://issuer.example.com/jwks"));
    metadata.setAuthorizationEndpointURI(URI.create("https://issuer.example.com/authorize"));
    metadata.setTokenEndpointURI(tokenEndpoint);
    metadata.setTokenEndpointAuthMethods(supportedMethods);
    metadata.setCodeChallengeMethods(List.of(CodeChallengeMethod.S256));
    return metadata;
  }

  private static AuthorizerConfiguration authorizerConfiguration(Set<String> adminPrincipals) {
    AuthorizerConfiguration authorizerConfiguration = new AuthorizerConfiguration();
    authorizerConfiguration.setAdminPrincipals(adminPrincipals);
    authorizerConfiguration.setPrincipalDomain("example.com");
    return authorizerConfiguration;
  }

  private static AuthenticationConfiguration oidcAuthConfig(URI discoveryUri) {
    OidcClientConfig oidcClientConfig = new OidcClientConfig();
    oidcClientConfig.setId("client-id");
    oidcClientConfig.setSecret("client-secret");
    oidcClientConfig.setDiscoveryUri(discoveryUri.toString());
    oidcClientConfig.setCallbackUrl("https://openmetadata.example.com/callback");
    oidcClientConfig.setServerUrl("https://openmetadata.example.com");
    oidcClientConfig.setScope("openid profile email");
    oidcClientConfig.setResponseType("code");

    AuthenticationConfiguration authenticationConfiguration = new AuthenticationConfiguration();
    authenticationConfiguration.setOidcConfiguration(oidcClientConfig);
    authenticationConfiguration.setJwtPrincipalClaims(List.of("preferred_username", "email"));
    authenticationConfiguration.setJwtPrincipalClaimsMapping(
        List.of("username:preferred_username", "email:email"));
    return authenticationConfiguration;
  }

  private static String signedJwt(JWTClaimsSet claimsSet) throws Exception {
    SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claimsSet);
    jwt.sign(new MACSigner("01234567890123456789012345678901"));
    return jwt.serialize();
  }

  private static TokenServer startTokenServer(int statusCode, String responseBody)
      throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext(
        "/token",
        exchange -> {
          byte[] body = responseBody.getBytes(java.nio.charset.StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(statusCode, body.length);
          try (OutputStream output = exchange.getResponseBody()) {
            output.write(body);
          }
        });
    server.start();
    return new TokenServer(server);
  }

  private static OidcDiscoveryServer startDiscoveryServer(String metadataBody) throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext(
        "/.well-known/openid-configuration",
        exchange -> {
          byte[] body = metadataBody.getBytes(java.nio.charset.StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          try (OutputStream output = exchange.getResponseBody()) {
            output.write(body);
          }
        });
    server.start();
    return new OidcDiscoveryServer(server);
  }

  private static String oidcDiscoveryMetadata(String authorizationEndpoint, String tokenEndpoint) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("issuer", "https://issuer.example.com");
    metadata.put("jwks_uri", "https://issuer.example.com/jwks");
    metadata.put("subject_types_supported", List.of("public"));
    metadata.put("response_types_supported", List.of("code"));
    metadata.put("id_token_signing_alg_values_supported", List.of("RS256"));
    metadata.put(
        "token_endpoint_auth_methods_supported",
        List.of("client_secret_basic", "client_secret_post"));
    if (authorizationEndpoint != null) {
      metadata.put("authorization_endpoint", authorizationEndpoint);
    }
    if (tokenEndpoint != null) {
      metadata.put("token_endpoint", tokenEndpoint);
    }
    return JsonUtils.pojoToJson(metadata);
  }

  private static final class TokenServer implements AutoCloseable {
    private final HttpServer server;

    private TokenServer(HttpServer server) {
      this.server = server;
    }

    private URI tokenEndpoint() {
      return URI.create("http://localhost:" + server.getAddress().getPort() + "/token");
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }

  private static final class OidcDiscoveryServer implements AutoCloseable {
    private final HttpServer server;

    private OidcDiscoveryServer(HttpServer server) {
      this.server = server;
    }

    private URI discoveryUri() {
      return URI.create(
          "http://localhost:"
              + server.getAddress().getPort()
              + "/.well-known/openid-configuration");
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }

  private static void setField(Object target, String name, Object value) throws Exception {
    Field field = AuthenticationCodeFlowHandler.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static AuthenticationCodeFlowHandler setHolderInstance(
      AuthenticationCodeFlowHandler value) throws Exception {
    Class<?> holderClass = Class.forName(AuthenticationCodeFlowHandler.class.getName() + "$Holder");
    Field instanceField = holderClass.getDeclaredField("instance");
    instanceField.setAccessible(true);
    AuthenticationCodeFlowHandler previous =
        (AuthenticationCodeFlowHandler) instanceField.get(null);
    instanceField.set(null, value);
    return previous;
  }

  private static Object readField(Object target, String name) throws Exception {
    Field field = AuthenticationCodeFlowHandler.class.getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }

  @SuppressWarnings("unchecked")
  private static <T> T invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method =
        AuthenticationCodeFlowHandler.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    try {
      return (T) method.invoke(target, args);
    } catch (InvocationTargetException e) {
      if (e.getCause() instanceof Exception exception) {
        throw exception;
      }
      if (e.getCause() instanceof Error error) {
        throw error;
      }
      throw new RuntimeException(e.getCause());
    }
  }
}
