package org.openmetadata.service.apps.bundles.slack;

import com.google.common.reflect.TypeToken;
import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.lang.reflect.InvocationTargetException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.Optional;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AppException;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.resources.Collection;

@Slf4j
@Path("/v1/collate/apps/slack/")
@Tag(name = "Slack App", description = "Slack App Resource.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "Slack")
public class SlackResource {
  public static final String COLLECTION_PATH = "/v1/collate/apps/slack/";
  public static final String APP_NAME = "SlackApplication";
  private static final String SLACK_APP = "Slack";
  private SlackApp slackApp;

  protected void initializeSlackApp() {
    try {
      AppRepository appRepo = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      App slackApplication = appRepo.getByName(null, APP_NAME, appRepo.getFields("*"));
      slackApp =
          (SlackApp)
              ApplicationHandler.getInstance()
                  .runAppInit(
                      slackApplication, Entity.getCollectionDAO(), Entity.getSearchRepository());

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
  @Path("/initiateOAuth")
  @Operation(
      summary = "Initiate OAuth Process",
      description = "Initializes the OAuth process for Slack integration.",
      responses = {
        @ApiResponse(
            responseCode = "302",
            description = "Redirect to OAuth URL",
            content = @Content(mediaType = "text/plain", schema = @Schema(type = "string"))),
        @ApiResponse(
            responseCode = "500",
            description = "Internal Server Error",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackApiResponse.class)))
      })
  public Response initiateOAuth(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    initializeSlackApp();
    try {
      String oauthUrl = slackApp.buildOAuthUrl();
      return Response.status(Response.Status.FOUND).location(new URI(oauthUrl)).build();
    } catch (Exception e) {
      LOG.error("Error processing slack oauth url", e);
      return Response.serverError().build();
    }
  }

  @POST
  @Path("/events")
  @Consumes(MediaType.APPLICATION_JSON)
  public Response handleSlackEvent(String payload, @Context HttpHeaders headers) {
    initializeSlackApp();

    // Validate Slack request
    if (!validateSlackRequest(headers, payload)) {
      return Response.status(Response.Status.BAD_REQUEST).build();
    }

    Map<String, Object> eventPayload = null;
    try {
      eventPayload =
          new Gson().fromJson(payload, new TypeToken<Map<String, Object>>() {}.getType());
    } catch (JsonSyntaxException e) {
      LOG.warn("Error parsing Slack payload JSON: " + e.getMessage());
      return Response.status(Response.Status.BAD_REQUEST).build();
    }

    // Check if the event payload contains a challenge
    if (eventPayload.containsKey("challenge")) {
      String challenge = (String) eventPayload.get("challenge");
      // Respond with the challenge value
      return Response.ok(challenge).build();
    }

    return slackApp.handleEvent(eventPayload);
  }

  @GET
  @Path("/callback")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "slackOAuthCallback",
      summary = "Slack OAuth Callback",
      description =
          "Exchanges a temporary authorization code for access tokens and validates the request state.",
      responses = {
        @ApiResponse(
            responseCode = "302",
            description = "Redirecting response to the frontend URL.")
      })
  public Response callback(@QueryParam("code") String code, @QueryParam("state") String state) {
    initializeSlackApp();
    try {
      if (!slackApp.isOAuthStateValid(state)) {
        LOG.error("State verification failed");
        return redirectResponse(slackApp.getRedirectUrl(false));
      }

      // Save token and build redirect URL
      String redirectUrl = slackApp.saveTokenAndBuildRedirectUrl(code);
      return redirectResponse(redirectUrl);
    } catch (Exception e) {
      LOG.error("Error processing Slack OAuth callback", e);
      return redirectResponse(slackApp.getRedirectUrl(false));
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
      Map<String, Object> listedChannels = slackApp.listChannels();
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

  private boolean validateSlackRequest(HttpHeaders headers, String payload) {
    // Retrieve headers case-insensitively
    MultivaluedMap<String, String> requestHeaders = headers.getRequestHeaders();
    Optional<String> slackSignature =
        Optional.ofNullable(requestHeaders.getFirst("X-Slack-Signature"));
    Optional<String> slackRequestTimestamp =
        Optional.ofNullable(requestHeaders.getFirst("X-Slack-Request-Timestamp"));

    if (slackSignature.isEmpty() || slackRequestTimestamp.isEmpty()) {
      LOG.warn("Missing required headers: X-Slack-Signature or X-Slack-Request-Timestamp");
      return false;
    }

    // Verify request signature
    boolean isRequestValid =
        slackApp.isRequestValid(slackSignature.get(), slackRequestTimestamp.get(), payload);
    if (!isRequestValid) {
      LOG.warn("Request verification failed");
      return false;
    }

    return true;
  }

  private Response redirectResponse(String url) {
    try {
      return Response.status(Response.Status.FOUND).location(new URI(url)).build();
    } catch (URISyntaxException e) {
      LOG.error("Invalid redirect URL", e);
      return Response.serverError().build();
    }
  }
}
