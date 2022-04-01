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

package org.openmetadata.catalog.security;

import static java.lang.String.format;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.net.URI;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.core.MultivaluedHashMap;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class JwtFilterTest {

  private static JwtFilter jwtFilter;

  private static Algorithm algorithm;
  private static UriInfo mockRequestURIInfo;

  @BeforeAll
  static void before() throws Exception {
    // Create a RSA256 algorithm wth random public/private key pair
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(512);
    KeyPair keyPair = keyPairGenerator.generateKeyPair();
    algorithm = Algorithm.RSA256((RSAPublicKey) keyPair.getPublic(), (RSAPrivateKey) keyPair.getPrivate());

    // Mock a JwkProvider that has a single JWK containing the public key from the algorithm above
    // This is used to verify the JWT
    Jwk mockJwk = mock(Jwk.class);
    when(mockJwk.getPublicKey()).thenReturn(keyPair.getPublic());
    JwkProvider jwkProvider = mock(JwkProvider.class);
    when(jwkProvider.get(algorithm.getSigningKeyId())).thenReturn(mockJwk);

    // This is needed by JwtFilter for some metadata, not very important
    URI uri = URI.create("POST:http://localhost:8080/login");
    mockRequestURIInfo = mock(UriInfo.class);
    when(mockRequestURIInfo.getPath()).thenReturn("/login");
    when(mockRequestURIInfo.getRequestUri()).thenReturn(uri);

    List<String> principalClaims = List.of("sub", "email");
    jwtFilter = new JwtFilter(jwkProvider, principalClaims);
  }

  @Test
  void testSuccessfulFilter() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    jwtFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument = ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testFilterWithEmailClaim() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "sam@gmail.com")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    jwtFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument = ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testMissingToken() {
    MultivaluedHashMap<String, String> headers = new MultivaluedHashMap<>();
    ContainerRequestContext context = mock(ContainerRequestContext.class);
    when(context.getUriInfo()).thenReturn(mockRequestURIInfo);
    when(context.getHeaders()).thenReturn(headers);

    Exception exception = assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("token not present"));
  }

  @Test
  void testInvalidToken() {
    ContainerRequestContext context = createRequestContextWithJwt("invalid-token");

    Exception exception = assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("invalid token"));
  }

  @Test
  void testExpiredToken() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().minus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception = assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("expired"));
  }

  @Test
  void testNoClaimsInToken() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("emailAddress", "sam@gmail.com")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception = assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("claim"));
  }

  @Test
  void testInvalidSignatureJwt() throws NoSuchAlgorithmException {
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(512);
    KeyPair keyPair = keyPairGenerator.generateKeyPair();
    Algorithm secondaryAlgorithm =
        Algorithm.RSA256((RSAPublicKey) keyPair.getPublic(), (RSAPrivateKey) keyPair.getPrivate());

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(secondaryAlgorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception = assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("invalid token"));
  }

  /**
   * Creates the ContainerRequestsContext that is passed to the filter. This object can be quite complex, but the
   * JwtFilter cares only about the Authorization header and request URI.
   *
   * @param jwt JWT in string format to be added to headers
   * @return Mocked ContainerRequestContext with an Authorization header and request URI info
   */
  private static ContainerRequestContext createRequestContextWithJwt(String jwt) {
    MultivaluedHashMap<String, String> headers =
        new MultivaluedHashMap<>(Map.of(JwtFilter.AUTHORIZATION_HEADER, format("%s %s", JwtFilter.TOKEN_PREFIX, jwt)));

    ContainerRequestContext context = mock(ContainerRequestContext.class);
    when(context.getUriInfo()).thenReturn(mockRequestURIInfo);
    when(context.getHeaders()).thenReturn(headers);

    return context;
  }
}
