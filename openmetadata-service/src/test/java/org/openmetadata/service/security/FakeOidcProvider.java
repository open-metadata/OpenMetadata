/*
 *  Copyright 2025 Collate.
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

import static java.nio.charset.StandardCharsets.UTF_8;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

/**
 * A minimal OpenID provider on a loopback port: a discovery document and a token endpoint. It lets
 * the Test Login OIDC leg run its real discovery, PKCE, client-authentication and nonce handling
 * end to end without mocking any of it. The token endpoint records what it was sent.
 */
public final class FakeOidcProvider implements AutoCloseable {
  public static final String CLIENT_ID = "om-test-login-client";
  public static final String CLIENT_SECRET = "candidate-client-secret";
  public static final String CALLBACK_URL = "http://localhost:8585/callback";

  private final HttpServer server;
  private final String issuer;
  private final AtomicInteger tokenStatus = new AtomicInteger(200);
  private final AtomicReference<String> tokenResponse = new AtomicReference<>("{}");
  private final AtomicReference<Map<String, String>> lastTokenRequest =
      new AtomicReference<>(Map.of());
  private final AtomicReference<String> lastTokenAuthorization = new AtomicReference<>();
  private final AtomicReference<String> authorizationEndpoint = new AtomicReference<>();

  private FakeOidcProvider(HttpServer server) {
    this.server = server;
    this.issuer = "http://127.0.0.1:" + server.getAddress().getPort();
    this.authorizationEndpoint.set(issuer + "/authorize");
  }

  public static FakeOidcProvider start() throws IOException {
    HttpServer server =
        HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    FakeOidcProvider provider = new FakeOidcProvider(server);
    server.createContext(
        "/.well-known/openid-configuration",
        exchange -> respond(exchange, 200, provider.discoveryDocument()));
    server.createContext("/token", provider::handleTokenRequest);
    server.start();
    return provider;
  }

  public String issuer() {
    return issuer;
  }

  /** A confidential client with PKCE on and client_secret_basic, so every assertion is exact. */
  public OidcClientConfig confidentialClient() {
    return new OidcClientConfig()
        .withId(CLIENT_ID)
        .withSecret(CLIENT_SECRET)
        .withDiscoveryUri(issuer + "/.well-known/openid-configuration")
        .withCallbackUrl(CALLBACK_URL)
        .withServerUrl("http://localhost:8585")
        .withClientAuthenticationMethod(
            OidcClientConfig.ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
        .withDisablePkce(false);
  }

  /** The token endpoint will answer the next exchange with an id_token for this identity. */
  public void issueIdToken(String nonce, String email) {
    JWTClaimsSet claims =
        new JWTClaimsSet.Builder()
            .issuer(issuer)
            .audience(CLIENT_ID)
            .subject("subject-123")
            .claim("email", email)
            .claim("nonce", nonce)
            .expirationTime(new Date(System.currentTimeMillis() + 60_000))
            .build();
    tokenStatus.set(200);
    tokenResponse.set(
        String.format(
            "{\"access_token\":\"access-token\",\"token_type\":\"Bearer\",\"expires_in\":3600,"
                + "\"id_token\":\"%s\"}",
            new PlainJWT(claims).serialize()));
  }

  public void rejectTokenRequests(int status, String error, String description) {
    tokenStatus.set(status);
    tokenResponse.set(
        String.format("{\"error\":\"%s\",\"error_description\":\"%s\"}", error, description));
  }

  public Map<String, String> lastTokenRequest() {
    return lastTokenRequest.get();
  }

  public String lastTokenAuthorization() {
    return lastTokenAuthorization.get();
  }

  /** Serve a discovery document that sends the browser somewhere else to sign in. */
  public void advertiseAuthorizationEndpoint(String endpoint) {
    authorizationEndpoint.set(endpoint);
  }

  public static SecurityConfiguration securityConfigFor(OidcClientConfig oidc) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration()
                .withProvider(AuthProvider.CUSTOM_OIDC)
                .withClientType(ClientType.CONFIDENTIAL)
                .withOidcConfiguration(oidc)
                .withJwtPrincipalClaims(List.of("email"))
                .withJwtPrincipalClaimsMapping(List.of()))
        .withAuthorizerConfiguration(
            new AuthorizerConfiguration()
                .withPrincipalDomain("example.com")
                .withEnforcePrincipalDomain(false)
                .withAllowedDomains(new HashSet<>()));
  }

  public static Map<String, String> queryOf(String url) {
    return formParameters(URI.create(url).getRawQuery());
  }

  @Override
  public void close() {
    server.stop(0);
  }

  private String discoveryDocument() {
    return String.format(
        "{\"issuer\":\"%1$s\",\"authorization_endpoint\":\"%2$s\","
            + "\"token_endpoint\":\"%1$s/token\",\"jwks_uri\":\"%1$s/jwks\","
            + "\"response_types_supported\":[\"code\"],\"subject_types_supported\":[\"public\"],"
            + "\"id_token_signing_alg_values_supported\":[\"RS256\"],"
            + "\"token_endpoint_auth_methods_supported\":[\"client_secret_basic\"],"
            + "\"code_challenge_methods_supported\":[\"S256\"]}",
        issuer, authorizationEndpoint.get());
  }

  private void handleTokenRequest(HttpExchange exchange) throws IOException {
    lastTokenRequest.set(
        formParameters(new String(exchange.getRequestBody().readAllBytes(), UTF_8)));
    lastTokenAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
    respond(exchange, tokenStatus.get(), tokenResponse.get());
  }

  private static void respond(HttpExchange exchange, int status, String json) throws IOException {
    byte[] body = json.getBytes(UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json");
    exchange.sendResponseHeaders(status, body.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(body);
    }
  }

  private static Map<String, String> formParameters(String encoded) {
    Map<String, String> parameters = new HashMap<>();
    if (encoded == null || encoded.isEmpty()) {
      return parameters;
    }
    for (String pair : encoded.split("&")) {
      int separator = pair.indexOf('=');
      parameters.put(
          URLDecoder.decode(pair.substring(0, separator), UTF_8),
          URLDecoder.decode(pair.substring(separator + 1), UTF_8));
    }
    return parameters;
  }
}
