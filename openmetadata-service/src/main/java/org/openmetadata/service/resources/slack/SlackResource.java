package org.openmetadata.service.resources.slack;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.lang.reflect.InvocationTargetException;
import java.util.Map;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AppException;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.bundles.slack.SlackApiResponse;
import org.openmetadata.service.apps.bundles.slack.SlackApp;
import org.openmetadata.service.apps.bundles.slack.SlackOAuthCallbackResponse;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.resources.Collection;

@Slf4j
@Path("/v1/slack")
@Tag(name = "Slack App", description = "Slack App Resource.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "slack")
public class SlackResource {
  public static final String COLLECTION_PATH = "/v1/slack/";
  private static final String APP_NAME = "SlackApplication";
  private static final String SLACK_APP = "Slack";
  private SlackApp app;

  protected void initializeSlackApp() {
    try {
      AppRepository appRepo = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      App slackApp = appRepo.getByName(null, APP_NAME, appRepo.getFields("*"));
      app =
          (SlackApp)
              ApplicationHandler.getInstance()
                  .runAppInit(slackApp, Entity.getCollectionDAO(), Entity.getSearchRepository());

    } catch (ClassNotFoundException
        | InvocationTargetException
        | NoSuchMethodException
        | InstantiationException
        | IllegalAccessException e) {
      throw AppException.byMessage(
          SLACK_APP,
          "Missing config",
          "The app needs to be installed before interacting with the API",
          Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  @GET
  @Path("/channels")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listChannels",
      summary = "List all Slack channels",
      description = "Retrieves a list of all Slack channels that the bot has access to.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Channels retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackApiResponse.class))),
        @ApiResponse(
            responseCode = "400",
            description = "Bad request",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackApiResponse.class))),
        @ApiResponse(
            responseCode = "500",
            description = "Internal server error",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackApiResponse.class)))
      })
  public Response listChannels(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    initializeSlackApp();
    try {
      Map<String, Object> listedChannels = app.listChannels();
      return Response.ok()
          .entity(
              new SlackApiResponse<>(
                  Response.Status.OK.getStatusCode(),
                  "Channels retrieved successfully",
                  listedChannels))
          .build();
    } catch (AppException e) {
      LOG.error("Error listing slack channels", e);
      return Response.status(e.getResponse().getStatusInfo().getStatusCode())
          .entity(
              new SlackApiResponse<>(
                  e.getResponse().getStatusInfo().getStatusCode(), e.getMessage(), null))
          .build();
    } catch (Exception e) {
      LOG.error("Error listing slack channels", e);
      AppException appException =
          AppException.byMessage(
              "SlackApp", "listChannels", e.getMessage(), Response.Status.INTERNAL_SERVER_ERROR);
      return Response.status(appException.getResponse().getStatus())
          .entity(
              new SlackApiResponse<>(
                  appException.getResponse().getStatusInfo().getStatusCode(),
                  appException.getMessage(),
                  null))
          .build();
    }
  }

  @GET
  @Path("/oauthUrl")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "getOAuthUrl",
      summary = "Generate OAuth URL",
      description = "Generates an OAuth URL for initiating the OAuth authorization process.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OAuth URL generated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackApiResponse.class))),
        @ApiResponse(
            responseCode = "500",
            description = "Internal Server Error",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackApiResponse.class)))
      })
  public Response getOAuthUrl(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    initializeSlackApp();
    try {
      String oauthUrl = app.buildOAuthUrl();
      return Response.ok()
          .entity(
              new SlackApiResponse<>(
                  Response.Status.OK.getStatusCode(), "OAuth URL generated successfully", oauthUrl))
          .build();
    } catch (Exception e) {
      LOG.error("Error processing slack oauth url", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              new SlackApiResponse<>(
                  Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                  "Error generating OAuth URL: " + e.getMessage(),
                  null))
          .build();
    }
  }

  /**
   * Exchanges a temporary authorization code for access tokens and validating the request state.
   */
  @GET
  @Path("/callback")
  public Response callback(@QueryParam("code") String code, @QueryParam("state") String state) {
    if (state == null || state.isEmpty()) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(
              new SlackOAuthCallbackResponse(
                  Response.Status.BAD_REQUEST.getStatusCode(), "State is required"))
          .build();
    }

    initializeSlackApp();
    try {
      // Verify if the state matches the expected state
      String expectedState = app.getSlackOAuthStateFromDb();
      if (!state.equals(expectedState)) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(
                new SlackOAuthCallbackResponse(
                    Response.Status.BAD_REQUEST.getStatusCode(), "State verification failed"))
            .build();
      }

      boolean isSaved = app.exchangeAndSaveSlackTokens(code);

      String redirectUrl = "https://open-metadata.org/";
      if (isSaved) {
        return Response.seeOther(java.net.URI.create(redirectUrl))
            .entity(
                new SlackOAuthCallbackResponse(
                    Response.Status.OK.getStatusCode(), "OAuth2 successful"))
            .build();
      } else {
        return Response.seeOther(java.net.URI.create(redirectUrl))
            .entity(
                new SlackOAuthCallbackResponse(
                    Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), "OAuth2 failed"))
            .build();
      }
    } catch (Exception e) {
      LOG.error("Error processing Slack OAuth callback", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              new SlackOAuthCallbackResponse(
                  Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                  "Error processing Slack OAuth callback"))
          .build();
    }
  }
}
