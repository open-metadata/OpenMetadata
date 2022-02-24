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
import com.auth0.jwk.UrlJwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.databind.node.TextNode;
import io.dropwizard.util.Strings;
import java.net.URI;
import java.security.interfaces.RSAPublicKey;
import java.util.Calendar;
import java.util.TimeZone;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.UriInfo;
import javax.ws.rs.ext.Provider;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.security.auth.CatalogSecurityContext;

@Slf4j
@Provider
public class JwtFilter implements ContainerRequestFilter {
  @Context private UriInfo uriInfo;

  public static final String AUTHORIZATION_HEADER = "Authorization";
  public static final String TOKEN_PREFIX = "Bearer";
  private String publicKeyUri;

  @SuppressWarnings("unused")
  private JwtFilter() {}

  public JwtFilter(AuthenticationConfiguration authenticationConfiguration) {
    this.publicKeyUri = authenticationConfiguration.getPublicKey();
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
    DecodedJWT jwt = JWT.decode(tokenFromHeader);

    // Check if expired
    if (jwt.getExpiresAt().before(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime())) {
      throw new AuthenticationException("Expired token!");
    }
    // Validate JWT with public key
    final URI uri = new URI(publicKeyUri).normalize();
    UrlJwkProvider urlJwkProvider = new UrlJwkProvider(uri.toURL());
    Jwk jwk = urlJwkProvider.get(jwt.getKeyId());
    Algorithm algorithm = Algorithm.RSA256((RSAPublicKey) jwk.getPublicKey(), null);
    try {
      algorithm.verify(jwt);
    } catch (RuntimeException runtimeException) {
      throw new AuthenticationException("Invalid token");
    }
    String authorizedEmail;
    if (jwt.getClaims().get("email") != null) {
      authorizedEmail = jwt.getClaim("email").as(TextNode.class).asText();
    } else if (jwt.getClaim("sub") != null) {
      authorizedEmail = jwt.getClaim("sub").as(TextNode.class).asText();
    } else {
      throw new AuthenticationException("Invalid JWT token, \"email\" or \"subject\" not present.");
    }
    String userName;
    if (authorizedEmail.contains("@")) {
      userName = authorizedEmail.split("@")[0];
    } else {
      userName = authorizedEmail;
    }
    // Setting Security Context
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName);
    String scheme = requestContext.getUriInfo().getRequestUri().getScheme();
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(catalogPrincipal, scheme, CatalogSecurityContext.DIGEST_AUTH);
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
