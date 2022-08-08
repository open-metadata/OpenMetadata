package org.openmetadata.catalog.resources.settings;

import static org.openmetadata.catalog.settings.SettingsType.*;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.apache.maven.shared.utils.io.IOUtil;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.catalog.events.EventHandlerConfiguration;
import org.openmetadata.catalog.filter.EntityFilter;
import org.openmetadata.catalog.filter.EventFilter;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.SettingsRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.secrets.SecretsManagerConfiguration;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.jwt.JWTTokenConfiguration;
import org.openmetadata.catalog.settings.Settings;
import org.openmetadata.catalog.settings.SettingsType;
import org.openmetadata.catalog.slack.SlackPublisherConfiguration;
import org.openmetadata.catalog.slackChat.SlackChatConfiguration;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/settings")
@Api(value = "Settings Collection", tags = "Settings collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "settings")
@Slf4j
public class SettingsResource {
  private final SettingsRepository settingsRepository;
  private final Authorizer authorizer;

  @SuppressWarnings("unused") // Method used for reflection
  public void initialize(CatalogApplicationConfig config) throws IOException {
    initSettings();
  }

  private void initSettings() throws IOException {
    List<String> jsonDataFiles = EntityUtil.getJsonDataResources(".*json/data/settings/settingsData.json$");
    if (jsonDataFiles.size() != 1) {
      LOG.warn("Invalid number of jsonDataFiles {}. Only one expected.", jsonDataFiles.size());
      return;
    }
    String jsonDataFile = jsonDataFiles.get(0);
    try {
      String json = IOUtil.toString(getClass().getClassLoader().getResourceAsStream(jsonDataFile));
      List<Settings> settings = JsonUtils.readObjects(json, Settings.class);
      settings.forEach(
          (setting) -> {
            try {
              Settings storedSettings = settingsRepository.getConfigWithKey(setting.getConfigType().toString());
              if (storedSettings == null) {
                // Only in case a config doesn't exist in DB we insert it
                settingsRepository.createNewSetting(setting);
              }
            } catch (Exception ex) {
              LOG.debug("Fetching from DB failed ", ex);
            }
          });
    } catch (Exception e) {
      LOG.warn("Failed to initialize the {} from file {}", "filters", jsonDataFile, e);
    }
  }

  public static class SettingsList extends ResultList<Settings> {
    @SuppressWarnings("unused")
    public SettingsList() {
      /* Required for serde */
    }

    public SettingsList(List<Settings> data) {
      super(data);
    }
  }

  public SettingsResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "SettingsRepository must not be null");
    this.settingsRepository = new SettingsRepository(dao);
    this.authorizer = authorizer;
  }

  @GET
  @Operation(
      operationId = "listSettings",
      summary = "List All Settings",
      tags = "settings",
      description = "Get a List of all OpenMetadata Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SettingsList.class)))
      })
  public ResultList<Settings> list(@Context UriInfo uriInfo, @Context SecurityContext securityContext)
      throws IOException {
    return settingsRepository.listAllConfigs();
  }

  @GET
  @Path("/{settingName}")
  @Operation(
      operationId = "getSetting",
      summary = "Get a Setting",
      tags = "settings",
      description = "Get a OpenMetadata Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Settings.class)))
      })
  public Settings getSettingByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("settingName") String settingName) {
    return settingsRepository.getConfigWithKey(settingName);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update Setting",
      tags = "settings",
      description = "Update Existing Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Settings.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid Settings settingName) {
    return settingsRepository.createOrUpdate(settingName);
  }

  @PUT
  @Path("/authenticationConfiguration")
  @Operation(
      operationId = "createOrUpdateAuthenticationConfiguration",
      summary = "Update Authentication Setting",
      tags = "settings",
      description = "Update Authentication Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AuthenticationConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid AuthenticationConfiguration authenticationConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(AUTHENTICATION_CONFIGURATION, authenticationConfiguration));
  }

  @PUT
  @Path("/authorizerConfiguration")
  @Operation(
      operationId = "createOrUpdateAuthorizationConfiguration",
      summary = "Update Authorization Setting",
      tags = "settings",
      description = "Update Authorization Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AuthorizerConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid AuthorizerConfiguration authorizerConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(AUTHORIZER_CONFIGURATION, authorizerConfiguration));
  }

  @PUT
  @Path("/jwtTokenConfiguration")
  @Operation(
      operationId = "createOrUpdateJWTConfiguration",
      summary = "Update JWT Setting",
      tags = "settings",
      description = "Update JWT Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = JWTTokenConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid JWTTokenConfiguration jwtTokenConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(JWT_TOKEN_CONFIGURATION, jwtTokenConfiguration));
  }

  @PUT
  @Path("/airflowConfiguration")
  @Operation(
      operationId = "createOrUpdateAirflowSettings",
      summary = "Update Airflow Setting",
      tags = "settings",
      description = "Update Existing Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Settings.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid AirflowConfiguration airflowConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(AIRFLOW_CONFIGURATION, airflowConfiguration));
  }

  @PUT
  @Path("/elasticsearch")
  @Operation(
      operationId = "createOrUpdateElasticSearchConfiguration",
      summary = "Update ES Setting",
      tags = "settings",
      description = "Update ES Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ElasticSearchConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid ElasticSearchConfiguration elasticSearchConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(ELASTICSEARCH, elasticSearchConfiguration));
  }

  @PUT
  @Path("/eventHandlerConfiguration")
  @Operation(
      operationId = "createOrUpdateEventHandlerConfiguration",
      summary = "Update Event Handler Setting",
      tags = "settings",
      description = "Update Event Handler Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventHandlerConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid EventHandlerConfiguration eventHandlerConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(EVENT_HANDLER_CONFIGURATION, eventHandlerConfiguration));
  }

  @PUT
  @Path("/slackEventPublishers")
  @Operation(
      operationId = "createOrUpdateSlackPublisherConfiguration",
      summary = "Update Slack Publisher Setting",
      tags = "settings",
      description = "Update Slack Publisher Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackPublisherConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid SlackPublisherConfiguration slackPublisherConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(SLACK_EVENT_PUBLISHERS, slackPublisherConfiguration));
  }

  @PUT
  @Path("/activityFeedFilterSetting")
  @Operation(
      operationId = "createOrUpdateActivityFeedConfiguration",
      summary = "Update activity feed Setting",
      tags = "settings",
      description = "Update activity feed Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityFilter.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid List<EntityFilter> filter) {
    return settingsRepository.createOrUpdate(getSettings(ACTIVITY_FEED_FILTER_SETTING, filter));
  }

  @PUT
  @Path("/secretsManagerConfiguration")
  @Operation(
      operationId = "createOrUpdateSecretManagerConfiguration",
      summary = "Update Secret Manager Setting",
      tags = "settings",
      description = "Update Secret Manager Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecretsManagerConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid SecretsManagerConfiguration secretsManagerConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(SECRETS_MANAGER_CONFIGURATION, secretsManagerConfiguration));
  }

  @PUT
  @Path("/slackChat")
  @Operation(
      operationId = "createOrUpdateSlackChatConfiguration",
      summary = "Update Slack Chat Setting",
      tags = "settings",
      description = "Update Slack Chat Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SlackChatConfiguration.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid SlackChatConfiguration slackChatConfiguration) {
    return settingsRepository.createOrUpdate(getSettings(SLACK_CHAT, slackChatConfiguration));
  }

  @POST
  @Path("/filter/add")
  @Operation(
      operationId = "addNewFilter",
      summary = "Add new Filter",
      tags = "settings",
      description = "Add New Filter",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityFilter.class)))
      })
  public Response createNewFilter(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid List<EntityFilter> newFilter) {
    return settingsRepository.addNewFilter(newFilter);
  }

  @PUT
  @Path("/filter/{entityName}/add")
  @Operation(
      operationId = "createOrUpdateEntityFilter",
      summary = "Create or Add new Filter",
      tags = "settings",
      description = "Add New Filter",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EventFilter.class)))
      })
  public Response createOrUpdateEntityFilter(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity Name for Filter to Update", schema = @Schema(type = "string"))
          @PathParam("entityName")
          String entityName,
      @Valid List<EventFilter> newFilter) {
    return settingsRepository.addNewFilterToEntity(entityName, newFilter);
  }

  @PATCH
  @Path("/{settingName}")
  @Operation(
      operationId = "patchSetting",
      summary = "Patch a Setting",
      tags = "settings",
      description = "Update an existing Setting using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Key of the Setting", schema = @Schema(type = "string")) @PathParam("settingName")
          String settingName,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    return settingsRepository.patchSetting(settingName, patch);
  }

  private Settings getSettings(SettingsType configType, Object configValue) {
    return new Settings().withConfigType(configType).withConfigValue(configValue);
  }
}
