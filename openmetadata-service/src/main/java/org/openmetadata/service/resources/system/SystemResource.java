package org.openmetadata.service.resources.system;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.LINEAGE_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.SEARCH_SETTINGS;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
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
import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.auth.EmailRequest;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.ValidationResponse;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.email.EmailUtil;

@Path("/v1/system")
@Tag(name = "System", description = "APIs related to System configuration and settings.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "system")
@Slf4j
public class SystemResource {
  public static final String COLLECTION_PATH = "/v1/system";
  private final SystemRepository systemRepository;
  private final Authorizer authorizer;
  private OpenMetadataApplicationConfig applicationConfig;
  private PipelineServiceClientInterface pipelineServiceClient;
  private JwtFilter jwtFilter;
  private SearchSettings defaultSearchSettingsCache = new SearchSettings();
  private SearchSettingsHandler searchSettingsHandler = new SearchSettingsHandler();
  private boolean isNlqEnabled = false;

  public SystemResource(Authorizer authorizer) {
    this.systemRepository = Entity.getSystemRepository();
    this.authorizer = authorizer;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.applicationConfig = config;
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());

    this.jwtFilter =
        new JwtFilter(
            SecurityConfigurationManager.getInstance().getCurrentAuthConfig(),
            SecurityConfigurationManager.getInstance().getCurrentAuthzConfig());
    this.isNlqEnabled =
        config.getElasticSearchConfiguration().getNaturalLanguageSearch() != null
            ? config.getElasticSearchConfiguration().getNaturalLanguageSearch().getEnabled()
            : false;
  }

  public static class SettingsList extends ResultList<Settings> {
    /* Required for serde */
  }

  public SearchSettings readDefaultSearchSettings() {
    if (defaultSearchSettingsCache != null) {
      try {
        List<String> jsonDataFiles =
            EntityUtil.getJsonDataResources(".*json/data/searchSettings/searchSettings.json$");
        if (!jsonDataFiles.isEmpty()) {
          String json =
              CommonUtil.getResourceAsStream(
                  EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
          defaultSearchSettingsCache = JsonUtils.readValue(json, SearchSettings.class);
        } else {
          throw new IllegalArgumentException("Default search settings file not found.");
        }
      } catch (IOException e) {
        LOG.error("Failed to read default search settings. Message: {}", e.getMessage(), e);
      }
    }
    return defaultSearchSettingsCache;
  }

  public SearchSettings loadDefaultSearchSettings(boolean force) {
    SearchSettings searchSettings = readDefaultSearchSettings();
    if (!force) {
      Settings existingSettings =
          systemRepository.getConfigWithKey(String.valueOf(SEARCH_SETTINGS));
      if (existingSettings != null && existingSettings.getConfigValue() != null) {
        SearchSettings existingSearchSettings = (SearchSettings) existingSettings.getConfigValue();
        if (existingSearchSettings.getGlobalSettings() != null) {
          return searchSettings;
        }
      }
    }
    Settings settings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchSettings);
    systemRepository.createOrUpdate(settings);
    LOG.info("Default searchSettings loaded successfully.");
    return searchSettings;
  }

  @GET
  @Path("/settings")
  @Operation(
      operationId = "listSettings",
      summary = "List all settings",
      description = "Get a list of all OpenMetadata settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SettingsList.class)))
      })
  public ResultList<Settings> list(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    return systemRepository.listAllConfigs();
  }

  @GET
  @Path("/settings/{name}")
  @Operation(
      operationId = "getSetting",
      summary = "Get a setting",
      description = "Get a OpenMetadata Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Settings getSettingByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the setting", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    if (!name.equalsIgnoreCase(LINEAGE_SETTINGS.toString())) {
      authorizer.authorizeAdmin(securityContext);
    }
    return systemRepository.getConfigWithKey(name);
  }

  @GET
  @Path("/search/nlq")
  @Operation(
      operationId = "",
      summary = "Check if Nlq is enabled in elastic search setting",
      description = "Check if Nlq is enabled in elastic search setting",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Boolean Nlq Service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Response checkSearchSettings(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return Response.ok().entity(isNlqEnabled).build();
  }

  @GET
  @Path("/settings/profilerConfiguration")
  @Operation(
      operationId = "getProfilerConfigurationSetting",
      summary = "Get profiler configuration setting",
      description = "Get a profiler configuration Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Settings getProfilerConfigurationSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which to get the global profiler configuration",
              schema = @Schema(type = "string"))
          @QueryParam("entityType")
          @DefaultValue("table")
          String entityType) {
    ResourceContext resourceContext = new ResourceContext(entityType);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_PROFILER_GLOBAL_CONFIGURATION);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return systemRepository.getConfigWithKey(SettingsType.PROFILER_CONFIGURATION.value());
  }

  @PUT
  @Path("/settings")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      description = "Update existing settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid Settings settingName) {
    authorizer.authorizeAdmin(securityContext);
    if (SettingsType.SEARCH_SETTINGS
        .value()
        .equalsIgnoreCase(settingName.getConfigType().toString())) {
      SearchSettings defaultSearchSettings = loadDefaultSearchSettings(false);
      SearchSettings incomingSearchSettings =
          JsonUtils.convertValue(settingName.getConfigValue(), SearchSettings.class);
      searchSettingsHandler.validateGlobalSettings(incomingSearchSettings.getGlobalSettings());
      SearchSettings mergedSettings =
          searchSettingsHandler.mergeSearchSettings(defaultSearchSettings, incomingSearchSettings);
      settingName.setConfigValue(mergedSettings);
    }
    Response response = systemRepository.createOrUpdate(settingName);
    // Explicitly invalidate the cache to ensure latest settings are fetched
    SettingsCache.invalidateSettings(settingName.getConfigType().value());
    return response;
  }

  @PUT
  @Path("/settings/reset/{name}")
  @Operation(
      operationId = "resetSettingToDefault",
      summary = "Reset a setting to default",
      description = "Reset the specified setting to its default value.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings reset to default",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Response resetSettingToDefault(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the setting", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    authorizer.authorizeAdmin(securityContext);

    if (!SettingsType.SEARCH_SETTINGS.value().equalsIgnoreCase(name)) {
      throw new SystemSettingsException("Resetting of setting '" + name + "' is not supported.");
    }
    SearchSettings settings = loadDefaultSearchSettings(true);
    return Response.ok(settings).build();
  }

  @PUT
  @Path("/email/test")
  @Operation(
      operationId = "sendTestEmail",
      summary = "Sends a Test Email",
      description = "Sends a Test Email with Provided Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "EmailTest",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class)))
      })
  public Response sendTestEmail(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid EmailRequest emailRequest) {
    if (nullOrEmpty(emailRequest.getEmail())) {
      throw new IllegalArgumentException("Email address is required.");
    }

    authorizer.authorizeAdmin(securityContext);

    try {
      EmailUtil.testConnection();
      EmailUtil.sendTestEmail(emailRequest.getEmail(), false);
    } catch (Exception ex) {
      LOG.error("Failed in sending mail. Message: {}", ex.getMessage(), ex);
      throw new UnhandledServerException(ex.getMessage());
    }

    return Response.status(Response.Status.OK).entity("Test Email Sent Successfully.").build();
  }

  @PATCH
  @Path("/settings/{settingName}")
  @Operation(
      operationId = "patchSetting",
      summary = "Patch a setting",
      description = "Update an existing Setting using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Key of the Setting", schema = @Schema(type = "string"))
          @PathParam("settingName")
          String settingName,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    authorizer.authorizeAdmin(securityContext);
    return systemRepository.patchSetting(settingName, patch);
  }

  @GET
  @Path("/entities/count")
  @Operation(
      operationId = "listEntitiesCount",
      summary = "List all entities counts",
      description = "Get a list of all entities count",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Entities Count",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntitiesCount.class)))
      })
  public EntitiesCount listEntitiesCount(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return systemRepository.getAllEntitiesCount(filter);
  }

  @GET
  @Path("/services/count")
  @Operation(
      operationId = "listServicesCount",
      summary = "List all services counts",
      description = "Get a list of all entities count",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Services Count",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ServicesCount.class)))
      })
  public ServicesCount listServicesCount(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return systemRepository.getAllServicesCount(filter);
  }

  @GET
  @Path("/status")
  @Operation(
      operationId = "validateDeployment",
      summary = "Validate the OpenMetadata deployment",
      description =
          "Check connectivity against your database, elasticsearch/opensearch, migrations,...",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "validation OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ServicesCount.class)))
      })
  public ValidationResponse validate() {
    return systemRepository.validateSystem(applicationConfig, pipelineServiceClient, jwtFilter);
  }

  @GET
  @Path("/security/config")
  @Operation(
      operationId = "getSecurityConfig",
      summary = "Get complete security configuration",
      description = "Get both authentication and authorization configuration",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security Configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityConfiguration.class)))
      })
  public SecurityConfiguration getSecurityConfig(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    SecurityConfiguration config =
        SecurityConfigurationManager.getInstance().getCurrentSecurityConfig();

    // Apply password masking if needed
    if (authorizer.shouldMaskPasswords(securityContext)) {
      // Mask OIDC configuration if present
      if (config.getAuthenticationConfiguration() != null
          && config.getAuthenticationConfiguration().getOidcConfiguration() != null) {
        config
            .getAuthenticationConfiguration()
            .getOidcConfiguration()
            .setSecret(PasswordEntityMasker.PASSWORD_MASK);
      }

      // Mask LDAP configuration if present
      if (config.getAuthenticationConfiguration() != null
          && config.getAuthenticationConfiguration().getLdapConfiguration() != null) {
        config
            .getAuthenticationConfiguration()
            .getLdapConfiguration()
            .setDnAdminPassword(PasswordEntityMasker.PASSWORD_MASK);
      }
    }
    return config;
  }

  @PUT
  @Path("/security/config")
  @Operation(
      operationId = "updateSecurityConfig",
      summary = "Update complete security configuration",
      description = "Update both authentication and authorization configuration atomically",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Updated Security Configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityConfiguration.class)))
      })
  public Response updateSecurityConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid SecurityConfiguration securityConfig) {
    authorizer.authorizeAdmin(securityContext);

    try {
      // Update both configurations in a transaction
      Settings authSettings =
          new Settings()
              .withConfigType(AUTHENTICATION_CONFIGURATION)
              .withConfigValue(securityConfig.getAuthenticationConfiguration());

      Settings authzSettings =
          new Settings()
              .withConfigType(AUTHORIZER_CONFIGURATION)
              .withConfigValue(securityConfig.getAuthorizerConfiguration());

      // Save both to database
      systemRepository.createOrUpdate(authSettings);
      systemRepository.createOrUpdate(authzSettings);

      // Invalidate both caches
      SettingsCache.invalidateSettings(AUTHENTICATION_CONFIGURATION.toString());
      SettingsCache.invalidateSettings(AUTHORIZER_CONFIGURATION.toString());

      // Reload entire security system
      SecurityConfigurationManager.getInstance().reloadSecuritySystem();

      return Response.ok(securityConfig).build();
    } catch (Exception e) {
      LOG.error("Failed to update security configuration", e);
      throw new RuntimeException("Failed to update security configuration: " + e.getMessage());
    }
  }
}
