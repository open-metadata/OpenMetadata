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
import com.google.common.util.concurrent.RateLimiter;
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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * RFC 7662-style token introspection used by the external log-server (and any future sidecar) to
 * validate that a presented bearer token is still the current token for its bot subject — without
 * ever exposing the stored token.
 *
 * <p>Response shape: {@code {"active": true|false, "sub": <name>?, "isBot": bool?, "exp": <epoch>?,
 * "reason": <code>?}}.
 *
 * <h2>Security properties</h2>
 *
 * <ul>
 *   <li>Sits in {@link JwtFilter#EXCLUDED_ENDPOINTS} so it can return a structured
 *       {@code active=false} for invalid tokens instead of a 401 — callers cache positive and
 *       negative decisions separately from transport errors.
 *   <li>Requires a caller-authentication header {@code X-OM-Introspect-Auth} matching the secret
 *       configured via {@code OM_INTROSPECT_CALLER_SECRET}. If unset, the endpoint runs in
 *       back-compat "unauthenticated" mode and logs a startup warning — production deployments
 *       MUST set the secret. Comparison uses {@link MessageDigest#isEqual} (constant-time).
 *   <li>Token validation reuses {@link JwtFilter#validateJwtAndGetClaims} AND
 *       {@link JwtFilter#checkValidationsForToken} — same checks as the production auth filter,
 *       so logged-out tokens, revoked PATs, principal-domain violations, and rotated bot tokens
 *       all correctly report {@code active=false}.
 *   <li>Rate-limited globally via {@link RateLimiter} at a configurable rps
 *       ({@code OM_INTROSPECT_RPS}, default 50) to bound the cost of RSA verifies for an
 *       unauthenticated attacker who has reached the endpoint despite ALB rules.
 *   <li>Exception messages are NEVER echoed to logs — the auth0-jwt library can include token
 *       fragments in decode errors. Only the exception class name is logged.
 * </ul>
 */
@Path("/v1/system/auth/introspect")
@Tag(name = "System", description = "Auth introspection for sidecars (e.g. log-server)")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "authIntrospect")
@Slf4j
public class AuthIntrospectResource {

  static final String CALLER_SECRET_ENV = "OM_INTROSPECT_CALLER_SECRET";
  static final String CALLER_SECRET_HEADER = "X-OM-Introspect-Auth";
  static final String RATE_LIMIT_ENV = "OM_INTROSPECT_RPS";
  static final double DEFAULT_RATE_LIMIT_RPS = 50.0;

  private JwtFilter jwtFilter;
  private byte[] callerSecretBytes; // null means "unauthenticated mode" (dev only)
  private RateLimiter rateLimiter;
  private volatile boolean initialised;

  public AuthIntrospectResource() {}

  public void initialize(OpenMetadataApplicationConfig config) {
    AuthenticationConfiguration authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
    AuthorizerConfiguration authzConfig =
        config != null ? config.getAuthorizerConfiguration() : null;
    if (authConfig == null || authzConfig == null) {
      LOG.error(
          "AuthIntrospectResource init failed: auth or authorizer configuration missing — "
              + "endpoint will return 503");
      return;
    }
    this.jwtFilter = new JwtFilter(authConfig, authzConfig);

    String secret = System.getenv(CALLER_SECRET_ENV);
    if (secret == null || secret.isBlank()) {
      LOG.warn(
          "AuthIntrospectResource: {} is not set — introspection endpoint is UNAUTHENTICATED. "
              + "Set this env var to a high-entropy shared secret in production.",
          CALLER_SECRET_ENV);
      this.callerSecretBytes = null;
    } else {
      this.callerSecretBytes = secret.getBytes(StandardCharsets.UTF_8);
    }

    double rps = DEFAULT_RATE_LIMIT_RPS;
    String rpsStr = System.getenv(RATE_LIMIT_ENV);
    if (rpsStr != null && !rpsStr.isBlank()) {
      try {
        double parsed = Double.parseDouble(rpsStr);
        if (parsed > 0) {
          rps = parsed;
        }
      } catch (NumberFormatException e) {
        LOG.warn("Invalid {} value '{}', falling back to {} rps", RATE_LIMIT_ENV, rpsStr, rps);
      }
    }
    this.rateLimiter = RateLimiter.create(rps);
    this.initialised = true;
    LOG.info(
        "AuthIntrospectResource initialised (callerSecret={}, rps={})",
        callerSecretBytes != null ? "enforced" : "DISABLED",
        rps);
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
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "401", description = "Caller authentication failed"),
        @ApiResponse(responseCode = "429", description = "Rate limit exceeded"),
        @ApiResponse(responseCode = "503", description = "Endpoint not initialised")
      })
  public Response introspect(
      @HeaderParam("Authorization") String authHeader,
      @HeaderParam(CALLER_SECRET_HEADER) String callerSecret) {

    if (!initialised) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "introspection not initialised"))
          .build();
    }

    if (!authoriseCaller(callerSecret)) {
      // Don't distinguish "missing" from "wrong" — both opaque to the caller.
      return Response.status(Response.Status.UNAUTHORIZED)
          .entity(Map.of("error", "caller authentication failed"))
          .build();
    }

    if (!rateLimiter.tryAcquire()) {
      return Response.status(429).entity(Map.of("error", "rate limit exceeded")).build();
    }

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("active", false);

    String token;
    try {
      token = JwtFilter.extractToken(authHeader);
    } catch (Exception e) {
      LOG.debug("introspect: missing/invalid bearer header ({})", e.getClass().getSimpleName());
      body.put("reason", "no_token");
      return Response.ok(body).build();
    }

    Map<String, Claim> claims;
    try {
      claims = jwtFilter.validateJwtAndGetClaims(token);
    } catch (Exception e) {
      LOG.debug("introspect: signature/expiry check failed ({})", e.getClass().getSimpleName());
      body.put("reason", "invalid_signature_or_expired");
      return Response.ok(body).build();
    }

    String userName;
    try {
      userName =
          SecurityUtil.findUserNameFromClaims(
              jwtFilter.getJwtPrincipalClaimsMapping(), jwtFilter.getJwtPrincipalClaims(), claims);
    } catch (Exception e) {
      LOG.debug("introspect: no subject in claims ({})", e.getClass().getSimpleName());
      body.put("reason", "no_subject");
      return Response.ok(body).build();
    }
    boolean isBot = SecurityUtil.isBot(claims);
    body.put("sub", userName);
    body.put("isBot", isBot);

    Claim expClaim = claims.get("exp");
    if (expClaim != null && !expClaim.isNull()) {
      try {
        body.put("exp", expClaim.asLong());
      } catch (Exception e) {
        // exp claim was present but couldn't be coerced to long (e.g. some IdPs
        // emit it as a numeric string or a date string). Not fatal — just omit
        // from the response. Log at trace so the case is visible during debug
        // without spamming production. Per project convention, no empty catch.
        LOG.trace("introspect: exp claim not parseable as long ({})", e.getClass().getSimpleName());
      }
    }

    // Full revocation/logout/PAT/domain-enforcement checks — same suite that the production
    // JwtFilter applies to every authenticated request. For bots this includes the BotTokenCache
    // compare (rotation invalidates); for non-bots it covers logout cache + PAT cache + principal
    // domain. Throws AuthenticationException / AuthorizationException on any failure.
    try {
      jwtFilter.checkValidationsForToken(claims, token, userName, null);
    } catch (Exception e) {
      LOG.debug(
          "introspect: post-signature checks rejected token for {} ({})",
          userName,
          e.getClass().getSimpleName());
      body.put("reason", "revoked_or_logged_out");
      return Response.ok(body).build();
    }

    body.put("active", true);
    return Response.ok(body).build();
  }

  /**
   * Constant-time check of the caller-authentication header against the configured shared secret.
   * Returns true if the endpoint is in unauthenticated mode (dev/back-compat) or if the secret
   * matches.
   */
  private boolean authoriseCaller(String providedSecret) {
    if (callerSecretBytes == null) {
      return true;
    }
    if (providedSecret == null) {
      return false;
    }
    byte[] provided = providedSecret.getBytes(StandardCharsets.UTF_8);
    return MessageDigest.isEqual(provided, callerSecretBytes);
  }
}
