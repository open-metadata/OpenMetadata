/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.system;

import com.auth0.jwt.interfaces.Claim;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.auth.BotTokenCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * RFC 7662-style token introspection used by the external log-server (and any
 * future sidecar) to validate that a presented bearer token is still the
 * current token for its bot subject — without ever exposing the stored token.
 *
 * <p>Returns {@code {"active": true|false, "sub": <name>, "isBot": bool, "exp": <epoch-ms>?}}.
 *
 * <p>This endpoint is added to {@link JwtFilter#EXCLUDED_ENDPOINTS} so the
 * filter does not 401 on invalid tokens; we want to return {@code active=false}
 * instead so callers can cache negative results separately from transport
 * errors.
 */
@Path("/v1/system/auth/introspect")
@Tag(name = "System", description = "Auth introspection for sidecars (e.g. log-server)")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "authIntrospect")
@Slf4j
public class AuthIntrospectResource {

  private JwtFilter jwtFilter;

  public AuthIntrospectResource() {}

  public void initialize(OpenMetadataApplicationConfig config) {
    AuthenticationConfiguration authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
    AuthorizerConfiguration authzConfig = config.getAuthorizerConfiguration();
    if (authConfig == null || authzConfig == null) {
      LOG.warn("AuthIntrospectResource not initialised: auth or authorizer configuration missing");
      return;
    }
    this.jwtFilter = new JwtFilter(authConfig, authzConfig);
  }

  @POST
  @Operation(
      operationId = "introspectToken",
      summary = "Introspect a bearer token (RFC 7662 subset)",
      description =
          "Used by sidecar services (notably log-server) to verify a bot token is still the "
              + "current one without ever pulling the stored secret across the wire.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Introspection result",
            content = @Content(mediaType = "application/json"))
      })
  public Response introspect(@HeaderParam("Authorization") String authHeader) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("active", false);

    if (jwtFilter == null) {
      return Response.ok(body).build();
    }

    String token;
    try {
      token = JwtFilter.extractToken(authHeader);
    } catch (Exception e) {
      LOG.debug("introspect: missing/invalid bearer header");
      return Response.ok(body).build();
    }

    Map<String, Claim> claims;
    try {
      claims = jwtFilter.validateJwtAndGetClaims(token);
    } catch (Exception e) {
      LOG.debug("introspect: token failed cryptographic validation: {}", e.getMessage());
      return Response.ok(body).build();
    }

    String userName =
        SecurityUtil.findUserNameFromClaims(
            jwtFilter.getJwtPrincipalClaimsMapping(), jwtFilter.getJwtPrincipalClaims(), claims);
    boolean isBot = SecurityUtil.isBot(claims);
    body.put("sub", userName);
    body.put("isBot", isBot);

    Claim expClaim = claims.get("exp");
    if (expClaim != null && !expClaim.isNull()) {
      try {
        body.put("exp", expClaim.asLong());
      } catch (Exception ignored) {
        // exp not parseable as long — leave absent
      }
    }

    if (!isBot) {
      // Non-bot tokens are considered active when the signature verifies and exp is in the
      // future (already enforced by validateJwtAndGetClaims). No revocation check applies.
      body.put("active", true);
      return Response.ok(body).build();
    }

    String currentToken;
    try {
      currentToken = BotTokenCache.getToken(userName);
    } catch (Exception e) {
      LOG.debug("introspect: bot lookup failed for {}: {}", userName, e.getMessage());
      return Response.ok(body).build();
    }

    if (currentToken != null && currentToken.equals(token)) {
      body.put("active", true);
    }
    return Response.ok(body).build();
  }
}
