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

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.databind.node.TextNode;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableList;
import io.dropwizard.util.Strings;
import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import javax.ws.rs.ext.Provider;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.security.auth.CatalogSecurityContext;

@Slf4j
@Provider
public class JwtFilter implements ContainerRequestFilter {
  public static final String AUTHORIZATION_HEADER = "Authorization";
  public static final String TOKEN_PREFIX = "Bearer";

  private List<String> jwtPrincipalClaims;
  private JwkProvider jwkProvider;

  @SuppressWarnings("unused")
  private JwtFilter() {}

  @SneakyThrows
  public JwtFilter(AuthenticationConfiguration authenticationConfiguration) {
    this.jwtPrincipalClaims = authenticationConfiguration.getJwtPrincipalClaims();

    ImmutableList.Builder<URL> publicKeyUrlsBuilder = ImmutableList.builder();
    for (String publicKeyUrlStr : authenticationConfiguration.getPublicKeyUrls()) {
      publicKeyUrlsBuilder.add(new URL(publicKeyUrlStr));
    }
    this.jwkProvider = new MultiUrlJwkProvider(publicKeyUrlsBuilder.build());
  }

  @VisibleForTesting
  JwtFilter(JwkProvider jwkProvider, List<String> jwtPrincipalClaims) {
    this.jwkProvider = jwkProvider;
    this.jwtPrincipalClaims = jwtPrincipalClaims;
  }

  @SneakyThrows
  @Override
  public void filter(ContainerRequestContext requestContext) {
    UriInfo uriInfo = requestContext.getUriInfo();
    if (uriInfo.getPath().contains("config")) {
      return;
    }

    // Extract token from the header
    MultivaluedMap<String, String> headers = requestContext.getHeaders();
    String tokenFromHeader = extractToken(headers);
    LOG.debug("Token from header:{}", tokenFromHeader);

    // Decode JWT Token
    DecodedJWT jwt;
    try {
      jwt = JWT.decode(tokenFromHeader);
    } catch (JWTDecodeException e) {
      throw new AuthenticationException("Invalid token", e);
    }

    // Check if expired
    if (jwt.getExpiresAt().before(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime())) {
      throw new AuthenticationException("Expired token!");
    }

    // Validate JWT with public key
    Jwk jwk = jwkProvider.get(jwt.getKeyId());
    Algorithm algorithm = Algorithm.RSA256((RSAPublicKey) jwk.getPublicKey(), null);
    try {
      algorithm.verify(jwt);
    } catch (RuntimeException runtimeException) {
      throw new AuthenticationException("Invalid token");
    }

    // Get username from JWT token
    String userName =
        jwtPrincipalClaims.stream()
            .filter(jwt.getClaims()::containsKey)
            .findFirst()
            .map(jwt::getClaim)
            .map(claim -> claim.as(TextNode.class).asText())
            .map(
                authorizedClaim -> {
                  if (authorizedClaim.contains("@")) {
                    return authorizedClaim.split("@")[0];
                  } else {
                    return authorizedClaim;
                  }
                })
            .orElseThrow(
                () ->
                    new AuthenticationException(
                        "Invalid JWT token, none of the following claims are present " + jwtPrincipalClaims));

    // Setting Security Context
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName);
    String scheme = requestContext.getUriInfo().getRequestUri().getScheme();
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(catalogPrincipal, scheme, SecurityContext.DIGEST_AUTH);
    LOG.debug("SecurityContext {}", catalogSecurityContext);
    requestContext.setSecurityContext(catalogSecurityContext);
  }

  protected static String extractToken(MultivaluedMap<String, String> headers) {
    LOG.debug("Request Headers:{}", headers);
    String source = headers.getFirst(AUTHORIZATION_HEADER);
    if (Strings.isNullOrEmpty(source)) {
      throw new AuthenticationException("Not Authorized! Token not present");
    }
    // Extract the bearer token
    if (source.startsWith(TOKEN_PREFIX)) {
      return source.substring(TOKEN_PREFIX.length() + 1);
    }
    throw new AuthenticationException("Not Authorized! Token not present");
  }
}
