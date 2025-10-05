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

package org.openmetadata.service.resources.oauth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.OAuthToken;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.OAuthTokenRepository;
import org.openmetadata.service.oauth.OAuthService;
import org.openmetadata.service.security.SecurityUtil;

@Slf4j
@Path("/v1/oauth")
@Tag(
    name = "OAuth",
    description =
        "OAuth endpoints for handling OAuth2 authentication flows. These endpoints manage "
            + "user authentication with external services that require OAuth2 authorization.")
@Produces(MediaType.APPLICATION_JSON)
public class OAuthResource {

  private final OAuthService oAuthService;
  private final OAuthTokenRepository oAuthTokenRepository;

  public OAuthResource(OpenMetadataApplicationConfig config) {
    this.oAuthService = new OAuthService(config);
    this.oAuthTokenRepository = new OAuthTokenRepository();
  }

  @GET
  @Path("/authorize/{credentialsId}")
  @Operation(
      operationId = "initiateOAuthFlow",
      summary = "Initiate OAuth authorization flow",
      description =
          "Initiate OAuth2 authorization flow for the specified credentials. "
              + "This will redirect the user to the OAuth provider's authorization page.",
      responses = {
        @ApiResponse(responseCode = "302", description = "Redirect to OAuth provider"),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid credentials or OAuth not supported"),
        @ApiResponse(responseCode = "404", description = "Credentials not found")
      })
  public Response authorize(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ID of the credentials entity",
              schema = @Schema(type = "string", format = "uuid"))
          @PathParam("credentialsId")
          UUID credentialsId,
      @Parameter(
              description = "URL to redirect to after OAuth flow completion",
              schema = @Schema(type = "string"))
          @QueryParam("returnUrl")
          String returnUrl) {

    try {
      UUID userId = SecurityUtil.getUserName(securityContext);

      String authorizationUrl =
          oAuthService.generateAuthorizationUrl(credentialsId, userId, returnUrl);

      LOG.info(
          "Redirecting user {} to OAuth authorization URL for credentials {}",
          userId,
          credentialsId);

      return Response.seeOther(URI.create(authorizationUrl)).build();

    } catch (Exception e) {
      LOG.error("Failed to initiate OAuth flow for credentials {}", credentialsId, e);
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\":\"" + e.getMessage() + "\"}")
          .build();
    }
  }

  @GET
  @Path("/callback")
  @Operation(
      operationId = "handleOAuthCallback",
      summary = "Handle OAuth authorization callback",
      description =
          "Handle the OAuth2 authorization callback from the provider. "
              + "This endpoint exchanges the authorization code for access tokens.",
      responses = {
        @ApiResponse(responseCode = "302", description = "Redirect to return URL"),
        @ApiResponse(responseCode = "400", description = "OAuth callback failed"),
      })
  public Response callback(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Authorization code from OAuth provider",
              schema = @Schema(type = "string"))
          @QueryParam("code")
          String code,
      @Parameter(
              description = "State parameter for CSRF protection",
              schema = @Schema(type = "string"))
          @QueryParam("state")
          String state,
      @Parameter(
              description = "Error parameter from OAuth provider",
              schema = @Schema(type = "string"))
          @QueryParam("error")
          String error) {

    try {
      OAuthToken token = oAuthService.handleCallback(code, state, error);

      LOG.info(
          "Successfully processed OAuth callback for user {} and credentials {}",
          token.getUserId(),
          token.getCredentialsId());

      // Extract return URL from state if available
      // For now, redirect to a default success page
      String redirectUrl = "/oauth/success?tokenId=" + token.getId();

      return Response.seeOther(URI.create(redirectUrl)).build();

    } catch (Exception e) {
      LOG.error("Failed to handle OAuth callback", e);
      String redirectUrl = "/oauth/error?message=" + e.getMessage();
      return Response.seeOther(URI.create(redirectUrl)).build();
    }
  }

  @GET
  @Path("/status/{credentialsId}")
  @Operation(
      operationId = "getOAuthStatus",
      summary = "Get OAuth authentication status",
      description =
          "Check if the current user has a valid OAuth token for the specified credentials.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OAuth status information",
            content = @Content(mediaType = "application/json"))
      })
  public Response getAuthStatus(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ID of the credentials entity",
              schema = @Schema(type = "string", format = "uuid"))
          @PathParam("credentialsId")
          UUID credentialsId) {

    try {
      UUID userId = SecurityUtil.getUserId(securityContext);

      Optional<OAuthToken> tokenOpt = oAuthService.getUserToken(userId, credentialsId);

      if (tokenOpt.isPresent()) {
        OAuthToken token = tokenOpt.get();
        boolean isValid = oAuthService.validateToken(token.getId());

        return Response.ok()
            .entity(
                String.format(
                    "{\"isAuthenticated\":%s,\"tokenId\":\"%s\",\"status\":\"%s\",\"expiresAt\":%s}",
                    isValid, token.getId(), token.getStatus(), token.getExpiresAt()))
            .build();
      } else {
        return Response.ok().entity("{\"isAuthenticated\":false}").build();
      }

    } catch (Exception e) {
      LOG.error("Failed to get OAuth status for credentials {}", credentialsId, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\":\"" + e.getMessage() + "\"}")
          .build();
    }
  }

  @GET
  @Path("/tokens")
  @Operation(
      operationId = "getUserOAuthTokens",
      summary = "Get user's OAuth tokens",
      description =
          "Get a list of OAuth tokens for the current user. "
              + "Sensitive token data is masked in the response.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of user's OAuth tokens",
            content = @Content(mediaType = "application/json"))
      })
  public Response getUserTokens(@Context SecurityContext securityContext) {

    try {
      UUID userId = SecurityUtil.getUserId(securityContext);

      List<OAuthToken> tokens = oAuthTokenRepository.findByUserId(userId);

      // Mask sensitive data before returning
      tokens.forEach(
          token -> {
            token.setAccessToken("***MASKED***");
            token.setRefreshToken("***MASKED***");
          });

      return Response.ok().entity(tokens).build();

    } catch (Exception e) {
      LOG.error("Failed to get OAuth tokens for user", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\":\"" + e.getMessage() + "\"}")
          .build();
    }
  }

  @POST
  @Path("/tokens/{tokenId}/refresh")
  @Operation(
      operationId = "refreshOAuthToken",
      summary = "Refresh OAuth token",
      description = "Manually refresh an OAuth token using its refresh token.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Token refreshed successfully"),
        @ApiResponse(responseCode = "400", description = "Token refresh failed"),
        @ApiResponse(responseCode = "404", description = "Token not found")
      })
  public Response refreshToken(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ID of the OAuth token",
              schema = @Schema(type = "string", format = "uuid"))
          @PathParam("tokenId")
          UUID tokenId) {

    try {
      UUID userId = SecurityUtil.getUserId(securityContext);

      // Verify token ownership
      Optional<OAuthToken> tokenOpt = oAuthTokenRepository.findById(tokenId);
      if (tokenOpt.isEmpty()) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("{\"error\":\"Token not found\"}")
            .build();
      }

      if (!tokenOpt.get().getUserId().equals(userId)) {
        return Response.status(Response.Status.FORBIDDEN)
            .entity("{\"error\":\"Access denied\"}")
            .build();
      }

      OAuthToken refreshedToken = oAuthService.refreshToken(tokenId);

      // Mask sensitive data
      refreshedToken.setAccessToken("***MASKED***");
      refreshedToken.setRefreshToken("***MASKED***");

      return Response.ok().entity(refreshedToken).build();

    } catch (Exception e) {
      LOG.error("Failed to refresh OAuth token {}", tokenId, e);
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\":\"" + e.getMessage() + "\"}")
          .build();
    }
  }

  @DELETE
  @Path("/tokens/{tokenId}")
  @Operation(
      operationId = "revokeOAuthToken",
      summary = "Revoke OAuth token",
      description = "Revoke an OAuth token, making it invalid for future use.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Token revoked successfully"),
        @ApiResponse(responseCode = "404", description = "Token not found")
      })
  public Response revokeToken(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ID of the OAuth token",
              schema = @Schema(type = "string", format = "uuid"))
          @PathParam("tokenId")
          UUID tokenId) {

    try {
      UUID userId = SecurityUtil.getUserId(securityContext);

      // Verify token ownership
      Optional<OAuthToken> tokenOpt = oAuthTokenRepository.findById(tokenId);
      if (tokenOpt.isEmpty()) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("{\"error\":\"Token not found\"}")
            .build();
      }

      if (!tokenOpt.get().getUserId().equals(userId)) {
        return Response.status(Response.Status.FORBIDDEN)
            .entity("{\"error\":\"Access denied\"}")
            .build();
      }

      oAuthService.revokeToken(tokenId);

      return Response.ok().entity("{\"message\":\"Token revoked successfully\"}").build();

    } catch (Exception e) {
      LOG.error("Failed to revoke OAuth token {}", tokenId, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\":\"" + e.getMessage() + "\"}")
          .build();
    }
  }
}
